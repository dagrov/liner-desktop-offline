import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  formatLrcTimestamp,
  normalizeLyricsInput,
} from "./lib/customLyricsUtils";
import {
  importLocalAudioBlobs,
  offlineApi,
  saveTrackCustomLyrics,
  useOfflineLibraryStore,
} from "./store/offlineLibraryStore";
import { useLyricsStore } from "@/features/lyrics/store/lyricsStore";
import { usePlayerStore } from "@/features/player/store/playerStore";
import { useOverlaySettingsStore } from "@/features/overlay/store/overlaySettingsStore";

describe("Custom Lyrics (File Import + Paste) & Mini Player Widget", () => {
  beforeEach(() => {
    useOfflineLibraryStore.setState({
      customTracks: [],
      trackLyricsOverrides: {},
      lyricsEditorTrackId: null,
    });
    useLyricsStore.getState().reset();
    usePlayerStore.setState({ currentTrack: null });
    useOverlaySettingsStore.setState({
      enabled: true,
      inAppWidgetOpen: false,
    });
    delete (window as any).linerElectron;
  });

  it("normalizes plain text, LRC, word-synced LRC, and SRT/VTT files", () => {
    const plain = normalizeLyricsInput("First verse line\nSecond verse line");
    expect(plain.format).toBe("plain");
    expect(plain.syncLevel).toBe("plain");
    expect(plain.lineCount).toBe(2);

    const lrc = normalizeLyricsInput(
      "[00:05.20] Golden city lights\n[00:09.80] Echo through the night",
      "song.lrc",
    );
    expect(lrc.format).toBe("lrc");
    expect(lrc.syncLevel).toBe("line_level");
    expect(lrc.lineCount).toBe(2);

    const srt = normalizeLyricsInput(
      "1\n00:00:12,500 --> 00:00:16,000\nHello from SRT\n\n2\n00:00:16,500 --> 00:00:20,000\nSynced automatically\n",
      "captions.srt",
    );
    expect(srt.format).toBe("lrc");
    expect(srt.syncLevel).toBe("line_level");
    expect(srt.content).toContain("[00:12.50]Hello from SRT");
    expect(srt.content).toContain("[00:16.50]Synced automatically");

    expect(formatLrcTimestamp(83_450)).toBe("[01:23.45]");
  });

  it("injects pasted or imported lyrics live into useLyricsStore while track is playing", async () => {
    const [track] = await importLocalAudioBlobs([
      {
        file: new Blob([new Uint8Array([0, 1, 2, 3])], { type: "audio/mpeg" }),
        name: "Addis Sunset.mp3",
      },
    ]);

    usePlayerStore.setState({
      currentTrack: {
        id: track.id,
        title: track.title,
        artists: track.artists,
        coverUrl: track.coverUrl,
        durationMs: 180_000,
      } as any,
    });

    // 1. Paste synced LRC while song is playing
    const res = saveTrackCustomLyrics(
      track.id,
      "[00:04.00] First synced line\n[00:08.50] Second synced line",
      "Addis Sunset.lrc",
    );
    expect(res.saved).toBe(true);
    expect(res.syncLevel).toBe("line_level");

    const liveState = useLyricsStore.getState();
    expect(liveState.currentLyricsTrackId).toBe(track.id);
    expect(liveState.activeProvider).toBe("Local Lyrics");
    expect(liveState.syncedLines.length).toBe(2);
    expect(liveState.syncedLines[0]?.text).toContain("First synced line");

    // 2. Also served by offlineApi.streamLyrics
    const events = [];
    for await (const ev of offlineApi.streamLyrics(track.id)) {
      events.push(ev);
    }
    expect(events.some((e) => e.type === "provider" && e.status === "found")).toBe(
      true,
    );

    // 3. Clearing lyrics resets live store cleanly
    const cleared = saveTrackCustomLyrics(track.id, "");
    expect(cleared.saved).toBe(false);
    expect(useLyricsStore.getState().braccatoLyrics).toEqual([]);
  });

  it("toggles Mini Player Widget in both web preview and Electron modes", () => {
    useOverlaySettingsStore.getState().toggleMiniPlayerWidget();
    expect(useOverlaySettingsStore.getState().inAppWidgetOpen).toBe(true);

    useOverlaySettingsStore.getState().toggleMiniPlayerWidget();
    expect(useOverlaySettingsStore.getState().inAppWidgetOpen).toBe(false);

    const toggleOverlaySpy = vi.fn().mockResolvedValue(true);
    (window as any).linerElectron = { toggleOverlay: toggleOverlaySpy };

    useOverlaySettingsStore.getState().toggleMiniPlayerWidget();
    expect(toggleOverlaySpy).toHaveBeenCalledTimes(1);
  });
});
