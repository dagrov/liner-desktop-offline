import type {
  LyricsCandidate,
  LyricsContentKind,
  LyricsSyncLevel,
} from "@/shared/contracts/lyrics";

export type StoredLyricsFormat = "lrc" | "ttml" | "plain";

export interface NormalizedCustomLyrics {
  content: string;
  format: StoredLyricsFormat;
  syncLevel: LyricsSyncLevel;
  contentKind: LyricsContentKind;
  lineCount: number;
}

const LRC_LINE_TIME_RE = /\[\d{1,3}:\d{2}(?:[.:]\d{1,3})?\]/;
const LRC_WORD_TIME_RE = /<\d{1,3}:\d{2}(?:[.:]\d{1,3})?>/;
const SRT_OR_VTT_TIME_RE =
  /^(?:(\d{1,2}):)?(\d{2}):(\d{2})[.,](\d{1,3})\s*-->\s*(?:(\d{1,2}):)?(\d{2}):(\d{2})[.,](\d{1,3})/;

export function formatLrcTimestamp(ms: number): string {
  const clamped = Math.max(0, Math.round(ms));
  const totalSeconds = Math.floor(clamped / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const hundredths = Math.floor((clamped % 1000) / 10);
  return `[${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(hundredths).padStart(2, "0")}]`;
}

function convertSrtOrVttToLrc(raw: string): string | null {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line || line === "WEBVTT" || /^\d+$/.test(line)) {
      i++;
      continue;
    }

    const match = line.match(SRT_OR_VTT_TIME_RE);
    if (match) {
      const hours = Number(match[1] || 0);
      const mins = Number(match[2] || 0);
      const secs = Number(match[3] || 0);
      const millis = Number((match[4] || "0").padEnd(3, "0").slice(0, 3));
      const startMs = ((hours * 60 + mins) * 60 + secs) * 1000 + millis;

      i++;
      const textParts: string[] = [];
      while (i < lines.length && lines[i].trim() !== "") {
        const cleaned = lines[i]
          .trim()
          .replace(/<[^>]+>/g, "")
          .trim();
        if (cleaned) textParts.push(cleaned);
        i++;
      }
      if (textParts.length > 0) {
        out.push(`${formatLrcTimestamp(startMs)}${textParts.join(" ")}`);
      }
      continue;
    }

    i++;
  }

  return out.length > 0 ? out.join("\n") : null;
}

export function normalizeLyricsInput(
  raw: string,
  fileName?: string,
): NormalizedCustomLyrics {
  const trimmed = raw.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").trim();
  if (!trimmed) {
    return {
      content: "",
      format: "plain",
      syncLevel: "plain",
      contentKind: "plain",
      lineCount: 0,
    };
  }

  const lowerName = (fileName || "").toLowerCase();

  // 1. TTML XML
  if (
    lowerName.endsWith(".ttml") ||
    /<tt[\s>]/i.test(trimmed)
  ) {
    const lineCount = (trimmed.match(/<p[\s>]/gi) || []).length || 1;
    return {
      content: trimmed,
      format: "ttml",
      syncLevel: /<span[\s>]/i.test(trimmed) ? "word_level" : "line_level",
      contentKind: /<span[\s>]/i.test(trimmed)
        ? "word_synced"
        : "line_synced",
      lineCount,
    };
  }

  // 2. SRT or WebVTT -> convert cleanly to LRC so @braccato/core syncs it
  if (
    lowerName.endsWith(".srt") ||
    lowerName.endsWith(".vtt") ||
    SRT_OR_VTT_TIME_RE.test(trimmed) ||
    trimmed.startsWith("WEBVTT")
  ) {
    const converted = convertSrtOrVttToLrc(trimmed);
    if (converted) {
      const lineCount = converted.split("\n").filter(Boolean).length;
      return {
        content: converted,
        format: "lrc",
        syncLevel: "line_level",
        contentKind: "line_synced",
        lineCount,
      };
    }
  }

  // 3. LRC / Enhanced LRC
  if (LRC_LINE_TIME_RE.test(trimmed)) {
    const isWordSynced = LRC_WORD_TIME_RE.test(trimmed);
    const lineCount = trimmed
      .split("\n")
      .filter((l) => LRC_LINE_TIME_RE.test(l)).length;
    return {
      content: trimmed,
      format: "lrc",
      syncLevel: isWordSynced ? "word_level" : "line_level",
      contentKind: isWordSynced ? "word_synced" : "line_synced",
      lineCount,
    };
  }

  // 4. Plain unsynced lyrics
  const lineCount = trimmed
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean).length;
  return {
    content: trimmed,
    format: "plain",
    syncLevel: "plain",
    contentKind: "plain",
    lineCount,
  };
}

export function buildCustomLyricsCandidate(input: {
  title: string;
  artists: string;
  durationMs: number;
  normalized: NormalizedCustomLyrics;
}): LyricsCandidate {
  const { title, artists, durationMs, normalized } = input;
  return {
    provider: "Local Lyrics",
    contentKind: normalized.contentKind,
    syncLevel: normalized.syncLevel,
    topPriority: true,
    matchedTrack: {
      title,
      artists: [artists],
      durationMs,
    },
    lyrics: {
      format: normalized.format,
      content: normalized.content,
    },
    quality: {
      total: 100,
      match: 100,
      content: 100,
      sync: normalized.syncLevel === "plain" ? 75 : 100,
      source: 100,
      reasons: ["user-custom-lyrics"],
    },
  };
}
