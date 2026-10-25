import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  type IpcMainInvokeEvent,
} from "electron";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

export type LocalFolderKind = "music" | "fonts" | "covers" | "lyrics";

export interface ScannedLocalFile {
  path: string;
  name: string;
  ext: string;
  size: number;
  mtimeMs: number;
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

function isLocalhostUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }
    const host = parsed.hostname.toLowerCase();
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host === "[::1]" ||
      host === "0.0.0.0"
    );
  } catch {
    return false;
  }
}

export function registerLocalMediaIpc(getMainWindow: () => BrowserWindow | null) {
  const approvedRoots = new Set<string>();
  const approvedFiles = new Set<string>();
  const watchers = new Map<string, fs.FSWatcher>();
  const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

  function isPathApproved(targetPath: string): boolean {
    const resolved = path.resolve(targetPath);
    if (approvedFiles.has(resolved)) return true;
    for (const root of approvedRoots) {
      if (resolved === root || resolved.startsWith(root + path.sep)) {
        return true;
      }
    }
    return false;
  }

  const IGNORED_SCAN_DIRS = new Set([
    "node_modules",
    "appdata",
    "application data",
    "program files",
    "program files (x86)",
    "windows",
    "$recycle.bin",
    "system volume information",
    "library",
    "__pycache__",
    "dist",
    "build",
    "target",
    "venv",
  ]);

  async function scanDirectoryRecursive(
    dirPath: string,
    kind: LocalFolderKind,
    maxFiles = 1500,
    maxDepth = 5,
  ): Promise<ScannedLocalFile[]> {
    const results: ScannedLocalFile[] = [];
    const allowedExts = EXTENSIONS_BY_KIND[kind] ?? EXTENSIONS_BY_KIND.music;
    const queue: { dir: string; depth: number }[] = [
      { dir: path.resolve(dirPath), depth: 0 },
    ];
    const visited = new Set<string>();

    while (queue.length > 0 && results.length < maxFiles) {
      const { dir: current, depth } = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);

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
          if (depth < maxDepth && !IGNORED_SCAN_DIRS.has(entry.name.toLowerCase())) {
            queue.push({ dir: fullPath, depth: depth + 1 });
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (!allowedExts.has(ext)) continue;
          try {
            const stat = await fsp.stat(fullPath);
            // Skip tiny < 4KB sound-effect/temp stubs when scanning whole PC
            if (kind === "music" && stat.size < 4096) continue;
            results.push({
              path: fullPath,
              name: entry.name,
              ext,
              size: stat.size,
              mtimeMs: stat.mtimeMs,
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
          files.push({
            path: resolved,
            name: path.basename(resolved),
            ext: path.extname(resolved).toLowerCase(),
            size: stat.size,
            mtimeMs: stat.mtimeMs,
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
      // Allow scanning previously user-approved roots or existing user directories persisted in local settings
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

      const candidateRoots = new Set<string>();
      const tryAddPath = (name: "music" | "downloads" | "desktop" | "home") => {
        try {
          const p = app.getPath(name);
          if (p) candidateRoots.add(path.resolve(p));
        } catch {}
      };

      tryAddPath("music");
      tryAddPath("downloads");
      tryAddPath("desktop");
      try {
        const home = app.getPath("home");
        if (home) {
          candidateRoots.add(path.resolve(home, "OneDrive", "Music"));
          candidateRoots.add(path.resolve(home, "Audio"));
        }
      } catch {}

      const scannedDirs: string[] = [];
      const seenPaths = new Set<string>();
      const files: ScannedLocalFile[] = [];

      for (const rootDir of candidateRoots) {
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
          2500 - files.length,
          5,
        );
        for (const item of found) {
          const norm = path.resolve(item.path);
          if (seenPaths.has(norm)) continue;
          seenPaths.add(norm);
          files.push(item);
        }
        if (files.length >= 2500) break;
      }

      return { scannedDirs, files };
    },
  );

  ipcMain.handle(
    "local:read-file-head",
    async (
      event,
      input: { filePath: string; maxBytes?: number },
    ): Promise<LocalFilePayload | null> => {
      const filePath = input?.filePath;
      if (!fromApp(event) || typeof filePath !== "string" || !filePath) {
        return null;
      }
      const resolved = path.resolve(filePath);
      if (!isPathApproved(resolved)) return null;
      const limit = Math.min(Math.max(input?.maxBytes ?? 524_288, 4096), 2_097_152);
      let handle: fsp.FileHandle | null = null;
      try {
        handle = await fsp.open(resolved, "r");
        const stat = await handle.stat();
        const toRead = Math.min(stat.size, limit);
        const buf = Buffer.allocUnsafe(toRead);
        const { bytesRead } = await handle.read(buf, 0, toRead, 0);
        const ext = path.extname(resolved).toLowerCase();
        return {
          path: resolved,
          name: path.basename(resolved),
          mimeType: MIME_BY_EXT[ext] ?? "application/octet-stream",
          bytes: new Uint8Array(buf.subarray(0, bytesRead)),
        };
      } catch {
        return null;
      } finally {
        await handle?.close().catch(() => {});
      }
    },
  );

  ipcMain.handle(
    "local:read-sidecar-lyrics",
    async (
      event,
      audioFilePath: string,
    ): Promise<{ content: string; fileName: string } | null> => {
      if (
        !fromApp(event) ||
        typeof audioFilePath !== "string" ||
        !audioFilePath
      ) {
        return null;
      }
      const resolvedAudio = path.resolve(audioFilePath);
      if (!isPathApproved(resolvedAudio)) return null;

      const parsed = path.parse(resolvedAudio);
      const sidecarExts = [".lrc", ".srt", ".vtt", ".ttml"];
      for (const ext of sidecarExts) {
        const candidatePath = path.join(parsed.dir, `${parsed.name}${ext}`);
        try {
          const st = await fsp.stat(candidatePath);
          if (!st.isFile() || st.size === 0 || st.size > 524_288) continue;
          const content = await fsp.readFile(candidatePath, "utf8");
          if (content.trim()) {
            return {
              content,
              fileName: path.basename(candidatePath),
            };
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
      if (!fromApp(event) || typeof filePath !== "string" || !filePath) {
        return null;
      }
      const resolved = path.resolve(filePath);
      if (!isPathApproved(resolved)) return null;
      try {
        const buffer = await fsp.readFile(resolved);
        const ext = path.extname(resolved).toLowerCase();
        return {
          path: resolved,
          name: path.basename(resolved),
          mimeType: MIME_BY_EXT[ext] ?? "application/octet-stream",
          bytes: new Uint8Array(buffer),
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
              }, 450),
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

  ipcMain.handle(
    "local:llm-request",
    async (
      event,
      input: LocalLlmRequestInput,
    ): Promise<LocalLlmResponseOutput> => {
      if (!fromApp(event)) {
        return { ok: false, status: 403, body: "", error: "Forbidden sender" };
      }
      if (!input?.url || !isLocalhostUrl(input.url)) {
        return {
          ok: false,
          status: 400,
          body: "",
          error: "Only local loopback LLM endpoints (127.0.0.1 / localhost) are permitted.",
        };
      }

      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        Math.min(Math.max(input.timeoutMs ?? 25_000, 1_000), 90_000),
      );
      try {
        const res = await fetch(input.url, {
          method: input.method ?? "POST",
          headers: input.headers,
          body: input.body,
          signal: controller.signal,
        });
        const body = await res.text();
        return {
          ok: res.ok,
          status: res.status,
          body,
        };
      } catch (err: any) {
        return {
          ok: false,
          status: 0,
          body: "",
          error: err?.message || "Failed to connect to local LLM endpoint",
        };
      } finally {
        clearTimeout(timeout);
      }
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
    },
  };
}
