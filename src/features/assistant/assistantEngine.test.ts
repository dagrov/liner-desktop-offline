import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("lottie-web", () => ({
  default: { loadAnimation: vi.fn() },
}));

vi.mock("@/shared/ui", () => ({
  showToast: vi.fn(),
}));

import { SAMPLE_TRACKS } from "@/features/offline/lib/sampleLibrary";
import {
  getAllOfflineTracks,
  toClientTrackFromOffline,
  useOfflineLibraryStore,
} from "@/features/offline/store/offlineLibraryStore";
import { STARTER_FONTS } from "@/features/studio/lib/starterAssets";
import { useStudioStore } from "@/features/studio/store/studioStore";
import { usePlayerStore } from "@/features/player/store/playerStore";
import { playerEngine } from "@/features/player/engine/playerEngine";
import { useAssistantStore } from "./store/assistantStore";
import {
  evaluateBuiltinAssistant,
  executeAssistantPayload,
  extractJsonActionPayload,
} from "./lib/assistantEngine";

describe("Music Assistant Engine & Strict JSON Contract", () => {
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
    });

    const allTracks = getAllOfflineTracks();
    const first = toClientTrackFromOffline(allTracks[0]);
    const second = toClientTrackFromOffline(allTracks[1]);
    usePlayerStore.setState({
      currentTrack: first,
      queue: [first, second],
      currentIndex: 0,
      volume: 0.7,
      status: "playing",
    });

    vi.spyOn(playerEngine, "playTrack").mockResolvedValue(undefined);
    vi.spyOn(playerEngine, "pause").mockImplementation(() => {});
    vi.spyOn(playerEngine, "skipNext").mockResolvedValue(undefined);
    vi.spyOn(playerEngine, "setVolume").mockImplementation((vol: number) => {
      usePlayerStore.setState({ volume: vol });
    });
  });

  it("is strictly disabled (OFF) by default so Liner stays AI-free out of the box", () => {
    expect(useAssistantStore.getState().enabled).toBe(false);
  });

  it("handles relative volume commands (-15% / +15%) and strict JSON schema", () => {
    const evalQuiet = evaluateBuiltinAssistant("Make it a bit quieter");
    expect(evalQuiet.payload?.action).toBe("SET_VOLUME");
    expect(evalQuiet.payload?.parameters.target).toBe("master");
    expect(evalQuiet.payload?.parameters.value).toBe(55); // 70% - 15% = 55%
    expect(evalQuiet.payload).toHaveProperty("assistant_reply");
    expect(usePlayerStore.getState().volume).toBeCloseTo(0.55, 2);

    const evalLouder = evaluateBuiltinAssistant("Turn it up a bit");
    expect(evalLouder.payload?.action).toBe("SET_VOLUME");
    expect(evalLouder.payload?.parameters.value).toBe(70); // 55% + 15% = 70%
    expect(usePlayerStore.getState().volume).toBeCloseTo(0.7, 2);
  });

  it("verifies font assets against the user's collection and asks for confirmation on unknown fonts", () => {
    const validFont = evaluateBuiltinAssistant(
      "Change the player font to Editorial Serif",
    );
    expect(validFont.payload?.action).toBe("CHANGE_FONT");
    expect(validFont.payload?.parameters.value).toBe("Editorial Serif");
    expect(useStudioStore.getState().activeTitleFontId).toBe(
      "font-editorial-serif",
    );

    const unverifiedFont = evaluateBuiltinAssistant(
      'Change font to "Papyrus Ultra Nonexistent"',
    );
    expect(unverifiedFont.payload).toBeNull();
    expect(unverifiedFont.replyText.toLowerCase()).toContain("confirm");
    expect(unverifiedFont.quickChoices && unverifiedFont.quickChoices.length).toBeGreaterThan(0);
  });

  it("changes cover art when requested and asks for clarification on ambiguous track matches", () => {
    const coverCmd = evaluateBuiltinAssistant("Switch to the alternate cover");
    expect(coverCmd.payload?.action).toBe("CHANGE_COVER");

    // Add two distinct custom tracks sharing the exact same title to trigger ambiguity clarification
    useOfflineLibraryStore.setState((s) => ({
      customTracks: [
        ...s.customTracks,
        {
          id: "local:eclipse-a",
          title: "Solaris",
          artists: "Artist Alpha",
          artistId: "artist:alpha",
          albumTitle: "Alpha Tape",
          albumId: "album:alpha",
          coverUrl: SAMPLE_TRACKS[0].coverUrl,
          originalCoverUrl: SAMPLE_TRACKS[0].coverUrl,
          durationMs: 120_000,
          genre: "Ambient",
          moods: ["chill"],
          vibeTags: ["clean"],
          playCount: 1,
          source: "local",
          mimeType: "audio/wav",
          addedAt: new Date().toISOString(),
        },
        {
          id: "local:eclipse-b",
          title: "Solaris",
          artists: "Artist Beta",
          artistId: "artist:beta",
          albumTitle: "Beta Tape",
          albumId: "album:beta",
          coverUrl: SAMPLE_TRACKS[1].coverUrl,
          originalCoverUrl: SAMPLE_TRACKS[1].coverUrl,
          durationMs: 135_000,
          genre: "Synthwave",
          moods: ["retro"],
          vibeTags: ["neon"],
          playCount: 1,
          source: "local",
          mimeType: "audio/wav",
          addedAt: new Date().toISOString(),
        },
      ],
    }));

    const ambiguous = evaluateBuiltinAssistant("Play Solaris");
    expect(ambiguous.payload).toBeNull();
    expect(ambiguous.quickChoices?.length).toBeGreaterThanOrEqual(2);
    expect(ambiguous.replyText).toContain("Artist Alpha");
    expect(ambiguous.replyText).toContain("Artist Beta");
  });

  it("answers artist/album liner-note context concisely and parses fenced LLM JSON", () => {
    const contextEval = evaluateBuiltinAssistant("Tell me about this artist");
    expect(contextEval.payload).toBeNull();
    expect(contextEval.replyText).toContain(
      SAMPLE_TRACKS[0].artistName,
    );

    const parsed = extractJsonActionPayload(`\`\`\`json
{
  "action": "SKIP",
  "parameters": { "target": "next", "value": null, "filters": {} },
  "assistant_reply": "Skipping ahead."
}
\`\`\``);
    expect(parsed.payload?.action).toBe("SKIP");
    expect(parsed.payload?.assistant_reply).toBe("Skipping ahead.");
  });
});
