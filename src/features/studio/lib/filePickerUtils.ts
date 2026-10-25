import {
  getAllOfflineTracks,
  importLocalAudioBlobs,
  saveTrackCustomLyrics,
  scanPcForAudio,
  syncElectronMusicDirectory,
  useOfflineLibraryStore,
} from "@/features/offline/store/offlineLibraryStore";
import { usePlayerStore } from "@/features/player/store/playerStore";
import {
  importCoverBlobs,
  importFontBlobs,
  syncElectronStudioFolder,
} from "../store/studioStore";

const AUDIO_EXT_RE = /\.(mp3|flac|wav|ogg|m4a|aac|opus|webm)$/i;
const FONT_EXT_RE = /\.(ttf|otf|woff2|woff)$/i;
const COVER_EXT_RE = /\.(png|jpg|jpeg|webp|svg|gif)$/i;
const LYRICS_EXT_RE = /\.(lrc|txt|srt|vtt|ttml)$/i;

function pickBrowserFilesViaInput(options: {
  accept?: string;
  multiple?: boolean;
  directory?: boolean;
}): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    if (options.accept) input.accept = options.accept;
    if (options.multiple) input.multiple = true;
    if (options.directory) {
      input.setAttribute("webkitdirectory", "");
      input.setAttribute("directory", "");
      input.multiple = true;
    }

    let settled = false;
    const finish = (files: File[]) => {
      if (settled) return;
      settled = true;
      resolve(files);
    };

    input.onchange = () => {
      const list = input.files ? Array.from(input.files) : [];
      finish(list);
    };
    input.oncancel = () => finish([]);
    input.click();
  });
}

export async function pickAndImportMusicFiles(): Promise<number> {
  if (typeof window !== "undefined" && window.linerElectron?.localMedia) {
    const picked = await window.linerElectron.localMedia.pickFiles("music");
    if (picked.length === 0) return 0;
    const batch: { file: Blob; name: string; localFilePath: string }[] = [];
    for (const item of picked) {
      const payload = await window.linerElectron.localMedia.readFile(item.path);
      if (!payload) continue;
      batch.push({
        file: new Blob([new Uint8Array(payload.bytes)], {
          type: payload.mimeType,
        }),
        name: payload.name,
        localFilePath: payload.path,
      });
    }
    const created = await importLocalAudioBlobs(batch);
    return created.length;
  }

  const files = await pickBrowserFilesViaInput({
    accept: ".mp3,.flac,.wav,.ogg,.m4a,.aac,.opus,.webm,audio/*",
    multiple: true,
  });
  const valid = files.filter(
    (f) => AUDIO_EXT_RE.test(f.name) || f.type.startsWith("audio/"),
  );
  if (valid.length === 0) return 0;
  const created = await importLocalAudioBlobs(
    valid.map((file) => ({ file, name: file.name })),
  );
  return created.length;
}

export async function pickAndSyncMusicFolder(): Promise<{
  folderLabel: string | null;
  importedCount: number;
}> {
  if (typeof window !== "undefined" && window.linerElectron?.localMedia) {
    const dir = await window.linerElectron.localMedia.pickDirectory("music");
    if (!dir) return { folderLabel: null, importedCount: 0 };
    const count = await syncElectronMusicDirectory(dir);
    return { folderLabel: dir, importedCount: count };
  }

  const files = await pickBrowserFilesViaInput({ directory: true });
  const audioFiles = files.filter(
    (f) => AUDIO_EXT_RE.test(f.name) || f.type.startsWith("audio/"),
  );
  if (audioFiles.length === 0) {
    return { folderLabel: null, importedCount: 0 };
  }
  const relPath = (audioFiles[0] as any).webkitRelativePath as
    | string
    | undefined;
  const folderName = relPath ? relPath.split("/")[0] : "Selected Music Folder";
  const created = await importLocalAudioBlobs(
    audioFiles.map((file) => ({ file, name: file.name })),
  );
  return { folderLabel: folderName, importedCount: created.length };
}

export async function triggerManualPcAudioScan(): Promise<{
  mode: "electron" | "browser";
  totalFound: number;
  newlyImported: number;
}> {
  if (
    typeof window !== "undefined" &&
    window.linerElectron?.localMedia?.scanPcAudio
  ) {
    const res = await scanPcForAudio();
    return {
      mode: "electron",
      totalFound: res.totalFound,
      newlyImported: res.newlyImported,
    };
  }

  useOfflineLibraryStore.setState({ isScanningPc: true });
  try {
    const res = await pickAndSyncMusicFolder();
    if (res.folderLabel) {
      useOfflineLibraryStore.getState().setSyncedMusicFolder(res.folderLabel);
    }
    return {
      mode: "browser",
      totalFound: res.importedCount,
      newlyImported: res.importedCount,
    };
  } finally {
    useOfflineLibraryStore.setState({ isScanningPc: false });
  }
}

export async function pickAndImportFontFiles(): Promise<number> {
  if (typeof window !== "undefined" && window.linerElectron?.localMedia) {
    const picked = await window.linerElectron.localMedia.pickFiles("fonts");
    if (picked.length === 0) return 0;
    const batch: {
      blob: Blob;
      fileName: string;
      localFilePath: string;
      source: "imported";
    }[] = [];
    for (const item of picked) {
      const payload = await window.linerElectron.localMedia.readFile(item.path);
      if (!payload) continue;
      batch.push({
        blob: new Blob([new Uint8Array(payload.bytes)], {
          type: payload.mimeType,
        }),
        fileName: payload.name,
        localFilePath: payload.path,
        source: "imported",
      });
    }
    const created = await importFontBlobs(batch);
    return created.length;
  }

  const files = await pickBrowserFilesViaInput({
    accept: ".ttf,.otf,.woff2,.woff",
    multiple: true,
  });
  const valid = files.filter((f) => FONT_EXT_RE.test(f.name));
  if (valid.length === 0) return 0;
  const created = await importFontBlobs(
    valid.map((f) => ({ blob: f, fileName: f.name, source: "imported" })),
  );
  return created.length;
}

export async function pickAndSyncFontsFolder(): Promise<{
  folderLabel: string | null;
  importedCount: number;
}> {
  if (typeof window !== "undefined" && window.linerElectron?.localMedia) {
    const dir = await window.linerElectron.localMedia.pickDirectory("fonts");
    if (!dir) return { folderLabel: null, importedCount: 0 };
    const count = await syncElectronStudioFolder(dir, "fonts");
    return { folderLabel: dir, importedCount: count };
  }

  const files = await pickBrowserFilesViaInput({ directory: true });
  const fontFiles = files.filter((f) => FONT_EXT_RE.test(f.name));
  if (fontFiles.length === 0) return { folderLabel: null, importedCount: 0 };
  const relPath = (fontFiles[0] as any).webkitRelativePath as
    | string
    | undefined;
  const folderName = relPath ? relPath.split("/")[0] : "Selected Fonts Folder";
  const created = await importFontBlobs(
    fontFiles.map((f) => ({ blob: f, fileName: f.name, source: "folder" })),
  );
  return { folderLabel: folderName, importedCount: created.length };
}

export async function pickAndImportCoverFiles(
  trackId?: string,
  tags?: string[],
): Promise<number> {
  if (typeof window !== "undefined" && window.linerElectron?.localMedia) {
    const picked = await window.linerElectron.localMedia.pickFiles("covers");
    if (picked.length === 0) return 0;
    const batch: {
      blob: Blob;
      fileName: string;
      localFilePath: string;
      trackId?: string;
      tags?: string[];
      source: "imported";
    }[] = [];
    for (const item of picked) {
      const payload = await window.linerElectron.localMedia.readFile(item.path);
      if (!payload) continue;
      batch.push({
        blob: new Blob([new Uint8Array(payload.bytes)], {
          type: payload.mimeType,
        }),
        fileName: payload.name,
        localFilePath: payload.path,
        trackId,
        tags,
        source: "imported",
      });
    }
    const created = await importCoverBlobs(batch);
    return created.length;
  }

  const files = await pickBrowserFilesViaInput({
    accept: ".png,.jpg,.jpeg,.webp,.svg,.gif,image/*",
    multiple: true,
  });
  const valid = files.filter(
    (f) => COVER_EXT_RE.test(f.name) || f.type.startsWith("image/"),
  );
  if (valid.length === 0) return 0;
  const created = await importCoverBlobs(
    valid.map((f) => ({
      blob: f,
      fileName: f.name,
      trackId,
      tags,
      source: "imported",
    })),
  );
  return created.length;
}

export async function pickAndSyncCoversFolder(): Promise<{
  folderLabel: string | null;
  importedCount: number;
}> {
  if (typeof window !== "undefined" && window.linerElectron?.localMedia) {
    const dir = await window.linerElectron.localMedia.pickDirectory("covers");
    if (!dir) return { folderLabel: null, importedCount: 0 };
    const count = await syncElectronStudioFolder(dir, "covers");
    return { folderLabel: dir, importedCount: count };
  }

  const files = await pickBrowserFilesViaInput({ directory: true });
  const coverFiles = files.filter(
    (f) => COVER_EXT_RE.test(f.name) || f.type.startsWith("image/"),
  );
  if (coverFiles.length === 0) return { folderLabel: null, importedCount: 0 };
  const relPath = (coverFiles[0] as any).webkitRelativePath as
    | string
    | undefined;
  const folderName = relPath ? relPath.split("/")[0] : "Selected Covers Folder";
  const created = await importCoverBlobs(
    coverFiles.map((f) => ({ blob: f, fileName: f.name, source: "folder" })),
  );
  return { folderLabel: folderName, importedCount: created.length };
}

export async function pickLyricsFile(): Promise<{
  content: string;
  fileName: string;
} | null> {
  if (typeof window !== "undefined" && window.linerElectron?.localMedia) {
    const picked = await window.linerElectron.localMedia.pickFiles("lyrics");
    const first = picked[0];
    if (!first) return null;
    const payload = await window.linerElectron.localMedia.readFile(first.path);
    if (!payload) return null;
    const text = new TextDecoder("utf-8").decode(payload.bytes);
    return { content: text, fileName: payload.name };
  }

  const files = await pickBrowserFilesViaInput({
    accept: ".lrc,.txt,.srt,.vtt,.ttml,text/plain",
    multiple: false,
  });
  const file = files[0];
  if (!file) return null;
  const content = await file.text();
  return { content, fileName: file.name };
}

export async function pickAndAttachLyricsFile(trackId: string): Promise<{
  saved: boolean;
  fileName?: string;
  lineCount: number;
  syncLevel: string;
}> {
  const picked = await pickLyricsFile();
  if (!picked) {
    return { saved: false, lineCount: 0, syncLevel: "plain" };
  }
  const result = saveTrackCustomLyrics(
    trackId,
    picked.content,
    picked.fileName,
  );
  return { ...result, fileName: picked.fileName };
}

function stemKey(name: string): string {
  return name
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9\u1200-\u137f]+/g, "");
}

export async function handleDroppedFilesImport(
  fileList: FileList | File[],
): Promise<{ audio: number; fonts: number; covers: number; lyrics: number }> {
  const files = Array.from(fileList);
  const audioFiles = files.filter(
    (f) => AUDIO_EXT_RE.test(f.name) || f.type.startsWith("audio/"),
  );
  const fontFiles = files.filter((f) => FONT_EXT_RE.test(f.name));
  const lyricsFiles = files.filter((f) => LYRICS_EXT_RE.test(f.name));
  const coverFiles = files.filter(
    (f) =>
      !FONT_EXT_RE.test(f.name) &&
      !AUDIO_EXT_RE.test(f.name) &&
      !LYRICS_EXT_RE.test(f.name) &&
      (COVER_EXT_RE.test(f.name) || f.type.startsWith("image/")),
  );

  let audio = 0;
  let fonts = 0;
  let covers = 0;
  let lyrics = 0;

  if (audioFiles.length > 0) {
    const res = await importLocalAudioBlobs(
      audioFiles.map((file) => ({ file, name: file.name })),
    );
    audio = res.length;
  }
  if (fontFiles.length > 0) {
    const res = await importFontBlobs(
      fontFiles.map((f) => ({ blob: f, fileName: f.name, source: "imported" })),
    );
    fonts = res.length;
  }
  if (coverFiles.length > 0) {
    const res = await importCoverBlobs(
      coverFiles.map((f) => ({
        blob: f,
        fileName: f.name,
        source: "imported",
      })),
    );
    covers = res.length;
  }
  if (lyricsFiles.length > 0) {
    const allTracks = getAllOfflineTracks();
    const currentTrackId = usePlayerStore.getState().currentTrack?.id ?? null;

    for (const file of lyricsFiles) {
      const content = await file.text().catch(() => "");
      if (!content.trim()) continue;
      const key = stemKey(file.name);
      const matchedTrack =
        allTracks.find((t) => {
          const titleKey = stemKey(t.title);
          const artistTitleKey = stemKey(`${t.artists} ${t.title}`);
          const filePathKey = t.localFilePath
            ? stemKey(t.localFilePath.split(/[\\/]/).pop() || "")
            : "";
          return (
            (key && titleKey === key) ||
            (key && artistTitleKey === key) ||
            (key && filePathKey === key)
          );
        }) ?? null;

      const targetTrackId = matchedTrack?.id ?? currentTrackId;
      if (targetTrackId) {
        const res = saveTrackCustomLyrics(targetTrackId, content, file.name);
        if (res.saved) lyrics++;
      }
    }
  }

  return { audio, fonts, covers, lyrics };
}
