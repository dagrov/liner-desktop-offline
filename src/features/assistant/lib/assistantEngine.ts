import { playerEngine } from "@/features/player/engine/playerEngine";
import { usePlayerStore } from "@/features/player/store/playerStore";
import {
  getAllOfflineTracks,
  getOfflineTrackById,
  toClientTrackFromOffline,
  useOfflineLibraryStore,
  type OfflineTrackRecord,
} from "@/features/offline/store/offlineLibraryStore";
import {
  getAllStudioCovers,
  getAllStudioFonts,
  useStudioStore,
} from "@/features/studio/store/studioStore";
import type { CoverAsset, FontAsset } from "@/features/studio/lib/starterAssets";
import type {
  AssistantActionPayload,
  AssistantActionType,
  AssistantQuickChoice,
  LocalLlmProvider,
} from "../types";

export interface AssistantTurnResult {
  replyText: string;
  payload: AssistantActionPayload | null;
  quickChoices?: AssistantQuickChoice[];
  matchedTrackIds?: string[];
  engineSource: "local-llm" | "builtin";
}

const VALID_ACTIONS = new Set<AssistantActionType>([
  "PLAY_TRACK",
  "PAUSE",
  "SKIP",
  "SET_VOLUME",
  "CHANGE_COVER",
  "CHANGE_FONT",
  "SEARCH_LIBRARY",
]);

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/['’".,!?()[\]{}:;]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text: string): string[] {
  const stopWords = new Set([
    "the",
    "a",
    "an",
    "to",
    "for",
    "of",
    "in",
    "on",
    "this",
    "that",
    "song",
    "track",
    "music",
    "cover",
    "art",
    "artwork",
    "version",
    "edition",
    "font",
    "fonts",
    "title",
    "text",
    "typography",
    "typeface",
    "player",
    "change",
    "switch",
    "swap",
    "update",
    "set",
    "make",
    "apply",
    "use",
    "something",
    "some",
    "please",
    "can",
    "you",
    "me",
    "my",
    "it",
    "is",
    "with",
    "by",
  ]);
  return normalize(text)
    .split(" ")
    .filter((t) => t.length > 1 && !stopWords.has(t));
}

function scoreAssetMatch(
  queryRaw: string,
  name: string,
  tags: string[],
  category?: string,
): { score: number; exactName: boolean } {
  const qNorm = normalize(queryRaw);
  const nameNorm = normalize(name);
  if (!qNorm) return { score: 0, exactName: false };

  if (qNorm === nameNorm || qNorm.includes(nameNorm)) {
    return { score: 100 + nameNorm.length, exactName: true };
  }

  // Strip generic words like "version" / "font" / "serif" only for clean comparison
  const tokens = tokenize(queryRaw);
  if (tokens.length === 0) return { score: 0, exactName: false };

  const nameTokens = normalize(name).split(" ");
  const tagSet = new Set(tags.map((t) => normalize(t)));

  let score = 0;
  for (const tok of tokens) {
    if (nameTokens.includes(tok)) {
      score += 25;
    } else if (nameNorm.includes(tok)) {
      score += 16;
    }
    if (tagSet.has(tok)) {
      score += 20;
    } else {
      for (const tag of tagSet) {
        if (tag.includes(tok) || tok.includes(tag)) {
          score += 10;
          break;
        }
      }
    }
    if (category && normalize(category) === tok) {
      score += 18;
    }
  }

  return { score, exactName: false };
}

function findTopScored<T>(
  items: T[],
  scorer: (item: T) => { score: number; exactName: boolean },
): { best: T[]; ambiguous: boolean } {
  const scored = items
    .map((item) => ({ item, ...scorer(item) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return { best: [], ambiguous: false };
  const top = scored[0];
  const tied = scored.filter((s) => s.score === top.score);
  if (tied.length > 1) {
    return { best: tied.slice(0, 4).map((t) => t.item), ambiguous: true };
  }
  return { best: [top.item], ambiguous: false };
}

function resolveTargetTrackFromPrompt(prompt: string): OfflineTrackRecord | null {
  const all = getAllOfflineTracks();
  const qNorm = normalize(prompt);
  for (const t of all) {
    const tNorm = normalize(t.title);
    if (tNorm.length >= 3 && qNorm.includes(tNorm)) {
      return t;
    }
  }
  const currentId = usePlayerStore.getState().currentTrack?.id;
  if (currentId) {
    return getOfflineTrackById(currentId) ?? all[0] ?? null;
  }
  return all[0] ?? null;
}

// ---- Action Executor --------------------------------------------------------

export function executeAssistantPayload(
  payload: AssistantActionPayload,
): { matchedTrackIds?: string[] } {
  const player = usePlayerStore.getState();
  const studio = useStudioStore.getState();
  const allTracks = getAllOfflineTracks();

  switch (payload.action) {
    case "PAUSE": {
      playerEngine.pause();
      return {};
    }

    case "SKIP": {
      const dir = String(payload.parameters.target || "next").toLowerCase();
      if (dir.includes("prev") || dir.includes("back")) {
        playerEngine.skipPrevious();
      } else {
        playerEngine.skipNext();
      }
      return {};
    }

    case "SET_VOLUME": {
      const rawVal = Number(payload.parameters.value);
      if (Number.isFinite(rawVal)) {
        const pct = Math.max(0, Math.min(100, rawVal));
        playerEngine.setVolume(pct / 100);
      }
      return {};
    }

    case "PLAY_TRACK": {
      const repeatFilter = payload.parameters.filters?.repeat;
      if (
        repeatFilter === "one" ||
        repeatFilter === "all" ||
        repeatFilter === "off"
      ) {
        playerEngine.setRepeat(repeatFilter);
        if (!payload.parameters.target) {
          if (player.status === "paused" && player.currentTrack) {
            playerEngine.resume();
          }
          return {};
        }
      }

      const target = payload.parameters.target;
      if (!target || target === "current" || target === "resume") {
        if (player.currentTrack) {
          if (player.status === "paused") {
            playerEngine.resume();
          } else if (player.status === "idle") {
            playerEngine.playTrack(player.currentTrack, player.queue);
          }
          return { matchedTrackIds: [player.currentTrack.id] };
        }
        if (allTracks[0]) {
          const clientList = allTracks.map(toClientTrackFromOffline);
          playerEngine.playTrack(clientList[0], clientList);
          return { matchedTrackIds: [clientList[0].id] };
        }
        return {};
      }

      // Check playlist ID or title first
      const playlists = useOfflineLibraryStore.getState().playlists;
      const plMatch = playlists.find(
        (pl) =>
          pl.id === target ||
          normalize(pl.title) === normalize(target),
      );
      if (plMatch) {
        const plTracks = plMatch.items
          .map((i) => getOfflineTrackById(i.trackId))
          .filter((t): t is OfflineTrackRecord => Boolean(t))
          .map(toClientTrackFromOffline);
        if (plTracks.length > 0) {
          playerEngine.playTrack(plTracks[0], plTracks, `playlist:${plMatch.id}`);
          return { matchedTrackIds: plTracks.map((t) => t.id) };
        }
      }

      // Match track by id or title/artist/mood
      const exactById = allTracks.find((t) => t.id === target);
      if (exactById) {
        const queueIds = Array.isArray(payload.parameters.filters?.queueIds)
          ? (payload.parameters.filters.queueIds as string[])
          : null;
        const queueRecords = queueIds
          ? queueIds
              .map((id) => getOfflineTrackById(id))
              .filter((t): t is OfflineTrackRecord => Boolean(t))
          : allTracks;
        const clientQueue = queueRecords.map(toClientTrackFromOffline);
        const clientTarget = toClientTrackFromOffline(exactById);
        playerEngine.playTrack(clientTarget, clientQueue);
        return {
          matchedTrackIds: queueIds ?? [exactById.id],
        };
      }

      const byName = allTracks.find(
        (t) =>
          normalize(t.title) === normalize(target) ||
          normalize(`${t.title} ${t.artists}`).includes(normalize(target)),
      );
      if (byName) {
        const clientQueue = allTracks.map(toClientTrackFromOffline);
        playerEngine.playTrack(toClientTrackFromOffline(byName), clientQueue);
        return { matchedTrackIds: [byName.id] };
      }
      return {};
    }

    case "CHANGE_COVER": {
      const targetTrack =
        (payload.parameters.target &&
          getOfflineTrackById(payload.parameters.target)) ||
        (player.currentTrack && getOfflineTrackById(player.currentTrack.id)) ||
        allTracks[0];
      if (!targetTrack) return {};

      const val = String(payload.parameters.value || "");
      if (val === "cycle" || val === "next") {
        studio.cycleTrackCover(targetTrack.id);
        return { matchedTrackIds: [targetTrack.id] };
      }
      if (val === "reset" || val === "original") {
        studio.resetTrackCover(targetTrack.id);
        return { matchedTrackIds: [targetTrack.id] };
      }

      const covers = getAllStudioCovers();
      const cover =
        covers.find((c) => c.id === val) ||
        covers.find((c) => normalize(c.name) === normalize(val));
      if (cover) {
        studio.applyCoverAssetToTrack(targetTrack.id, cover.id);
      }
      return { matchedTrackIds: [targetTrack.id] };
    }

    case "CHANGE_FONT": {
      const val = String(payload.parameters.value || "");
      const targetSurface = String(payload.parameters.target || "title");
      const fonts = getAllStudioFonts();
      const font =
        fonts.find((f) => f.id === val) ||
        fonts.find((f) => normalize(f.name) === normalize(val));
      if (font) {
        if (targetSurface === "body" || targetSurface === "ui") {
          studio.setBodyFont(font.id);
        } else {
          studio.setTitleFont(font.id);
        }
      }
      return {};
    }

    case "SEARCH_LIBRARY": {
      const q = String(payload.parameters.value || payload.parameters.target || "").trim();
      const norm = normalize(q);
      const matched = allTracks.filter((t) => {
        if (!norm) return true;
        return normalize(
          `${t.title} ${t.artists} ${t.albumTitle} ${t.genre} ${t.moods.join(" ")} ${t.vibeTags.join(" ")}`,
        ).includes(norm);
      });
      return { matchedTrackIds: matched.slice(0, 6).map((t) => t.id) };
    }
  }
}

// ---- Built-in Deterministic Context-Aware Music Assistant -------------------

export function evaluateBuiltinAssistant(promptRaw: string): AssistantTurnResult {
  const prompt = promptRaw.trim();
  const norm = normalize(prompt);
  const player = usePlayerStore.getState();
  const allTracks = getAllOfflineTracks();
  const allFonts = getAllStudioFonts();
  const allCovers = getAllStudioCovers();

  const activeTrack =
    (player.currentTrack && getOfflineTrackById(player.currentTrack.id)) ||
    allTracks[0] ||
    null;

  // 1. Music Context & Artist/Album Facts (conversational, no unnecessary action)
  if (
    /\b(fact|facts|about this|tell me about|who is|story behind|liner notes|info on|background on|what song is this|what s playing|whats playing)\b/.test(
      norm,
    )
  ) {
    if (!activeTrack) {
      return {
        replyText:
          "Nothing is cued right now. Select any track from your library and ask me for its liner notes or studio backstory.",
        payload: null,
        engineSource: "builtin",
      };
    }
    const details = [
      `**${activeTrack.title}** by **${activeTrack.artists}** — from *${activeTrack.albumTitle}* (${activeTrack.genre}${activeTrack.bpm ? `, ${activeTrack.bpm} BPM` : ""}).`,
      activeTrack.curatorFact || activeTrack.artistBio,
      activeTrack.albumLinerNotes,
    ]
      .filter(Boolean)
      .join(" ");

    return {
      replyText: details,
      payload: null,
      matchedTrackIds: [activeTrack.id],
      engineSource: "builtin",
    };
  }

  // 2. Typography / Font Customization
  if (
    /\b(font|fonts|typeface|typography|serif|sans|monospace|mono)\b/.test(
      norm,
    ) ||
    (/\btitle\b/.test(norm) && /\b(clean|retro|editorial|modern)\b/.test(norm))
  ) {
    const isBody = /\b(body|interface|ui|app text)\b/.test(norm);
    const targetSurface = isBody ? "body" : "title";

    // Match album/track vibe automatically
    if (/\b(match|fit|suit)\b.*\b(vibe|mood|album|track|song|aesthetic)\b/.test(norm)) {
      const preferredCat = activeTrack?.recommendedFontCategory ?? "sans";
      const trackTags = activeTrack?.vibeTags ?? ["clean"];
      const ranked = [...allFonts].sort((a, b) => {
        const aScore =
          (a.category === preferredCat ? 30 : 0) +
          a.tags.filter((t) => trackTags.includes(t)).length * 12;
        const bScore =
          (b.category === preferredCat ? 30 : 0) +
          b.tags.filter((t) => trackTags.includes(t)).length * 12;
        return bScore - aScore;
      });
      const chosen = ranked[0] ?? allFonts[0];
      const reply = activeTrack
        ? `Matched the typography to *${activeTrack.albumTitle}*—switched to **${chosen.name}**.`
        : `Switched typography to **${chosen.name}**.`;
      const payload: AssistantActionPayload = {
        action: "CHANGE_FONT",
        parameters: {
          target: targetSurface,
          value: chosen.name,
          filters: { fontId: chosen.id, category: chosen.category, matchedVibe: true },
        },
        assistant_reply: reply,
      };
      executeAssistantPayload(payload);
      return { replyText: reply, payload, engineSource: "builtin" };
    }

    const { best, ambiguous } = findTopScored<FontAsset>(allFonts, (f) =>
      scoreAssetMatch(prompt, f.name, f.tags, f.category),
    );

    if (best.length === 0) {
      const availableNames = allFonts.slice(0, 5).map((f) => f.name);
      return {
        replyText: `I couldn't verify that font in your Studio collection. Please confirm the exact font name you'd like to apply—available options include: ${availableNames.map((n) => `**${n}**`).join(", ")}.`,
        payload: null,
        quickChoices: availableNames.map((name) => ({
          label: name,
          prompt: `Switch ${targetSurface} font to ${name}`,
        })),
        engineSource: "builtin",
      };
    }

    if (ambiguous) {
      return {
        replyText: `Multiple fonts in your collection match equally: ${best.map((f) => `**${f.name}**`).join(", ")}. Which one would you like to apply?`,
        payload: null,
        quickChoices: best.map((f) => ({
          label: f.name,
          prompt: `Switch ${targetSurface} font to ${f.name}`,
        })),
        engineSource: "builtin",
      };
    }

    const chosen = best[0];
    const reply = `Switched the ${targetSurface === "body" ? "interface" : "title"} typography to **${chosen.name}**.`;
    const payload: AssistantActionPayload = {
      action: "CHANGE_FONT",
      parameters: {
        target: targetSurface,
        value: chosen.name,
        filters: { fontId: chosen.id, category: chosen.category },
      },
      assistant_reply: reply,
    };
    executeAssistantPayload(payload);
    return { replyText: reply, payload, engineSource: "builtin" };
  }

  // 3. Cover Art Customization
  if (/\b(cover|artwork|sleeve|album art)\b/.test(norm)) {
    const targetTrack = resolveTargetTrackFromPrompt(prompt);
    if (!targetTrack) {
      return {
        replyText: "Select or play a track first so I know which cover art to update.",
        payload: null,
        engineSource: "builtin",
      };
    }

    if (/\b(cycle|next|rotate|another|alternate|alt)\b/.test(norm)) {
      const cycled = useStudioStore.getState().cycleTrackCover(targetTrack.id);
      const label = cycled?.label ?? "Next Cover";
      const reply = `Cycled cover art for **${targetTrack.title}** to **${label}**.`;
      const payload: AssistantActionPayload = {
        action: "CHANGE_COVER",
        parameters: {
          target: targetTrack.id,
          value: label,
          filters: { mode: "cycle", trackTitle: targetTrack.title },
        },
        assistant_reply: reply,
      };
      return {
        replyText: reply,
        payload,
        matchedTrackIds: [targetTrack.id],
        engineSource: "builtin",
      };
    }

    if (/\b(reset|restore|original|default)\b/.test(norm)) {
      useStudioStore.getState().resetTrackCover(targetTrack.id);
      const reply = `Restored the original cover artwork for **${targetTrack.title}**.`;
      const payload: AssistantActionPayload = {
        action: "CHANGE_COVER",
        parameters: {
          target: targetTrack.id,
          value: "original",
          filters: { mode: "reset", trackTitle: targetTrack.title },
        },
        assistant_reply: reply,
      };
      return {
        replyText: reply,
        payload,
        matchedTrackIds: [targetTrack.id],
        engineSource: "builtin",
      };
    }

    // Remove track title from query before scoring cover names so track words don't skew cover match
    const coverQuery = prompt.replace(
      new RegExp(targetTrack.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "ig"),
      "",
    );
    const { best, ambiguous } = findTopScored<CoverAsset>(allCovers, (c) =>
      scoreAssetMatch(coverQuery, c.name, c.tags),
    );

    if (best.length === 0) {
      const names = allCovers.slice(0, 5).map((c) => c.name);
      return {
        replyText: `I couldn't verify that cover artwork in your collection. Please confirm the exact asset name—available covers include: ${names.map((n) => `**${n}**`).join(", ")}.`,
        payload: null,
        quickChoices: names.map((name) => ({
          label: name,
          prompt: `Change cover art for ${targetTrack.title} to ${name}`,
        })),
        engineSource: "builtin",
      };
    }

    if (ambiguous) {
      return {
        replyText: `I found multiple matching covers in your collection: ${best.map((c) => `**${c.name}**`).join(", ")}. Which cover should I apply to **${targetTrack.title}**?`,
        payload: null,
        quickChoices: best.map((c) => ({
          label: c.name,
          prompt: `Change cover art for ${targetTrack.title} to ${c.name}`,
        })),
        engineSource: "builtin",
      };
    }

    const chosenCover = best[0];
    useStudioStore
      .getState()
      .applyCoverAssetToTrack(targetTrack.id, chosenCover.id);
    const reply = `Updated cover art for **${targetTrack.title}** to **${chosenCover.name}**.`;
    const payload: AssistantActionPayload = {
      action: "CHANGE_COVER",
      parameters: {
        target: targetTrack.id,
        value: chosenCover.name,
        filters: { coverId: chosenCover.id, trackTitle: targetTrack.title },
      },
      assistant_reply: reply,
    };
    return {
      replyText: reply,
      payload,
      matchedTrackIds: [targetTrack.id],
      engineSource: "builtin",
    };
  }

  // 4. Volume Controls (relative & exact percentages)
  if (
    /\b(volume|quieter|louder|softer|mute|unmute|turn it up|turn it down|lower the sound|crank it)\b/.test(
      norm,
    ) ||
    /\b\d{1,3}\s*%/.test(prompt)
  ) {
    const currentPct = Math.round(player.volume * 100);
    let nextPct = currentPct;

    const explicitMatch = prompt.match(/(\d{1,3})\s*%?/);
    if (/\bmute\b/.test(norm) && !/\bunmute\b/.test(norm)) {
      nextPct = 0;
    } else if (/\bunmute\b/.test(norm)) {
      nextPct = currentPct === 0 ? 65 : currentPct;
    } else if (/\b(max|full)\s+volume\b/.test(norm)) {
      nextPct = 100;
    } else if (
      explicitMatch &&
      /\b(volume|to|at)\b/.test(norm) &&
      !/\b(by|up by|down by|lower by|raise by)\b/.test(norm)
    ) {
      nextPct = Math.max(0, Math.min(100, Number(explicitMatch[1])));
    } else if (
      explicitMatch &&
      /\b(by|up by|down by|lower by|raise by)\b/.test(norm)
    ) {
      const delta = Number(explicitMatch[1]);
      const down = /\b(down|lower|quieter|softer|reduce)\b/.test(norm);
      nextPct = Math.max(
        0,
        Math.min(100, currentPct + (down ? -delta : delta)),
      );
    } else if (/\b(much quieter|way quieter|way down)\b/.test(norm)) {
      nextPct = Math.max(0, currentPct - 30);
    } else if (/\b(much louder|way louder|crank it)\b/.test(norm)) {
      nextPct = Math.min(100, currentPct + 30);
    } else if (/\b(quieter|softer|turn it down|lower)\b/.test(norm)) {
      nextPct = Math.max(0, currentPct - 15);
    } else if (/\b(louder|turn it up|up)\b/.test(norm)) {
      nextPct = Math.min(100, currentPct + 15);
    }

    const reply =
      nextPct === 0
        ? "Audio muted."
        : `Volume set to **${nextPct}%** (was ${currentPct}%).`;
    const payload: AssistantActionPayload = {
      action: "SET_VOLUME",
      parameters: {
        target: "master",
        value: nextPct,
        filters: { previousVolume: currentPct },
      },
      assistant_reply: reply,
    };
    executeAssistantPayload(payload);
    return { replyText: reply, payload, engineSource: "builtin" };
  }

  // 5. Pause / Stop
  if (/^(pause|stop|hold on|pause music|pause playback|pause track)$/.test(norm)) {
    const reply = "Playback paused.";
    const payload: AssistantActionPayload = {
      action: "PAUSE",
      parameters: { target: activeTrack?.id ?? null, value: null, filters: {} },
      assistant_reply: reply,
    };
    executeAssistantPayload(payload);
    return { replyText: reply, payload, engineSource: "builtin" };
  }

  // 6. Skip / Next / Previous
  if (
    /\b(skip|next track|next song|play next|previous track|previous song|go back|prev)\b/.test(
      norm,
    ) ||
    norm === "next" ||
    norm === "previous"
  ) {
    const isPrev = /\b(previous|prev|back)\b/.test(norm);
    const direction = isPrev ? "previous" : "next";
    const payload: AssistantActionPayload = {
      action: "SKIP",
      parameters: { target: direction, value: 1, filters: {} },
      assistant_reply: isPrev
        ? "Stepping back to the previous track."
        : "Skipping to the next track.",
    };
    executeAssistantPayload(payload);
    const updatedTrack = usePlayerStore.getState().currentTrack;
    const reply = updatedTrack
      ? `${isPrev ? "Back to" : "Skipped to"} **${updatedTrack.title}** by ${updatedTrack.artists}.`
      : payload.assistant_reply;
    payload.assistant_reply = reply;
    return { replyText: reply, payload, engineSource: "builtin" };
  }

  // 7. Loop / Repeat Controls
  if (/\b(loop|repeat)\b/.test(norm)) {
    const turnOff = /\b(off|stop|disable|no)\b/.test(norm);
    const loopAll = /\b(all|queue|playlist)\b/.test(norm);
    const nextRepeat = turnOff ? "off" : loopAll ? "all" : "one";
    const reply =
      nextRepeat === "one"
        ? `Looping **${activeTrack?.title ?? "current track"}**.`
        : nextRepeat === "all"
          ? "Looping the entire queue."
          : "Repeat turned off.";
    const payload: AssistantActionPayload = {
      action: "PLAY_TRACK",
      parameters: {
        target: null,
        value: nextRepeat,
        filters: { repeat: nextRepeat },
      },
      assistant_reply: reply,
    };
    executeAssistantPayload(payload);
    return { replyText: reply, payload, engineSource: "builtin" };
  }

  // 8. Search Library
  if (/^(search|find|look up|show|filter|browse)\b/.test(norm)) {
    const cleaned = prompt
      .replace(/^(search|find|look up|show|filter|browse)(\s+(library|tracks|songs|music|for|me))*\s*/i, "")
      .trim();
    const qNorm = normalize(cleaned);
    const matches = allTracks.filter((t) =>
      normalize(
        `${t.title} ${t.artists} ${t.albumTitle} ${t.genre} ${t.moods.join(" ")} ${t.vibeTags.join(" ")}`,
      ).includes(qNorm),
    );
    const reply =
      matches.length > 0
        ? `Found **${matches.length}** track${matches.length === 1 ? "" : "s"} matching "${cleaned || "your library"}": ${matches
            .slice(0, 3)
            .map((t) => `**${t.title}** (${t.artists})`)
            .join(", ")}.`
        : `No tracks in your offline library matched "${cleaned}". Try searching by artist, mood (chill, retro, focus), or genre.`;
    const payload: AssistantActionPayload = {
      action: "SEARCH_LIBRARY",
      parameters: {
        target: "library",
        value: cleaned || null,
        filters: { matchCount: matches.length },
      },
      assistant_reply: reply,
    };
    return {
      replyText: reply,
      payload,
      matchedTrackIds: matches.slice(0, 5).map((t) => t.id),
      engineSource: "builtin",
    };
  }

  // 9. Play / Queue / Vibe Curation
  if (
    /\b(play|resume|start|queue|put on|curate|listen to)\b/.test(norm) ||
    allTracks.some((t) => normalize(t.title) === norm)
  ) {
    if (/^(play|resume|start|play music)$/.test(norm)) {
      const reply = activeTrack
        ? `Playing **${activeTrack.title}** by ${activeTrack.artists}.`
        : "Starting playback.";
      const payload: AssistantActionPayload = {
        action: "PLAY_TRACK",
        parameters: {
          target: "resume",
          value: activeTrack?.title ?? null,
          filters: {},
        },
        assistant_reply: reply,
      };
      executeAssistantPayload(payload);
      return {
        replyText: reply,
        payload,
        matchedTrackIds: activeTrack ? [activeTrack.id] : undefined,
        engineSource: "builtin",
      };
    }

    const queryBody = prompt
      .replace(
        /^(please\s+)?(play|queue|put on|curate|start|listen to)(\s+(some|something|a|tracks|music|songs|playlist|vibe|with|that feels))*\s*/i,
        "",
      )
      .trim();

    // Check mood/genre curation first when multiple vibe tracks fit
    const moodMatches = allTracks.filter((t) => {
      const tokens = tokenize(queryBody);
      if (tokens.length === 0) return false;
      return tokens.some(
        (tok) =>
          t.moods.some((m) => normalize(m).includes(tok)) ||
          normalize(t.genre).includes(tok) ||
          t.vibeTags.some((v) => normalize(v).includes(tok)),
      );
    });

    // Score specific track/artist matches
    const { best: trackMatches, ambiguous } = findTopScored<OfflineTrackRecord>(
      allTracks,
      (t) =>
        scoreAssetMatch(
          queryBody,
          t.title,
          [t.artists, t.albumTitle, t.genre, ...t.moods],
        ),
    );

    if (
      moodMatches.length >= 2 &&
      !allTracks.some((t) => normalize(queryBody).includes(normalize(t.title)))
    ) {
      const lead = moodMatches[0];
      const reply = `Curated a **${queryBody}** session starting with **${lead.title}** by ${lead.artists} (+${moodMatches.length - 1} queued).`;
      const payload: AssistantActionPayload = {
        action: "PLAY_TRACK",
        parameters: {
          target: lead.id,
          value: lead.title,
          filters: {
            mood: queryBody,
            queueIds: moodMatches.map((m) => m.id),
          },
        },
        assistant_reply: reply,
      };
      executeAssistantPayload(payload);
      return {
        replyText: reply,
        payload,
        matchedTrackIds: moodMatches.map((m) => m.id),
        engineSource: "builtin",
      };
    }

    if (ambiguous && trackMatches.length > 1) {
      return {
        replyText: `Multiple tracks match "${queryBody}": ${trackMatches.map((t) => `**${t.title}** (${t.artists})`).join(", ")}. Which one should I play?`,
        payload: null,
        quickChoices: trackMatches.map((t) => ({
          label: `${t.title} — ${t.artists}`,
          prompt: `Play ${t.title}`,
        })),
        engineSource: "builtin",
      };
    }

    if (trackMatches.length >= 1) {
      const chosen = trackMatches[0];
      const reply = `Now playing **${chosen.title}** by ${chosen.artists}.`;
      const payload: AssistantActionPayload = {
        action: "PLAY_TRACK",
        parameters: {
          target: chosen.id,
          value: chosen.title,
          filters: { artist: chosen.artists, album: chosen.albumTitle },
        },
        assistant_reply: reply,
      };
      executeAssistantPayload(payload);
      return {
        replyText: reply,
        payload,
        matchedTrackIds: [chosen.id],
        engineSource: "builtin",
      };
    }

    return {
      replyText: `I couldn't find "${queryBody}" in your offline library. Try asking for an artist like **Sora Vance** or a mood like **chill**, **retro**, or **cinematic**.`,
      payload: null,
      engineSource: "builtin",
    };
  }

  return {
    replyText:
      "I can control playback, adjust volume relatively (e.g. *'make it a bit quieter'*), swap cover art (*'change cover to Retro Version'*, *'cycle cover'*), customize fonts (*'change title font to something clean'*, *'match album vibe'*), or share liner notes about the current track.",
    payload: null,
    engineSource: "builtin",
  };
}

// ---- Local LLM Integration (Ollama & OpenAI-Compatible Local Endpoints) -----

async function performLocalHttp(input: {
  url: string;
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
}): Promise<{ ok: boolean; status: number; body: string; error?: string }> {
  if (typeof window !== "undefined" && window.linerElectron?.localLlm) {
    return window.linerElectron.localLlm.request(input);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs ?? 12_000);
  try {
    const res = await fetch(input.url, {
      method: input.method ?? "POST",
      headers: input.headers,
      body: input.body,
      signal: controller.signal,
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, body: text };
  } catch (err: any) {
    return {
      ok: false,
      status: 0,
      body: "",
      error: err?.message || "Connection refused",
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function testLocalLlmEndpoint(
  provider: LocalLlmProvider,
  endpointUrl: string,
): Promise<{ ok: boolean; models: string[]; detail: string }> {
  if (provider === "builtin") {
    return {
      ok: true,
      models: ["liner-offline-engine"],
      detail: "Built-in offline engine ready (0ms latency).",
    };
  }

  const base = endpointUrl.replace(/\/+$/, "");
  const probeUrl =
    provider === "ollama" ? `${base}/api/tags` : `${base}/models`;
  const res = await performLocalHttp({
    url: probeUrl,
    method: "GET",
    timeoutMs: 4000,
  });

  if (!res.ok) {
    return {
      ok: false,
      models: [],
      detail:
        res.error ||
        `Unreachable (${res.status || "offline"}). Built-in fallback remains active.`,
    };
  }

  try {
    const parsed = JSON.parse(res.body);
    const models: string[] =
      provider === "ollama"
        ? (parsed.models || []).map((m: any) => String(m.name)).filter(Boolean)
        : (parsed.data || []).map((m: any) => String(m.id)).filter(Boolean);
    return {
      ok: true,
      models,
      detail:
        models.length > 0
          ? `Connected · ${models.length} model(s) detected`
          : "Connected to local endpoint",
    };
  } catch {
    return { ok: true, models: [], detail: "Connected to local endpoint" };
  }
}

function buildSystemPrompt(): string {
  const player = usePlayerStore.getState();
  const tracks = getAllOfflineTracks();
  const fonts = getAllStudioFonts();
  const covers = getAllStudioCovers();
  const current =
    (player.currentTrack && getOfflineTrackById(player.currentTrack.id)) ||
    null;

  return `You are an advanced, context-aware Music Assistant integrated into Liner, a sleek desktop music player.
Style: Premium, concise, helpful, focused on the music.

CURRENT PLAYER STATE:
- Playing: ${current ? `"${current.title}" by ${current.artists} (id: "${current.id}", album: "${current.albumTitle}", genre: "${current.genre}", vibe: [${current.vibeTags.join(", ")}], fact: "${current.curatorFact ?? ""}")` : "Idle"}
- Status: ${player.status}
- Volume: ${Math.round(player.volume * 100)}%
- Repeat: ${player.repeat}

AVAILABLE LIBRARY TRACKS:
${tracks.map((t) => `- id="${t.id}" | "${t.title}" by ${t.artists} | album="${t.albumTitle}" | genre="${t.genre}" | moods=[${t.moods.join(",")}]`).join("\n")}

AVAILABLE VERIFIED FONTS IN COLLECTION:
${fonts.map((f) => `- "${f.name}" (category=${f.category}, tags=[${f.tags.join(",")}])`).join("\n")}

AVAILABLE VERIFIED COVER ARTS IN COLLECTION:
${covers.map((c) => `- "${c.name}" (tags=[${c.tags.join(",")}])`).join("\n")}

RULES:
1. Relative volume: e.g. "a bit quieter" = current volume minus 15; "turn it up" = current volume plus 15 (clamped 0..100).
2. If the user asks for an asset (font or cover) NOT in the verified lists above, do NOT output a JSON action—politely ask them to confirm the exact name from their collection.
3. If a request matches multiple tracks, fonts, or covers identically, list the top matches briefly and ask for clarification without outputting a JSON action.
4. For every request requiring a player action or change, include a strict JSON block:
\`\`\`json
{
  "action": "PLAY_TRACK | PAUSE | SKIP | SET_VOLUME | CHANGE_COVER | CHANGE_FONT | SEARCH_LIBRARY",
  "parameters": {
    "target": "string_or_null",
    "value": "string_or_number_or_null",
    "filters": {}
  },
  "assistant_reply": "Your brief, premium-toned confirmation message to the user."
}
\`\`\``;
}

export function extractJsonActionPayload(
  rawText: string,
): { cleanText: string; payload: AssistantActionPayload | null } {
  const fenced = rawText.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidateJson = fenced ? fenced[1].trim() : null;

  let parsed: any = null;
  if (candidateJson) {
    try {
      parsed = JSON.parse(candidateJson);
    } catch {
      parsed = null;
    }
  } else {
    const braceStart = rawText.indexOf("{");
    const braceEnd = rawText.lastIndexOf("}");
    if (braceStart !== -1 && braceEnd > braceStart) {
      try {
        parsed = JSON.parse(rawText.slice(braceStart, braceEnd + 1));
      } catch {
        parsed = null;
      }
    }
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    !VALID_ACTIONS.has(parsed.action)
  ) {
    return { cleanText: rawText.trim(), payload: null };
  }

  const payload: AssistantActionPayload = {
    action: parsed.action,
    parameters: {
      target:
        parsed.parameters?.target !== undefined
          ? parsed.parameters.target
          : null,
      value:
        parsed.parameters?.value !== undefined ? parsed.parameters.value : null,
      filters:
        parsed.parameters?.filters &&
        typeof parsed.parameters.filters === "object"
          ? parsed.parameters.filters
          : {},
    },
    assistant_reply:
      typeof parsed.assistant_reply === "string" &&
      parsed.assistant_reply.trim()
        ? parsed.assistant_reply.trim()
        : "Done.",
  };

  const withoutFence = fenced
    ? rawText.replace(fenced[0], "").trim()
    : payload.assistant_reply;

  return {
    cleanText: withoutFence || payload.assistant_reply,
    payload,
  };
}

export async function processAssistantPrompt(
  prompt: string,
  options: {
    provider: LocalLlmProvider;
    endpointUrl: string;
    modelName: string;
    autoFallbackToBuiltin: boolean;
  },
): Promise<AssistantTurnResult> {
  if (options.provider === "builtin") {
    return evaluateBuiltinAssistant(prompt);
  }

  const base = options.endpointUrl.replace(/\/+$/, "");
  const systemPrompt = buildSystemPrompt();

  const url =
    options.provider === "ollama"
      ? `${base}/api/chat`
      : `${base}/chat/completions`;

  const body =
    options.provider === "ollama"
      ? JSON.stringify({
          model: options.modelName || "llama3.2",
          stream: false,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt },
          ],
        })
      : JSON.stringify({
          model: options.modelName || "local-model",
          temperature: 0.2,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt },
          ],
        });

  const res = await performLocalHttp({
    url,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    timeoutMs: 14_000,
  });

  if (!res.ok) {
    if (options.autoFallbackToBuiltin) {
      return evaluateBuiltinAssistant(prompt);
    }
    return {
      replyText: `Unable to reach your local LLM at \`${options.endpointUrl}\` (${res.error || `HTTP ${res.status}`}). Start Ollama/LM Studio or enable Built-in Offline Fallback in Settings.`,
      payload: null,
      engineSource: "local-llm",
    };
  }

  try {
    const data = JSON.parse(res.body);
    const content: string =
      options.provider === "ollama"
        ? data?.message?.content || ""
        : data?.choices?.[0]?.message?.content || "";

    if (!content.trim()) {
      return options.autoFallbackToBuiltin
        ? evaluateBuiltinAssistant(prompt)
        : {
            replyText: "Local model returned an empty response.",
            payload: null,
            engineSource: "local-llm",
          };
    }

    const { cleanText, payload } = extractJsonActionPayload(content);
    if (payload) {
      // Verify cover/font assets exist before mutating
      if (payload.action === "CHANGE_FONT") {
        const val = String(payload.parameters.value || "");
        const exists = getAllStudioFonts().some(
          (f) => f.id === val || normalize(f.name) === normalize(val),
        );
        if (!exists) {
          return evaluateBuiltinAssistant(prompt);
        }
      }
      if (payload.action === "CHANGE_COVER") {
        const val = String(payload.parameters.value || "");
        const validSpecial = ["cycle", "next", "reset", "original"].includes(
          val.toLowerCase(),
        );
        const exists =
          validSpecial ||
          getAllStudioCovers().some(
            (c) => c.id === val || normalize(c.name) === normalize(val),
          );
        if (!exists) {
          return evaluateBuiltinAssistant(prompt);
        }
      }
      const execResult = executeAssistantPayload(payload);
      return {
        replyText: cleanText || payload.assistant_reply,
        payload,
        matchedTrackIds: execResult.matchedTrackIds,
        engineSource: "local-llm",
      };
    }

    return {
      replyText: cleanText,
      payload: null,
      engineSource: "local-llm",
    };
  } catch {
    return options.autoFallbackToBuiltin
      ? evaluateBuiltinAssistant(prompt)
      : {
          replyText: "Received malformed output from local LLM.",
          payload: null,
          engineSource: "local-llm",
        };
  }
}
