import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlbumFill,
  ArrowLeftLine,
  FolderOpenLine,
  Music2Fill,
  PlayFill,
  RadarLine,
  Search2Line,
  ShuffleLine,
  Upload2Line,
  User3Fill,
} from "@mingcute/react";
import { useTranslation } from "@/languages";
import { showToast } from "@/shared/ui";
import SongCardWithMenu from "@/features/player/ui/SongCardWithMenu";
import { playerEngine } from "@/features/player/engine/playerEngine";
import { usePlayerStore } from "@/features/player/store/playerStore";
import {
  pickAndImportMusicFiles,
  pickAndSyncMusicFolder,
  triggerManualPcAudioScan,
} from "@/features/studio";
import { VINYL_COVER_DATA_URL } from "../lib/sampleLibrary";
import {
  getAllOfflineTracks,
  toClientTrackFromOffline,
  useOfflineLibraryStore,
  type OfflineTrackRecord,
} from "../store/offlineLibraryStore";

type TabKey = "songs" | "folders" | "albums" | "artists";
type SortKey = "recent" | "title" | "artist" | "folder" | "plays";

function formatDurationMs(ms: number): string {
  const totalSec = Math.max(0, Math.round((ms || 0) / 1000));
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

export default function AllImportsPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedFolderParam = searchParams.get("folder");

  // Subscribe to store updates so new imports/tags reflect live
  const customTracks = useOfflineLibraryStore((s) => s.customTracks);
  const trackCoverOverrides = useOfflineLibraryStore(
    (s) => s.trackCoverOverrides,
  );
  const trackPlayCounts = useOfflineLibraryStore((s) => s.trackPlayCounts);
  const isScanningPc = useOfflineLibraryStore((s) => s.isScanningPc);
  const setSyncedMusicFolder = useOfflineLibraryStore(
    (s) => s.setSyncedMusicFolder,
  );

  const [activeTab, setActiveTab] = useState<TabKey>(() =>
    selectedFolderParam ? "folders" : "songs",
  );
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("recent");
  const [visibleCount, setVisibleCount] = useState(80);
  const [selectedGroup, setSelectedGroup] = useState<{
    kind: "folder" | "album" | "artist";
    key: string;
    label: string;
    subtitle?: string;
  } | null>(() =>
    selectedFolderParam
      ? {
          kind: "folder",
          key: selectedFolderParam,
          label:
            selectedFolderParam.split(/[\\/]/).pop() || selectedFolderParam,
          subtitle: selectedFolderParam,
        }
      : null,
  );

  useEffect(() => {
    if (selectedFolderParam) {
      setActiveTab("folders");
      setSelectedGroup({
        kind: "folder",
        key: selectedFolderParam,
        label: selectedFolderParam.split(/[\\/]/).pop() || selectedFolderParam,
        subtitle: selectedFolderParam,
      });
    }
  }, [selectedFolderParam]);

  const allTracks = useMemo(() => {
    void customTracks;
    void trackCoverOverrides;
    void trackPlayCounts;
    return getAllOfflineTracks().filter((tr) => tr.source === "local");
  }, [customTracks, trackCoverOverrides, trackPlayCounts]);

  const folders = useMemo(() => {
    const map = new Map<
      string,
      { key: string; name: string; fullPath: string; tracks: OfflineTrackRecord[] }
    >();
    for (const tr of allTracks) {
      const fullPath = tr.folderPath || "Imported Files";
      const name =
        tr.folderName || fullPath.split(/[\\/]/).pop() || "Imported Files";
      const existing = map.get(fullPath);
      if (existing) {
        existing.tracks.push(tr);
      } else {
        map.set(fullPath, { key: fullPath, name, fullPath, tracks: [tr] });
      }
    }
    return Array.from(map.values()).sort(
      (a, b) => b.tracks.length - a.tracks.length,
    );
  }, [allTracks]);

  const albums = useMemo(() => {
    const map = new Map<
      string,
      { key: string; title: string; artist: string; coverUrl: string; tracks: OfflineTrackRecord[] }
    >();
    for (const tr of allTracks) {
      const existing = map.get(tr.albumId);
      if (existing) {
        existing.tracks.push(tr);
      } else {
        map.set(tr.albumId, {
          key: tr.albumId,
          title: tr.albumTitle || "Local Music",
          artist: tr.artists,
          coverUrl: tr.coverUrl,
          tracks: [tr],
        });
      }
    }
    return Array.from(map.values()).sort(
      (a, b) => b.tracks.length - a.tracks.length,
    );
  }, [allTracks]);

  const artists = useMemo(() => {
    const map = new Map<
      string,
      { key: string; name: string; coverUrl: string; tracks: OfflineTrackRecord[] }
    >();
    for (const tr of allTracks) {
      const existing = map.get(tr.artistId);
      if (existing) {
        existing.tracks.push(tr);
      } else {
        map.set(tr.artistId, {
          key: tr.artistId,
          name: tr.artists,
          coverUrl: tr.coverUrl,
          tracks: [tr],
        });
      }
    }
    return Array.from(map.values()).sort(
      (a, b) => b.tracks.length - a.tracks.length,
    );
  }, [allTracks]);

  const baseTracksForView = useMemo(() => {
    if (!selectedGroup) return allTracks;
    if (selectedGroup.kind === "folder") {
      return allTracks.filter(
        (tr) => (tr.folderPath || "Imported Files") === selectedGroup.key,
      );
    }
    if (selectedGroup.kind === "album") {
      return allTracks.filter((tr) => tr.albumId === selectedGroup.key);
    }
    return allTracks.filter((tr) => tr.artistId === selectedGroup.key);
  }, [allTracks, selectedGroup]);

  const filteredAndSortedTracks = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? baseTracksForView.filter(
          (tr) =>
            tr.title.toLowerCase().includes(q) ||
            tr.artists.toLowerCase().includes(q) ||
            tr.albumTitle.toLowerCase().includes(q) ||
            (tr.folderName || "").toLowerCase().includes(q),
        )
      : [...baseTracksForView];

    list.sort((a, b) => {
      if (sortBy === "title") return a.title.localeCompare(b.title);
      if (sortBy === "artist") return a.artists.localeCompare(b.artists);
      if (sortBy === "folder") {
        return (a.folderName || "").localeCompare(b.folderName || "");
      }
      if (sortBy === "plays") return b.playCount - a.playCount;
      return (b.addedAt || "").localeCompare(a.addedAt || "");
    });
    return list;
  }, [baseTracksForView, query, sortBy]);

  const visibleTracks = useMemo(
    () => filteredAndSortedTracks.slice(0, visibleCount),
    [filteredAndSortedTracks, visibleCount],
  );

  const handlePlayList = useCallback(
    (tracks: OfflineTrackRecord[], startIndex = 0, shuffle = false) => {
      if (tracks.length === 0) return;
      const clientTracks = tracks.map(toClientTrackFromOffline);
      if (shuffle) {
        const shuffled = [...clientTracks];
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        usePlayerStore.getState().setShuffle(true);
        void playerEngine.playTrack(shuffled[0], shuffled);
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
        t("all_imports.scan_found_new", {
          count: res.newlyImported,
        }),
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

  const clearSelectedGroup = () => {
    setSelectedGroup(null);
    if (selectedFolderParam) {
      setSearchParams({});
    }
  };

  const showSongTable = activeTab === "songs" || Boolean(selectedGroup);

  return (
    <div
      className="relative h-full w-full overflow-y-auto overflow-x-hidden bg-transparent pt-(--page-inset-top) pb-(--page-inset-bottom) px-6"
      onScroll={(e) => {
        if (!showSongTable) return;
        const el = e.currentTarget;
        if (
          el.scrollHeight - el.scrollTop - el.clientHeight < 360 &&
          visibleCount < filteredAndSortedTracks.length
        ) {
          setVisibleCount((prev) =>
            Math.min(filteredAndSortedTracks.length, prev + 80),
          );
        }
      }}
    >
      {/* Top Header Card */}
      <div className="flex flex-col gap-4 rounded-[18px] border border-border-alpha-14 bg-bg-surface/65 dark:bg-white/[0.04] p-5 mb-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <img
              src={allTracks[0]?.coverUrl || VINYL_COVER_DATA_URL}
              alt=""
              draggable={false}
              className="h-14 w-14 rounded-[14px] object-cover border border-white/10 shrink-0"
            />
            <div className="min-w-0">
              <h1 className="m-0 text-[20px] font-[700] tracking-[-0.02em] text-text-primary truncate">
                {selectedGroup
                  ? selectedGroup.label
                  : t("all_imports.title")}
              </h1>
              <p className="m-0 mt-0.5 text-[13px] text-text-tertiary truncate">
                {selectedGroup
                  ? `${filteredAndSortedTracks.length} ${t("all_imports.songs_label")}${
                      selectedGroup.subtitle
                        ? ` · ${selectedGroup.subtitle}`
                        : ""
                    }`
                  : t("all_imports.subtitle", {
                      songs: allTracks.length,
                      folders: folders.length,
                    })}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {filteredAndSortedTracks.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => handlePlayList(filteredAndSortedTracks, 0, false)}
                  className="h-[36px] px-4 rounded-[10px] border-0 bg-btn-primary-bg text-btn-primary-text text-[13px] font-[600] inline-flex items-center gap-1.5 cursor-pointer hover:opacity-90 transition-opacity"
                >
                  <PlayFill size={15} />
                  <span>{t("all_imports.play_all")}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handlePlayList(filteredAndSortedTracks, 0, true)}
                  className="h-[36px] px-3.5 rounded-[10px] border border-border-alpha-14 bg-white/[0.06] hover:bg-white/[0.12] text-text-primary text-[13px] font-[500] inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <ShuffleLine size={15} />
                  <span>{t("all_imports.shuffle")}</span>
                </button>
              </>
            )}

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

            <button
              type="button"
              onClick={() => void handleImportFolder()}
              className="h-[36px] px-3.5 rounded-[10px] border border-border-alpha-14 bg-white/[0.06] hover:bg-white/[0.12] text-text-primary text-[13px] font-[500] inline-flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <FolderOpenLine size={15} />
              <span>{t("all_imports.import_folder")}</span>
            </button>
          </div>
        </div>

        {/* Category Tabs + Search + Sort */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-border-alpha-14">
          <div className="flex flex-wrap items-center gap-1.5">
            {selectedGroup && (
              <button
                type="button"
                onClick={clearSelectedGroup}
                className="h-[32px] px-3 rounded-[9px] border border-border-alpha-14 bg-white/[0.08] hover:bg-white/[0.14] text-[12.5px] font-[500] text-text-primary inline-flex items-center gap-1.5 cursor-pointer mr-1"
              >
                <ArrowLeftLine size={14} />
                <span>{t("common.back")}</span>
              </button>
            )}

            {(
              [
                {
                  id: "songs" as const,
                  label: `${t("all_imports.tab_all_songs")} (${allTracks.length})`,
                  Icon: Music2Fill,
                },
                {
                  id: "folders" as const,
                  label: `${t("all_imports.tab_folders")} (${folders.length})`,
                  Icon: FolderOpenLine,
                },
                {
                  id: "albums" as const,
                  label: `${t("all_imports.tab_albums")} (${albums.length})`,
                  Icon: AlbumFill,
                },
                {
                  id: "artists" as const,
                  label: `${t("all_imports.tab_artists")} (${artists.length})`,
                  Icon: User3Fill,
                },
              ] as const
            ).map(({ id, label, Icon }) => {
              const active = activeTab === id && !selectedGroup;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    clearSelectedGroup();
                    setActiveTab(id);
                    setVisibleCount(80);
                  }}
                  className={`h-[32px] px-3 rounded-[9px] border text-[12.5px] font-[500] inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                    active
                      ? "border-transparent bg-text-primary text-bg-primary font-[600]"
                      : "border-border-alpha-14 bg-transparent hover:bg-white/[0.06] text-text-secondary hover:text-text-primary"
                  }`}
                >
                  <Icon size={14} />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>

          {showSongTable && allTracks.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[210px]">
                <Search2Line
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none"
                />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setVisibleCount(80);
                  }}
                  placeholder={t("all_imports.filter_placeholder")}
                  className="h-[32px] w-full pl-8 pr-3 rounded-[9px] border border-border-alpha-14 bg-black/20 text-[12.5px] text-text-primary outline-none placeholder:text-text-tertiary"
                />
              </div>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortKey)}
                className="h-[32px] px-2.5 rounded-[9px] border border-border-alpha-14 bg-bg-surface dark:bg-[#18181c] text-[12.5px] text-text-primary outline-none cursor-pointer"
              >
                <option value="recent">{t("all_imports.sort_recent")}</option>
                <option value="title">{t("all_imports.sort_title")}</option>
                <option value="artist">{t("all_imports.sort_artist")}</option>
                <option value="folder">{t("all_imports.sort_folder")}</option>
                <option value="plays">{t("all_imports.sort_plays")}</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Empty State */}
      {allTracks.length === 0 ? (
        <div className="flex min-h-[52vh] flex-col items-center justify-center text-center px-6 py-12">
          <img
            src={VINYL_COVER_DATA_URL}
            alt=""
            draggable={false}
            className="h-20 w-20 rounded-[18px] border border-white/10 mb-4"
          />
          <h2 className="m-0 text-[18px] font-[600] text-text-primary">
            {t("home.emptyOfflineTitle")}
          </h2>
          <p className="m-0 mt-1.5 max-w-[400px] text-[13px] text-text-tertiary">
            {t("home.emptyOfflineSubtitle")}
          </p>
        </div>
      ) : showSongTable ? (
        <div className="flex flex-col gap-1 pb-8">
          {visibleTracks.map((track, idx) => (
            <SongCardWithMenu
              key={track.id}
              id={track.id}
              title={track.title}
              artists={
                track.folderName && !selectedGroup
                  ? `${track.artists} · ${track.folderName}`
                  : track.artists
              }
              artistId={track.artistId}
              artistList={[{ id: track.artistId, name: track.artists }]}
              coverUrl={track.coverUrl}
              duration={formatDurationMs(track.durationMs)}
              durationMs={track.durationMs}
              trackNumber={idx + 1}
              highlight={query || undefined}
              onPlay={() => handlePlayList(filteredAndSortedTracks, idx, false)}
            />
          ))}

          {visibleCount < filteredAndSortedTracks.length && (
            <div className="pt-4 flex justify-center">
              <button
                type="button"
                onClick={() =>
                  setVisibleCount((prev) =>
                    Math.min(filteredAndSortedTracks.length, prev + 120),
                  )
                }
                className="h-[34px] px-4 rounded-[10px] border border-border-alpha-14 bg-white/[0.06] hover:bg-white/[0.12] text-[12.5px] font-[500] text-text-primary cursor-pointer"
              >
                {t("all_imports.load_more", {
                  shown: visibleTracks.length,
                  total: filteredAndSortedTracks.length,
                })}
              </button>
            </div>
          )}
        </div>
      ) : activeTab === "folders" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pb-8">
          {folders.map((folder) => (
            <div
              key={folder.key}
              onClick={() =>
                setSelectedGroup({
                  kind: "folder",
                  key: folder.key,
                  label: folder.name,
                  subtitle: folder.fullPath,
                })
              }
              className="group flex items-center justify-between gap-3 rounded-[14px] border border-border-alpha-14 bg-bg-surface/60 dark:bg-white/[0.04] hover:bg-white/[0.08] p-3.5 cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-12 w-12 rounded-[11px] bg-white/[0.07] border border-white/10 flex items-center justify-center shrink-0 text-text-primary">
                  <FolderOpenLine size={22} />
                </div>
                <div className="min-w-0">
                  <div className="text-[14px] font-[600] text-text-primary truncate">
                    {folder.name}
                  </div>
                  <div className="text-[12px] text-text-tertiary truncate">
                    {folder.tracks.length} {t("all_imports.songs_label")} ·{" "}
                    {folder.fullPath}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePlayList(folder.tracks, 0, false);
                }}
                className="h-9 w-9 rounded-full border-0 bg-btn-primary-bg text-btn-primary-text opacity-85 group-hover:opacity-100 flex items-center justify-center shrink-0 cursor-pointer"
                aria-label="Play folder"
              >
                <PlayFill size={15} />
              </button>
            </div>
          ))}
        </div>
      ) : activeTab === "albums" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 pb-8">
          {albums.map((album) => (
            <div
              key={album.key}
              onClick={() =>
                setSelectedGroup({
                  kind: "album",
                  key: album.key,
                  label: album.title,
                  subtitle: album.artist,
                })
              }
              className="group flex flex-col gap-2 rounded-[14px] border border-border-alpha-14 bg-bg-surface/60 dark:bg-white/[0.04] hover:bg-white/[0.08] p-3 cursor-pointer transition-colors"
            >
              <img
                src={album.coverUrl || VINYL_COVER_DATA_URL}
                alt={album.title}
                loading="lazy"
                className="aspect-square w-full rounded-[10px] object-cover border border-white/10"
              />
              <div className="min-w-0">
                <div className="text-[13.5px] font-[600] text-text-primary truncate">
                  {album.title}
                </div>
                <div className="text-[12px] text-text-tertiary truncate">
                  {album.artist} · {album.tracks.length}{" "}
                  {t("all_imports.songs_label")}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 pb-8">
          {artists.map((artist) => (
            <div
              key={artist.key}
              onClick={() =>
                setSelectedGroup({
                  kind: "artist",
                  key: artist.key,
                  label: artist.name,
                })
              }
              className="group flex flex-col items-center text-center gap-2 rounded-[14px] border border-border-alpha-14 bg-bg-surface/60 dark:bg-white/[0.04] hover:bg-white/[0.08] p-3.5 cursor-pointer transition-colors"
            >
              <img
                src={artist.coverUrl || VINYL_COVER_DATA_URL}
                alt={artist.name}
                loading="lazy"
                className="h-20 w-20 rounded-full object-cover border border-white/10"
              />
              <div className="min-w-0 w-full">
                <div className="text-[13.5px] font-[600] text-text-primary truncate">
                  {artist.name}
                </div>
                <div className="text-[12px] text-text-tertiary truncate">
                  {artist.tracks.length} {t("all_imports.songs_label")}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
