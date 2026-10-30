import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { debouncedStorage } from "@/shared/utils/storage";
import { linerDb } from "@/shared/storage";
import { queryCache } from "@/shared/cache/queryCache";
import type {
  ApiAlbumDetails,
  ApiArtistDetails,
  ApiCatalogPlaylistDetails,
  ApiLikedTracksPage,
  ApiSearchItem,
  ApiTrack,
  ApiTrackDetails,
  ApiUserPlaylist,
  ApiUserPlaylistItem,
  DailyMixesResponse,
  LyricsStreamEvent,
  MostSavedResponse,
  MostSavedType,
  PlaybackHistoryItem,
  PlaybackHistoryResponse,
  PopularAlbumsResponse,
  PopularTimeWindow,
  PopularTracksResponse,
  RadioResponse,
  RecordPlaybackEventRequest,
  SearchResponse,
  SearchType,
} from "@/shared/contracts";
import type { Track as ClientTrack } from "@/shared/types";
import { SAMPLE_TRACKS, type SampleTrackEntry } from "../lib/sampleLibrary";
import {
  synthesizeSampleTrackWav,
  type SynthPreset,
} from "../lib/synthAudioGenerator";
import {
  extractAudioMetadata,
  inferFromFilename,
} from "../lib/audioMetadataParser";
import {
  buildCustomLyricsCandidate,
  normalizeLyricsInput,
  type StoredLyricsFormat,
} from "../lib/customLyricsUtils";
import { parseRawLyrics } from "@/features/lyrics/engine/lyricsParser";
import { lyricsCache } from "@/features/lyrics/store/lyricsCache";
import { useLyricsStore } from "@/features/lyrics/store/lyricsStore";
import { usePlayerStore } from "@/features/player/store/playerStore";

export interface OfflineTrackRecord {
  id: string;
  title: string;
  artists: string;
  artistId: string;
  albumTitle: string;
  albumId: string;
  coverUrl: string;
  originalCoverUrl: string;
  durationMs: number;
  releaseDate?: string;
  genre: string;
  moods: string[];
  vibeTags: string[];
  recommendedFontCategory?: "sans" | "serif" | "mono" | "retro";
  bpm?: number;
  curatorFact?: string;
  albumLinerNotes?: string;
  artistBio?: string;
  lrcLyrics?: string;
  playCount: number;
  source: "sample" | "local";
  synthPreset?: SynthPreset;
  localFilePath?: string;
  folderPath?: string;
  folderName?: string;
  mimeType?: string;
  addedAt: string;
}

export interface OfflinePlaylistRecord {
  id: string;
  title: string;
  description?: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  revision: number;
  items: {
    id: string;
    trackId: string;
    addedAt: string;
  }[];
}

export interface SavedCollectionRecord {
  id: string;
  type: "albums" | "artists" | "playlists";
  savedAt: string;
  snapshot?: Record<string, unknown>;
}

export interface TrackLyricsOverride {
  content: string;
  format: StoredLyricsFormat;
  updatedAt: string;
}

interface OfflineLibraryState {
  customTracks: OfflineTrackRecord[];
  trackCoverOverrides: Record<string, string>;
  trackLyricsOverrides: Record<string, TrackLyricsOverride>;
  albumCoverOverrides: Record<string, string>;
  trackPlayCounts: Record<string, number>;
  likedTracks: { trackId: string; likedAt: string }[];
  playlists: OfflinePlaylistRecord[];
  savedCollections: SavedCollectionRecord[];
  history: PlaybackHistoryItem[];
  syncedMusicFolder: string | null;
  includeSampleTracks: boolean;
  autoScanPcOnLaunch: boolean;
  isScanningPc: boolean;
  lyricsEditorTrackId: string | null;
  seededDefaults: boolean;

  ensureSeeded: () => void;
  setIncludeSampleTracks: (enabled: boolean) => void;
  setAutoScanPcOnLaunch: (enabled: boolean) => void;
  setSyncedMusicFolder: (folder: string | null) => void;
  openLyricsEditor: (trackId: string) => void;
  closeLyricsEditor: () => void;
  addOrUpdateCustomTracks: (tracks: OfflineTrackRecord[]) => void;
  removeCustomTrack: (trackId: string) => void;
  setTrackCoverUrl: (trackId: string, coverUrl: string | null) => void;
  setAlbumCoverUrl: (albumId: string, coverUrl: string | null) => void;
  incrementPlayCount: (trackId: string) => void;
}

let offlineModeActive = false;

export function isOfflineModeActive(): boolean {
  return offlineModeActive;
}

export function setOfflineModeActive(active: boolean): void {
  offlineModeActive = active;
}

export function isOfflineTrackId(id: string): boolean {
  return id.startsWith("sample:") || id.startsWith("local:");
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "unknown"
  );
}

function sampleEntryToOfflineRecord(
  entry: SampleTrackEntry,
): OfflineTrackRecord {
  return {
    id: entry.id,
    title: entry.title,
    artists: entry.artistName,
    artistId: entry.artistId,
    albumTitle: entry.albumTitle,
    albumId: entry.albumId,
    coverUrl: entry.coverUrl,
    originalCoverUrl: entry.coverUrl,
    durationMs: entry.durationMs,
    releaseDate: entry.releaseDate,
    genre: entry.genre,
    moods: entry.moods,
    vibeTags: entry.vibeTags,
    recommendedFontCategory: entry.recommendedFontCategory,
    bpm: entry.bpm,
    curatorFact: entry.curatorFact,
    albumLinerNotes: entry.albumLinerNotes,
    artistBio: entry.artistBio,
    lrcLyrics: entry.lrcLyrics,
    playCount: entry.playCount,
    source: "sample",
    synthPreset: entry.synthPreset,
    addedAt: `${entry.releaseDate}T12:00:00.000Z`,
  };
}

function createStarterPlaylists(): OfflinePlaylistRecord[] {
  const now = "2026-10-01T18:00:00.000Z";
  return [
    {
      id: "playlist:late-night-architecture",
      title: "Late Night Architecture",
      description:
        "Nocturnal ambient, neo-classical strings, and quiet study textures.",
      isPublic: false,
      createdAt: now,
      updatedAt: now,
      revision: 1,
      items: [
        { id: "item-1", trackId: "sample:midnight-glass", addedAt: now },
        { id: "item-2", trackId: "sample:solaris-drift", addedAt: now },
        { id: "item-3", trackId: "sample:paper-lanterns", addedAt: now },
        { id: "item-4", trackId: "sample:rain-on-cedar", addedAt: now },
      ],
    },
    {
      id: "playlist:analog-horizon",
      title: "Analog Horizon",
      description:
        "Warm tape synthwave, nu-disco basslines, and coastal night drives.",
      isPublic: false,
      createdAt: now,
      updatedAt: now,
      revision: 1,
      items: [
        { id: "item-5", trackId: "sample:velvet-static", addedAt: now },
        { id: "item-6", trackId: "sample:chrome-boulevard", addedAt: now },
        { id: "item-7", trackId: "sample:midnight-glass", addedAt: now },
      ],
    },
  ];
}

export const useOfflineLibraryStore = create<OfflineLibraryState>()(
  persist(
    (set, get) => ({
      customTracks: [],
      trackCoverOverrides: {},
      trackLyricsOverrides: {},
      albumCoverOverrides: {},
      trackPlayCounts: {},
      likedTracks: [],
      playlists: [],
      savedCollections: [],
      history: [],
      syncedMusicFolder: null,
      includeSampleTracks: false,
      autoScanPcOnLaunch: false,
      isScanningPc: false,
      lyricsEditorTrackId: null,
      seededDefaults: false,

      ensureSeeded: () => {
        const state = get();
        if (state.seededDefaults) return;
        set({
          seededDefaults: true,
          playlists:
            state.playlists.length > 0
              ? state.playlists
              : state.includeSampleTracks
                ? createStarterPlaylists()
                : [],
          likedTracks:
            state.likedTracks.length > 0
              ? state.likedTracks
              : state.includeSampleTracks
                ? [
                    {
                      trackId: "sample:midnight-glass",
                      likedAt: "2026-10-10T20:00:00.000Z",
                    },
                    {
                      trackId: "sample:velvet-static",
                      likedAt: "2026-10-11T20:00:00.000Z",
                    },
                  ]
                : [],
        });
      },

      setIncludeSampleTracks: (enabled) => {
        set({ includeSampleTracks: enabled });
        queryCache.clear();
        notifyOfflineLibraryChanged();
      },

      setAutoScanPcOnLaunch: (enabled) => {
        set({ autoScanPcOnLaunch: enabled });
      },

      setSyncedMusicFolder: (folder) => set({ syncedMusicFolder: folder }),

      openLyricsEditor: (trackId) => set({ lyricsEditorTrackId: trackId }),
      closeLyricsEditor: () => set({ lyricsEditorTrackId: null }),

      addOrUpdateCustomTracks: (incoming) => {
        if (incoming.length === 0) return;
        set((state) => {
          const map = new Map(state.customTracks.map((t) => [t.id, t]));
          for (const track of incoming) {
            const existing = map.get(track.id);
            map.set(track.id, existing ? { ...existing, ...track } : track);
          }
          return { customTracks: Array.from(map.values()) };
        });
        notifyOfflineLibraryChanged();
      },

      removeCustomTrack: (trackId) => {
        set((state) => ({
          customTracks: state.customTracks.filter((t) => t.id !== trackId),
          likedTracks: state.likedTracks.filter((l) => l.trackId !== trackId),
          playlists: state.playlists.map((pl) => ({
            ...pl,
            items: pl.items.filter((i) => i.trackId !== trackId),
          })),
        }));
        void linerDb.deleteAudio(trackId);
        notifyOfflineLibraryChanged();
      },

      setTrackCoverUrl: (trackId, coverUrl) => {
        set((state) => {
          const next = { ...state.trackCoverOverrides };
          if (coverUrl) next[trackId] = coverUrl;
          else delete next[trackId];
          return { trackCoverOverrides: next };
        });
        queryCache.clear();
        notifyOfflineLibraryChanged();
      },

      setAlbumCoverUrl: (albumId, coverUrl) => {
        set((state) => {
          const next = { ...state.albumCoverOverrides };
          if (coverUrl) next[albumId] = coverUrl;
          else delete next[albumId];
          return { albumCoverOverrides: next };
        });
        queryCache.clear();
        notifyOfflineLibraryChanged();
      },

      incrementPlayCount: (trackId) => {
        set((state) => ({
          trackPlayCounts: {
            ...state.trackPlayCounts,
            [trackId]: (state.trackPlayCounts[trackId] ?? 0) + 1,
          },
        }));
      },
    }),
    {
      name: "liner_offline_library_v2",
      storage: createJSONStorage(() => debouncedStorage),
      partialize: (state) => ({
        customTracks: state.customTracks,
        trackCoverOverrides: state.trackCoverOverrides,
        trackLyricsOverrides: state.trackLyricsOverrides,
        albumCoverOverrides: state.albumCoverOverrides,
        trackPlayCounts: state.trackPlayCounts,
        likedTracks: state.likedTracks,
        playlists: state.playlists,
        savedCollections: state.savedCollections,
        history: state.history,
        syncedMusicFolder: state.syncedMusicFolder,
        includeSampleTracks: state.includeSampleTracks,
        autoScanPcOnLaunch: state.autoScanPcOnLaunch,
        seededDefaults: state.seededDefaults,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const isElectron =
          typeof window !== "undefined" &&
          Boolean(window.linerElectron?.localMedia);
        let mutated = false;
        const cleaned = state.customTracks.map((track) => {
          let next = track;
          // Populate folderPath / folderName from localFilePath if missing
          if (next.localFilePath && (!next.folderPath || !next.folderName)) {
            const parts = next.localFilePath.split(/[\\/]/);
            parts.pop();
            const fp = parts.join(next.localFilePath.includes("\\") ? "\\" : "/");
            const fn = parts[parts.length - 1] || fp || "Local Folder";
            next = { ...next, folderPath: fp, folderName: fn };
            mutated = true;
          }
          // Strip huge legacy base64 covers out of localStorage to prevent quota drops & UI lag
          if (
            next.originalCoverUrl &&
            next.originalCoverUrl.startsWith("data:image/") &&
            !next.originalCoverUrl.startsWith("data:image/svg+xml") &&
            next.originalCoverUrl.length > 8192
          ) {
            const diskCover =
              isElectron && next.localFilePath
                ? `liner-media://cover?path=${encodeURIComponent(next.localFilePath)}`
                : SAMPLE_TRACKS[0]?.coverUrl || "";
            next = {
              ...next,
              coverUrl: diskCover,
              originalCoverUrl: diskCover,
            };
            mutated = true;
          }
          return next;
        });
        if (mutated) {
          state.customTracks = cleaned;
        }
      },
    },
  ),
);

export function notifyOfflineLibraryChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("library:changed"));
    window.dispatchEvent(new Event("offline-catalog:changed"));
  }
}

export function getAllOfflineTracks(): OfflineTrackRecord[] {
  const state = useOfflineLibraryStore.getState();
  const baseSamples = state.includeSampleTracks
    ? SAMPLE_TRACKS.map(sampleEntryToOfflineRecord)
    : [];
  const all = [...state.customTracks, ...baseSamples];

  return all.map((track) => {
    const coverOverride =
      state.trackCoverOverrides[track.id] ||
      state.albumCoverOverrides[track.albumId];
    const extraPlays = state.trackPlayCounts[track.id] ?? 0;
    return {
      ...track,
      coverUrl: coverOverride || track.originalCoverUrl || track.coverUrl,
      // Local tracks ALWAYS start at 0 plays until the user genuinely plays them
      playCount: track.source === "local" ? extraPlays : track.playCount + extraPlays,
    };
  });
}

export function getOfflineTrackById(
  trackId: string,
): OfflineTrackRecord | undefined {
  return getAllOfflineTracks().find((t) => t.id === trackId);
}

function makeCover(url: string) {
  return { url, width: 1000, height: 1000 };
}

export function toApiTrackFromOffline(record: OfflineTrackRecord): ApiTrack {
  return {
    id: record.id,
    title: record.title,
    artists: [{ id: record.artistId, name: record.artists }],
    album: { id: record.albumId, title: record.albumTitle },
    durationMs: record.durationMs,
    cover: makeCover(record.coverUrl),
    explicit: false,
  };
}

export function toClientTrackFromOffline(
  record: OfflineTrackRecord,
): ClientTrack {
  return {
    id: record.id,
    title: record.title,
    artists: record.artists,
    artistId: record.artistId,
    artistList: [{ id: record.artistId, name: record.artists }],
    coverUrl: record.coverUrl,
    durationMs: record.durationMs,
    playCount: record.playCount,
    releaseDate: record.releaseDate,
    album: {
      id: record.albumId,
      title: record.albumTitle,
    },
  };
}

export async function importLocalAudioBlobs(
  entries: {
    file: Blob;
    name: string;
    localFilePath?: string;
    folderName?: string;
    folderPath?: string;
  }[],
): Promise<OfflineTrackRecord[]> {
  const imported: OfflineTrackRecord[] = [];
  for (const entry of entries) {
    const meta = await extractAudioMetadata(entry.file, entry.name);
    const artistSlug = slugify(meta.artists);
    const albumTitle = meta.albumTitle || entry.folderName || "Imported Music";
    const albumSlug = slugify(`${meta.artists}-${albumTitle}`);
    const idSeed = entry.localFilePath
      ? `local:${slugify(entry.localFilePath)}`
      : `local:${slugify(`${meta.artists}-${meta.title}-${entry.file.size}`)}`;

    const mimeType = entry.file.type || "audio/mpeg";
    if (!entry.localFilePath) {
      await linerDb.putAudio(idSeed, entry.file, mimeType);
    }

    // Avoid saving multi-megabyte base64 raster covers inside localStorage
    const safeCoverUrl =
      entry.localFilePath &&
      typeof window !== "undefined" &&
      window.linerElectron?.localMedia
        ? `liner-media://cover?path=${encodeURIComponent(entry.localFilePath)}`
        : meta.coverUrl.length > 48_000 &&
            !meta.coverUrl.startsWith("data:image/svg+xml")
          ? SAMPLE_TRACKS[0]?.coverUrl || meta.coverUrl
          : meta.coverUrl;

    const relPath = (entry.file as any)?.webkitRelativePath as
      | string
      | undefined;
    const relFolder =
      relPath && relPath.includes("/")
        ? relPath.split("/").slice(0, -1).join("/")
        : undefined;
    const folderName =
      entry.folderName ||
      (relFolder ? relFolder.split("/").pop() : undefined) ||
      "Imported Files";
    const folderPath = entry.folderPath || relFolder || "Imported Files";

    const record: OfflineTrackRecord = {
      id: idSeed,
      title: meta.title,
      artists: meta.artists,
      artistId: `artist:${artistSlug}`,
      albumTitle,
      albumId: `album:${albumSlug}`,
      coverUrl: safeCoverUrl,
      originalCoverUrl: safeCoverUrl,
      durationMs: meta.durationMs,
      releaseDate: meta.year ? `${meta.year}-01-01` : undefined,
      genre: meta.genre || "Local Audio",
      moods: ["local", ...(meta.genre ? [meta.genre.toLowerCase()] : [])],
      vibeTags: ["clean", "modern", ...(meta.genre ? [meta.genre.toLowerCase()] : [])],
      playCount: 0,
      source: "local",
      localFilePath: entry.localFilePath,
      folderPath,
      folderName,
      mimeType,
      addedAt: new Date().toISOString(),
    };
    await linerDb.putTrack(toClientTrackFromOffline(record));
    imported.push(record);
  }

  useOfflineLibraryStore.getState().addOrUpdateCustomTracks(imported);
  queryCache.clear();
  return imported;
}

const MIME_BY_AUDIO_EXT: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".flac": "audio/flac",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".opus": "audio/opus",
  ".webm": "audio/webm",
};

function enrichScannedTracksInBackground(
  records: OfflineTrackRecord[],
): void {
  const bridge =
    typeof window !== "undefined" ? window.linerElectron?.localMedia : undefined;
  if (!bridge?.readTagsBatch || records.length === 0) return;

  void (async () => {
    const BATCH_SIZE = 35;
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const slice = records.slice(i, i + BATCH_SIZE);
      const paths = slice
        .map((r) => r.localFilePath)
        .filter((p): p is string => Boolean(p));
      if (paths.length === 0) continue;

      const tagsList = await bridge.readTagsBatch(paths).catch(() => []);
      const updates: OfflineTrackRecord[] = [];
      const tagByPath = new Map(tagsList.map((t) => [t.path, t]));

      for (const rec of slice) {
        if (!rec.localFilePath) continue;
        const tag = tagByPath.get(rec.localFilePath);
        let sidecarLrc = rec.lrcLyrics;
        if (!sidecarLrc && bridge.readSidecarLyrics) {
          const sidecar = await bridge
            .readSidecarLyrics(rec.localFilePath)
            .catch(() => null);
          if (sidecar?.content) {
            sidecarLrc = normalizeLyricsInput(
              sidecar.content,
              sidecar.fileName,
            ).content;
          }
        }

        if (
          tag?.title ||
          tag?.artists ||
          tag?.albumTitle ||
          tag?.genre ||
          tag?.year ||
          sidecarLrc
        ) {
          const artists = tag?.artists || rec.artists;
          const albumTitle = tag?.albumTitle || rec.albumTitle;
          updates.push({
            ...rec,
            title: tag?.title || rec.title,
            artists,
            artistId: `artist:${slugify(artists)}`,
            albumTitle,
            albumId: `album:${slugify(`${artists}-${albumTitle}`)}`,
            genre: tag?.genre || rec.genre,
            releaseDate: tag?.year ? `${tag.year}-01-01` : rec.releaseDate,
            lrcLyrics: sidecarLrc,
          });
        }
      }

      if (updates.length > 0) {
        useOfflineLibraryStore.getState().addOrUpdateCustomTracks(updates);
        queryCache.clear();
      }
      // Gentle pause between batches so spinning 500GB HDDs never lag the system
      await new Promise<void>((r) => setTimeout(r, 150));
    }
  })();
}

export async function ingestScannedElectronFiles(
  scanned: {
    path: string;
    name: string;
    size: number;
    ext?: string;
    folderPath?: string;
    folderName?: string;
  }[],
): Promise<OfflineTrackRecord[]> {
  const bridge =
    typeof window !== "undefined" ? window.linerElectron?.localMedia : undefined;
  if (!bridge || scanned.length === 0) return [];

  const existingPaths = new Set(
    useOfflineLibraryStore
      .getState()
      .customTracks.map((t) => (t.localFilePath ? t.localFilePath.toLowerCase() : ""))
      .filter(Boolean),
  );

  const imported: OfflineTrackRecord[] = [];
  const nowIso = new Date().toISOString();

  for (const fileInfo of scanned) {
    const lowerPath = fileInfo.path.toLowerCase();
    if (existingPaths.has(lowerPath)) continue;

    const inferred = inferFromFilename(fileInfo.name);
    const parts = fileInfo.path.split(/[\\/]/);
    parts.pop();
    const folderPath =
      fileInfo.folderPath ||
      parts.join(fileInfo.path.includes("\\") ? "\\" : "/");
    const folderName =
      fileInfo.folderName || parts[parts.length - 1] || "Local Folder";

    const artistSlug = slugify(inferred.artists);
    const albumTitle = folderName || "Local Music";
    const albumSlug = slugify(`${inferred.artists}-${albumTitle}`);
    const idSeed = `local:${slugify(fileInfo.path)}`;
    const ext =
      fileInfo.ext ||
      (fileInfo.name.includes(".")
        ? `.${fileInfo.name.split(".").pop()!.toLowerCase()}`
        : ".mp3");
    const diskCoverUrl = `liner-media://cover?path=${encodeURIComponent(fileInfo.path)}`;
    const estimatedDurationMs = Math.max(
      15_000,
      Math.min(1_200_000, Math.round((fileInfo.size / 24_000) * 1000)),
    );

    const record: OfflineTrackRecord = {
      id: idSeed,
      title: inferred.title,
      artists: inferred.artists,
      artistId: `artist:${artistSlug}`,
      albumTitle,
      albumId: `album:${albumSlug}`,
      coverUrl: diskCoverUrl,
      originalCoverUrl: diskCoverUrl,
      durationMs: estimatedDurationMs,
      genre: "Local Audio",
      moods: ["local"],
      vibeTags: ["clean", "modern"],
      playCount: 0,
      source: "local",
      localFilePath: fileInfo.path,
      folderPath,
      folderName,
      mimeType: MIME_BY_AUDIO_EXT[ext] || "audio/mpeg",
      addedAt: nowIso,
    };

    imported.push(record);
    existingPaths.add(lowerPath);
  }

  if (imported.length > 0) {
    useOfflineLibraryStore.getState().addOrUpdateCustomTracks(imported);
    queryCache.clear();
    enrichScannedTracksInBackground(imported);
  }
  return imported;
}

export async function syncElectronMusicDirectory(
  dirPath: string,
): Promise<number> {
  const bridge =
    typeof window !== "undefined" ? window.linerElectron?.localMedia : undefined;
  if (!bridge) return 0;

  const scanned = await bridge.scanDirectory(dirPath, "music");
  const imported = await ingestScannedElectronFiles(scanned);
  useOfflineLibraryStore.getState().setSyncedMusicFolder(dirPath);
  void bridge.watchDirectory(dirPath, "music");
  return imported.length;
}

let inFlightPcScan: Promise<{
  scannedDirs: string[];
  totalFound: number;
  newlyImported: number;
}> | null = null;

export async function scanPcForAudio(): Promise<{
  scannedDirs: string[];
  totalFound: number;
  newlyImported: number;
}> {
  if (inFlightPcScan) return inFlightPcScan;

  const bridge =
    typeof window !== "undefined" ? window.linerElectron?.localMedia : undefined;
  if (!bridge?.scanPcAudio) {
    return { scannedDirs: [], totalFound: 0, newlyImported: 0 };
  }

  inFlightPcScan = (async () => {
    useOfflineLibraryStore.setState({ isScanningPc: true });
    try {
      const { scannedDirs, files } = await bridge.scanPcAudio();
      const syncedDir = useOfflineLibraryStore.getState().syncedMusicFolder;
      let combinedFiles = [...files];
      const allDirs = [...scannedDirs];

      if (syncedDir && !allDirs.includes(syncedDir)) {
        const extra = await bridge.scanDirectory(syncedDir, "music");
        combinedFiles = [...combinedFiles, ...extra];
        allDirs.push(syncedDir);
      }

      const imported = await ingestScannedElectronFiles(combinedFiles);
      return {
        scannedDirs: allDirs,
        totalFound: combinedFiles.length,
        newlyImported: imported.length,
      };
    } finally {
      useOfflineLibraryStore.setState({ isScanningPc: false });
      inFlightPcScan = null;
    }
  })();

  return inFlightPcScan;
}

export function getTrackCustomLyricsText(trackId: string): string {
  const override =
    useOfflineLibraryStore.getState().trackLyricsOverrides[trackId];
  if (override?.content) return override.content;
  const offline = getOfflineTrackById(trackId);
  return offline?.lrcLyrics ?? "";
}

export function saveTrackCustomLyrics(
  trackId: string,
  rawContent: string | null,
  fileName?: string,
): { saved: boolean; lineCount: number; syncLevel: string } {
  const normalized = normalizeLyricsInput(rawContent ?? "", fileName);
  const offlineTrack = getOfflineTrackById(trackId);
  const activePlayerTrack = usePlayerStore.getState().currentTrack;
  const title =
    offlineTrack?.title ||
    (activePlayerTrack?.id === trackId ? activePlayerTrack.title : "Track");
  const artists =
    offlineTrack?.artists ||
    (activePlayerTrack?.id === trackId ? activePlayerTrack.artists : "Artist");
  const durationMs =
    offlineTrack?.durationMs ||
    (activePlayerTrack?.id === trackId
      ? activePlayerTrack.durationMs
      : 180_000) ||
    180_000;

  if (!normalized.content) {
    useOfflineLibraryStore.setState((state) => {
      const next = { ...state.trackLyricsOverrides };
      delete next[trackId];
      return { trackLyricsOverrides: next };
    });
    lyricsCache.delete(trackId);
    void linerDb.deleteLyrics(trackId).catch(() => {});

    if (
      activePlayerTrack?.id === trackId ||
      useLyricsStore.getState().currentLyricsTrackId === trackId
    ) {
      if (offlineTrack?.lrcLyrics) {
        const fallbackNorm = normalizeLyricsInput(offlineTrack.lrcLyrics);
        const fallbackCandidate = buildCustomLyricsCandidate({
          title,
          artists,
          durationMs,
          normalized: fallbackNorm,
        });
        const parsed = parseRawLyrics(
          fallbackNorm.content,
          fallbackNorm.format,
          durationMs,
        );
        useLyricsStore.getState().setLyricsState({
          lyricsLoading: false,
          lyricsError: null,
          rawLyrics: fallbackNorm.content,
          rawFormat: fallbackNorm.format,
          braccatoLyrics: parsed.braccatoLyrics,
          syncedLines: parsed.syncedLines,
          plainLyrics: parsed.plainLyrics,
          lyricsQuality: fallbackCandidate.quality.total,
          currentLyricsTrackId: trackId,
          activeProvider: fallbackCandidate.provider,
          availableProviders: [
            {
              provider: fallbackCandidate.provider,
              syncLevel: fallbackCandidate.syncLevel,
              quality: fallbackCandidate.quality.total,
              candidate: fallbackCandidate,
            },
          ],
        });
      } else {
        useLyricsStore.getState().setLyricsState({
          lyricsLoading: false,
          lyricsError: null,
          rawLyrics: null,
          rawFormat: null,
          braccatoLyrics: [],
          syncedLines: [],
          plainLyrics: null,
          lyricsQuality: 0,
          currentLyricsTrackId: trackId,
          activeProvider: null,
          availableProviders: [],
        });
      }
    }

    notifyOfflineLibraryChanged();
    return { saved: false, lineCount: 0, syncLevel: "plain" };
  }

  useOfflineLibraryStore.setState((state) => ({
    trackLyricsOverrides: {
      ...state.trackLyricsOverrides,
      [trackId]: {
        content: normalized.content,
        format: normalized.format,
        updatedAt: new Date().toISOString(),
      },
    },
  }));

  const candidate = buildCustomLyricsCandidate({
    title,
    artists,
    durationMs,
    normalized,
  });
  const providerOption = {
    provider: candidate.provider,
    syncLevel: candidate.syncLevel,
    quality: candidate.quality.total,
    candidate,
  };

  lyricsCache.delete(trackId);
  lyricsCache.set(trackId, candidate, [providerOption]);
  void linerDb
    .putLyrics({
      trackId,
      syncLevel: candidate.syncLevel,
      quality: candidate.quality.total,
      activeProvider: candidate.provider,
      availableProviders: [providerOption],
      rawLyrics: normalized.content,
      rawFormat: normalized.format,
      candidate,
      updatedAt: Date.now(),
      lastCheckedAt: Date.now(),
    })
    .catch(() => {});

  if (
    activePlayerTrack?.id === trackId ||
    useLyricsStore.getState().currentLyricsTrackId === trackId
  ) {
    const parsed = parseRawLyrics(
      normalized.content,
      normalized.format,
      durationMs,
    );
    useLyricsStore.getState().setLyricsState({
      lyricsLoading: false,
      lyricsError: null,
      rawLyrics: normalized.content,
      rawFormat: normalized.format,
      braccatoLyrics: parsed.braccatoLyrics,
      syncedLines: parsed.syncedLines,
      plainLyrics: parsed.plainLyrics,
      lyricsQuality: candidate.quality.total,
      currentLyricsTrackId: trackId,
      activeProvider: candidate.provider,
      availableProviders: [providerOption],
    });
  }

  notifyOfflineLibraryChanged();
  return {
    saved: true,
    lineCount: normalized.lineCount,
    syncLevel: normalized.syncLevel,
  };
}

export type OfflinePlaybackSource =
  | { kind: "disk-url"; url: string; mimeType: string }
  | { kind: "blob"; blob: Blob; mimeType: string };

export async function resolveOfflineTrackPlaybackSource(
  trackId: string,
): Promise<OfflinePlaybackSource | null> {
  const record = getOfflineTrackById(trackId);

  // 1. Electron local file on disk -> stream directly from disk via liner-media:// (0 RAM copy!)
  if (
    record?.localFilePath &&
    typeof window !== "undefined" &&
    window.linerElectron?.localMedia
  ) {
    return {
      kind: "disk-url",
      url: `liner-media://audio?path=${encodeURIComponent(record.localFilePath)}`,
      mimeType: record.mimeType || "audio/mpeg",
    };
  }

  const blobRes = await resolveOfflineTrackBlob(trackId);
  if (!blobRes) return null;
  return { kind: "blob", blob: blobRes.blob, mimeType: blobRes.mimeType };
}

export async function resolveOfflineTrackBlob(
  trackId: string,
): Promise<{ blob: Blob; mimeType: string } | null> {
  // 1. Check linerDb cache first
  const cached = await linerDb.getAudio(trackId);
  if (cached && cached.blob.size > 0) {
    return { blob: cached.blob, mimeType: cached.mimeType || "audio/wav" };
  }

  const record = getOfflineTrackById(trackId);
  if (!record) return null;

  // 2. Sample track: synthesize warm stereo WAV on the fly & cache in linerDb
  if (record.source === "sample" && record.synthPreset) {
    const durationSec = Math.max(12, Math.round(record.durationMs / 1000));
    const blob = synthesizeSampleTrackWav(record.synthPreset, durationSec);
    await linerDb.putAudio(trackId, blob, "audio/wav");
    return { blob, mimeType: "audio/wav" };
  }

  // 3. Electron local file path on disk
  if (
    record.localFilePath &&
    typeof window !== "undefined" &&
    window.linerElectron?.localMedia
  ) {
    const payload = await window.linerElectron.localMedia.readFile(
      record.localFilePath,
    );
    if (payload) {
      const blob = new Blob([new Uint8Array(payload.bytes)], {
        type: payload.mimeType,
      });
      return { blob, mimeType: payload.mimeType };
    }
  }

  return null;
}

// ---- Complete Offline API Adapter -------------------------------------------

export const offlineApi = {
  async search(q: string, type: SearchType = "all"): Promise<SearchResponse> {
    const query = q.trim().toLowerCase();
    const tracks = getAllOfflineTracks();
    const state = useOfflineLibraryStore.getState();
    const likedSet = new Set(state.likedTracks.map((l) => l.trackId));

    const matchText = (...fields: (string | undefined)[]) => {
      if (!query) return true;
      return fields.some((f) => f && f.toLowerCase().includes(query));
    };

    const items: ApiSearchItem[] = [];

    if (type === "all" || type === "track") {
      for (const t of tracks) {
        if (
          matchText(
            t.title,
            t.artists,
            t.albumTitle,
            t.genre,
            t.moods.join(" "),
            t.vibeTags.join(" "),
          )
        ) {
          items.push({
            ...toApiTrackFromOffline(t),
            type: "track",
            viewer: { liked: likedSet.has(t.id) },
          });
        }
      }
    }

    if (type === "all" || type === "album") {
      const albums = new Map<string, OfflineTrackRecord[]>();
      for (const t of tracks) {
        const list = albums.get(t.albumId) ?? [];
        list.push(t);
        albums.set(t.albumId, list);
      }
      for (const [albumId, albumTracks] of albums.entries()) {
        const first = albumTracks[0];
        if (matchText(first.albumTitle, first.artists, first.genre)) {
          items.push({
            type: "album",
            id: albumId,
            title: first.albumTitle,
            artists: [{ id: first.artistId, name: first.artists }],
            year: first.releaseDate
              ? Number(first.releaseDate.slice(0, 4))
              : 2026,
            cover: makeCover(first.coverUrl),
          });
        }
      }
    }

    if (type === "all" || type === "artist") {
      const artists = new Map<string, OfflineTrackRecord>();
      for (const t of tracks) {
        if (!artists.has(t.artistId)) artists.set(t.artistId, t);
      }
      for (const [artistId, first] of artists.entries()) {
        if (matchText(first.artists, first.genre)) {
          items.push({
            type: "artist",
            id: artistId,
            name: first.artists,
            cover: makeCover(first.coverUrl),
          });
        }
      }
    }

    if (type === "all" || type === "playlist") {
      for (const pl of state.playlists) {
        if (matchText(pl.title, pl.description)) {
          const firstTrack = pl.items
            .map((i) => getOfflineTrackById(i.trackId))
            .find(Boolean);
          items.push({
            type: "playlist",
            id: pl.id,
            title: pl.title,
            author: "Local Library",
            cover: firstTrack ? makeCover(firstTrack.coverUrl) : undefined,
          });
        }
      }
    }

    return { items };
  },

  async getTrack(id: string): Promise<ApiTrackDetails> {
    const found = getOfflineTrackById(id) ?? getAllOfflineTracks()[0];
    if (!found) {
      throw new Error("Track not found in offline library");
    }
    return {
      ...toApiTrackFromOffline(found),
      releaseDate: found.releaseDate,
    } as ApiTrackDetails;
  },

  async getRadio(id: string, k = 15): Promise<RadioResponse> {
    const all = getAllOfflineTracks();
    const seed = getOfflineTrackById(id);
    const others = all.filter((t) => t.id !== id);
    if (seed) {
      others.sort((a, b) => {
        const aScore =
          (a.genre === seed.genre ? 3 : 0) +
          a.moods.filter((m) => seed.moods.includes(m)).length;
        const bScore =
          (b.genre === seed.genre ? 3 : 0) +
          b.moods.filter((m) => seed.moods.includes(m)).length;
        return bScore - aScore;
      });
    }
    return {
      items: others.slice(0, k).map((t) => ({
        id: t.id,
        title: t.title,
        artists: [{ id: t.artistId, name: t.artists }],
        album: { id: t.albumId, title: t.albumTitle },
        durationMs: t.durationMs,
        cover: makeCover(t.coverUrl),
      })),
    };
  },

  async getAlbum(id: string): Promise<ApiAlbumDetails> {
    const decoded = decodeURIComponent(id);
    const tracks = getAllOfflineTracks().filter(
      (t) =>
        t.albumId === decoded ||
        t.albumId === id ||
        t.albumTitle.toLowerCase() === decoded.toLowerCase(),
    );
    const first = tracks[0] ?? getAllOfflineTracks()[0];
    return {
      type: "album",
      id: first?.albumId ?? decoded,
      title: first?.albumTitle ?? "Local Album",
      artists: first ? [{ id: first.artistId, name: first.artists }] : [],
      year: first?.releaseDate ? Number(first.releaseDate.slice(0, 4)) : 2026,
      cover: first ? makeCover(first.coverUrl) : undefined,
      trackCount: tracks.length,
      durationMs: tracks.reduce((sum, t) => sum + t.durationMs, 0),
      tracks: tracks.map(toApiTrackFromOffline),
    };
  },

  async getArtistImage(id: string): Promise<string | undefined> {
    const decoded = decodeURIComponent(id);
    const match = getAllOfflineTracks().find(
      (t) =>
        t.artistId === decoded ||
        t.artistId === id ||
        t.artists.toLowerCase() === decoded.toLowerCase(),
    );
    return match?.coverUrl;
  },

  async getArtist(id: string): Promise<ApiArtistDetails> {
    const decoded = decodeURIComponent(id);
    const tracks = getAllOfflineTracks().filter(
      (t) =>
        t.artistId === decoded ||
        t.artistId === id ||
        t.artists.toLowerCase() === decoded.toLowerCase(),
    );
    const first = tracks[0] ?? getAllOfflineTracks()[0];
    const albumsMap = new Map<string, OfflineTrackRecord[]>();
    for (const t of tracks) {
      const arr = albumsMap.get(t.albumId) ?? [];
      arr.push(t);
      albumsMap.set(t.albumId, arr);
    }

    return {
      type: "artist",
      id: first?.artistId ?? decoded,
      name: first?.artists ?? decoded,
      bio:
        first?.artistBio ||
        `${first?.artists ?? "Artist"} in your offline Liner music collection.`,
      cover: first ? makeCover(first.coverUrl) : undefined,
      monthlyListeners: "Offline Library",
      verified: true,
      tracks: tracks.map(toApiTrackFromOffline),
      albums: Array.from(albumsMap.entries()).map(([albumId, list]) => ({
        id: albumId,
        title: list[0].albumTitle,
        year: list[0].releaseDate
          ? Number(list[0].releaseDate.slice(0, 4))
          : 2026,
        cover: makeCover(list[0].coverUrl),
        totalTracks: list.length,
        trackCount: list.length,
      })),
      singles: [],
    };
  },

  async getPlaylist(id: string): Promise<ApiCatalogPlaylistDetails> {
    const decoded = decodeURIComponent(id);
    const pl = useOfflineLibraryStore
      .getState()
      .playlists.find((p) => p.id === decoded || p.id === id);
    if (!pl) {
      const tracks = getAllOfflineTracks();
      return {
        type: "playlist",
        id: decoded,
        title: "Offline Mix",
        author: "Local Library",
        cover: tracks[0] ? makeCover(tracks[0].coverUrl) : undefined,
        trackCount: tracks.length,
        tracks: tracks.map(toApiTrackFromOffline),
      };
    }
    const tracks = pl.items
      .map((i) => getOfflineTrackById(i.trackId))
      .filter((t): t is OfflineTrackRecord => Boolean(t));
    return {
      type: "playlist",
      id: pl.id,
      title: pl.title,
      author: "Local Library",
      description: pl.description,
      cover: tracks[0] ? makeCover(tracks[0].coverUrl) : undefined,
      trackCount: tracks.length,
      durationMs: tracks.reduce((s, t) => s + t.durationMs, 0),
      tracks: tracks.map(toApiTrackFromOffline),
    };
  },

  async listLikedTracks(): Promise<ApiLikedTracksPage> {
    const state = useOfflineLibraryStore.getState();
    state.ensureSeeded();
    const items = useOfflineLibraryStore
      .getState()
      .likedTracks.map((entry) => {
        const track = getOfflineTrackById(entry.trackId);
        if (!track) return null;
        return {
          track: toApiTrackFromOffline(track),
          likedAt: entry.likedAt,
        };
      })
      .filter((x): x is { track: ApiTrack; likedAt: string } => Boolean(x));
    return { items, nextCursor: null };
  },

  async likeTrack(id: string): Promise<void> {
    useOfflineLibraryStore.setState((state) => {
      if (state.likedTracks.some((l) => l.trackId === id)) return state;
      return {
        likedTracks: [
          { trackId: id, likedAt: new Date().toISOString() },
          ...state.likedTracks,
        ],
      };
    });
    notifyOfflineLibraryChanged();
  },

  async unlikeTrack(id: string): Promise<void> {
    useOfflineLibraryStore.setState((state) => ({
      likedTracks: state.likedTracks.filter((l) => l.trackId !== id),
    }));
    notifyOfflineLibraryChanged();
  },

  async listSavedCollections(
    type: "albums" | "artists" | "playlists",
  ): Promise<{ items: unknown[] }> {
    const tracks = getAllOfflineTracks();
    const saved = useOfflineLibraryStore
      .getState()
      .savedCollections.filter((s) => s.type === type);

    if (type === "albums") {
      // Include explicitly saved albums plus local/sample albums so Library > Albums is populated
      const albums = new Map<string, OfflineTrackRecord[]>();
      for (const t of tracks) {
        const arr = albums.get(t.albumId) ?? [];
        arr.push(t);
        albums.set(t.albumId, arr);
      }
      const items = Array.from(albums.entries()).map(([albumId, list]) => ({
        id: albumId,
        title: list[0].albumTitle,
        artists: [{ id: list[0].artistId, name: list[0].artists }],
        cover: { url: list[0].coverUrl },
        addedAt: list[0].addedAt,
      }));
      for (const s of saved) {
        if (!items.some((i) => i.id === s.id) && s.snapshot) {
          items.push({ id: s.id, ...s.snapshot, addedAt: s.savedAt } as any);
        }
      }
      return { items };
    }

    if (type === "artists") {
      const artists = new Map<string, OfflineTrackRecord>();
      for (const t of tracks) {
        if (!artists.has(t.artistId)) artists.set(t.artistId, t);
      }
      const items = Array.from(artists.entries()).map(([artistId, first]) => ({
        id: artistId,
        name: first.artists,
        cover: { url: first.coverUrl },
        addedAt: first.addedAt,
      }));
      return { items };
    }

    return {
      items: saved.map((s) => ({
        id: s.id,
        ...(s.snapshot ?? {}),
        addedAt: s.savedAt,
      })),
    };
  },

  async saveCollection(
    type: "albums" | "artists" | "playlists",
    id: string,
    snapshot?: Record<string, unknown>,
  ): Promise<void> {
    useOfflineLibraryStore.setState((state) => {
      if (state.savedCollections.some((s) => s.type === type && s.id === id)) {
        return state;
      }
      return {
        savedCollections: [
          { id, type, savedAt: new Date().toISOString(), snapshot },
          ...state.savedCollections,
        ],
      };
    });
    notifyOfflineLibraryChanged();
  },

  async removeCollection(
    type: "albums" | "artists" | "playlists",
    id: string,
  ): Promise<void> {
    useOfflineLibraryStore.setState((state) => ({
      savedCollections: state.savedCollections.filter(
        (s) => !(s.type === type && s.id === id),
      ),
    }));
    notifyOfflineLibraryChanged();
  },

  async listPlaylists(): Promise<{ items: ApiUserPlaylist[] }> {
    const state = useOfflineLibraryStore.getState();
    state.ensureSeeded();
    const items: ApiUserPlaylist[] = useOfflineLibraryStore
      .getState()
      .playlists.map((pl) => ({
        id: pl.id,
        title: pl.title,
        description: pl.description,
        isPublic: pl.isPublic,
        createdAt: pl.createdAt,
        updatedAt: pl.updatedAt,
        revision: pl.revision,
        owner: {
          id: "offline-user",
          username: "local",
          displayName: "Local Library",
        },
      }));
    return { items };
  },

  async getUserPlaylist(
    id: string,
  ): Promise<{ playlist: ApiUserPlaylist; items: ApiUserPlaylistItem[] }> {
    const state = useOfflineLibraryStore.getState();
    state.ensureSeeded();
    const pl = useOfflineLibraryStore
      .getState()
      .playlists.find((p) => p.id === id || p.id === decodeURIComponent(id));
    if (!pl) {
      throw new Error("Playlist not found");
    }
    const items: ApiUserPlaylistItem[] = pl.items
      .map((item, idx) => {
        const track = getOfflineTrackById(item.trackId);
        if (!track) return null;
        return {
          id: item.id,
          track: toApiTrackFromOffline(track),
          position: idx,
          addedAt: item.addedAt,
        };
      })
      .filter((x): x is ApiUserPlaylistItem => Boolean(x));

    return {
      playlist: {
        id: pl.id,
        title: pl.title,
        description: pl.description,
        isPublic: pl.isPublic,
        createdAt: pl.createdAt,
        updatedAt: pl.updatedAt,
        revision: pl.revision,
        owner: {
          id: "offline-user",
          username: "local",
          displayName: "Local Library",
        },
      },
      items,
    };
  },

  async createPlaylist(input: {
    title: string;
    description?: string;
    isPublic?: boolean;
  }): Promise<ApiUserPlaylist> {
    const now = new Date().toISOString();
    const newPl: OfflinePlaylistRecord = {
      id: `playlist:custom-${Date.now().toString(36)}`,
      title: input.title.trim() || "Untitled Playlist",
      description: input.description?.trim(),
      isPublic: Boolean(input.isPublic),
      createdAt: now,
      updatedAt: now,
      revision: 1,
      items: [],
    };
    useOfflineLibraryStore.setState((state) => ({
      playlists: [newPl, ...state.playlists],
    }));
    notifyOfflineLibraryChanged();
    return {
      id: newPl.id,
      title: newPl.title,
      description: newPl.description,
      isPublic: newPl.isPublic,
      createdAt: newPl.createdAt,
      updatedAt: newPl.updatedAt,
      revision: newPl.revision,
    };
  },

  async updatePlaylist(
    id: string,
    input: { title?: string; description?: string | null; isPublic?: boolean },
  ): Promise<ApiUserPlaylist> {
    const now = new Date().toISOString();
    let updated: OfflinePlaylistRecord | undefined;
    useOfflineLibraryStore.setState((state) => ({
      playlists: state.playlists.map((pl) => {
        if (pl.id !== id) return pl;
        updated = {
          ...pl,
          title: input.title !== undefined ? input.title : pl.title,
          description:
            input.description === null
              ? undefined
              : input.description !== undefined
                ? input.description
                : pl.description,
          isPublic: input.isPublic !== undefined ? input.isPublic : pl.isPublic,
          updatedAt: now,
          revision: pl.revision + 1,
        };
        return updated;
      }),
    }));
    queryCache.delete(`playlist:detail:${id}`);
    notifyOfflineLibraryChanged();
    if (!updated) throw new Error("Playlist not found");
    return {
      id: updated.id,
      title: updated.title,
      description: updated.description,
      isPublic: updated.isPublic,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      revision: updated.revision,
    };
  },

  async deletePlaylist(id: string): Promise<void> {
    useOfflineLibraryStore.setState((state) => ({
      playlists: state.playlists.filter((pl) => pl.id !== id),
    }));
    queryCache.delete(`playlist:detail:${id}`);
    notifyOfflineLibraryChanged();
  },

  async addPlaylistTrack(
    playlistId: string,
    trackId: string,
  ): Promise<ApiUserPlaylistItem> {
    const now = new Date().toISOString();
    const itemId = `pli_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    let pos = 0;
    useOfflineLibraryStore.setState((state) => ({
      playlists: state.playlists.map((pl) => {
        if (pl.id !== playlistId) return pl;
        pos = pl.items.length;
        return {
          ...pl,
          updatedAt: now,
          revision: pl.revision + 1,
          items: [...pl.items, { id: itemId, trackId, addedAt: now }],
        };
      }),
    }));
    queryCache.delete(`playlist:detail:${playlistId}`);
    notifyOfflineLibraryChanged();
    const track = getOfflineTrackById(trackId) ?? getAllOfflineTracks()[0];
    return {
      id: itemId,
      track: toApiTrackFromOffline(track),
      position: pos,
      addedAt: now,
    };
  },

  async addPlaylistTrackSnapshots(
    playlistId: string,
    tracks: { id: string }[],
  ): Promise<{ items: ApiUserPlaylistItem[]; added: number; rejected: number }> {
    const items: ApiUserPlaylistItem[] = [];
    for (const t of tracks) {
      items.push(await offlineApi.addPlaylistTrack(playlistId, t.id));
    }
    return { items, added: items.length, rejected: 0 };
  },

  async removePlaylistItem(playlistId: string, itemId: string): Promise<void> {
    const now = new Date().toISOString();
    useOfflineLibraryStore.setState((state) => ({
      playlists: state.playlists.map((pl) => {
        if (pl.id !== playlistId) return pl;
        return {
          ...pl,
          updatedAt: now,
          revision: pl.revision + 1,
          items: pl.items.filter(
            (i) => i.id !== itemId && i.trackId !== itemId,
          ),
        };
      }),
    }));
    queryCache.delete(`playlist:detail:${playlistId}`);
    notifyOfflineLibraryChanged();
  },

  async movePlaylistItem(
    playlistId: string,
    itemId: string,
    beforeItemId: string | null,
  ): Promise<{ playlist: ApiUserPlaylist; items: ApiUserPlaylistItem[] }> {
    const now = new Date().toISOString();
    useOfflineLibraryStore.setState((state) => ({
      playlists: state.playlists.map((pl) => {
        if (pl.id !== playlistId) return pl;
        const moving = pl.items.find((i) => i.id === itemId);
        if (!moving) return pl;
        const rest = pl.items.filter((i) => i.id !== itemId);
        if (!beforeItemId) {
          rest.push(moving);
        } else {
          const targetIdx = rest.findIndex((i) => i.id === beforeItemId);
          if (targetIdx === -1) rest.push(moving);
          else rest.splice(targetIdx, 0, moving);
        }
        return {
          ...pl,
          updatedAt: now,
          revision: pl.revision + 1,
          items: rest,
        };
      }),
    }));
    queryCache.delete(`playlist:detail:${playlistId}`);
    return offlineApi.getUserPlaylist(playlistId);
  },

  async *streamLyrics(id: string): AsyncGenerator<LyricsStreamEvent> {
    const track = getOfflineTrackById(id);
    const customOverride =
      useOfflineLibraryStore.getState().trackLyricsOverrides[id];

    if (!track && !customOverride) {
      yield { type: "done", cached: false, status: "not_found" };
      return;
    }

    const title = track?.title ?? "Local Track";
    const artists = track?.artists ?? "Local Artist";
    const artistId = track?.artistId ?? "artist:local";
    const durationMs = track?.durationMs ?? 180_000;

    yield {
      type: "metadata",
      track: {
        id,
        title,
        artists: [{ id: artistId, name: artists }],
        durationMs,
      },
    };

    const rawSource = customOverride?.content || track?.lrcLyrics;
    if (rawSource) {
      const normalized = normalizeLyricsInput(rawSource);
      const candidate = buildCustomLyricsCandidate({
        title,
        artists,
        durationMs,
        normalized,
      });
      yield {
        type: "provider",
        provider: candidate.provider,
        status: "found",
        syncLevel: candidate.syncLevel,
        candidate,
      };
      yield {
        type: "done",
        cached: true,
        best: {
          provider: candidate.provider,
          quality: candidate.quality.total,
          syncLevel: candidate.syncLevel,
        },
      };
    } else {
      yield { type: "done", cached: false, status: "not_found" };
    }
  },

  async recordPlaybackEvent(payload: RecordPlaybackEventRequest): Promise<void> {
    const track = getOfflineTrackById(payload.trackId);
    if (!track) return;
    useOfflineLibraryStore.getState().incrementPlayCount(payload.trackId);
    const item: PlaybackHistoryItem = {
      id: `hist_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      playbackSessionId: payload.playbackSessionId,
      listeningSessionId: payload.listeningSessionId,
      track: toApiTrackFromOffline(track),
      playedDurationMs: payload.playedDurationMs,
      completionRate: payload.completionRate,
      completed: Boolean(payload.completed),
      skipped: Boolean(payload.skipped),
      loopCount: payload.loopCount ?? 0,
      hasSeekBackward: Boolean(payload.hasSeekBackward),
      context: payload.context,
      listenedAt: new Date().toISOString(),
    };
    useOfflineLibraryStore.setState((state) => ({
      history: [item, ...state.history].slice(0, 100),
    }));
  },

  async getHistory(_cursor?: string, limit = 30): Promise<PlaybackHistoryResponse> {
    const items = useOfflineLibraryStore.getState().history.slice(0, limit);
    return { items, nextCursor: null };
  },

  async getPopularTracks(
    window: PopularTimeWindow = "7d",
    limit = 50,
  ): Promise<PopularTracksResponse> {
    // Only rank tracks the user has genuinely listened to (playCount > 0)
    const tracks = getAllOfflineTracks()
      .filter((t) => t.playCount > 0)
      .sort((a, b) => b.playCount - a.playCount);
    const likedSet = new Set(
      useOfflineLibraryStore.getState().likedTracks.map((l) => l.trackId),
    );
    return {
      window,
      generatedAt: new Date().toISOString(),
      items: tracks.slice(0, limit).map((t, idx) => ({
        rank: idx + 1,
        track: toApiTrackFromOffline(t),
        playCount: t.playCount,
        uniqueListeners: 1,
        score: t.playCount,
        viewer: { liked: likedSet.has(t.id) },
      })),
    };
  },

  async getPopularAlbums(
    window: PopularTimeWindow = "7d",
    limit = 20,
  ): Promise<PopularAlbumsResponse> {
    const tracks = getAllOfflineTracks();
    const albums = new Map<string, OfflineTrackRecord[]>();
    for (const t of tracks) {
      const arr = albums.get(t.albumId) ?? [];
      arr.push(t);
      albums.set(t.albumId, arr);
    }

    const items = Array.from(albums.entries())
      .map(([albumId, list]) => {
        const first = list[0];
        const plays = list.reduce((s, t) => s + t.playCount, 0);
        return {
          id: albumId,
          title: first.albumTitle,
          artist: first.artists,
          coverUrl: first.coverUrl,
          year: first.releaseDate
            ? Number(first.releaseDate.slice(0, 4))
            : 2026,
          playCount: plays,
          uniqueListeners: Math.max(1, Math.round(plays / 5)),
          // Ensure starter/local featured albums satisfy HomePage's >= 5 filter
          trackCount: Math.max(5, list.length),
          score: plays,
        };
      })
      .sort((a, b) => b.playCount - a.playCount)
      .slice(0, limit);

    return { window, items };
  },

  async getMostSaved(
    type: MostSavedType = "all",
    limit = 20,
  ): Promise<MostSavedResponse> {
    const state = useOfflineLibraryStore.getState();
    state.ensureSeeded();
    const playlists = useOfflineLibraryStore.getState().playlists;
    const tracks = getAllOfflineTracks();

    const entries: MostSavedResponse["items"] = [];
    if (type === "all" || type === "playlist") {
      for (const pl of playlists) {
        const firstTrack = pl.items
          .map((i) => getOfflineTrackById(i.trackId))
          .find(Boolean);
        entries.push({
          type: "playlist",
          id: pl.id,
          title: pl.title,
          subtitle: "Local Curator",
          coverUrl: firstTrack?.coverUrl ?? tracks[0]?.coverUrl ?? null,
          saves: 42 + pl.items.length * 7,
        });
      }
    }
    if (type === "all" || type === "album") {
      const seen = new Set<string>();
      for (const t of tracks) {
        if (seen.has(t.albumId)) continue;
        seen.add(t.albumId);
        entries.push({
          type: "album",
          id: t.albumId,
          title: t.albumTitle,
          subtitle: t.artists,
          coverUrl: t.coverUrl,
          saves: Math.max(12, Math.round(t.playCount / 18)),
        });
      }
    }
    return { type, items: entries.slice(0, limit) };
  },

  async getDailyMixes(): Promise<DailyMixesResponse> {
    const tracks = getAllOfflineTracks();
    const chill = tracks.filter((t) =>
      t.moods.some((m) =>
        ["chill", "focus", "calm", "warm", "acoustic", "cinematic"].includes(m),
      ),
    );
    const upbeat = tracks.filter((t) =>
      t.moods.some((m) =>
        ["retro", "energetic", "upbeat", "dance", "night drive"].includes(m),
      ),
    );
    const localOnly = tracks.filter((t) => t.source === "local");

    const mixes: DailyMixesResponse["items"] = [];
    if (chill.length > 0) {
      mixes.push({
        id: "daily-mix-nocturnal",
        title: "Nocturnal Focus",
        description: "Ambient glass, chamber strings, and warm late-night calm",
        clusterArtists: chill.map((t) => t.artists).slice(0, 4),
        cover: makeCover(chill[0].coverUrl),
        trackCount: chill.length,
        tracks: chill.map(toApiTrackFromOffline),
      });
    }
    if (upbeat.length > 0) {
      mixes.push({
        id: "daily-mix-horizon",
        title: "Neon Night Drive",
        description: "Analog synthwave, FM basslines, and midnight momentum",
        clusterArtists: upbeat.map((t) => t.artists).slice(0, 4),
        cover: makeCover(upbeat[0].coverUrl),
        trackCount: upbeat.length,
        tracks: upbeat.map(toApiTrackFromOffline),
      });
    }
    if (localOnly.length > 0) {
      mixes.push({
        id: "daily-mix-local",
        title: "Imported Favorites",
        description: "Fresh cuts directly from your local disk collection",
        clusterArtists: localOnly.map((t) => t.artists).slice(0, 4),
        cover: makeCover(localOnly[0].coverUrl),
        trackCount: localOnly.length,
        tracks: localOnly.map(toApiTrackFromOffline),
      });
    } else if (tracks.length > 0) {
      const reversed = [...tracks].reverse();
      mixes.push({
        id: "daily-mix-curator",
        title: "Curator's Rotation",
        description: "Eclectic blend across your entire offline catalog",
        clusterArtists: reversed.map((t) => t.artists).slice(0, 4),
        cover: makeCover(reversed[0].coverUrl),
        trackCount: reversed.length,
        tracks: reversed.map(toApiTrackFromOffline),
      });
    }

    return {
      items: mixes,
      generatedAt: new Date().toISOString(),
    };
  },
};
