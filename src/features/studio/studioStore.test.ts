import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("lottie-web", () => ({
  default: { loadAnimation: vi.fn() },
}));

import { SAMPLE_TRACKS, svgToDataUrl } from "@/features/offline/lib/sampleLibrary";
import {
  getAllOfflineTracks,
  getOfflineTrackById,
  toClientTrackFromOffline,
  useOfflineLibraryStore,
} from "@/features/offline/store/offlineLibraryStore";
import { usePlayerStore } from "@/features/player/store/playerStore";
import { STARTER_COVERS, STARTER_FONTS } from "./lib/starterAssets";
import { useStudioStore } from "./store/studioStore";

describe("Studio Store — Vinyl-Only Built-In Cover & Music Title Font", () => {
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
      activeTitleFontId: STARTER_FONTS[0].id,
      activeBodyFontId: STARTER_FONTS[1].id,
      coverPickerTrackId: null,
    });

    const first = toClientTrackFromOffline(getAllOfflineTracks()[0]);
    usePlayerStore.setState({
      currentTrack: first,
      queue: [first],
      currentIndex: 0,
    });
  });

  it("ships curated music title fonts and ONLY the Minimalist Vinyl built-in cover", () => {
    expect(STARTER_FONTS.length).toBeGreaterThanOrEqual(7);
    expect(STARTER_COVERS.map((c) => c.id)).toEqual(["cover-minimal-vinyl"]);
  });

  it("swaps, cycles, and restores custom track cover art across OfflineLibrary & PlayerStore", () => {
    const trackId = SAMPLE_TRACKS[0].id;
    const originalCover = SAMPLE_TRACKS[0].coverUrl;
    const customCoverUrl = svgToDataUrl(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#111"/></svg>',
    );

    useStudioStore.getState().addCustomCover({
      id: "cover-user-sleeve",
      name: "Uploaded Sleeve",
      imageUrl: customCoverUrl,
      tags: ["custom"],
      description: "User uploaded cover",
      source: "imported",
    });

    const applied = useStudioStore
      .getState()
      .applyCoverAssetToTrack(trackId, "cover-user-sleeve");
    expect(applied?.id).toBe("cover-user-sleeve");
    expect(getOfflineTrackById(trackId)?.coverUrl).toBe(customCoverUrl);
    expect(usePlayerStore.getState().currentTrack?.coverUrl).toBe(
      customCoverUrl,
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

  it("updates music title font selection and resets cleanly", () => {
    const serifFont = STARTER_FONTS.find((f) => f.category === "serif")!;
    useStudioStore.getState().setTitleFont(serifFont.id);
    expect(useStudioStore.getState().activeTitleFontId).toBe(serifFont.id);

    useStudioStore.getState().resetTypography();
    expect(useStudioStore.getState().activeTitleFontId).toBe(
      STARTER_FONTS[0].id,
    );
  });
});
