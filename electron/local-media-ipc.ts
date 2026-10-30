import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  protocol,
  type IpcMainInvokeEvent,
} from "electron";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

export type LocalFolderKind = "music" | "fonts" | "covers" | "lyrics";

export interface ScannedLocalFile {
  path: string;
  name: string;
  ext: string;
  size: number;
  mtimeMs: number;
  folderPath?: string;
  folderName?: string;
}

export interface ScannedTrackTags {
  path: string;
  title?: string;
  artists?: string;
  albumTitle?: string;
  genre?: string;
  year?: number;
  hasEmbeddedCover: boolean;
}

export interface LocalFilePayload {
  path: string;
  name: string;
  mimeType: string;
  bytes: Uint8Array;
}

export interface LocalLlmRequestInput {
  url: string;
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
}

export interface LocalLlmResponseOutput {
  ok: boolean;
  status: number;
  body: string;
  error?: string;
}

const EXTENSIONS_BY_KIND: Record<LocalFolderKind, Set<string>> = {
  music: new Set([
    ".mp3",
    ".flac",
    ".wav",
    ".ogg",
    ".m4a",
    ".aac",
    ".opus",
    ".webm",
  ]),
  fonts: new Set([".ttf", ".otf", ".woff2", ".woff"]),
  covers: new Set([".png", ".jpg", ".jpeg", ".webp", ".svg", ".gif"]),
  lyrics: new Set([".lrc", ".txt", ".srt", ".vtt", ".ttml"]),
};

const MIME_BY_EXT: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".flac": "audio/flac",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".opus": "audio/opus",
  ".webm": "audio/webm",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".gif": "image/gif",
};

const DIALOG_FILTERS_BY_KIND: Record<
  LocalFolderKind,
  { name: string; extensions: string[] }[]
> = {
  music: [
    {
      name: "Audio Files",
      extensions: ["mp3", "flac", "wav", "ogg", "m4a", "aac", "opus", "webm"],
    },
  ],
  fonts: [
    {
      name: "Font Files",
      extensions: ["ttf", "otf", "woff2", "woff"],
    },
  ],
  covers: [
    {
      name: "Cover Art Images",
      extensions: ["png", "jpg", "jpeg", "webp", "svg", "gif"],
    },
  ],
  lyrics: [
    {
      name: "Lyrics Files",
      extensions: ["lrc", "txt", "srt", "vtt", "ttml"],
    },
  ],
};

// Vinyl SVG fallback served with zero RAM overhead when a local track has no embedded cover
const VINYL_FALLBACK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600"><defs><radialGradient id="bg" cx="50%" cy="45%" r="65%"><stop offset="0%" stop-color="#2a2421"/><stop offset="100%" stop-color="#0d0b0a"/></radialGradient><radialGradient id="lbl" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#e7b97a"/><stop offset="100%" stop-color="#b87836"/></radialGradient></defs><rect width="600" height="600" fill="url(#bg)"/><circle cx="300" cy="300" r="236" fill="#111"/><circle cx="300" cy="300" r="215" fill="none" stroke="#262626" stroke-width="1.5"/><circle cx="300" cy="300" r="190" fill="none" stroke="#1f1f1f" stroke-width="1.5"/><circle cx="300" cy="300" r="165" fill="none" stroke="#292929" stroke-width="1.5"/><circle cx="300" cy="300" r="140" fill="none" stroke="#1e1e1e" stroke-width="1.5"/><circle cx="300" cy="300" r="115" fill="none" stroke="#262626" stroke-width="1.5"/><circle cx="300" cy="300" r="82" fill="url(#lbl)"/><circle cx="300" cy="300" r="68" fill="none" stroke="#1a120a" stroke-opacity="0.35" stroke-width="1.5"/><circle cx="300" cy="300" r="13" fill="#0d0b0a"/></svg>`;

export function registerLocalMediaScheme(): void {
  try {
    protocol.registerSchemesAsPrivileged([
      {
        scheme: "liner-media",
        privileges: {
          standard: true,
          secure: true,
          supportFetchAPI: true,
          stream: true,
          corsEnabled: true,
          bypassCSP: true,
        },
      },
    ]);
  } catch {
    // Already registered or running inside unit test harness
  }
}

function isAppUrl(url: string | undefined): boolean {
  if (!url) return false;
  if (url.startsWith("file:")) return true;
  const devServer = process.env.VITE_DEV_SERVER_URL;
  if (!devServer) return false;
  try {
    return new URL(url).origin === new URL(devServer).origin;
  } catch {
    return false;
  }
}

function fromApp(event: IpcMainInvokeEvent): boolean {
  return isAppUrl(event.senderFrame?.url);
}

function readSynchsafeInt(b: Buffer, offset: number): number {
  return (
    ((b[offset] & 0x7f) << 21) |
    ((b[offset + 1] & 0x7f) << 14) |
    ((b[offset + 2] & 0x7f) << 7) |
    (b[offset + 3] & 0x7f)
  );
}

function decodeId3Text(buf: Buffer): string {
  if (buf.length === 0) return "";
  const enc = buf[0];
  const payload = buf.subarray(1);
  let text = "";
  if (enc === 0) {
    text = payload.toString("latin1");
  } else if (enc === 1 || enc === 2) {
    if (
      payload.length >= 2 &&
      payload[0] === 0xfe &&
      payload[1] === 0xff
    ) {
      const swapped = Buffer.allocUnsafe(payload.length - 2);
      for (let i = 2; i + 1 < payload.length; i += 2) {
        swapped[i - 2] = payload[i + 1];
        swapped[i - 1] = payload[i];
      }
      text = swapped.toString("utf16le");
    } else if (
      payload.length >= 2 &&
      payload[0] === 0xff &&
      payload[1] === 0xfe
    ) {
      text = payload.subarray(2).toString("utf16le");
    } else {
      text = payload.toString("utf16le");
    }
  } else {
    text = payload.toString("utf8");
  }
  return text.replace(/\0/g, "").trim();
}

function extractEmbeddedCoverFromBuffer(
  buf: Buffer,
): { mime: string; data: Buffer } | null {
  // ID3v2 APIC / PIC
  if (
    buf.length > 14 &&
    buf[0] === 0x49 &&
    buf[1] === 0x44 &&
    buf[2] === 0x33
  ) {
    const version = buf[3];
    const flags = buf[5];
    const tagSize = readSynchsafeInt(buf, 6);
    const limit = Math.min(buf.length, 10 + tagSize);
    let offset = 10;
    if ((flags & 0x40) !== 0 && offset + 4 < limit) {
      const extSize =
        version === 4 ? readSynchsafeInt(buf, offset) : buf.readUInt32BE(offset);
      offset += extSize;
    }

    while (offset + (version === 2 ? 6 : 10) <= limit) {
      if (buf[offset] === 0) break;
      let frameId = "";
      let frameSize = 0;
      let headerLen = 10;

      if (version === 2) {
        frameId = buf.toString("ascii", offset, offset + 3);
        frameSize =
          (buf[offset + 3] << 16) | (buf[offset + 4] << 8) | buf[offset + 5];
        headerLen = 6;
      } else {
        frameId = buf.toString("ascii", offset, offset + 4);
        frameSize =
          version === 4
            ? readSynchsafeInt(buf, offset + 4)
            : buf.readUInt32BE(offset + 4);
        headerLen = 10;
      }

      if (frameSize <= 0 || offset + headerLen + frameSize > buf.length) break;
      const body = buf.subarray(offset + headerLen, offset + headerLen + frameSize);

      if ((frameId === "APIC" || frameId === "PIC") && body.length > 16) {
        const textEnc = body[0];
        let pos = 1;
        let mime = "image/jpeg";
        if (frameId === "PIC") {
          const fmt = body.toString("ascii", 1, 4).toLowerCase();
          mime = fmt === "png" ? "image/png" : "image/jpeg";
          pos = 4;
        } else {
          let mimeEnd = pos;
          while (mimeEnd < body.length && body[mimeEnd] !== 0) mimeEnd++;
          mime = body.toString("ascii", pos, mimeEnd) || "image/jpeg";
          pos = mimeEnd + 1;
        }
        pos += 1; // picture type byte
        if (textEnc === 1 || textEnc === 2) {
          while (pos + 1 < body.length && !(body[pos] === 0 && body[pos + 1] === 0)) {
            pos += 2;
          }
          pos += 2;
        } else {
          while (pos < body.length && body[pos] !== 0) pos++;
          pos += 1;
        }
        if (pos < body.length) {
          return {
            mime: mime.includes("png") ? "image/png" : "image/jpeg",
            data: Buffer.from(body.subarray(pos)),
          };
        }
      }
      offset += headerLen + frameSize;
    }
  }

  // FLAC METADATA_BLOCK_PICTURE (block type 6)
  if (
    buf.length > 42 &&
    buf[0] === 0x66 &&
    buf[1] === 0x4c &&
    buf[2] === 0x61 &&
    buf[3] === 0x43
  ) {
    let offset = 4;
    while (offset + 4 <= buf.length) {
      const isLast = (buf[offset] & 0x80) !== 0;
      const blockType = buf[offset] & 0x7f;
      const blockLen =
        (buf[offset + 1] << 16) | (buf[offset + 2] << 8) | buf[offset + 3];
      offset += 4;
      if (offset + blockLen > buf.length) break;
      if (blockType === 6 && blockLen > 32) {
        const block = buf.subarray(offset, offset + blockLen);
        let p = 4; // skip picture type
        if (p + 4 > block.length) break;
        const mimeLen = block.readUInt32BE(p);
        p += 4;
        if (p + mimeLen + 4 > block.length) break;
        const mime = block.toString("ascii", p, p + mimeLen) || "image/jpeg";
        p += mimeLen;
        const descLen = block.readUInt32BE(p);
        p += 4 + descLen + 16; // skip width, height, depth, colors
        if (p + 4 <= block.length) {
          const dataLen = block.readUInt32BE(p);
          p += 4;
          if (p + dataLen <= block.length && dataLen > 0) {
            return { mime, data: Buffer.from(block.subarray(p, p + dataLen)) };
          }
        }
      }
      offset += blockLen;
      if (isLast) break;
    }
  }

  return null;
}

function parseQuickTagsFromBuffer(
  buf: Buffer,
  filePath: string,
): ScannedTrackTags {
  const result: ScannedTrackTags = {
    path: filePath,
    hasEmbeddedCover: false,
  };

  if (
    buf.length > 14 &&
    buf[0] === 0x49 &&
    buf[1] === 0x44 &&
    buf[2] === 0x33
  ) {
    const version = buf[3];
    const flags = buf[5];
    const tagSize = readSynchsafeInt(buf, 6);
    const limit = Math.min(buf.length, 10 + tagSize);
    let offset = 10;
    if ((flags & 0x40) !== 0 && offset + 4 < limit) {
      const extSize =
        version === 4 ? readSynchsafeInt(buf, offset) : buf.readUInt32BE(offset);
      offset += extSize;
    }
    while (offset + (version === 2 ? 6 : 10) <= limit) {
      if (buf[offset] === 0) break;
      let frameId = "";
      let frameSize = 0;
      let headerLen = 10;
      if (version === 2) {
        frameId = buf.toString("ascii", offset, offset + 3);
        frameSize =
          (buf[offset + 3] << 16) | (buf[offset + 4] << 8) | buf[offset + 5];
        headerLen = 6;
      } else {
        frameId = buf.toString("ascii", offset, offset + 4);
        frameSize =
          version === 4
            ? readSynchsafeInt(buf, offset + 4)
            : buf.readUInt32BE(offset + 4);
        headerLen = 10;
      }
      if (frameSize <= 0) break;
      if (frameId === "APIC" || frameId === "PIC") {
        result.hasEmbeddedCover = true;
      } else if (offset + headerLen + frameSize <= buf.length && frameSize < 4096) {
        const body = buf.subarray(offset + headerLen, offset + headerLen + frameSize);
        if (frameId === "TIT2" || frameId === "TT2") {
          result.title = decodeId3Text(body) || result.title;
        } else if (frameId === "TPE1" || frameId === "TP1") {
          result.artists = decodeId3Text(body) || result.artists;
        } else if (frameId === "TALB" || frameId === "TAL") {
          result.albumTitle = decodeId3Text(body) || result.albumTitle;
        } else if (frameId === "TCON" || frameId === "TCO") {
          result.genre = decodeId3Text(body) || result.genre;
        } else if (
          frameId === "TDRC" ||
          frameId === "TYER" ||
          frameId === "TYE"
        ) {
          const yr = Number.parseInt(decodeId3Text(body).slice(0, 4), 10);
          if (yr >= 1900 && yr <= 2100) result.year = yr;
        }
      }
      offset += headerLen + frameSize;
    }
  }

  return result;
}

export function registerLocalMediaIpc(getMainWindow: () => BrowserWindow | null) {
  const approvedRoots = new Set<string>();
  const approvedFiles = new Set<string>();
  const watchers = new Map<string, fs.FSWatcher>();
  const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const coverCache = new Map<string, { mime: string; data: Buffer } | "none">();

  function rememberCover(
    key: string,
    val: { mime: string; data: Buffer } | "none",
  ) {
    if (coverCache.size >= 24) {
      const oldest = coverCache.keys().next().value;
      if (oldest) coverCache.delete(oldest);
    }
    coverCache.set(key, val);
  }

  function isPathApproved(targetPath: string): boolean {
    const resolved = path.resolve(targetPath);
    if (approvedFiles.has(resolved)) return true;
    for (const root of approvedRoots) {
      if (resolved === root || resolved.startsWith(root + path.sep)) {
        return true;
      }
    }
    // Also permit existing audio files saved in user's persisted offline library across app restarts
    const ext = path.extname(resolved).toLowerCase();
    if (EXTENSIONS_BY_KIND.music.has(ext)) {
      approvedFiles.add(resolved);
      return true;
    }
    return false;
  }

  // Register direct disk streaming protocol (0 MB full-file IPC buffer, HTTP 206 Range support)
  try {
    protocol.handle("liner-media", async (request) => {
      try {
        const parsed = new URL(request.url);
        const host = parsed.hostname.toLowerCase();
        const rawPath = parsed.searchParams.get("path");
        if (!rawPath) {
          return new Response("Missing path", { status: 400 });
        }
        const resolved = path.resolve(rawPath);
        if (!isPathApproved(resolved)) {
          return new Response("Forbidden", { status: 403 });
        }

        if (host === "cover") {
          let cached = coverCache.get(resolved);
          if (!cached) {
            const handle = await fsp.open(resolved, "r");
            try {
              const st = await handle.stat();
              const readLen = Math.min(st.size, 393_216); // 384KB max read for cover header
              const buf = Buffer.allocUnsafe(readLen);
              const { bytesRead } = await handle.read(buf, 0, readLen, 0);
              const extracted = extractEmbeddedCoverFromBuffer(
                buf.subarray(0, bytesRead),
              );
              cached = extracted ?? "none";
              rememberCover(resolved, cached);
            } finally {
              await handle.close();
            }
          }
          if (cached && cached !== "none") {
            return new Response(new Uint8Array(cached.data), {
              status: 200,
              headers: {
                "Content-Type": cached.mime,
                "Cache-Control": "public, max-age=86400",
              },
            });
          }
          return new Response(VINYL_FALLBACK_SVG, {
            status: 200,
            headers: {
              "Content-Type": "image/svg+xml",
              "Cache-Control": "public, max-age=86400",
            },
          });
        }

        // Default: liner-media://audio?path=... with full HTTP Range 206 streaming from disk
        const stat = await fsp.stat(resolved);
        if (!stat.isFile()) {
          return new Response("Not found", { status: 404 });
        }
        const ext = path.extname(resolved).toLowerCase();
        const mimeType = MIME_BY_EXT[ext] ?? "audio/mpeg";
        const fileSize = stat.size;
        const rangeHeader = request.headers.get("range");

        if (rangeHeader) {
          const match = /bytes=(\d*)-(\d*)/i.exec(rangeHeader);
          if (match) {
            const start = match[1] ? Number.parseInt(match[1], 10) : 0;
            const requestedEnd = match[2]
              ? Number.parseInt(match[2], 10)
              : fileSize - 1;
            const end = Math.min(fileSize - 1, Math.max(start, requestedEnd));
            if (start >= fileSize) {
              return new Response(null, {
                status: 416,
                headers: { "Content-Range": `bytes */${fileSize}` },
              });
            }
            const chunkLen = end - start + 1;
            const nodeStream = fs.createReadStream(resolved, {
              start,
              end,
              highWaterMark: 65_536,
            });
            return new Response(Readable.toWeb(nodeStream) as ReadableStream, {
              status: 206,
              headers: {
                "Content-Type": mimeType,
                "Accept-Ranges": "bytes",
                "Content-Range": `bytes ${start}-${end}/${fileSize}`,
                "Content-Length": String(chunkLen),
              },
            });
          }
        }

        const fullStream = fs.createReadStream(resolved, {
          highWaterMark: 65_536,
        });
        return new Response(Readable.toWeb(fullStream) as ReadableStream, {
          status: 200,
          headers: {
            "Content-Type": mimeType,
            "Accept-Ranges": "bytes",
            "Content-Length": String(fileSize),
          },
        });
      } catch {
        return new Response("Stream error", { status: 500 });
      }
    });
  } catch {
    // Ignore if running in headless vitest without full protocol table
  }

  // Skip OS, system, browser cache, dev, and game directories so scanning whole drives is fast & gentle on HDDs
  const IGNORED_SCAN_DIRS = new Set([
    "windows",
    "winnt",
    "program files",
    "program files (x86)",
    "programdata",
    "appdata",
    "application data",
    "local settings",
    "$recycle.bin",
    "$windows.~bt",
    "$windows.~ws",
    "system volume information",
    "recovery",
    "perflogs",
    "msocache",
    "config.msi",
    "intel",
    "amd",
    "nvidia",
    "drivers",
    "steam",
    "steamapps",
    "epic games",
    "riot games",
    "ubisoft",
    "gog galaxy",
    "node_modules",
    "__pycache__",
    "site-packages",
    "venv",
    ".venv",
    ".git",
    ".cache",
    ".npm",
    ".pnpm-store",
    ".cargo",
    ".rustup",
    ".gradle",
    "dist",
    "build",
    "target",
    "library",
    "proc",
    "sys",
    "dev",
    "run",
    "usr",
    "var",
    "etc",
    "bin",
    "sbin",
    "lib",
    "lib64",
    "opt",
    "snap",
    "boot",
    "tmp",
    "lost+found",
  ]);

  async function scanDirectoryRecursive(
    dirPath: string,
    kind: LocalFolderKind,
    maxFiles = 20000,
    maxDepth = 12,
    sharedVisited?: Set<string>,
  ): Promise<ScannedLocalFile[]> {
    const results: ScannedLocalFile[] = [];
    const allowedExts = EXTENSIONS_BY_KIND[kind] ?? EXTENSIONS_BY_KIND.music;
    const queue: { dir: string; depth: number }[] = [
      { dir: path.resolve(dirPath), depth: 0 },
    ];
    const visited = sharedVisited ?? new Set<string>();
    let dirsProcessed = 0;

    while (queue.length > 0 && results.length < maxFiles) {
      const { dir: current, depth } = queue.shift()!;
      const normKey =
        process.platform === "win32" ? current.toLowerCase() : current;
      if (visited.has(normKey)) continue;
      visited.add(normKey);

      dirsProcessed++;
      // Yield every 50 directories so a 500GB spinning HDD & UI thread stay completely smooth
      if (dirsProcessed % 50 === 0) {
        await new Promise<void>((r) => setImmediate(r));
      }

      let entries: fs.Dirent[];
      try {
        entries = await fsp.readdir(current, { withFileTypes: true });
      } catch {
        continue;
      }

      for (const entry of entries) {
        if (entry.name.startsWith(".")) continue;
        const fullPath = path.join(current, entry.name);
        if (entry.isDirectory()) {
          if (
            depth < maxDepth &&
            !IGNORED_SCAN_DIRS.has(entry.name.toLowerCase())
          ) {
            queue.push({ dir: fullPath, depth: depth + 1 });
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (!allowedExts.has(ext)) continue;
          try {
            const stat = await fsp.stat(fullPath);
            // Skip tiny < 8KB UI sound-effect/system stubs when scanning whole PC
            if (kind === "music" && stat.size < 8192) continue;
            const folderPath = path.dirname(fullPath);
            const folderName = path.basename(folderPath) || folderPath;
            results.push({
              path: fullPath,
              name: entry.name,
              ext,
              size: stat.size,
              mtimeMs: stat.mtimeMs,
              folderPath,
              folderName,
            });
            approvedFiles.add(path.resolve(fullPath));
            if (results.length >= maxFiles) break;
          } catch {
            // skip unreadable file
          }
        }
      }
    }

    return results;
  }

  ipcMain.handle(
    "local:pick-directory",
    async (event, kind: LocalFolderKind = "music"): Promise<string | null> => {
      if (!fromApp(event)) return null;
      const win = getMainWindow();
      const titleMap: Record<LocalFolderKind, string> = {
        music: "Select Local Music Folder",
        fonts: "Select Custom Fonts Folder",
        covers: "Select Cover Art Folder",
        lyrics: "Select Lyrics Folder",
      };
      const result = win
        ? await dialog.showOpenDialog(win, {
            title: titleMap[kind] ?? "Select Folder",
            properties: ["openDirectory"],
          })
        : await dialog.showOpenDialog({
            title: titleMap[kind] ?? "Select Folder",
            properties: ["openDirectory"],
          });
      if (result.canceled || result.filePaths.length === 0) return null;
      const chosen = path.resolve(result.filePaths[0]);
      approvedRoots.add(chosen);
      return chosen;
    },
  );

  ipcMain.handle(
    "local:pick-files",
    async (
      event,
      kind: LocalFolderKind = "music",
    ): Promise<ScannedLocalFile[]> => {
      if (!fromApp(event)) return [];
      const win = getMainWindow();
      const filters = DIALOG_FILTERS_BY_KIND[kind] ?? DIALOG_FILTERS_BY_KIND.music;
      const result = win
        ? await dialog.showOpenDialog(win, {
            properties: ["openFile", "multiSelections"],
            filters,
          })
        : await dialog.showOpenDialog({
            properties: ["openFile", "multiSelections"],
            filters,
          });
      if (result.canceled || result.filePaths.length === 0) return [];

      const files: ScannedLocalFile[] = [];
      for (const filePath of result.filePaths) {
        const resolved = path.resolve(filePath);
        try {
          const stat = await fsp.stat(resolved);
          if (!stat.isFile()) continue;
          approvedFiles.add(resolved);
          const folderPath = path.dirname(resolved);
          const folderName = path.basename(folderPath) || folderPath;
          files.push({
            path: resolved,
            name: path.basename(resolved),
            ext: path.extname(resolved).toLowerCase(),
            size: stat.size,
            mtimeMs: stat.mtimeMs,
            folderPath,
            folderName,
          });
        } catch {
          // ignore unreadable
        }
      }
      return files;
    },
  );

  ipcMain.handle(
    "local:scan-directory",
    async (
      event,
      input: { dirPath: string; kind: LocalFolderKind },
    ): Promise<ScannedLocalFile[]> => {
      if (!fromApp(event) || !input?.dirPath) return [];
      const resolved = path.resolve(input.dirPath);
      try {
        const stat = await fsp.stat(resolved);
        if (!stat.isDirectory()) return [];
      } catch {
        return [];
      }
      approvedRoots.add(resolved);
      return scanDirectoryRecursive(resolved, input.kind);
    },
  );

  ipcMain.handle(
    "local:scan-pc-audio",
    async (
      event,
    ): Promise<{ scannedDirs: string[]; files: ScannedLocalFile[] }> => {
      if (!fromApp(event)) return { scannedDirs: [], files: [] };

      const candidateRoots: string[] = [];
      const pushUniqueRoot = (p: string | undefined | null) => {
        if (!p) return;
        const resolved = path.resolve(p);
        const key =
          process.platform === "win32" ? resolved.toLowerCase() : resolved;
        if (
          !candidateRoots.some(
            (existing) =>
              (process.platform === "win32"
                ? existing.toLowerCase()
                : existing) === key,
          )
        ) {
          candidateRoots.push(resolved);
        }
      };

      // 1. High-priority user media folders first (Music, Downloads, Desktop, Documents, Videos, Home)
      for (const key of [
        "music",
        "downloads",
        "desktop",
        "documents",
        "videos",
        "home",
      ] as const) {
        try {
          pushUniqueRoot(app.getPath(key));
        } catch {}
      }

      // 2. All mounted drives & external/partition roots across the whole PC!
      if (process.platform === "win32") {
        // Scan D:\..Z:\ first (secondary partitions/drives where music collections usually live), then C:\ user/root folders
        const letters = "DEFGHIJKLMNOPQRSTUVWXYZABC";
        for (const ch of letters) {
          const driveRoot = `${ch}:\\`;
          try {
            if (fs.existsSync(driveRoot)) {
              pushUniqueRoot(driveRoot);
            }
          } catch {}
        }
      } else {
        for (const mountParent of ["/mnt", "/media", "/run/media", "/Volumes"]) {
          try {
            if (fs.existsSync(mountParent)) {
              pushUniqueRoot(mountParent);
            }
          } catch {}
        }
      }

      const scannedDirs: string[] = [];
      const sharedVisited = new Set<string>();
      const seenPaths = new Set<string>();
      const files: ScannedLocalFile[] = [];
      const MAX_TOTAL_FILES = 25000;

      for (const rootDir of candidateRoots) {
        if (files.length >= MAX_TOTAL_FILES) break;
        try {
          const st = await fsp.stat(rootDir);
          if (!st.isDirectory()) continue;
        } catch {
          continue;
        }
        approvedRoots.add(rootDir);
        scannedDirs.push(rootDir);
        const found = await scanDirectoryRecursive(
          rootDir,
          "music",
          MAX_TOTAL_FILES - files.length,
          12,
          sharedVisited,
        );
        for (const item of found) {
          const fileKey =
            process.platform === "win32" ? item.path.toLowerCase() : item.path;
          if (!seenPaths.has(fileKey)) {
            seenPaths.add(fileKey);
            files.push(item);
          }
        }
      }

      return { scannedDirs, files };
    },
  );

  // Fast, HDD-gentle batch tag reader (reads only 16KB text frames per file, 0 image bytes over IPC)
  ipcMain.handle(
    "local:read-tags-batch",
    async (event, filePaths: string[]): Promise<ScannedTrackTags[]> => {
      if (!fromApp(event) || !Array.isArray(filePaths)) return [];
      const out: ScannedTrackTags[] = [];
      const batch = filePaths.slice(0, 50);

      for (const rawPath of batch) {
        if (!rawPath) continue;
        const resolved = path.resolve(rawPath);
        if (!isPathApproved(resolved)) continue;
        try {
          const handle = await fsp.open(resolved, "r");
          try {
            const st = await handle.stat();
            const len = Math.min(st.size, 32_768);
            const buf = Buffer.allocUnsafe(len);
            const { bytesRead } = await handle.read(buf, 0, len, 0);
            out.push(
              parseQuickTagsFromBuffer(buf.subarray(0, bytesRead), resolved),
            );
          } finally {
            await handle.close();
          }
        } catch {
          // ignore unreadable file
        }
      }
      return out;
    },
  );

  ipcMain.handle(
    "local:read-file-head",
    async (
      event,
      input: { filePath: string; maxBytes?: number },
    ): Promise<LocalFilePayload | null> => {
      if (!fromApp(event) || !input?.filePath) return null;
      const resolved = path.resolve(input.filePath);
      if (!isPathApproved(resolved)) return null;
      const cap = Math.min(Math.max(input.maxBytes ?? 65_536, 4096), 2_097_152);
      try {
        const handle = await fsp.open(resolved, "r");
        try {
          const stat = await handle.stat();
          const length = Math.min(stat.size, cap);
          const buf = Buffer.allocUnsafe(length);
          const { bytesRead } = await handle.read(buf, 0, length, 0);
          const ext = path.extname(resolved).toLowerCase();
          return {
            path: resolved,
            name: path.basename(resolved),
            mimeType: MIME_BY_EXT[ext] ?? "application/octet-stream",
            bytes: new Uint8Array(
              buf.buffer,
              buf.byteOffset,
              bytesRead,
            ),
          };
        } finally {
          await handle.close();
        }
      } catch {
        return null;
      }
    },
  );

  ipcMain.handle(
    "local:read-sidecar-lyrics",
    async (
      event,
      audioFilePath: string,
    ): Promise<{ content: string; fileName: string } | null> => {
      if (!fromApp(event) || !audioFilePath) return null;
      const resolvedAudio = path.resolve(audioFilePath);
      if (!isPathApproved(resolvedAudio)) return null;
      const dir = path.dirname(resolvedAudio);
      const baseNoExt = path.basename(
        resolvedAudio,
        path.extname(resolvedAudio),
      );
      for (const ext of [".lrc", ".srt", ".vtt", ".ttml", ".txt"]) {
        const candidate = path.join(dir, `${baseNoExt}${ext}`);
        try {
          const st = await fsp.stat(candidate);
          if (st.isFile() && st.size > 0 && st.size <= 1_048_576) {
            const content = await fsp.readFile(candidate, "utf8");
            if (content.trim()) {
              return { content, fileName: path.basename(candidate) };
            }
          }
        } catch {
          // try next extension
        }
      }
      return null;
    },
  );

  ipcMain.handle(
    "local:read-file",
    async (event, filePath: string): Promise<LocalFilePayload | null> => {
      if (!fromApp(event) || !filePath) return null;
      const resolved = path.resolve(filePath);
      if (!isPathApproved(resolved)) return null;
      try {
        const bytes = await fsp.readFile(resolved);
        const ext = path.extname(resolved).toLowerCase();
        return {
          path: resolved,
          name: path.basename(resolved),
          mimeType: MIME_BY_EXT[ext] ?? "application/octet-stream",
          bytes: new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength),
        };
      } catch {
        return null;
      }
    },
  );

  ipcMain.handle(
    "local:watch-directory",
    async (
      event,
      input: { dirPath: string; kind: LocalFolderKind },
    ): Promise<boolean> => {
      if (!fromApp(event) || !input?.dirPath) return false;
      const resolved = path.resolve(input.dirPath);
      if (!isPathApproved(resolved)) return false;

      const key = `${input.kind}::${resolved}`;
      if (watchers.has(key)) return true;

      try {
        const watcher = fs.watch(
          resolved,
          { recursive: process.platform !== "linux" },
          () => {
            const prevTimer = debounceTimers.get(key);
            if (prevTimer) clearTimeout(prevTimer);
            debounceTimers.set(
              key,
              setTimeout(() => {
                debounceTimers.delete(key);
                for (const win of BrowserWindow.getAllWindows()) {
                  if (win.isDestroyed()) continue;
                  if (!isAppUrl(win.webContents.getURL())) continue;
                  win.webContents.send("local:directory-changed", {
                    dirPath: resolved,
                    kind: input.kind,
                  });
                }
              }, 800),
            );
          },
        );
        watcher.on("error", () => {
          watcher.close();
          watchers.delete(key);
        });
        watchers.set(key, watcher);
        return true;
      } catch {
        return false;
      }
    },
  );

  ipcMain.handle(
    "local:unwatch-directory",
    async (event, input: { dirPath: string; kind: LocalFolderKind }) => {
      if (!fromApp(event) || !input?.dirPath) return false;
      const resolved = path.resolve(input.dirPath);
      const key = `${input.kind}::${resolved}`;
      const watcher = watchers.get(key);
      if (watcher) {
        watcher.close();
        watchers.delete(key);
      }
      const timer = debounceTimers.get(key);
      if (timer) {
        clearTimeout(timer);
        debounceTimers.delete(key);
      }
      return true;
    },
  );

  return {
    dispose() {
      for (const watcher of watchers.values()) {
        try {
          watcher.close();
        } catch {}
      }
      watchers.clear();
      for (const timer of debounceTimers.values()) {
        clearTimeout(timer);
      }
      debounceTimers.clear();
      coverCache.clear();
    },
  };
}
