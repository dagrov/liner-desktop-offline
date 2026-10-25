import { VINYL_COVER_DATA_URL } from "./sampleLibrary";

export interface ParsedAudioMetadata {
  title: string;
  artists: string;
  albumTitle?: string;
  genre?: string;
  year?: string;
  coverUrl: string;
  durationMs: number;
}

export function generateProceduralTrackCover(_seedText?: string): string {
  return VINYL_COVER_DATA_URL;
}

export function inferFromFilename(fileName: string): {
  title: string;
  artists: string;
} {
  const withoutExt = fileName.replace(/\.[^/.]+$/, "").trim();
  // Strip leading track numbers like "01 - " or "02. "
  const cleaned = withoutExt.replace(/^\d{1,3}\s*[-._)]\s*/, "").trim();
  const dashSplit = cleaned.split(/\s+[-–—]\s+/);
  if (dashSplit.length >= 2) {
    return {
      artists: dashSplit[0].trim() || "Local Artist",
      title: dashSplit.slice(1).join(" - ").trim() || cleaned,
    };
  }
  return {
    title: cleaned || "Untitled Track",
    artists: "Local Artist",
  };
}

function readSynchsafeInt(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] & 0x7f) << 21) |
    ((bytes[offset + 1] & 0x7f) << 14) |
    ((bytes[offset + 2] & 0x7f) << 7) |
    (bytes[offset + 3] & 0x7f)
  );
}

function readUint32BE(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] << 24) >>> 0) +
    ((bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3])
  );
}

function decodeId3Text(payload: Uint8Array): string {
  if (payload.length <= 1) return "";
  const encoding = payload[0];
  const body = payload.subarray(1);
  let decoded = "";
  try {
    if (encoding === 0) {
      decoded = new TextDecoder("iso-8859-1").decode(body);
    } else if (encoding === 1) {
      decoded = new TextDecoder("utf-16").decode(body);
    } else if (encoding === 2) {
      decoded = new TextDecoder("utf-16be").decode(body);
    } else {
      decoded = new TextDecoder("utf-8").decode(body);
    }
  } catch {
    decoded = new TextDecoder("utf-8", { fatal: false }).decode(body);
  }
  return decoded.replace(/\0+/g, " ").trim();
}

function bytesToBase64DataUrl(bytes: Uint8Array, mimeType: string): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, i + chunk);
    binary += String.fromCharCode(...slice);
  }
  const base64 =
    typeof btoa === "function"
      ? btoa(binary)
      : Buffer.from(bytes).toString("base64");
  return `data:${mimeType || "image/jpeg"};base64,${base64}`;
}

function decodeApicFrame(payload: Uint8Array): string | undefined {
  if (payload.length < 16) return undefined;
  const encoding = payload[0];
  let idx = 1;
  let mime = "";
  while (idx < payload.length && payload[idx] !== 0) {
    mime += String.fromCharCode(payload[idx]);
    idx++;
  }
  idx++; // skip null terminator after MIME
  if (idx >= payload.length) return undefined;
  idx++; // skip picture type byte
  // Skip description string (null-terminated, 1 or 2 bytes depending on encoding)
  if (encoding === 1 || encoding === 2) {
    while (idx + 1 < payload.length) {
      if (payload[idx] === 0 && payload[idx + 1] === 0) {
        idx += 2;
        break;
      }
      idx += 2;
    }
  } else {
    while (idx < payload.length && payload[idx] !== 0) {
      idx++;
    }
    idx++;
  }
  if (idx >= payload.length) return undefined;
  const imgBytes = payload.subarray(idx);
  if (imgBytes.length < 32) return undefined;
  const resolvedMime =
    mime && mime.includes("/")
      ? mime
      : imgBytes[0] === 0x89 && imgBytes[1] === 0x50
        ? "image/png"
        : "image/jpeg";
  return bytesToBase64DataUrl(imgBytes, resolvedMime);
}

export function parseId3v2FromBytes(bytes: Uint8Array): {
  title?: string;
  artists?: string;
  albumTitle?: string;
  genre?: string;
  year?: string;
  coverUrl?: string;
} {
  if (
    bytes.length < 10 ||
    bytes[0] !== 0x49 || // 'I'
    bytes[1] !== 0x44 || // 'D'
    bytes[2] !== 0x33 // '3'
  ) {
    return {};
  }

  const version = bytes[3];
  if (version < 3 || version > 4) return {};

  const tagSize = readSynchsafeInt(bytes, 6);
  const end = Math.min(bytes.length, 10 + tagSize);
  let pos = 10;

  const out: {
    title?: string;
    artists?: string;
    albumTitle?: string;
    genre?: string;
    year?: string;
    coverUrl?: string;
  } = {};

  while (pos + 10 <= end) {
    const id = String.fromCharCode(
      bytes[pos],
      bytes[pos + 1],
      bytes[pos + 2],
      bytes[pos + 3],
    );
    if (!/^[A-Z0-9]{4}$/.test(id)) break;

    const frameSize =
      version === 4
        ? readSynchsafeInt(bytes, pos + 4)
        : readUint32BE(bytes, pos + 4);
    if (frameSize <= 0 || pos + 10 + frameSize > end) break;

    const payload = bytes.subarray(pos + 10, pos + 10 + frameSize);
    if (id === "TIT2" && !out.title) out.title = decodeId3Text(payload);
    else if (id === "TPE1" && !out.artists) out.artists = decodeId3Text(payload);
    else if (id === "TALB" && !out.albumTitle)
      out.albumTitle = decodeId3Text(payload);
    else if (id === "TCON" && !out.genre) out.genre = decodeId3Text(payload);
    else if ((id === "TYER" || id === "TDRC") && !out.year)
      out.year = decodeId3Text(payload);
    else if (id === "APIC" && !out.coverUrl)
      out.coverUrl = decodeApicFrame(payload);

    pos += 10 + frameSize;
  }

  return out;
}

async function probeDurationMs(blob: Blob): Promise<number> {
  if (typeof window === "undefined" || typeof Audio === "undefined") {
    return 180_000;
  }
  const url = URL.createObjectURL(blob);
  try {
    return await new Promise<number>((resolve) => {
      const audio = new Audio();
      const timer = setTimeout(() => {
        cleanup();
        resolve(180_000);
      }, 2500);
      const cleanup = () => {
        clearTimeout(timer);
        audio.onloadedmetadata = null;
        audio.onerror = null;
        audio.src = "";
      };
      audio.preload = "metadata";
      audio.onloadedmetadata = () => {
        const dur =
          Number.isFinite(audio.duration) && audio.duration > 0
            ? Math.round(audio.duration * 1000)
            : 180_000;
        cleanup();
        resolve(dur);
      };
      audio.onerror = () => {
        cleanup();
        resolve(180_000);
      };
      audio.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function extractAudioMetadata(
  blob: Blob,
  fileName: string,
): Promise<ParsedAudioMetadata> {
  const fallback = inferFromFilename(fileName);
  let tags: ReturnType<typeof parseId3v2FromBytes> = {};

  try {
    // Read up to first 512 KB to capture ID3 header + embedded cover art without loading huge FLACs twice
    const headerSlice = blob.slice(0, Math.min(blob.size, 512 * 1024));
    const buf = await headerSlice.arrayBuffer();
    tags = parseId3v2FromBytes(new Uint8Array(buf));
  } catch {
    // ignore tag parse error
  }

  const durationMs = await probeDurationMs(blob);
  const title = tags.title || fallback.title;
  const artists = tags.artists || fallback.artists;

  return {
    title,
    artists,
    albumTitle: tags.albumTitle || "Local Library",
    genre: tags.genre,
    year: tags.year,
    coverUrl:
      tags.coverUrl || generateProceduralTrackCover(`${artists}::${title}`),
    durationMs,
  };
}

export function extractAudioMetadataFromHeaderBytes(
  headerBytes: Uint8Array,
  fileName: string,
  fileSizeBytes?: number,
): ParsedAudioMetadata {
  const fallback = inferFromFilename(fileName);
  const tags = parseId3v2FromBytes(headerBytes);
  const title = tags.title || fallback.title;
  const artists = tags.artists || fallback.artists;
  // Rough duration estimate from file size (~192kbps average) until exact duration is probed during playback
  const estimatedMs =
    fileSizeBytes && fileSizeBytes > 0
      ? Math.min(Math.max(Math.round((fileSizeBytes / 24_000) * 1000), 15_000), 900_000)
      : 180_000;

  return {
    title,
    artists,
    albumTitle: tags.albumTitle || "Local Library",
    genre: tags.genre,
    year: tags.year,
    coverUrl: tags.coverUrl || VINYL_COVER_DATA_URL,
    durationMs: estimatedMs,
  };
}
