import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("lottie-web", () => ({
  default: { loadAnimation: vi.fn() },
}));

import { SAMPLE_TRACKS } from "@/features/offline/lib/sampleLibrary";
import {
  getAllOfflineTracks,
  getOfflineTrackById,
  toClientTrackFromOffline,
  useOfflineLibraryStore,
} from "@/features/offline/store/offlineLibraryStore";
import { usePlayerStore } from "@/features/player/store/playerStore";
import { STARTER_COVERS, STARTER_FONTS } from "./lib/starterAssets";
import { useStudioStore } from "./store/studioStore";

describe("Studio Store — Cover Art & Typography Customization", () => {
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

    useStudioStore.setState({
      customFonts: [],
      customCovers: [],
      activeTitleFontId: "font-montserrat-studio",
      activeBodyFontId: "font-inter-clean",
      coverPickerTrackId: null,
    });

    const first = toClientTrackFromOffline(getAllOfflineTracks()[0]);
    usePlayerStore.setState({
      currentTrack: first,
      queue: [first],
      currentIndex: 0,
    });
  });

  it("ships curated starter fonts and starter cover artworks", () => {
    expect(STARTER_FONTS.length).toBeGreaterThanOrEqual(7);
    expect(STARTER_COVERS.length).toBeGreaterThanOrEqual(8);
  });

  it("swaps, cycles, and restores original track cover art across OfflineLibrary & PlayerStore", () => {
    const trackId = SAMPLE_TRACKS[0].id;
    const originalCover = SAMPLE_TRACKS[0].coverUrl;
    const targetCover = STARTER_COVERS.find(
      (c) => c.imageUrl !== originalCover,
    )!;

    const applied = useStudioStore
      .getState()
      .applyCoverAssetToTrack(trackId, targetCover.id);
    expect(applied?.id).toBe(targetCover.id);
    expect(getOfflineTrackById(trackId)?.coverUrl).toBe(targetCover.imageUrl);
    expect(usePlayerStore.getState().currentTrack?.coverUrl).toBe(
      targetCover.imageUrl,
    );

    const cycled = useStudioStore.getState().cycleTrackCover(trackId);
    expect(cycled).not.toBeNull();
    expect(getOfflineTrackById(trackId)?.coverUrl).toBe(cycled?.coverUrl);

    useStudioStore.getState().resetTrackCover(trackId);
    expect(getOfflineTrackById(trackId)?.coverUrl).toBe(originalCover);
    expect(usePlayerStore.getState().currentTrack?.coverUrl).toBe(
      originalCover,
    );
  });

  it("updates Title and Interface typography and resets cleanly", () => {
    const serifFont = STARTER_FONTS.find((f) => f.category === "serif")!;
    useStudioStore.getState().setTitleFont(serifFont.id);
    expect(useStudioStore.getState().activeTitleFontId).toBe(serifFont.id);

    useStudioStore.getState().resetTypography();
    expect(useStudioStore.getState().activeTitleFontId).toBe(
      STARTER_FONTS[0].id,
    );
    expect(useStudioStore.getState().activeBodyFontId).toBe(
      STARTER_FONTS[1].id,
    );
  });
});
