import { useMemo } from "react";
import {
  CheckLine,
  Delete2Line,
  FolderOpenLine,
  Refresh2Line,
  SparklesFill,
  Upload2Line,
} from "@mingcute/react";
import { showToast } from "@/shared/ui";
import { getOfflineTrackById } from "@/features/offline";
import { usePlayerStore } from "@/features/player/store/playerStore";
import {
  STARTER_COVERS,
  STARTER_FONTS,
  pickAndImportCoverFiles,
  pickAndImportFontFiles,
  pickAndSyncCoversFolder,
  pickAndSyncFontsFolder,
  syncElectronStudioFolder,
  useStudioStore,
} from "@/features/studio";
import { SettingBlock, SettingSection } from "../controls";

export function StudioTab({ searchQuery }: { searchQuery?: string }) {
  const customFonts = useStudioStore((s) => s.customFonts);
  const customCovers = useStudioStore((s) => s.customCovers);
  const activeTitleFontId = useStudioStore((s) => s.activeTitleFontId);
  const syncedFontsFolder = useStudioStore((s) => s.syncedFontsFolder);
  const syncedCoversFolder = useStudioStore((s) => s.syncedCoversFolder);

  const setTitleFont = useStudioStore((s) => s.setTitleFont);
  const resetTypography = useStudioStore((s) => s.resetTypography);
  const removeCustomFont = useStudioStore((s) => s.removeCustomFont);
  const removeCustomCover = useStudioStore((s) => s.removeCustomCover);
  const setSyncedFontsFolder = useStudioStore((s) => s.setSyncedFontsFolder);
  const setSyncedCoversFolder = useStudioStore((s) => s.setSyncedCoversFolder);
  const applyCoverAssetToTrack = useStudioStore(
    (s) => s.applyCoverAssetToTrack,
  );
  const cycleTrackCover = useStudioStore((s) => s.cycleTrackCover);
  const resetTrackCover = useStudioStore((s) => s.resetTrackCover);

  const currentTrack = usePlayerStore((s) => s.currentTrack);

  const allFonts = useMemo(
    () => [...customFonts, ...STARTER_FONTS],
    [customFonts],
  );
  const allCovers = useMemo(
    () => [...customCovers, ...STARTER_COVERS],
    [customCovers],
  );

  const matchTrackVibeTypography = () => {
    const offline = currentTrack
      ? getOfflineTrackById(currentTrack.id)
      : undefined;
    const cat = offline?.recommendedFontCategory ?? "sans";
    const tags = offline?.vibeTags ?? ["clean"];
    const ranked = [...allFonts].sort((a, b) => {
      const aS =
        (a.category === cat ? 30 : 0) +
        a.tags.filter((t) => tags.includes(t)).length * 10;
      const bS =
        (b.category === cat ? 30 : 0) +
        b.tags.filter((t) => tags.includes(t)).length * 10;
      return bS - aS;
    });
    const best = ranked[0];
    if (best) {
      setTitleFont(best.id);
      showToast(
        `Matched album vibe with "${best.name}"`,
        "success",
      );
    }
  };

  return (
    <div className="flex flex-col gap-[22px] pb-[14px]">
      {/* Typography Collection */}
      <SettingSection label="Music Title Font">
        <SettingBlock
          title="Song Title Typography"
          description="Customize the font used for song titles in the player and track lists without changing Liner's app UI font."
          searchQuery={searchQuery}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <span className="text-[12px] text-text-tertiary">
              Applies only to music track titles
            </span>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={matchTrackVibeTypography}
                className="h-[32px] px-3 rounded-[9px] border border-border-alpha-14 bg-black/[0.05] dark:bg-white/[0.07] hover:bg-white/[0.13] text-[12px] font-[500] text-text-primary inline-flex items-center gap-1.5 cursor-pointer"
              >
                <SparklesFill size={13} />
                Match Track Vibe
              </button>

              <button
                type="button"
                onClick={async () => {
                  const count = await pickAndImportFontFiles();
                  if (count > 0) {
                    showToast(`Imported ${count} font(s)`, "success");
                  }
                }}
                className="h-[32px] px-3 rounded-[9px] border-0 bg-btn-primary-bg text-btn-primary-text text-[12px] font-[600] inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Upload2Line size={14} />
                Import Font
              </button>

              <button
                type="button"
                onClick={async () => {
                  const res = await pickAndSyncFontsFolder();
                  if (res.folderLabel) {
                    setSyncedFontsFolder(res.folderLabel);
                    showToast(
                      `Synced fonts folder (${res.importedCount} new)`,
                      "success",
                    );
                  }
                }}
                className="h-[32px] px-3 rounded-[9px] border border-border-alpha-14 bg-black/[0.05] dark:bg-white/[0.07] hover:bg-white/[0.13] text-[12px] font-[500] text-text-primary inline-flex items-center gap-1.5 cursor-pointer"
              >
                <FolderOpenLine size={14} />
                Sync Folder
              </button>

              <button
                type="button"
                onClick={() => {
                  resetTypography();
                  showToast("Typography reset to Liner defaults", "info");
                }}
                className="h-[32px] px-2.5 rounded-[9px] border-0 bg-transparent hover:bg-white/[0.08] text-[12px] text-text-tertiary hover:text-text-primary cursor-pointer"
              >
                Reset
              </button>
            </div>
          </div>

          {syncedFontsFolder && (
            <div className="flex items-center justify-between gap-2 rounded-[9px] bg-black/[0.04] dark:bg-white/[0.05] px-3 py-1.5 text-[11.5px] text-text-secondary">
              <span className="truncate">
                Fonts Folder: <strong>{syncedFontsFolder}</strong>
              </span>
              <div className="flex items-center gap-2 shrink-0">
                {typeof window !== "undefined" &&
                  window.linerElectron?.localMedia && (
                    <button
                      type="button"
                      onClick={() =>
                        void syncElectronStudioFolder(
                          syncedFontsFolder,
                          "fonts",
                        )
                      }
                      className="border-0 bg-transparent text-accent-primary cursor-pointer text-[11.5px]"
                    >
                      Rescan
                    </button>
                  )}
                <button
                  type="button"
                  onClick={() => setSyncedFontsFolder(null)}
                  className="border-0 bg-transparent text-text-tertiary hover:text-text-primary cursor-pointer text-[11.5px]"
                >
                  Unlink
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            {allFonts.map((fontItem) => {
              const isSelected = activeTitleFontId === fontItem.id;
              return (
                <div
                  key={fontItem.id}
                  onClick={() => {
                    setTitleFont(fontItem.id);
                  }}
                  className={`group relative flex flex-col justify-between gap-2 rounded-[11px] border p-3 cursor-pointer transition-all ${
                    isSelected
                      ? "border-accent-primary bg-accent-primary/10"
                      : "border-border-alpha-14 bg-black/[0.03] dark:bg-white/[0.04] hover:bg-white/[0.08]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[13px] font-[600] text-text-primary truncate">
                          {fontItem.name}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-white/[0.08] text-[10px] uppercase tracking-wider text-text-tertiary">
                          {fontItem.category}
                        </span>
                      </div>
                      <p className="m-0 mt-0.5 text-[11.5px] text-text-tertiary truncate">
                        {fontItem.description}
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      {isSelected && (
                        <span className="h-5 w-5 rounded-full bg-accent-primary text-white flex items-center justify-center">
                          <CheckLine size={12} />
                        </span>
                      )}
                      {fontItem.source !== "starter" && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeCustomFont(fontItem.id);
                          }}
                          className="h-6 w-6 rounded-md border-0 bg-transparent hover:bg-red-500/20 text-text-tertiary hover:text-red-400 flex items-center justify-center cursor-pointer"
                        >
                          <Delete2Line size={13} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div
                    style={{ fontFamily: fontItem.cssFamily }}
                    className="pt-1 text-[17px] text-text-primary truncate"
                  >
                    Midnight Glass — 02:48
                  </div>
                </div>
              );
            })}
          </div>
        </SettingBlock>
      </SettingSection>

      {/* Cover Art Vault */}
      <SettingSection label="Cover Art Vault">
        <SettingBlock
          title="Alternate Album & Track Covers"
          description={
            currentTrack
              ? `Click any artwork below to apply it to "${currentTrack.title}", or right-click any song in Liner to change its cover.`
              : "Import custom cover artwork or sync a local covers folder on disk."
          }
          searchQuery={searchQuery}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={async () => {
                  const count = await pickAndImportCoverFiles();
                  if (count > 0) {
                    showToast(`Added ${count} cover(s) to Vault`, "success");
                  }
                }}
                className="h-[32px] px-3 rounded-[9px] border-0 bg-btn-primary-bg text-btn-primary-text text-[12px] font-[600] inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Upload2Line size={14} />
                Import Cover Art
              </button>

              <button
                type="button"
                onClick={async () => {
                  const res = await pickAndSyncCoversFolder();
                  if (res.folderLabel) {
                    setSyncedCoversFolder(res.folderLabel);
                    showToast(
                      `Synced covers folder (${res.importedCount} new)`,
                      "success",
                    );
                  }
                }}
                className="h-[32px] px-3 rounded-[9px] border border-border-alpha-14 bg-black/[0.05] dark:bg-white/[0.07] hover:bg-white/[0.13] text-[12px] font-[500] text-text-primary inline-flex items-center gap-1.5 cursor-pointer"
              >
                <FolderOpenLine size={14} />
                Sync Covers Folder
              </button>
            </div>

            {currentTrack && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    const next = cycleTrackCover(currentTrack.id);
                    if (next) {
                      showToast(
                        `Cycled "${currentTrack.title}" to ${next.label}`,
                        "info",
                      );
                    }
                  }}
                  className="h-[32px] px-3 rounded-[9px] border border-border-alpha-14 bg-black/[0.05] dark:bg-white/[0.07] hover:bg-white/[0.13] text-[12px] font-[500] text-text-primary inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Refresh2Line size={14} />
                  Cycle Cover
                </button>
                <button
                  type="button"
                  onClick={() => {
                    resetTrackCover(currentTrack.id);
                    showToast("Restored original track cover", "info");
                  }}
                  className="h-[32px] px-2.5 rounded-[9px] border-0 bg-transparent hover:bg-white/[0.08] text-[12px] text-text-tertiary hover:text-text-primary cursor-pointer"
                >
                  Original
                </button>
              </div>
            )}
          </div>

          {syncedCoversFolder && (
            <div className="flex items-center justify-between gap-2 rounded-[9px] bg-black/[0.04] dark:bg-white/[0.05] px-3 py-1.5 text-[11.5px] text-text-secondary">
              <span className="truncate">
                Covers Folder: <strong>{syncedCoversFolder}</strong>
              </span>
              <div className="flex items-center gap-2 shrink-0">
                {typeof window !== "undefined" &&
                  window.linerElectron?.localMedia && (
                    <button
                      type="button"
                      onClick={() =>
                        void syncElectronStudioFolder(
                          syncedCoversFolder,
                          "covers",
                        )
                      }
                      className="border-0 bg-transparent text-accent-primary cursor-pointer text-[11.5px]"
                    >
                      Rescan
                    </button>
                  )}
                <button
                  type="button"
                  onClick={() => setSyncedCoversFolder(null)}
                  className="border-0 bg-transparent text-text-tertiary hover:text-text-primary cursor-pointer text-[11.5px]"
                >
                  Unlink
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            {allCovers.map((cover) => {
              const active = currentTrack?.coverUrl === cover.imageUrl;
              return (
                <div
                  key={cover.id}
                  onClick={() => {
                    if (!currentTrack) return;
                    applyCoverAssetToTrack(currentTrack.id, cover.id);
                    showToast(
                      `Applied "${cover.name}" to ${currentTrack.title}`,
                      "success",
                    );
                  }}
                  className={`group relative flex flex-col gap-1.5 rounded-[11px] border p-2 cursor-pointer transition-all ${
                    active
                      ? "border-accent-primary bg-accent-primary/10"
                      : "border-border-alpha-14 bg-black/[0.03] dark:bg-white/[0.04] hover:bg-white/[0.08]"
                  }`}
                >
                  <div className="relative aspect-square w-full overflow-hidden rounded-[8px]">
                    <img
                      src={cover.imageUrl}
                      alt={cover.name}
                      className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                    />
                    {active && (
                      <span className="absolute right-1.5 top-1.5 h-5 w-5 rounded-full bg-accent-primary text-white flex items-center justify-center">
                        <CheckLine size={12} />
                      </span>
                    )}
                    {cover.source !== "starter" && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeCustomCover(cover.id);
                        }}
                        className="absolute left-1.5 top-1.5 h-6 w-6 rounded-md border-0 bg-black/60 text-white/80 hover:text-red-400 flex items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Delete2Line size={13} />
                      </button>
                    )}
                  </div>
                  <div className="text-[12px] font-[600] text-text-primary truncate px-0.5">
                    {cover.name}
                  </div>
                  <div className="text-[10.5px] text-text-tertiary truncate px-0.5">
                    {cover.tags.slice(0, 3).join(" · ")}
                  </div>
                </div>
              );
            })}
          </div>
        </SettingBlock>
      </SettingSection>
    </div>
  );
}
