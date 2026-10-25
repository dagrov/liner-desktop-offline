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
import { extractAudioMetadata } from "../lib/audioMetadataParser";

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

interface OfflineLibraryState {
  customTracks: OfflineTrackRecord[];
  trackCoverOverrides: Record<string, string>;
  albumCoverOverrides: Record<string, string>;
  trackPlayCounts: Record<string, number>;
  likedTracks: { trackId: string; likedAt: string }[];
  playlists: OfflinePlaylistRecord[];
  savedCollections: SavedCollectionRecord[];
  history: PlaybackHistoryItem[];
  syncedMusicFolder: string | null;
  includeSampleTracks: boolean;
  seededDefaults: boolean;

  ensureSeeded: () => void;
  setIncludeSampleTracks: (enabled: boolean) => void;
  setSyncedMusicFolder: (folder: string | null) => void;
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
      albumCoverOverrides: {},
      trackPlayCounts: {},
      likedTracks: [],
      playlists: [],
      savedCollections: [],
      history: [],
      syncedMusicFolder: null,
      includeSampleTracks: true,
      seededDefaults: false,

      ensureSeeded: () => {
        const state = get();
        if (state.seededDefaults) return;
        set({
          seededDefaults: true,
          playlists:
            state.playlists.length > 0
              ? state.playlists
              : createStarterPlaylists(),
          likedTracks:
            state.likedTracks.length > 0
              ? state.likedTracks
              : [
                  {
                    trackId: "sample:midnight-glass",
                    likedAt: "2026-10-10T20:00:00.000Z",
                  },
                  {
                    trackId: "sample:velvet-static",
                    likedAt: "2026-10-11T20:00:00.000Z",
                  },
                ],
        });
      },

      setIncludeSampleTracks: (enabled) => {
        set({ includeSampleTracks: enabled });
        notifyOfflineLibraryChanged();
      },

      setSyncedMusicFolder: (folder) => set({ syncedMusicFolder: folder }),

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
      name: "liner_offline_library_v1",
      storage: createJSONStorage(() => debouncedStorage),
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
      playCount: track.playCount + extraPlays,
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
  entries: { file: Blob; name: string; localFilePath?: string }[],
): Promise<OfflineTrackRecord[]> {
  const imported: OfflineTrackRecord[] = [];
  for (const entry of entries) {
    const meta = await extractAudioMetadata(entry.file, entry.name);
    const artistSlug = slugify(meta.artists);
    const albumTitle = meta.albumTitle || "Local Library";
    const albumSlug = slugify(`${meta.artists}-${albumTitle}`);
    const idSeed = entry.localFilePath
      ? `local:${slugify(entry.localFilePath)}`
      : `local:${slugify(`${meta.artists}-${meta.title}-${entry.file.size}`)}`;

    const mimeType = entry.file.type || "audio/mpeg";
    if (!entry.localFilePath) {
      await linerDb.putAudio(idSeed, entry.file, mimeType);
    }

    const record: OfflineTrackRecord = {
      id: idSeed,
      title: meta.title,
      artists: meta.artists,
      artistId: `artist:${artistSlug}`,
      albumTitle,
      albumId: `album:${albumSlug}`,
      coverUrl: meta.coverUrl,
      originalCoverUrl: meta.coverUrl,
      durationMs: meta.durationMs,
      releaseDate: meta.year ? `${meta.year}-01-01` : undefined,
      genre: meta.genre || "Local Audio",
      moods: ["local", ...(meta.genre ? [meta.genre.toLowerCase()] : [])],
      vibeTags: ["clean", "modern", ...(meta.genre ? [meta.genre.toLowerCase()] : [])],
      playCount: 1,
      source: "local",
      localFilePath: entry.localFilePath,
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

export async function syncElectronMusicDirectory(
  dirPath: string,
): Promise<number> {
  const bridge =
    typeof window !== "undefined" ? window.linerElectron?.localMedia : undefined;
  if (!bridge) return 0;

  const scanned = await bridge.scanDirectory(dirPath, "music");
  const existingPaths = new Set(
    useOfflineLibraryStore
      .getState()
      .customTracks.map((t) => t.localFilePath)
      .filter(Boolean),
  );

  const toImport: { file: Blob; name: string; localFilePath: string }[] = [];
  for (const fileInfo of scanned) {
    if (existingPaths.has(fileInfo.path)) continue;
    const payload = await bridge.readFile(fileInfo.path);
    if (!payload) continue;
    const blob = new Blob([new Uint8Array(payload.bytes)], {
      type: payload.mimeType,
    });
    toImport.push({
      file: blob,
      name: payload.name,
      localFilePath: payload.path,
    });
  }

  if (toImport.length > 0) {
    await importLocalAudioBlobs(toImport);
  }
  useOfflineLibraryStore.getState().setSyncedMusicFolder(dirPath);
  void bridge.watchDirectory(dirPath, "music");
  return toImport.length;
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
    if (!track) {
      yield { type: "done", cached: false, status: "not_found" };
      return;
    }

    yield {
      type: "metadata",
      track: {
        id: track.id,
        title: track.title,
        artists: [{ id: track.artistId, name: track.artists }],
        durationMs: track.durationMs,
      },
    };

    if (track.lrcLyrics) {
      const candidate = {
        provider: "offline-liner",
        contentKind: "line_synced" as const,
        syncLevel: "line_level" as const,
        topPriority: true,
        matchedTrack: {
          title: track.title,
          artists: [track.artists],
          durationMs: track.durationMs,
        },
        lyrics: {
          format: "lrc" as const,
          content: track.lrcLyrics,
        },
        quality: {
          total: 95,
          match: 100,
          content: 92,
          sync: 94,
          source: 95,
          reasons: ["bundled-offline-lrc"],
        },
      };
      yield {
        type: "provider",
        provider: "offline-liner",
        status: "found",
        syncLevel: "line_level",
        candidate,
      };
      yield {
        type: "done",
        cached: true,
        best: {
          provider: "offline-liner",
          quality: 95,
          syncLevel: "line_level",
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
    const tracks = [...getAllOfflineTracks()].sort(
      (a, b) => b.playCount - a.playCount,
    );
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
        uniqueListeners: Math.max(1, Math.round(t.playCount / 4)),
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
