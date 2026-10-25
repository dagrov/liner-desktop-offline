import { useMemo, useRef, useState } from "react";
import { useTranslation } from "@/languages";
import {
  CheckLine,
  ClipboardLine,
  CloseLine,
  Delete2Line,
  TimeLine,
  Upload2Line,
} from "@mingcute/react";
import Dialog from "@/shared/ui/Dialog";
import { showToast } from "@/shared/ui/Toast";
import {
  formatLrcTimestamp,
  getOfflineTrackById,
  getTrackCustomLyricsText,
  normalizeLyricsInput,
  saveTrackCustomLyrics,
  useOfflineLibraryStore,
} from "@/features/offline";
import { usePlayerState } from "@/features/player/hooks/usePlayerState";
import { useLyricsStore } from "@/features/lyrics/store/lyricsStore";
import { pickLyricsFile } from "../lib/filePickerUtils";

interface ResolvedEditorTrack {
  id: string;
  title: string;
  artists: string;
  coverUrl: string;
  durationMs: number;
}

function getInitialLyricsDraft(trackId: string): string {
  const saved = getTrackCustomLyricsText(trackId);
  if (saved) return saved;
  const activeLyrics = useLyricsStore.getState();
  if (activeLyrics.currentLyricsTrackId === trackId && activeLyrics.rawLyrics) {
    return activeLyrics.rawLyrics;
  }
  return "";
}

function LyricsEditorModalContent({
  track,
  onClose,
}: {
  track: ResolvedEditorTrack;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const player = usePlayerState();

  const [draft, setDraft] = useState(() => getInitialLyricsDraft(track.id));
  const [loadedFileName, setLoadedFileName] = useState<string | undefined>(
    undefined,
  );
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const previewInfo = useMemo(
    () => normalizeLyricsInput(draft, loadedFileName),
    [draft, loadedFileName],
  );

  const isCurrentPlayingTrack = player.currentTrack?.id === track.id;
  const currentPosMs = player.positionMs || 0;

  const handleImportFile = async () => {
    const picked = await pickLyricsFile();
    if (!picked) return;
    const norm = normalizeLyricsInput(picked.content, picked.fileName);
    setDraft(norm.content || picked.content);
    setLoadedFileName(picked.fileName);
    showToast(
      t("lyrics_editor.imported_file_toast", { name: picked.fileName }),
      "info",
    );
  };

  const handlePasteClipboard = async () => {
    try {
      const clip = await navigator.clipboard.readText();
      if (!clip.trim()) {
        showToast(t("lyrics_editor.clipboard_empty"), "info");
        return;
      }
      setDraft((prev) => (prev.trim() ? `${prev}\n${clip}` : clip));
      setLoadedFileName(undefined);
    } catch {
      textareaRef.current?.focus();
      showToast(t("lyrics_editor.paste_shortcut_hint"), "info");
    }
  };

  const handleStampCurrentTime = () => {
    const stamp = `${formatLrcTimestamp(currentPosMs)} `;
    const el = textareaRef.current;
    if (!el) {
      setDraft((prev) => `${stamp}${prev}`);
      return;
    }
    const pos = el.selectionStart ?? 0;
    const lineStart = draft.lastIndexOf("\n", Math.max(0, pos - 1)) + 1;
    const lineEndIdx = draft.indexOf("\n", lineStart);
    const currentLine =
      lineEndIdx === -1
        ? draft.slice(lineStart)
        : draft.slice(lineStart, lineEndIdx);
    const strippedLine = currentLine.replace(
      /^\[\d{1,3}:\d{2}(?:[.:]\d{1,3})?\]\s*/,
      "",
    );
    const updatedLine = `${stamp}${strippedLine}`;
    const nextDraft =
      lineEndIdx === -1
        ? `${draft.slice(0, lineStart)}${updatedLine}`
        : `${draft.slice(0, lineStart)}${updatedLine}${draft.slice(lineEndIdx)}`;

    setDraft(nextDraft);

    requestAnimationFrame(() => {
      if (!textareaRef.current) return;
      textareaRef.current.focus();
      const nextLineStart =
        lineEndIdx === -1
          ? nextDraft.length
          : lineStart + updatedLine.length + 1;
      textareaRef.current.setSelectionRange(nextLineStart, nextLineStart);
    });
  };

  const handleSave = () => {
    const res = saveTrackCustomLyrics(track.id, draft, loadedFileName);
    if (res.saved) {
      showToast(
        t("lyrics_editor.saved_toast", {
          title: track.title,
          count: res.lineCount,
        }),
        "success",
      );
    } else {
      showToast(
        t("lyrics_editor.cleared_toast", { title: track.title }),
        "info",
      );
    }
    onClose();
  };

  const handleClear = () => {
    setDraft("");
    setLoadedFileName(undefined);
    saveTrackCustomLyrics(track.id, null);
    showToast(t("lyrics_editor.cleared_toast", { title: track.title }), "info");
    onClose();
  };

  const syncBadgeLabel = !draft.trim()
    ? t("lyrics_editor.badge_empty")
    : previewInfo.syncLevel === "word_level"
      ? t("lyrics_editor.badge_word_synced")
      : previewInfo.syncLevel === "line_level"
        ? t("lyrics_editor.badge_line_synced")
        : t("lyrics_editor.badge_plain");

  return (
    <div
      className={`flex flex-col max-h-[85vh] transition-colors ${
        isDraggingOver ? "bg-white/[0.04]" : ""
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDraggingOver(true);
      }}
      onDragLeave={() => setIsDraggingOver(false)}
      onDrop={async (e) => {
        e.preventDefault();
        setIsDraggingOver(false);
        const file = e.dataTransfer?.files?.[0];
        if (!file) return;
        const text = await file.text().catch(() => "");
        if (text.trim()) {
          const norm = normalizeLyricsInput(text, file.name);
          setDraft(norm.content || text);
          setLoadedFileName(file.name);
        }
      }}
    >
      <div className="flex items-center justify-between gap-4 px-6 pt-5 pb-4 border-b border-border-alpha-14">
        <div className="flex items-center gap-3.5 min-w-0">
          <img
            src={track.coverUrl}
            alt={track.title}
            className="h-12 w-12 rounded-[10px] object-cover shrink-0 border border-border-alpha-14"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3
                data-music-title="true"
                className="m-0 text-[16px] font-[600] text-text-primary truncate font-montserrat"
              >
                {track.title}
              </h3>
              <span className="shrink-0 px-2 py-0.5 rounded-full text-[11px] font-medium bg-white/[0.08] border border-border-alpha-14 text-text-secondary">
                {syncBadgeLabel}
              </span>
            </div>
            <p className="m-0 text-[12.5px] text-text-secondary truncate">
              {track.artists} · {t("lyrics_editor.subtitle")}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="h-8 w-8 rounded-lg border-0 bg-transparent text-text-tertiary hover:text-text-primary hover:bg-border-alpha-14 flex items-center justify-center cursor-pointer"
        >
          <CloseLine size={18} />
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-3 bg-bg-primary/30 border-b border-border-alpha-14">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void handleImportFile()}
            className="h-[33px] px-3 rounded-[9px] border border-border-alpha-14 bg-white/[0.07] hover:bg-white/[0.12] text-[12.5px] font-medium text-text-primary flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <Upload2Line size={14} />
            <span>{t("lyrics_editor.import_file")}</span>
          </button>

          <button
            type="button"
            onClick={() => void handlePasteClipboard()}
            className="h-[33px] px-3 rounded-[9px] border border-border-alpha-14 bg-white/[0.05] hover:bg-white/[0.1] text-[12.5px] font-medium text-text-secondary hover:text-text-primary flex items-center gap-1.5 cursor-pointer transition-colors"
          >
            <ClipboardLine size={14} />
            <span>{t("lyrics_editor.paste_clipboard")}</span>
          </button>

          {isCurrentPlayingTrack && (
            <button
              type="button"
              onClick={handleStampCurrentTime}
              title={t("lyrics_editor.stamp_time_hint")}
              className="h-[33px] px-3 rounded-[9px] border border-border-alpha-14 bg-white/[0.05] hover:bg-white/[0.1] text-[12.5px] font-medium text-text-secondary hover:text-text-primary flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <TimeLine size={14} />
              <span>
                {t("lyrics_editor.stamp_time", {
                  time: formatLrcTimestamp(currentPosMs),
                })}
              </span>
            </button>
          )}
        </div>

        <span className="text-[11.5px] text-text-tertiary">
          {previewInfo.lineCount > 0
            ? t("lyrics_editor.lines_count", { count: previewInfo.lineCount })
            : t("lyrics_editor.formats_hint")}
        </span>
      </div>

      <div className="px-6 py-4 flex-1 min-h-0 flex flex-col">
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t("lyrics_editor.placeholder")}
          rows={13}
          spellCheck={false}
          className="w-full flex-1 min-h-[260px] max-h-[46vh] p-3.5 rounded-[12px] border border-border-alpha-14 bg-black/25 text-[13.5px] leading-[1.65] font-mono text-text-primary outline-none focus:border-white/30 resize-y placeholder:text-text-tertiary/70"
        />
      </div>

      <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-border-alpha-14 bg-bg-primary/20">
        <button
          type="button"
          onClick={handleClear}
          className="h-[36px] px-3.5 rounded-[10px] border border-border-alpha-14 bg-transparent hover:bg-red-500/15 text-[12.5px] font-medium text-text-secondary hover:text-red-300 flex items-center gap-1.5 cursor-pointer transition-colors"
        >
          <Delete2Line size={15} />
          <span>{t("lyrics_editor.clear_lyrics")}</span>
        </button>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="h-[36px] px-4 rounded-[10px] border border-border-alpha-14 bg-transparent hover:bg-white/[0.06] text-[13px] font-medium text-text-secondary hover:text-text-primary cursor-pointer transition-colors"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="h-[36px] px-4 rounded-[10px] border-0 bg-text-primary text-bg-primary hover:opacity-90 text-[13px] font-[600] flex items-center gap-1.5 cursor-pointer transition-opacity"
          >
            <CheckLine size={15} />
            <span>{t("lyrics_editor.save_lyrics")}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export function LyricsEditorModal() {
  const trackId = useOfflineLibraryStore((s) => s.lyricsEditorTrackId);
  const close = useOfflineLibraryStore((s) => s.closeLyricsEditor);
  const player = usePlayerState();

  const track = useMemo<ResolvedEditorTrack | null>(() => {
    if (!trackId) return null;
    const offline = getOfflineTrackById(trackId);
    if (offline) {
      return {
        id: offline.id,
        title: offline.title,
        artists: offline.artists,
        coverUrl: offline.coverUrl,
        durationMs: offline.durationMs,
      };
    }
    if (player.currentTrack?.id === trackId) {
      return {
        id: player.currentTrack.id,
        title: player.currentTrack.title,
        artists: player.currentTrack.artists,
        coverUrl: player.currentTrack.coverUrl,
        durationMs: player.currentTrack.durationMs,
      };
    }
    return null;
  }, [trackId, player.currentTrack]);

  if (!trackId || !track) return null;

  return (
    <Dialog
      open={Boolean(trackId)}
      onOpenChange={(next) => (!next ? close() : undefined)}
      maxWidth={700}
      className="p-0 overflow-hidden !bg-bg-surface/90 dark:!bg-bg-elevated/85 !backdrop-blur-[50px] !border !border-border-alpha-14"
    >
      <LyricsEditorModalContent key={track.id} track={track} onClose={close} />
    </Dialog>
  );
}
