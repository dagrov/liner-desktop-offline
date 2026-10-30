import { describe, it, expect, beforeEach, vi } from "vitest";
import { mediaUrl } from "@/shared/api/api";
import { SAMPLE_TRACKS, VINYL_COVER_DATA_URL } from "./lib/sampleLibrary";
import { synthesizeSampleTrackWav } from "./lib/synthAudioGenerator";
import {
  generateProceduralTrackCover,
  inferFromFilename,
  parseId3v2FromBytes,
} from "./lib/audioMetadataParser";
import {
  getAllOfflineTracks,
  isOfflineTrackId,
  offlineApi,
  scanPcForAudio,
  useOfflineLibraryStore,
} from "./store/offlineLibraryStore";

describe("Offline Library & Audio Pipeline", () => {
  beforeEach(() => {
    useOfflineLibraryStore.setState({
      seededDefaults: false,
      includeSampleTracks: true,
      customTracks: [],
      trackCoverOverrides: {},
      playlists: [],
      likedTracks: [],
    });
    useOfflineLibraryStore.getState().ensureSeeded();
  });

  it("seeds curated offline sample tracks with SVG covers, LRC lyrics, and liner notes", () => {
    const tracks = getAllOfflineTracks();
    expect(tracks.length).toBeGreaterThanOrEqual(6);
    expect(SAMPLE_TRACKS[0].coverUrl.startsWith("data:image/svg+xml")).toBe(
      true,
    );
    expect(SAMPLE_TRACKS[0].lrcLyrics).toContain("[00:");
    expect(isOfflineTrackId(SAMPLE_TRACKS[0].id)).toBe(true);
  });

  it("synthesizes valid stereo RIFF/WAVE PCM audio blobs offline", async () => {
    const blob = synthesizeSampleTrackWav("ambient", 2);
    expect(blob.type).toBe("audio/wav");
    expect(blob.size).toBeGreaterThan(44);
    const buf = new Uint8Array(await blob.arrayBuffer());
    const riff = String.fromCharCode(buf[0], buf[1], buf[2], buf[3]);
    const wave = String.fromCharCode(buf[8], buf[9], buf[10], buf[11]);
    expect(riff).toBe("RIFF");
    expect(wave).toBe("WAVE");
  });

  it("parses artist and title cleanly from filenames and ID3v2 headers", () => {
    const inferred = inferFromFilename("03 - Boards of Canada - Olson.flac");
    expect(inferred.artists).toBe("Boards of Canada");
    expect(inferred.title).toBe("Olson");

    // Minimal ID3v2.3 header with TIT2 ("Velvet Sky")
    const titleBytes = new TextEncoder().encode("Velvet Sky");
    const frameSize = 1 + titleBytes.length;
    const tagSize = 10 + frameSize;
    const raw = new Uint8Array(10 + tagSize);
    raw.set([0x49, 0x44, 0x33, 0x03, 0x00, 0x00], 0); // "ID3" v2.3
    raw[6] = 0;
    raw[7] = 0;
    raw[8] = (tagSize >> 7) & 0x7f;
    raw[9] = tagSize & 0x7f;
    // Frame "TIT2"
    raw.set([0x54, 0x49, 0x54, 0x32], 10);
    raw[14] = 0;
    raw[15] = 0;
    raw[16] = 0;
    raw[17] = frameSize;
    raw[18] = 0;
    raw[19] = 0;
    raw[20] = 0x03; // UTF-8
    raw.set(titleBytes, 21);

    const parsed = parseId3v2FromBytes(raw);
    expect(parsed.title).toBe("Velvet Sky");
  });

  it("passes data:, blob:, and file: URLs through mediaUrl untouched", () => {
    const dataUri = "data:image/svg+xml;utf8,<svg></svg>";
    const blobUri = "blob:http://localhost:5173/abc-123";
    const fileUri = "file:///Users/demo/cover.png";
    expect(mediaUrl(dataUri)).toBe(dataUri);
    expect(mediaUrl(blobUri)).toBe(blobUri);
    expect(mediaUrl(fileUri)).toBe(fileUri);
  });

  it("starts completely empty when no user audio has been uploaded yet and uses Vinyl fallback cover", async () => {
    useOfflineLibraryStore.setState({
      seededDefaults: false,
      includeSampleTracks: false,
      customTracks: [],
      playlists: [],
      likedTracks: [],
    });
    useOfflineLibraryStore.getState().ensureSeeded();

    expect(getAllOfflineTracks()).toEqual([]);
    const mixes = await offlineApi.getDailyMixes();
    expect(mixes.items).toEqual([]);
    expect(generateProceduralTrackCover("Any Track")).toBe(VINYL_COVER_DATA_URL);
  });

  it("scans PC audio directories via Electron bridge and imports discovered tracks", async () => {
    useOfflineLibraryStore.setState({
      seededDefaults: true,
      includeSampleTracks: false,
      customTracks: [],
    });

    (window as any).linerElectron = {
      localMedia: {
        scanPcAudio: vi.fn().mockResolvedValue({
          scannedDirs: ["/Users/demo/Music"],
          files: [
            {
              path: "/Users/demo/Music/Mulatu Astatke - Tezeta.mp3",
              name: "Mulatu Astatke - Tezeta.mp3",
              ext: ".mp3",
              size: 4_800_000,
              mtimeMs: Date.now(),
            },
          ],
        }),
        readFileHead: vi.fn().mockResolvedValue({
          path: "/Users/demo/Music/Mulatu Astatke - Tezeta.mp3",
          name: "Mulatu Astatke - Tezeta.mp3",
          mimeType: "audio/mpeg",
          bytes: new Uint8Array(64),
        }),
        readFile: vi.fn(),
        scanDirectory: vi.fn().mockResolvedValue([]),
      },
    };

    const result = await scanPcForAudio();
    expect(result.newlyImported).toBe(1);
    const tracks = getAllOfflineTracks();
    expect(tracks).toHaveLength(1);
    expect(tracks[0].artists).toBe("Mulatu Astatke");
    expect(tracks[0].title).toBe("Tezeta");
    expect(tracks[0].coverUrl).toBe(
      `liner-media://cover?path=${encodeURIComponent("/Users/demo/Music/Mulatu Astatke - Tezeta.mp3")}`,
    );

    delete (window as any).linerElectron;
  });

  it("serves offline search, daily mixes, and liked track mutations", async () => {
    const searchRes = await offlineApi.search("Midnight", "track");
    expect(searchRes.items.length).toBeGreaterThan(0);

    const mixes = await offlineApi.getDailyMixes();
    expect(mixes.items.length).toBeGreaterThanOrEqual(2);

    const targetId = SAMPLE_TRACKS[0].id;
    await offlineApi.likeTrack(targetId);
    const liked = await offlineApi.listLikedTracks();
    expect(liked.items.some((i) => i.track.id === targetId)).toBe(true);
  });
});
