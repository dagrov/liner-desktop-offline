import { useMemo, useState } from "react";
import {
  CheckLine,
  CloseLine,
  Refresh2Line,
  Upload2Line,
  Search2Line,
} from "@mingcute/react";
import Dialog from "@/shared/ui/Dialog";
import { showToast } from "@/shared/ui/Toast";
import { getOfflineTrackById } from "@/features/offline";
import { usePlayerStore } from "@/features/player/store/playerStore";
import { STARTER_COVERS } from "../lib/starterAssets";
import { useStudioStore } from "../store/studioStore";
import { pickAndImportCoverFiles } from "../lib/filePickerUtils";

export function CoverPickerModal() {
  const trackId = useStudioStore((s) => s.coverPickerTrackId);
  const close = useStudioStore((s) => s.closeCoverPicker);
  const customCovers = useStudioStore((s) => s.customCovers);
  const applyCoverAssetToTrack = useStudioStore(
    (s) => s.applyCoverAssetToTrack,
  );
  const cycleTrackCover = useStudioStore((s) => s.cycleTrackCover);
  const resetTrackCover = useStudioStore((s) => s.resetTrackCover);

  const [query, setQuery] = useState("");
  const currentPlayerTrack = usePlayerStore((s) => s.currentTrack);

  const track = useMemo(() => {
    if (!trackId) return null;
    const offline = getOfflineTrackById(trackId);
    if (offline) return offline;
    if (currentPlayerTrack?.id === trackId) {
      return {
        id: currentPlayerTrack.id,
        title: currentPlayerTrack.title,
        artists: currentPlayerTrack.artists,
        coverUrl: currentPlayerTrack.coverUrl,
        originalCoverUrl: currentPlayerTrack.coverUrl,
      };
    }
    return null;
  }, [trackId, currentPlayerTrack]);

  const allCovers = useMemo(
    () => [...customCovers, ...STARTER_COVERS],
    [customCovers],
  );

  const filteredCovers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allCovers;
    return allCovers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.tags.some((tag) => tag.toLowerCase().includes(q)) ||
        c.description.toLowerCase().includes(q),
    );
  }, [allCovers, query]);

  if (!trackId || !track) return null;

  const handleImportAndApply = async () => {
    const count = await pickAndImportCoverFiles(trackId);
    if (count > 0) {
      const newest = useStudioStore.getState().customCovers[0];
      if (newest) {
        applyCoverAssetToTrack(trackId, newest.id);
        showToast(`Applied "${newest.name}" to ${track.title}`, "success");
      }
    }
  };

  return (
    <Dialog
      open={Boolean(trackId)}
      onOpenChange={(next) => (!next ? close() : undefined)}
      maxWidth={680}
      className="p-0 overflow-hidden !bg-bg-surface/85 dark:!bg-bg-elevated/80 !backdrop-blur-[50px] !border !border-border-alpha-14"
    >
      <div className="flex flex-col max-h-[82vh]">
        <div className="flex items-center justify-between gap-4 px-6 pt-5 pb-4 border-b border-border-alpha-14">
          <div className="flex items-center gap-3.5 min-w-0">
            <img
              src={track.coverUrl}
              alt={track.title}
              className="h-12 w-12 rounded-[10px] object-cover shrink-0 border border-border-alpha-14"
            />
            <div className="min-w-0">
              <h3 className="m-0 text-[16px] font-[600] text-text-primary truncate font-montserrat">
                Cover Art — {track.title}
              </h3>
              <p className="m-0 text-[12.5px] text-text-secondary truncate">
                {track.artists} · Choose from your Cover Vault or import custom artwork
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={close}
            className="h-8 w-8 rounded-lg border-0 bg-transparent text-text-tertiary hover:text-text-primary hover:bg-border-alpha-14 flex items-center justify-center cursor-pointer"
          >
            <CloseLine size={18} />
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2.5 px-6 py-3 bg-bg-primary/30">
          <div className="relative flex-1 min-w-[200px]">
            <Search2Line
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search covers by name or vibe (retro, vinyl, noir, minimal)..."
              className="w-full h-[34px] pl-9 pr-3 rounded-[9px] border border-border-alpha-14 bg-bg-surface/70 dark:bg-white/[0.06] text-[12.5px] text-text-primary outline-none placeholder:text-text-tertiary"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const cycled = cycleTrackCover(trackId);
                if (cycled) {
                  showToast(`Cover cycled to "${cycled.label}"`, "info");
                }
              }}
              className="h-[34px] px-3 rounded-[9px] border border-border-alpha-14 bg-bg-surface/60 dark:bg-white/[0.06] hover:bg-white/[0.12] text-[12px] font-[500] text-text-primary inline-flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Refresh2Line size={14} />
              Cycle Next
            </button>

            <button
              type="button"
              onClick={() => {
                resetTrackCover(trackId);
                showToast("Restored original track cover", "info");
              }}
              className="h-[34px] px-3 rounded-[9px] border border-border-alpha-14 bg-bg-surface/60 dark:bg-white/[0.06] hover:bg-white/[0.12] text-[12px] font-[500] text-text-secondary hover:text-text-primary cursor-pointer transition-colors"
            >
              Original
            </button>

            <button
              type="button"
              onClick={() => void handleImportAndApply()}
              className="h-[34px] px-3.5 rounded-[9px] border-0 bg-btn-primary-bg text-btn-primary-text text-[12px] font-[600] inline-flex items-center gap-1.5 cursor-pointer hover:opacity-90 transition-opacity"
            >
              <Upload2Line size={14} />
              Import Image
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          {filteredCovers.map((cover) => {
            const isSelected = track.coverUrl === cover.imageUrl;
            return (
              <button
                key={cover.id}
                type="button"
                onClick={() => {
                  applyCoverAssetToTrack(trackId, cover.id);
                  showToast(
                    `Switched cover art to "${cover.name}"`,
                    "success",
                  );
                }}
                className={`group flex flex-col gap-2 p-2 rounded-[12px] border text-left cursor-pointer transition-all ${
                  isSelected
                    ? "border-accent-primary bg-accent-primary/10"
                    : "border-border-alpha-14 bg-bg-surface/40 dark:bg-white/[0.03] hover:bg-white/[0.08]"
                }`}
              >
                <div className="relative aspect-square w-full overflow-hidden rounded-[8px]">
                  <img
                    src={cover.imageUrl}
                    alt={cover.name}
                    className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
                  />
                  {isSelected && (
                    <span className="absolute right-2 top-2 h-6 w-6 rounded-full bg-accent-primary text-white flex items-center justify-center shadow-md">
                      <CheckLine size={14} />
                    </span>
                  )}
                </div>
                <div className="min-w-0 px-0.5">
                  <div className="text-[12.5px] font-[600] text-text-primary truncate">
                    {cover.name}
                  </div>
                  <div className="text-[11px] text-text-tertiary truncate">
                    {cover.tags.slice(0, 3).join(" · ")}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </Dialog>
  );
}

export default CoverPickerModal;
