import { useState, useEffect, useCallback } from "react";
import PopularTracksSection from "./PopularTracksSection";
import DailyMixesSection from "./DailyMixesSection";
import HomePageSkeleton from "./HomePageSkeleton";
import { usePopularTracksAllTime } from "../hooks/usePopularTracks";
import { useListeningNow } from "../hooks/useListeningNow";
import ListeningNowSection from "./ListeningNowSection";
import { useRecentlyPlayed } from "../hooks/useRecentlyPlayed";
import { useDailyMixes } from "../hooks/useDailyMixes";
import { useMostSaved, usePopularAlbums } from "../hooks/useExploreCollections";
import { useTranslation } from "@/languages";
import { usePageBackdrop } from "@/shared/lib";
import { showToast } from "@/shared/ui";
import { useOfflineLibraryStore } from "@/features/offline";
import { VINYL_COVER_DATA_URL } from "@/features/offline/lib/sampleLibrary";
import {
  pickAndImportMusicFiles,
  triggerManualPcAudioScan,
} from "@/features/studio";
import {
  AlbumFill,
  BookmarkFill,
  FireFill,
  RadarLine,
  TimeFill,
  TrophyFill,
  Upload2Line,
} from "@mingcute/react";

export default function HomePage() {
  const { t } = useTranslation();

  const { tracks: listeningNow, isLoading: tracksLoading } = useListeningNow();
  const { data: popularTracksAllTime, isLoading: allTimeLoading } =
    usePopularTracksAllTime(20);
  const { data: recentlyPlayed, isLoading: recentLoading } =
    useRecentlyPlayed(20);
  const { items: popularAlbums, isLoading: albumsLoading } = usePopularAlbums();
  const { items: mostSaved, isLoading: savedLoading } = useMostSaved();
  const { data: dailyMixes } = useDailyMixes();
  const isScanningPc = useOfflineLibraryStore((s) => s.isScanningPc);

  const hasMixes = Boolean(dailyMixes && dailyMixes.length > 0);
  const firstAlbum = popularAlbums[0];
  const firstAlbumCover =
    firstAlbum?.type === "album" ? firstAlbum.item.coverUrl : undefined;
  usePageBackdrop(
    dailyMixes?.[0]?.coverUrl ||
      firstAlbumCover ||
      listeningNow[0]?.coverUrl ||
      undefined,
  );

  const isDataLoading =
    tracksLoading ||
    allTimeLoading ||
    recentLoading ||
    albumsLoading ||
    savedLoading;

  const isReady = !isDataLoading;
  const [skeletonExited, setSkeletonExited] = useState(() => !isDataLoading);

  useEffect(() => {
    if (isReady && !skeletonExited) {
      const timer = setTimeout(() => {
        setSkeletonExited(true);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [isReady, skeletonExited]);

  const isEmptyLibrary =
    !hasMixes &&
    popularAlbums.length === 0 &&
    listeningNow.length === 0 &&
    (!recentlyPlayed || recentlyPlayed.length === 0) &&
    (!popularTracksAllTime || popularTracksAllTime.length === 0) &&
    mostSaved.length === 0;

  const handleScanPc = useCallback(async () => {
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
  }, []);

  const handleImportFiles = useCallback(async () => {
    const count = await pickAndImportMusicFiles();
    if (count > 0) {
      showToast(
        `Imported ${count} local audio track${count === 1 ? "" : "s"}`,
        "success",
      );
    }
  }, []);

  return (
    <div className="relative h-full w-full overflow-y-auto overflow-x-hidden bg-transparent pt-(--page-inset-top) pb-(--page-inset-bottom)">
      <div className="relative z-1 grid grid-cols-1 items-start w-full min-h-[calc(100vh-180px)]">
        {isReady && isEmptyLibrary && (
          <div className="col-start-1 row-start-1 flex min-h-[calc(100vh-200px)] w-full flex-col items-center justify-center px-6 py-12 text-center select-none">
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
                {isScanningPc ? t("offline.scanningPc") : t("home.scanPcForMusic")}
              </button>
              <button
                type="button"
                onClick={() => void handleImportFiles()}
                className="h-[38px] px-4 rounded-[11px] border border-border-alpha-14 bg-bg-glass backdrop-blur-[20px] hover:bg-white/[0.1] text-text-primary text-[13px] font-[500] inline-flex items-center gap-2 cursor-pointer transition-colors"
              >
                <Upload2Line size={16} />
                {t("home.importAudioFiles")}
              </button>
            </div>
          </div>
        )}

        {isReady && !isEmptyLibrary && (
          <div className="col-start-1 row-start-1 w-full pb-[16px]">
            {dailyMixes && hasMixes && (
              <DailyMixesSection mixes={dailyMixes} headingMarginTop="mt-0" />
            )}

            {popularAlbums.length > 0 && (
              <PopularTracksSection
                title={t("home.popularAlbums")}
                icon={<AlbumFill className="w-6 h-6 text-emerald-400" />}
                items={popularAlbums}
                headingMarginTop={hasMixes ? "mt-[22px]" : "mt-0"}
              />
            )}

            {listeningNow.length > 0 && (
              <ListeningNowSection
                title={t("home.whatEveryonesOn")}
                icon={<FireFill className="w-6 h-6 text-amber-500" />}
                tracks={listeningNow}
                headingMarginTop={
                  hasMixes || popularAlbums.length > 0 ? "mt-[22px]" : "mt-0"
                }
              />
            )}

            {recentlyPlayed && recentlyPlayed.length > 0 && (
              <PopularTracksSection
                title={t("home.jumpBackIn")}
                icon={<TimeFill className="w-6 h-6 text-sky-400" />}
                items={recentlyPlayed}
                headingMarginTop="mt-[22px]"
              />
            )}

            {popularTracksAllTime && popularTracksAllTime.length > 0 && (
              <PopularTracksSection
                title={t("home.mostListened")}
                icon={<TrophyFill className="w-6 h-6 text-yellow-500" />}
                items={popularTracksAllTime}
                headingMarginTop="mt-[22px]"
              />
            )}

            {mostSaved.length > 0 && (
              <PopularTracksSection
                title={t("home.mostSaved")}
                icon={<BookmarkFill className="w-6 h-6 text-rose-400" />}
                items={mostSaved}
                headingMarginTop="mt-[22px]"
              />
            )}
          </div>
        )}

        {!skeletonExited && (
          <div
            className={`col-start-1 row-start-1 w-full z-10 transition-opacity duration-300 ease-out ${
              isReady
                ? "opacity-0 pointer-events-none"
                : "opacity-100 pointer-events-auto"
            }`}
            onTransitionEnd={() => setSkeletonExited(true)}
          >
            <HomePageSkeleton />
          </div>
        )}
      </div>
    </div>
  );
}
