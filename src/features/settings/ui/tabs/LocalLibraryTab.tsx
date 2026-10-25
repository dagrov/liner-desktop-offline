import { useState } from "react";
import {
  Delete2Line,
  Edit2Line,
  FolderOpenLine,
  Music2Fill,
  Pic2Line,
  PlayFill,
  RadarLine,
  Upload2Line,
} from "@mingcute/react";
import ToggleSwitch from "@/shared/ui/ToggleSwitch";
import { showToast } from "@/shared/ui";
import { playerEngine } from "@/features/player/engine/playerEngine";
import {
  getAllOfflineTracks,
  syncElectronMusicDirectory,
  toClientTrackFromOffline,
  useOfflineLibraryStore,
} from "@/features/offline";
import {
  pickAndImportMusicFiles,
  pickAndSyncMusicFolder,
  triggerManualPcAudioScan,
  useStudioStore,
} from "@/features/studio";
import { SettingBlock, SettingRow, SettingSection } from "../controls";

export function LocalLibraryTab({ searchQuery }: { searchQuery?: string }) {
  const customTracks = useOfflineLibraryStore((s) => s.customTracks);
  const trackLyricsOverrides = useOfflineLibraryStore(
    (s) => s.trackLyricsOverrides,
  );
  const openLyricsEditor = useOfflineLibraryStore((s) => s.openLyricsEditor);
  const includeSampleTracks = useOfflineLibraryStore(
    (s) => s.includeSampleTracks,
  );
  const setIncludeSampleTracks = useOfflineLibraryStore(
    (s) => s.setIncludeSampleTracks,
  );
  const autoScanPcOnLaunch = useOfflineLibraryStore(
    (s) => s.autoScanPcOnLaunch,
  );
  const setAutoScanPcOnLaunch = useOfflineLibraryStore(
    (s) => s.setAutoScanPcOnLaunch,
  );
  const isScanningPc = useOfflineLibraryStore((s) => s.isScanningPc);
  const syncedMusicFolder = useOfflineLibraryStore(
    (s) => s.syncedMusicFolder,
  );
  const setSyncedMusicFolder = useOfflineLibraryStore(
    (s) => s.setSyncedMusicFolder,
  );
  const removeCustomTrack = useOfflineLibraryStore(
    (s) => s.removeCustomTrack,
  );
  const openCoverPicker = useStudioStore((s) => s.openCoverPicker);

  const [busy, setBusy] = useState(false);

  const handleScanPc = async () => {
    setBusy(true);
    try {
      const res = await triggerManualPcAudioScan();
      if (res.newlyImported > 0) {
        showToast(
          `Added ${res.newlyImported} audio track${res.newlyImported === 1 ? "" : "s"} from PC`,
          "success",
        );
      } else if (res.mode === "electron") {
        showToast(
          res.totalFound > 0
            ? `PC scanned — all ${res.totalFound} audio track${res.totalFound === 1 ? "" : "s"} already in library`
            : "No audio files found in Music, Downloads, or Desktop folders",
          "info",
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const handleImportFiles = async () => {
    setBusy(true);
    try {
      const count = await pickAndImportMusicFiles();
      if (count > 0) {
        showToast(
          `Imported ${count} local audio track${count === 1 ? "" : "s"}`,
          "success",
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSyncFolder = async () => {
    setBusy(true);
    try {
      const res = await pickAndSyncMusicFolder();
      if (res.folderLabel) {
        setSyncedMusicFolder(res.folderLabel);
        showToast(
          `Synced "${res.folderLabel}" (${res.importedCount} new track${res.importedCount === 1 ? "" : "s"})`,
          "success",
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const handleRescan = async () => {
    if (!syncedMusicFolder || !window.linerElectron?.localMedia) return;
    setBusy(true);
    try {
      const added = await syncElectronMusicDirectory(syncedMusicFolder);
      showToast(`Folder rescanned (${added} new)`, "info");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-[20px] pb-[12px]">
      <SettingSection label="Offline Music Sources">
        <SettingBlock
          title="Scan PC & Import Local Audio"
          description="Automatically scan your PC's Music, Downloads, and Desktop folders, or import MP3, FLAC, WAV, OGG, M4A, AAC, and Opus files directly."
          searchQuery={searchQuery}
        >
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              disabled={busy || isScanningPc}
              onClick={() => void handleScanPc()}
              className="h-[34px] px-3.5 rounded-[10px] border-0 bg-btn-primary-bg text-btn-primary-text text-[12.5px] font-[600] inline-flex items-center gap-1.5 cursor-pointer hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              <RadarLine
                size={15}
                className={isScanningPc ? "animate-spin" : undefined}
              />
              {isScanningPc ? "Scanning PC..." : "Scan PC for Music"}
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={() => void handleImportFiles()}
              className="h-[34px] px-3.5 rounded-[10px] border border-border-alpha-14 bg-black/[0.06] dark:bg-white/[0.08] hover:bg-black/[0.1] dark:hover:bg-white/[0.14] text-text-primary text-[12.5px] font-[500] inline-flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Upload2Line size={15} />
              Import Audio Files
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={() => void handleSyncFolder()}
              className="h-[34px] px-3.5 rounded-[10px] border border-border-alpha-14 bg-black/[0.06] dark:bg-white/[0.08] hover:bg-black/[0.1] dark:hover:bg-white/[0.14] text-text-primary text-[12.5px] font-[500] inline-flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <FolderOpenLine size={15} />
              Sync Custom Folder
            </button>

            {syncedMusicFolder && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-[9px] bg-black/[0.04] dark:bg-white/[0.05] text-[12px] text-text-secondary">
                <span className="truncate max-w-[240px]">
                  {syncedMusicFolder}
                </span>
                {typeof window !== "undefined" &&
                  window.linerElectron?.localMedia && (
                    <button
                      type="button"
                      onClick={() => void handleRescan()}
                      className="text-accent-primary bg-transparent border-0 text-[11.5px] font-[500] cursor-pointer"
                    >
                      Rescan
                    </button>
                  )}
                <button
                  type="button"
                  onClick={() => setSyncedMusicFolder(null)}
                  className="text-text-tertiary hover:text-text-primary bg-transparent border-0 text-[11.5px] cursor-pointer"
                >
                  Unlink
                </button>
              </div>
            )}
          </div>
        </SettingBlock>

        <SettingRow
          title="Auto-Scan PC on Launch"
          description="Automatically scan your PC's Music, Downloads, and Desktop folders for audio files whenever Liner opens."
          explained
          searchQuery={searchQuery}
          control={
            <ToggleSwitch
              checked={autoScanPcOnLaunch}
              onChange={setAutoScanPcOnLaunch}
            />
          }
        />

        <SettingRow
          title="Include Demo Sample Tracks"
          description="Optional: add 6 synthesized demo tracks with synchronized lyrics for testing when you don't have local audio yet."
          explained
          searchQuery={searchQuery}
          control={
            <ToggleSwitch
              checked={includeSampleTracks}
              onChange={setIncludeSampleTracks}
            />
          }
        />
      </SettingSection>

      <SettingSection
        label={`Local Tracks (${customTracks.length})`}
      >
        {customTracks.length === 0 ? (
          <div className="rounded-[12px] bg-black/[0.04] dark:bg-white/[0.06] px-4 py-6 text-center text-[13px] text-text-tertiary flex flex-col items-center gap-2">
            <Music2Fill size={22} className="opacity-60" />
            <span>
              No local audio files added yet. Click{" "}
              <strong className="text-text-secondary">Scan PC for Music</strong>,{" "}
              <strong className="text-text-secondary">Import Audio Files</strong>,{" "}
              or drag & drop songs into Liner.
            </span>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {customTracks.map((track) => (
              <div
                key={track.id}
                className="flex items-center justify-between gap-3 rounded-[11px] bg-black/[0.04] dark:bg-white/[0.06] px-3 py-2"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={track.coverUrl}
                    alt=""
                    className="h-10 w-10 rounded-[8px] object-cover shrink-0"
                  />
                  <div className="min-w-0">
                    <div
                      data-music-title="true"
                      className="text-[13.5px] font-[500] text-text-primary truncate"
                    >
                      {track.title}
                    </div>
                    <div className="text-[12px] text-text-tertiary truncate">
                      {track.artists} · {track.albumTitle}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    title="Play track"
                    onClick={() => {
                      const queue = getAllOfflineTracks().map(
                        toClientTrackFromOffline,
                      );
                      playerEngine.playTrack(
                        toClientTrackFromOffline(track),
                        queue,
                      );
                    }}
                    className="h-8 w-8 rounded-lg border-0 bg-transparent hover:bg-white/[0.1] text-text-secondary hover:text-text-primary flex items-center justify-center cursor-pointer"
                  >
                    <PlayFill size={15} />
                  </button>
                  <button
                    type="button"
                    title="Add or edit lyrics"
                    onClick={() => openLyricsEditor(track.id)}
                    className={`h-8 w-8 rounded-lg border-0 bg-transparent hover:bg-white/[0.1] flex items-center justify-center cursor-pointer ${
                      trackLyricsOverrides[track.id] || track.lrcLyrics
                        ? "text-text-primary"
                        : "text-text-secondary hover:text-text-primary"
                    }`}
                  >
                    <Edit2Line size={15} />
                  </button>
                  <button
                    type="button"
                    title="Change cover art"
                    onClick={() => openCoverPicker(track.id)}
                    className="h-8 w-8 rounded-lg border-0 bg-transparent hover:bg-white/[0.1] text-text-secondary hover:text-text-primary flex items-center justify-center cursor-pointer"
                  >
                    <Pic2Line size={15} />
                  </button>
                  <button
                    type="button"
                    title="Remove track"
                    onClick={() => removeCustomTrack(track.id)}
                    className="h-8 w-8 rounded-lg border-0 bg-transparent hover:bg-red-500/15 text-text-tertiary hover:text-red-400 flex items-center justify-center cursor-pointer"
                  >
                    <Delete2Line size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </SettingSection>
    </div>
  );
}
