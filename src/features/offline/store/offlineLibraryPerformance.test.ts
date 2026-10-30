import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  useOfflineLibraryStore,
  getAllOfflineTracks,
  offlineApi,
  ingestScannedElectronFiles,
  resolveOfflineTrackPlaybackSource,
} from "./offlineLibraryStore";
import {
  useStudioStore,
  MATCH_TITLE_LYRICS_FONT_ID,
} from "@/features/studio/store/studioStore";

describe("Offline library low-spec streaming, whole-PC scan, and unranked imports", () => {
  beforeEach(() => {
    (window as any).linerElectron = {
      localMedia: {
        scanPcAudio: vi.fn(),
        readTagsBatch: vi.fn().mockResolvedValue([]),
      },
    };
    useOfflineLibraryStore.setState({
      customTracks: [],
      likedTracks: [],
      trackPlayCounts: {},
      playlists: [],
      autoScanPcOnLaunch: false,
      includeSampleTracks: false,
    });
    useStudioStore.setState({ customFonts: [] });
    useStudioStore.getState().resetTypography();
  });

  afterEach(() => {
    delete (window as any).linerElectron;
  });

  it("never ranks or marks imported tracks as played before listening", async () => {
    const imported = await ingestScannedElectronFiles([
      {
        name: "Track One.mp3",
        path: "D:\\My Songs\\Track One.mp3",
        size: 4_200_000,
        ext: ".mp3",
        folderPath: "D:\\My Songs",
        folderName: "My Songs",
      },
      {
        name: "Track Two.flac",
        path: "E:\\Archive\\Ethiopian Jazz\\Track Two.flac",
        size: 18_500_000,
        ext: ".flac",
        folderPath: "E:\\Archive\\Ethiopian Jazz",
        folderName: "Ethiopian Jazz",
      },
    ]);

    expect(imported).toHaveLength(2);

    const all = getAllOfflineTracks();
    expect(all).toHaveLength(2);
    expect(all.every((t) => t.playCount === 0)).toBe(true);

    // Unplayed tracks must NOT appear in popular/ranked tracks
    const beforeListen = await offlineApi.getPopularTracks("7d", 10);
    expect(beforeListen.items).toHaveLength(0);

    // After genuinely listening to one track, only that track appears in popular tracks
    const playedId = all[0].id;
    useOfflineLibraryStore.getState().incrementPlayCount(playedId);
    const popularAfterPlay = await offlineApi.getPopularTracks("7d", 10);
    expect(popularAfterPlay.items).toHaveLength(1);
    expect(popularAfterPlay.items[0].track.id).toBe(playedId);
  });

  it("preserves folder grouping across multiple drives and streams directly via liner-media://", async () => {
    await ingestScannedElectronFiles([
      {
        name: "Tizita.mp3",
        path: "F:\\Music\\Amharic Classics\\Tizita.mp3",
        size: 5_100_000,
        ext: ".mp3",
        folderPath: "F:\\Music\\Amharic Classics",
        folderName: "Amharic Classics",
      },
    ]);

    const tracks = useOfflineLibraryStore.getState().customTracks;
    expect(tracks).toHaveLength(1);
    expect(tracks[0].folderPath).toBe("F:\\Music\\Amharic Classics");
    expect(tracks[0].folderName).toBe("Amharic Classics");
    expect(tracks[0].coverUrl).toContain("liner-media://cover?path=");

    const source = await resolveOfflineTrackPlaybackSource(tracks[0].id);
    expect(source).not.toBeNull();
    expect(source?.kind).toBe("disk-url");
    if (source?.kind === "disk-url") {
      expect(source.url).toContain("liner-media://audio?path=");
    }
  });

  it("shares Music Title custom font with Lyrics verses by default and supports independent Lyrics font override", () => {
    expect(useStudioStore.getState().activeLyricsFontId).toBe(
      MATCH_TITLE_LYRICS_FONT_ID,
    );

    const fontId = "custom-font-abyssinica";
    useStudioStore.getState().addCustomFont({
      id: fontId,
      name: "Abyssinica Display",
      cssFamily: "'Abyssinica Display', serif",
      category: "serif",
      tags: ["custom"],
      description: "Imported custom font",
      source: "imported",
    });

    useStudioStore.getState().setLyricsFont(fontId);
    expect(useStudioStore.getState().activeLyricsFontId).toBe(fontId);

    // Removing the custom font resets activeLyricsFontId back to match-title safely
    useStudioStore.getState().removeCustomFont(fontId);
    expect(useStudioStore.getState().activeLyricsFontId).toBe(
      MATCH_TITLE_LYRICS_FONT_ID,
    );
  });
});
