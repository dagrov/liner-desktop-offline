import { useCallback } from "react";
import {
  LuRadio,
  LuStepForward,
  LuListPlus,
  LuHeart,
  LuPlus,
  LuTrash2,
  LuFolderPlus,
  LuImage,
  LuRefreshCw,
  LuFileText,
  LuUpload,
} from "react-icons/lu";
import type { DropdownMenuItem } from "@/shared/ui/DropdownMenu";
import { playerEngine } from "../engine/playerEngine";
import { pickAndAttachLyricsFile, useStudioStore } from "@/features/studio";
import { useOfflineLibraryStore } from "@/features/offline";
import {
  usePlaylistsList,
  useLikeTrack,
  useUnlikeTrack,
  useIsTrackLiked,
  useModalStore,
} from "@/features/library";
import { useTranslation } from "@/languages";
import { showToast } from "@/shared/ui";

export interface SongMenuContext {
  id?: string;
  title: string;
  artists: string;
  coverUrl: string;
  duration?: string;
  durationMs?: number;
  searchType?: "track" | "album" | "artist" | "playlist";
  totalTracks?: number;
  playlistId?: string;
  playlistItemId?: string;
  playlistTitle?: string;
}

export function useSongMenuItems(ctx: SongMenuContext): DropdownMenuItem[] {
  const { t } = useTranslation();
  const {
    id,
    title,
    artists,
    coverUrl,
    duration,
    durationMs,
    searchType,
    totalTracks,
    playlistId,
    playlistItemId,
    playlistTitle,
  } = ctx;

  const { data: playlistsData } = usePlaylistsList();

  const likeMutation = useLikeTrack();
  const unlikeMutation = useUnlikeTrack();

  const liked = useIsTrackLiked(id);

  const handleLike = useCallback(async () => {
    if (!id) return;
    if (liked) {
      unlikeMutation.mutate(id);
    } else {
      likeMutation.mutate(id);
    }
  }, [id, liked, likeMutation, unlikeMutation]);

  const buildMenu = useCallback((): DropdownMenuItem[] => {
    const isTrack = searchType === "track" || !searchType;

    if (isTrack) {
      if (playlistId) {
        return [
          {
            id: "start-radio",
            label: t("common.start_radio"),
            icon: <LuRadio size={15} />,
            onClick: () => {
              if (!id) return;
              void playerEngine.startRadioStation({
                id,
                title,
                artists,
                coverUrl,
                durationMs: durationMs ?? 0,
                playCount: 0,
              });
            },
          },
          {
            id: "play-next",
            label: t("common.play_next"),
            icon: <LuStepForward size={15} />,
            onClick: () => {
              if (!id) return;
              playerEngine.playNext({
                id,
                title,
                artists,
                coverUrl,
                durationMs: durationMs ?? 0,
                playCount: 0,
              });
            },
          },
          {
            id: "add-to-queue",
            label: t("common.add_to_queue"),
            icon: <LuListPlus size={15} />,
            onClick: () => {
              if (!id) return;
              playerEngine.addToQueue({
                id,
                title,
                artists,
                coverUrl,
                durationMs: durationMs ?? 0,
                playCount: 0,
              });
              showToast(t("common.added_to_queue"), "checkmark", {
                description: artists ? `${title} — ${artists}` : title,
              });
            },
          },
          {
            id: liked ? "unlike-track" : "like-track",
            label: liked ? t("common.unlike") : t("common.like"),
            icon: (
              <LuHeart
                size={15}
                className={
                  liked ? "fill-red-500 text-red-500" : "text-text-secondary"
                }
              />
            ),
            onClick: handleLike,
          },
          {
            id: "change-cover-art",
            label: "Change Cover Art…",
            icon: <LuImage size={15} />,
            onClick: () => {
              if (!id) return;
              useStudioStore.getState().openCoverPicker(id);
            },
          },
          {
            id: "cycle-cover-art",
            label: "Cycle Cover Art",
            icon: <LuRefreshCw size={15} />,
            onClick: () => {
              if (!id) return;
              const next = useStudioStore.getState().cycleTrackCover(id);
              if (next) {
                showToast(`Cover switched to "${next.label}"`, "info");
              }
            },
          },
          {
            id: "edit-track-lyrics",
            label: t("lyrics_editor.add_or_edit", {
              defaultValue: "Add / Paste Lyrics…",
            }),
            icon: <LuFileText size={15} />,
            onClick: () => {
              if (!id) return;
              useOfflineLibraryStore.getState().openLyricsEditor(id);
            },
          },
          {
            id: "import-track-lyrics-file",
            label: t("lyrics_editor.import_file", {
              defaultValue: "Import Lyrics File…",
            }),
            icon: <LuUpload size={15} />,
            onClick: () => {
              if (!id) return;
              void pickAndAttachLyricsFile(id).then((res) => {
                if (res.saved) {
                  showToast(
                    t("lyrics_editor.imported_file_toast", {
                      defaultValue: "Loaded lyrics from {{name}}",
                      name: res.fileName || "file",
                    }),
                    "success",
                  );
                }
              });
            },
          },
          {
            id: "remove-from-playlist",
            label: t("common.remove_from_playlist"),
            icon: <LuTrash2 size={15} />,
            danger: true,
            onClick: () => {
              if (!id) return;
              useModalStore.getState().openRemoveFromPlaylist({
                trackId: id,
                playlistItemId,
                trackTitle: title,
                trackArtists: artists,
                trackCoverUrl: coverUrl,
                playlistId,
                playlistTitle,
              });
            },
          },
        ];
      }

      return [
        {
          id: "start-radio",
          label: t("common.start_radio"),
          icon: <LuRadio size={15} />,
          onClick: () => {
            if (!id) return;
            void playerEngine.startRadioStation({
              id,
              title,
              artists,
              coverUrl,
              durationMs: durationMs ?? 0,
              playCount: 0,
            });
          },
        },
        {
          id: "play-next",
          label: t("common.play_next"),
          icon: <LuStepForward size={15} />,
          onClick: () => {
            if (!id) return;
            playerEngine.playNext({
              id,
              title,
              artists,
              coverUrl,
              durationMs: durationMs ?? 0,
              playCount: 0,
            });
          },
        },
        {
          id: "add-to-queue",
          label: t("common.add_to_queue"),
          icon: <LuListPlus size={15} />,
          onClick: () => {
            if (!id) return;
            playerEngine.addToQueue({
              id,
              title,
              artists,
              coverUrl,
              durationMs: durationMs ?? 0,
              playCount: 0,
            });
            showToast(t("common.added_to_queue"), "checkmark", {
              description: artists ? `${title} — ${artists}` : title,
            });
          },
        },
        {
          id: liked ? "unlike-track" : "like-track",
          label: liked ? t("common.unlike") : t("common.like"),
          icon: (
            <LuHeart
              size={15}
              className={
                liked ? "fill-red-500 text-red-500" : "text-text-secondary"
              }
            />
          ),
          onClick: handleLike,
        },
        {
          id: "add-to-playlist",
          label: t("common.add_to_playlist"),
          icon: <LuPlus size={15} />,
          onClick: () => {
            if (!id) return;
            useModalStore.getState().openAddToPlaylist({
              id,
              title,
              artists,
              coverUrl,
              duration,
              playlists: playlistsData?.playlists ?? [],
            });
          },
        },
        {
          id: "change-cover-art",
          label: "Change Cover Art…",
          icon: <LuImage size={15} />,
          onClick: () => {
            if (!id) return;
            useStudioStore.getState().openCoverPicker(id);
          },
        },
        {
          id: "cycle-cover-art",
          label: "Cycle Cover Art",
          icon: <LuRefreshCw size={15} />,
          onClick: () => {
            if (!id) return;
            const next = useStudioStore.getState().cycleTrackCover(id);
            if (next) {
              showToast(`Cover switched to "${next.label}"`, "info");
            }
          },
        },
        {
          id: "edit-track-lyrics",
          label: t("lyrics_editor.add_or_edit", {
            defaultValue: "Add / Paste Lyrics…",
          }),
          icon: <LuFileText size={15} />,
          onClick: () => {
            if (!id) return;
            useOfflineLibraryStore.getState().openLyricsEditor(id);
          },
        },
        {
          id: "import-track-lyrics-file",
          label: t("lyrics_editor.import_file", {
            defaultValue: "Import Lyrics File…",
          }),
          icon: <LuUpload size={15} />,
          onClick: () => {
            if (!id) return;
            void pickAndAttachLyricsFile(id).then((res) => {
              if (res.saved) {
                showToast(
                  t("lyrics_editor.imported_file_toast", {
                    defaultValue: "Loaded lyrics from {{name}}",
                    name: res.fileName || "file",
                  }),
                  "success",
                );
              }
            });
          },
        },
      ];
    }

    return [
      {
        id: "add-to-library",
        label: t("common.add_to_library"),
        icon: <LuFolderPlus size={15} />,
        onClick: () => {
          if (!id) return;
          useModalStore.getState().openAddToLibrary({
            id,
            title,
            coverUrl,
            type: (searchType as "album" | "artist" | "playlist") || "album",
            subtitle: artists,
            totalTracks,
          });
        },
      },
    ];
  }, [
    id,
    title,
    artists,
    coverUrl,
    duration,
    durationMs,
    searchType,
    totalTracks,
    playlistId,
    playlistItemId,
    playlistTitle,
    liked,
    handleLike,
    playlistsData,
    t,
  ]);

  return buildMenu();
}
