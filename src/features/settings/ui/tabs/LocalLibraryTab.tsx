import { useState } from "react";
import {
  Delete2Line,
  FolderOpenLine,
  Music2Fill,
  Pic2Line,
  PlayFill,
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
  useStudioStore,
} from "@/features/studio";
import { SettingBlock, SettingRow, SettingSection } from "../controls";

export function LocalLibraryTab({ searchQuery }: { searchQuery?: string }) {
  const customTracks = useOfflineLibraryStore((s) => s.customTracks);
  const includeSampleTracks = useOfflineLibraryStore(
    (s) => s.includeSampleTracks,
  );
  const setIncludeSampleTracks = useOfflineLibraryStore(
    (s) => s.setIncludeSampleTracks,
  );
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
          title="Import Local Audio"
          description="Add MP3, FLAC, WAV, OGG, M4A, AAC, or Opus files from disk, or drop audio files anywhere onto the Liner window."
          searchQuery={searchQuery}
        >
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleImportFiles()}
              className="h-[34px] px-3.5 rounded-[10px] border-0 bg-btn-primary-bg text-btn-primary-text text-[12.5px] font-[600] inline-flex items-center gap-1.5 cursor-pointer hover:opacity-90 disabled:opacity-50 transition-opacity"
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
              Sync Music Folder
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
          title="Include Curated Sample Catalog"
          description="Keep 6 built-in offline tracks with synchronized lyrics and album liner notes in your library."
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
        label={`Imported Local Tracks (${customTracks.length})`}
      >
        {customTracks.length === 0 ? (
          <div className="rounded-[12px] bg-black/[0.04] dark:bg-white/[0.06] px-4 py-6 text-center text-[13px] text-text-tertiary flex flex-col items-center gap-2">
            <Music2Fill size={22} className="opacity-60" />
            <span>
              No custom audio files imported yet. Use{" "}
              <strong className="text-text-secondary">Import Audio Files</strong>{" "}
              or drag & drop tracks into Liner.
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
                    <div className="text-[13.5px] font-[500] text-text-primary truncate">
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
