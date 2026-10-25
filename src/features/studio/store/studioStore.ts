import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { debouncedStorage } from "@/shared/utils/storage";
import {
  getOfflineTrackById,
  useOfflineLibraryStore,
} from "@/features/offline/store/offlineLibraryStore";
import { usePlayerStore } from "@/features/player/store/playerStore";
import { preloadCoverArt } from "@/features/covers";
import {
  STARTER_COVERS,
  STARTER_FONTS,
  type CoverAsset,
  type FontAsset,
  type FontCategory,
} from "../lib/starterAssets";
import {
  blobToDataUrl,
  deleteStudioBinaryAsset,
  getStudioBinaryAsset,
  putStudioBinaryAsset,
} from "../lib/studioDb";

interface StudioState {
  customFonts: FontAsset[];
  customCovers: CoverAsset[];
  activeTitleFontId: string;
  activeBodyFontId: string;
  syncedFontsFolder: string | null;
  syncedCoversFolder: string | null;
  coverPickerTrackId: string | null;

  setTitleFont: (fontId: string) => FontAsset | null;
  setBodyFont: (fontId: string) => FontAsset | null;
  resetTypography: () => void;
  openCoverPicker: (trackId: string) => void;
  closeCoverPicker: () => void;

  applyCoverAssetToTrack: (trackId: string, coverId: string) => CoverAsset | null;
  applyRawCoverUrlToTrack: (trackId: string, coverUrl: string) => void;
  cycleTrackCover: (
    trackId: string,
  ) => { label: string; coverUrl: string; asset: CoverAsset | null } | null;
  resetTrackCover: (trackId: string) => boolean;

  addCustomFont: (font: FontAsset) => void;
  removeCustomFont: (fontId: string) => void;
  addCustomCover: (cover: CoverAsset) => void;
  removeCustomCover: (coverId: string) => void;
  setSyncedFontsFolder: (dir: string | null) => void;
  setSyncedCoversFolder: (dir: string | null) => void;
}

const DEFAULT_TITLE_FONT_ID = "font-montserrat-geometric";
const DEFAULT_BODY_FONT_ID = "font-inter-clean";

function syncCoverUrlIntoPlayer(trackId: string, nextCoverUrl: string): void {
  void preloadCoverArt(nextCoverUrl);
  const player = usePlayerStore.getState();
  const updatedQueue = player.queue.map((t) =>
    t.id === trackId ? { ...t, coverUrl: nextCoverUrl } : t,
  );
  const currentUpdated =
    player.currentTrack?.id === trackId
      ? { ...player.currentTrack, coverUrl: nextCoverUrl }
      : player.currentTrack;

  usePlayerStore.setState({
    queue: updatedQueue,
    currentTrack: currentUpdated,
  });
}

export const useStudioStore = create<StudioState>()(
  persist(
    (set, get) => ({
      customFonts: [],
      customCovers: [],
      activeTitleFontId: DEFAULT_TITLE_FONT_ID,
      activeBodyFontId: DEFAULT_BODY_FONT_ID,
      syncedFontsFolder: null,
      syncedCoversFolder: null,
      coverPickerTrackId: null,

      setTitleFont: (fontId) => {
        const all = [...STARTER_FONTS, ...get().customFonts];
        const found = all.find((f) => f.id === fontId) ?? null;
        if (!found) return null;
        set({ activeTitleFontId: found.id });
        return found;
      },

      setBodyFont: (fontId) => {
        const all = [...STARTER_FONTS, ...get().customFonts];
        const found = all.find((f) => f.id === fontId) ?? null;
        if (!found) return null;
        set({ activeBodyFontId: found.id });
        return found;
      },

      resetTypography: () =>
        set({
          activeTitleFontId: DEFAULT_TITLE_FONT_ID,
          activeBodyFontId: DEFAULT_BODY_FONT_ID,
        }),

      openCoverPicker: (trackId) => set({ coverPickerTrackId: trackId }),
      closeCoverPicker: () => set({ coverPickerTrackId: null }),

      applyCoverAssetToTrack: (trackId, coverId) => {
        const all = [...STARTER_COVERS, ...get().customCovers];
        const asset = all.find((c) => c.id === coverId) ?? null;
        if (!asset) return null;
        useOfflineLibraryStore
          .getState()
          .setTrackCoverUrl(trackId, asset.imageUrl);
        syncCoverUrlIntoPlayer(trackId, asset.imageUrl);
        return asset;
      },

      applyRawCoverUrlToTrack: (trackId, coverUrl) => {
        useOfflineLibraryStore.getState().setTrackCoverUrl(trackId, coverUrl);
        syncCoverUrlIntoPlayer(trackId, coverUrl);
      },

      cycleTrackCover: (trackId) => {
        const offlineTrack = getOfflineTrackById(trackId);
        const currentPlayerTrack = usePlayerStore.getState().currentTrack;
        const currentUrl =
          offlineTrack?.coverUrl ||
          (currentPlayerTrack?.id === trackId
            ? currentPlayerTrack.coverUrl
            : "") ||
          "";
        const originalUrl = offlineTrack?.originalCoverUrl || currentUrl;

        const allCovers = [...get().customCovers, ...STARTER_COVERS].filter(
          (c) => !c.trackId || c.trackId === trackId,
        );

        const options: {
          label: string;
          coverUrl: string;
          asset: CoverAsset | null;
        }[] = [
          ...(originalUrl
            ? [{ label: "Original Cover", coverUrl: originalUrl, asset: null }]
            : []),
          ...allCovers.map((c) => ({
            label: c.name,
            coverUrl: c.imageUrl,
            asset: c,
          })),
        ];

        if (options.length === 0) return null;
        const currentIdx = options.findIndex((o) => o.coverUrl === currentUrl);
        const nextIdx = (currentIdx + 1) % options.length;
        const chosen = options[nextIdx];

        if (chosen.asset === null) {
          useOfflineLibraryStore.getState().setTrackCoverUrl(trackId, null);
        } else {
          useOfflineLibraryStore
            .getState()
            .setTrackCoverUrl(trackId, chosen.coverUrl);
        }
        syncCoverUrlIntoPlayer(trackId, chosen.coverUrl);
        return chosen;
      },

      resetTrackCover: (trackId) => {
        const offlineTrack = getOfflineTrackById(trackId);
        useOfflineLibraryStore.getState().setTrackCoverUrl(trackId, null);
        if (offlineTrack?.originalCoverUrl) {
          syncCoverUrlIntoPlayer(trackId, offlineTrack.originalCoverUrl);
        }
        return true;
      },

      addCustomFont: (font) =>
        set((state) => ({
          customFonts: [
            font,
            ...state.customFonts.filter((f) => f.id !== font.id),
          ],
        })),

      removeCustomFont: (fontId) => {
        void deleteStudioBinaryAsset(fontId);
        set((state) => ({
          customFonts: state.customFonts.filter((f) => f.id !== fontId),
          activeTitleFontId:
            state.activeTitleFontId === fontId
              ? DEFAULT_TITLE_FONT_ID
              : state.activeTitleFontId,
          activeBodyFontId:
            state.activeBodyFontId === fontId
              ? DEFAULT_BODY_FONT_ID
              : state.activeBodyFontId,
        }));
      },

      addCustomCover: (cover) =>
        set((state) => ({
          customCovers: [
            cover,
            ...state.customCovers.filter((c) => c.id !== cover.id),
          ],
        })),

      removeCustomCover: (coverId) => {
        void deleteStudioBinaryAsset(coverId);
        set((state) => ({
          customCovers: state.customCovers.filter((c) => c.id !== coverId),
        }));
      },

      setSyncedFontsFolder: (dir) => set({ syncedFontsFolder: dir }),
      setSyncedCoversFolder: (dir) => set({ syncedCoversFolder: dir }),
    }),
    {
      name: "liner_studio_v1",
      storage: createJSONStorage(() => debouncedStorage),
      partialize: (state) => ({
        // Store customCovers metadata without giant base64 strings if stored in IDB,
        // and rehydrate cover imageUrls from IDB on startup
        customFonts: state.customFonts,
        customCovers: state.customCovers.map((c) => ({
          ...c,
          imageUrl: c.imageUrl.length > 4096 ? `idb://${c.id}` : c.imageUrl,
        })),
        activeTitleFontId: state.activeTitleFontId,
        activeBodyFontId: state.activeBodyFontId,
        syncedFontsFolder: state.syncedFontsFolder,
        syncedCoversFolder: state.syncedCoversFolder,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        for (const cover of state.customCovers) {
          if (cover.imageUrl.startsWith("idb://")) {
            void getStudioBinaryAsset(cover.id).then((stored) => {
              if (stored?.dataUrl) {
                useStudioStore.setState((curr) => ({
                  customCovers: curr.customCovers.map((c) =>
                    c.id === cover.id ? { ...c, imageUrl: stored.dataUrl } : c,
                  ),
                }));
              }
            });
          }
        }
      },
    },
  ),
);

export function getAllStudioFonts(): FontAsset[] {
  return [...useStudioStore.getState().customFonts, ...STARTER_FONTS];
}

export function getAllStudioCovers(): CoverAsset[] {
  return [...useStudioStore.getState().customCovers, ...STARTER_COVERS];
}

function inferFontCategory(name: string): FontCategory {
  const lower = name.toLowerCase();
  if (lower.includes("mono") || lower.includes("code") || lower.includes("console")) {
    return "mono";
  }
  if (
    lower.includes("serif") &&
    !lower.includes("sans")
  ) {
    return "serif";
  }
  if (
    lower.includes("garamond") ||
    lower.includes("playfair") ||
    lower.includes("bodoni") ||
    lower.includes("baskerville") ||
    lower.includes("times") ||
    lower.includes("lora")
  ) {
    return "serif";
  }
  if (
    lower.includes("retro") ||
    lower.includes("display") ||
    lower.includes("syne") ||
    lower.includes("pixel") ||
    lower.includes("arcade")
  ) {
    return "retro";
  }
  return "sans";
}

function cleanAssetDisplayName(fileName: string): string {
  return fileName
    .replace(/\.[^/.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase())
    .trim();
}

export async function importFontBlobs(
  entries: {
    blob: Blob;
    fileName: string;
    localFilePath?: string;
    source?: "imported" | "folder";
  }[],
): Promise<FontAsset[]> {
  const created: FontAsset[] = [];
  for (const entry of entries) {
    const cleanName = cleanAssetDisplayName(entry.fileName);
    const slug = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const id = `font-user-${slug}`;
    const familyToken = `LinerCustom_${slug.replace(/-/g, "_")}`;
    const dataUrl = await blobToDataUrl(entry.blob);

    await putStudioBinaryAsset({
      id,
      kind: "font",
      dataUrl,
      mimeType: entry.blob.type || "font/woff2",
      savedAt: Date.now(),
    });

    const category = inferFontCategory(cleanName);
    const words = cleanName
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length >= 2);
    const asset: FontAsset = {
      id,
      name: cleanName,
      cssFamily: `"${familyToken}", sans-serif`,
      category,
      tags: Array.from(new Set([category, "custom", ...words])),
      description:
        entry.source === "folder"
          ? `Synced from local fonts folder (${entry.fileName})`
          : `Imported custom font (${entry.fileName})`,
      source: entry.source ?? "imported",
      fileName: entry.fileName,
      localFilePath: entry.localFilePath,
    };
    useStudioStore.getState().addCustomFont(asset);
    created.push(asset);
  }
  return created;
}

export async function importCoverBlobs(
  entries: {
    blob: Blob;
    fileName: string;
    tags?: string[];
    trackId?: string;
    localFilePath?: string;
    source?: "imported" | "folder";
  }[],
): Promise<CoverAsset[]> {
  const created: CoverAsset[] = [];
  for (const entry of entries) {
    const cleanName = cleanAssetDisplayName(entry.fileName);
    const slug = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const id = `cover-user-${slug}`;
    const dataUrl = await blobToDataUrl(entry.blob);

    await putStudioBinaryAsset({
      id,
      kind: "cover",
      dataUrl,
      mimeType: entry.blob.type || "image/png",
      savedAt: Date.now(),
    });

    const words = cleanName
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length >= 2);
    const asset: CoverAsset = {
      id,
      name: cleanName,
      imageUrl: dataUrl,
      tags: Array.from(
        new Set(["custom", ...(entry.tags ?? []), ...words]),
      ),
      description:
        entry.source === "folder"
          ? `Synced from local covers folder (${entry.fileName})`
          : `Custom cover artwork (${entry.fileName})`,
      source: entry.source ?? "imported",
      trackId: entry.trackId,
      fileName: entry.fileName,
      localFilePath: entry.localFilePath,
    };
    useStudioStore.getState().addCustomCover(asset);
    created.push(asset);
  }
  return created;
}

export async function syncElectronStudioFolder(
  dirPath: string,
  kind: "fonts" | "covers",
): Promise<number> {
  const bridge =
    typeof window !== "undefined" ? window.linerElectron?.localMedia : undefined;
  if (!bridge) return 0;

  const scanned = await bridge.scanDirectory(dirPath, kind);
  const store = useStudioStore.getState();

  if (kind === "fonts") {
    const existing = new Set(
      store.customFonts.map((f) => f.localFilePath).filter(Boolean),
    );
    const batch: {
      blob: Blob;
      fileName: string;
      localFilePath: string;
      source: "folder";
    }[] = [];
    for (const fileInfo of scanned) {
      if (existing.has(fileInfo.path)) continue;
      const payload = await bridge.readFile(fileInfo.path);
      if (!payload) continue;
      batch.push({
        blob: new Blob([new Uint8Array(payload.bytes)], {
          type: payload.mimeType,
        }),
        fileName: payload.name,
        localFilePath: payload.path,
        source: "folder",
      });
    }
    if (batch.length > 0) await importFontBlobs(batch);
    store.setSyncedFontsFolder(dirPath);
    void bridge.watchDirectory(dirPath, "fonts");
    return batch.length;
  }

  const existing = new Set(
    store.customCovers.map((c) => c.localFilePath).filter(Boolean),
  );
  const batch: {
    blob: Blob;
    fileName: string;
    localFilePath: string;
    source: "folder";
  }[] = [];
  for (const fileInfo of scanned) {
    if (existing.has(fileInfo.path)) continue;
    const payload = await bridge.readFile(fileInfo.path);
    if (!payload) continue;
    batch.push({
      blob: new Blob([new Uint8Array(payload.bytes)], {
        type: payload.mimeType,
      }),
      fileName: payload.name,
      localFilePath: payload.path,
      source: "folder",
    });
  }
  if (batch.length > 0) await importCoverBlobs(batch);
  store.setSyncedCoversFolder(dirPath);
  void bridge.watchDirectory(dirPath, "covers");
  return batch.length;
}
