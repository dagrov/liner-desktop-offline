import { useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import PopularTracksSection from "./PopularTracksSection";
import { usePopularTracksAllTime } from "../hooks/usePopularTracks";
import { useRecentlyPlayed } from "../hooks/useRecentlyPlayed";
import { useTranslation } from "@/languages";
import { usePageBackdrop } from "@/shared/lib";
import { showToast } from "@/shared/ui";
import SongCardWithMenu from "@/features/player/ui/SongCardWithMenu";
import { playerEngine } from "@/features/player/engine/playerEngine";
import { usePlayerStore } from "@/features/player/store/playerStore";
import {
  getAllOfflineTracks,
  toClientTrackFromOffline,
  useOfflineLibraryStore,
  type OfflineTrackRecord,
} from "@/features/offline";
import { VINYL_COVER_DATA_URL } from "@/features/offline/lib/sampleLibrary";
import {
  pickAndImportMusicFiles,
  pickAndSyncMusicFolder,
  triggerManualPcAudioScan,
} from "@/features/studio";
import {
  ArrowRightLine,
  FolderOpenLine,
  Music2Fill,
  PlayFill,
  RadarLine,
  ShuffleLine,
  TimeFill,
  TrophyFill,
  Upload2Line,
} from "@mingcute/react";

function formatDurationMs(ms: number): string {
  const totalSec = Math.max(0, Math.round((ms || 0) / 1000));
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

export default function HomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const customTracks = useOfflineLibraryStore((s) => s.customTracks);
  const trackCoverOverrides = useOfflineLibraryStore(
    (s) => s.trackCoverOverrides,
  );
  const trackPlayCounts = useOfflineLibraryStore((s) => s.trackPlayCounts);
  const history = useOfflineLibraryStore((s) => s.history);
  const isScanningPc = useOfflineLibraryStore((s) => s.isScanningPc);
  const setSyncedMusicFolder = useOfflineLibraryStore(
    (s) => s.setSyncedMusicFolder,
  );

  // Real playback stats ONLY (playCount > 0 and real listening history)
  const { data: popularTracksAllTime } = usePopularTracksAllTime(15);
  const { data: recentlyPlayed } = useRecentlyPlayed(15);

  const allLocalTracks = useMemo(() => {
    void customTracks;
    void trackCoverOverrides;
    void trackPlayCounts;
    return getAllOfflineTracks().filter((tr) => tr.source === "local");
  }, [customTracks, trackCoverOverrides, trackPlayCounts]);

  usePageBackdrop(allLocalTracks[0]?.coverUrl || undefined);

  const folders = useMemo(() => {
    const map = new Map<
      string,
      { key: string; name: string; fullPath: string; tracks: OfflineTrackRecord[] }
    >();
    for (const tr of allLocalTracks) {
      const fullPath = tr.folderPath || "Imported Files";
      const name =
        tr.folderName || fullPath.split(/[\\/]/).pop() || "Imported Files";
      const existing = map.get(fullPath);
      if (existing) existing.tracks.push(tr);
      else map.set(fullPath, { key: fullPath, name, fullPath, tracks: [tr] });
    }
    return Array.from(map.values()).sort(
      (a, b) => b.tracks.length - a.tracks.length,
    );
  }, [allLocalTracks]);

  const recentlyImported = useMemo(() => {
    return [...allLocalTracks]
      .sort((a, b) => (b.addedAt || "").localeCompare(a.addedAt || ""))
      .slice(0, 12);
  }, [allLocalTracks]);

  const handlePlayTracks = useCallback(
    (tracks: OfflineTrackRecord[], startIndex = 0, shuffle = false) => {
      if (tracks.length === 0) return;
      const clientTracks = tracks.map(toClientTrackFromOffline);
      if (shuffle) {
        const copy = [...clientTracks];
        for (let i = copy.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        usePlayerStore.getState().setShuffle(true);
        void playerEngine.playTrack(copy[0], copy);
        return;
      }
      void playerEngine.playTrack(clientTracks[startIndex], clientTracks);
    },
    [],
  );

  const handleScanPc = useCallback(async () => {
    const res = await triggerManualPcAudioScan();
    if (res.newlyImported > 0) {
      showToast(
        t("all_imports.scan_found_new", { count: res.newlyImported }),
        "success",
      );
    } else if (res.mode === "electron") {
      showToast(
        res.totalFound > 0
          ? t("all_imports.scan_all_present", { count: res.totalFound })
          : t("all_imports.scan_none_found"),
        "info",
      );
    }
  }, [t]);

  const handleImportFiles = useCallback(async () => {
    const count = await pickAndImportMusicFiles();
    if (count > 0) {
      showToast(t("all_imports.imported_count", { count }), "success");
    }
  }, [t]);

  const handleImportFolder = useCallback(async () => {
    const res = await pickAndSyncMusicFolder();
    if (res.folderLabel) {
      setSyncedMusicFolder(res.folderLabel);
      showToast(
        t("all_imports.synced_folder_toast", {
          folder: res.folderLabel,
          count: res.importedCount,
        }),
        "success",
      );
    }
  }, [setSyncedMusicFolder, t]);

  const hasRealListeningHistory = history.length > 0;
  const realMostPlayed = useMemo(
    () =>
      (popularTracksAllTime || []).filter(
        (item) =>
          item.type === "track" && ((item as any).item?.playCount ?? 1) > 0,
      ),
    [popularTracksAllTime],
  );

  return (
    <div className="relative h-full w-full overflow-y-auto overflow-x-hidden bg-transparent pt-(--page-inset-top) pb-(--page-inset-bottom)">
      <div className="relative z-1 flex flex-col w-full min-h-[calc(100vh-180px)]">
        {allLocalTracks.length === 0 ? (
          <div className="flex min-h-[calc(100vh-200px)] w-full flex-col items-center justify-center px-6 py-12 text-center select-none">
            <img
              src={VINYL_COVER_DATA_URL}
              alt=""
              draggable={false}
              className={`h-[96px] w-[96px] rounded-[20px] shadow-2xl border border-white/10 mb-5 ${
                isScanningPc ? "animate-spin" : ""
              }`}
            />
            <h2 className="m-0 text-[20px] font-[600] tracking-[-0.02em] text-text-primary">
              {t("home.emptyOfflineTitle")}
            </h2>
            <p className="m-0 mt-2 max-w-[420px] text-[13.5px] leading-[1.55] text-text-tertiary">
              {t("home.emptyOfflineSubtitle")}
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
              <button
                type="button"
                disabled={isScanningPc}
                onClick={() => void handleScanPc()}
                className="h-[38px] px-4 rounded-[11px] border-0 bg-btn-primary-bg text-btn-primary-text text-[13px] font-[600] inline-flex items-center gap-2 cursor-pointer hover:opacity-90 disabled:opacity-60 transition-opacity"
              >
                <RadarLine
                  size={16}
                  className={isScanningPc ? "animate-spin" : undefined}
                />
                {isScanningPc
                  ? t("offline.scanningPc")
                  : t("home.scanPcForMusic")}
              </button>
              <button
                type="button"
                onClick={() => void handleImportFiles()}
                className="h-[38px] px-4 rounded-[11px] border border-border-alpha-14 bg-bg-glass backdrop-blur-[20px] hover:bg-white/[0.1] text-text-primary text-[13px] font-[500] inline-flex items-center gap-2 cursor-pointer transition-colors"
              >
                <Upload2Line size={16} />
                {t("home.importAudioFiles")}
              </button>
              <button
                type="button"
                onClick={() => void handleImportFolder()}
                className="h-[38px] px-4 rounded-[11px] border border-border-alpha-14 bg-bg-glass backdrop-blur-[20px] hover:bg-white/[0.1] text-text-primary text-[13px] font-[500] inline-flex items-center gap-2 cursor-pointer transition-colors"
              >
                <FolderOpenLine size={16} />
                {t("all_imports.import_folder")}
              </button>
            </div>
          </div>
        ) : (
          <div className="w-full pb-[24px] flex flex-col gap-6">
            {/* 1. Prominent All Imported Music Hero Card */}
            <div className="mx-6 rounded-[18px] border border-border-alpha-14 bg-bg-surface/65 dark:bg-white/[0.04] p-5 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="h-13 w-13 rounded-[14px] bg-white/[0.08] border border-white/10 flex items-center justify-center shrink-0 text-text-primary">
                  <Music2Fill size={24} />
                </div>
                <div className="min-w-0">
                  <h2 className="m-0 text-[18px] font-[700] tracking-[-0.02em] text-text-primary truncate">
                    {t("all_imports.title")}
                  </h2>
                  <p className="m-0 mt-0.5 text-[13px] text-text-tertiary truncate">
                    {t("all_imports.subtitle", {
                      songs: allLocalTracks.length,
                      folders: folders.length,
                    })}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigate("/all-music")}
                  className="h-[36px] px-4 rounded-[10px] border-0 bg-btn-primary-bg text-btn-primary-text text-[13px] font-[600] inline-flex items-center gap-1.5 cursor-pointer hover:opacity-90 transition-opacity"
                >
                  <span>
                    {t("all_imports.open_all_btn", {
                      count: allLocalTracks.length,
                    })}
                  </span>
                  <ArrowRightLine size={15} />
                </button>

                <button
                  type="button"
                  onClick={() => handlePlayTracks(allLocalTracks, 0, false)}
                  className="h-[36px] px-3.5 rounded-[10px] border border-border-alpha-14 bg-white/[0.06] hover:bg-white/[0.12] text-text-primary text-[13px] font-[500] inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <PlayFill size={15} />
                  <span>{t("all_imports.play_all")}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handlePlayTracks(allLocalTracks, 0, true)}
                  className="h-[36px] px-3.5 rounded-[10px] border border-border-alpha-14 bg-white/[0.06] hover:bg-white/[0.12] text-text-primary text-[13px] font-[500] inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <ShuffleLine size={15} />
                  <span>{t("all_imports.shuffle")}</span>
                </button>

                <button
                  type="button"
                  disabled={isScanningPc}
                  onClick={() => void handleScanPc()}
                  className="h-[36px] px-3.5 rounded-[10px] border border-border-alpha-14 bg-white/[0.06] hover:bg-white/[0.12] text-text-primary text-[13px] font-[500] inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60 transition-colors"
                >
                  <RadarLine
                    size={15}
                    className={isScanningPc ? "animate-spin" : undefined}
                  />
                  <span>
                    {isScanningPc
                      ? t("offline.scanningPc")
                      : t("home.scanPcForMusic")}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => void handleImportFiles()}
                  className="h-[36px] px-3.5 rounded-[10px] border border-border-alpha-14 bg-white/[0.06] hover:bg-white/[0.12] text-text-primary text-[13px] font-[500] inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Upload2Line size={15} />
                  <span>{t("home.importAudioFiles")}</span>
                </button>
              </div>
            </div>

            {/* 2. Music Folders (Real PC Folders where imports live) */}
            {folders.length > 0 && (
              <section className="px-6 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FolderOpenLine className="w-5 h-5 text-emerald-400" />
                    <h3 className="m-0 text-[17px] font-[600] text-text-primary">
                      {t("all_imports.your_folders")}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate("/all-music")}
                    className="border-0 bg-transparent text-[12.5px] font-[500] text-text-tertiary hover:text-text-primary inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>{t("all_imports.see_all")}</span>
                    <ArrowRightLine size={14} />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {folders.slice(0, 6).map((folder) => (
                    <div
                      key={folder.key}
                      onClick={() =>
                        navigate(
                          `/all-music?folder=${encodeURIComponent(folder.key)}`,
                        )
                      }
                      className="group flex items-center justify-between gap-3 rounded-[13px] border border-border-alpha-14 bg-bg-surface/55 dark:bg-white/[0.04] hover:bg-white/[0.08] px-3.5 py-3 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-10 w-10 rounded-[10px] bg-white/[0.07] border border-white/10 flex items-center justify-center shrink-0 text-text-primary">
                          <FolderOpenLine size={19} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[13.5px] font-[600] text-text-primary truncate">
                            {folder.name}
                          </div>
                          <div className="text-[11.5px] text-text-tertiary truncate">
                            {folder.tracks.length} {t("all_imports.songs_label")}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePlayTracks(folder.tracks, 0, false);
                        }}
                        className="h-8 w-8 rounded-full border-0 bg-btn-primary-bg text-btn-primary-text opacity-80 group-hover:opacity-100 flex items-center justify-center shrink-0 cursor-pointer"
                        aria-label="Play folder"
                      >
                        <PlayFill size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 3. Recently Imported (Unranked, honest chronological order) */}
            <section className="px-6 flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Music2Fill className="w-5 h-5 text-sky-400" />
                  <h3 className="m-0 text-[17px] font-[600] text-text-primary">
                    {t("all_imports.recently_imported")}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => navigate("/all-music")}
                  className="border-0 bg-transparent text-[12.5px] font-[500] text-text-tertiary hover:text-text-primary inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>
                    {t("all_imports.see_all_count", {
                      count: allLocalTracks.length,
                    })}
                  </span>
                  <ArrowRightLine size={14} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                {recentlyImported.map((track, idx) => (
                  <SongCardWithMenu
                    key={track.id}
                    id={track.id}
                    title={track.title}
                    artists={
                      track.folderName
                        ? `${track.artists} · ${track.folderName}`
                        : track.artists
                    }
                    artistId={track.artistId}
                    artistList={[{ id: track.artistId, name: track.artists }]}
                    coverUrl={track.coverUrl}
                    duration={formatDurationMs(track.durationMs)}
                    durationMs={track.durationMs}
                    onPlay={() =>
                      handlePlayTracks(recentlyImported, idx, false)
                    }
                  />
                ))}
              </div>
            </section>

            {/* 4. Recently Played — ONLY shown after real playback */}
            {hasRealListeningHistory &&
              recentlyPlayed &&
              recentlyPlayed.length > 0 && (
                <PopularTracksSection
                  title={t("home.jumpBackIn")}
                  icon={<TimeFill className="w-6 h-6 text-sky-400" />}
                  items={recentlyPlayed}
                  headingMarginTop="mt-0"
                />
              )}

            {/* 5. Most Played — ONLY shown for songs with real playCount > 0 */}
            {hasRealListeningHistory && realMostPlayed.length > 0 && (
              <PopularTracksSection
                title={t("home.mostListened")}
                icon={<TrophyFill className="w-6 h-6 text-yellow-500" />}
                items={realMostPlayed}
                headingMarginTop="mt-0"
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
