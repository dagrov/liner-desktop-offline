import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SkipNext, SkipPrevious } from "@solar-icons/react";
import { CloseLine, HeartFill, HeartLine } from "@mingcute/react";
import { useTranslation } from "@/languages";
import CoverImage from "@/features/covers/ui/CoverImage";
import { useCoverSrc } from "@/features/covers";
import { ScrollableText } from "@/shared/ui/ScrollableText";
import {
  useIsTrackLiked,
  useLikeTrack,
  useUnlikeTrack,
} from "@/features/library/hooks";
import {
  useOverlaySettingsStore,
  getEnglishKeyFromEvent,
} from "@/features/overlay";
import { usePlayerState } from "../hooks/usePlayerState";
import { playerEngine } from "../engine/playerEngine";
import {
  ICON_PAUSE,
  ICON_PLAY,
  PlayerMorphIcon,
} from "./morphPlayerIcons";

function matchesOverlayAccelerator(
  e: KeyboardEvent,
  shortcut: string,
): boolean {
  if (!shortcut) return false;
  const parts = shortcut
    .split("+")
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);
  if (parts.length === 0) return false;

  const needCtrl = parts.some(
    (p) => p === "ctrl" || p === "control" || p === "commandorcontrol",
  );
  const needAlt = parts.some((p) => p === "alt" || p === "option");
  const needShift = parts.some((p) => p === "shift");
  const needMeta = parts.some(
    (p) => p === "cmd" || p === "command" || p === "meta" || p === "super",
  );

  if (e.ctrlKey !== needCtrl) return false;
  if (e.altKey !== needAlt) return false;
  if (e.shiftKey !== needShift) return false;
  if (e.metaKey !== needMeta) return false;

  const mainPart = parts[parts.length - 1];
  const pressedKey = (getEnglishKeyFromEvent(e) || e.key || "").toLowerCase();
  return pressedKey === mainPart;
}

export function FloatingMiniPlayerWidget() {
  const { t } = useTranslation();
  const isElectronOverlaySupported =
    typeof window !== "undefined" &&
    typeof window.linerElectron?.toggleOverlay === "function";

  const enabled = useOverlaySettingsStore((s) => s.enabled);
  const position = useOverlaySettingsStore((s) => s.position);
  const shortcut = useOverlaySettingsStore((s) => s.shortcut);
  const inAppWidgetOpen = useOverlaySettingsStore((s) => s.inAppWidgetOpen);
  const setInAppWidgetOpen = useOverlaySettingsStore(
    (s) => s.setInAppWidgetOpen,
  );
  const toggleMiniPlayerWidget = useOverlaySettingsStore(
    (s) => s.toggleMiniPlayerWidget,
  );

  const player = usePlayerState();
  const currentTrack = player.currentTrack;
  const effectiveCover = useCoverSrc(currentTrack?.coverUrl);
  const isLiked = useIsTrackLiked(currentTrack?.id);
  const likeMutation = useLikeTrack();
  const unlikeMutation = useUnlikeTrack();

  const [isInfoHovered, setIsInfoHovered] = useState(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(
    null,
  );
  const dragStartRef = useRef<{
    mouseX: number;
    mouseY: number;
    elemLeft: number;
    elemTop: number;
  } | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);

  // Reset custom drag offset when preset position changes in Settings
  useEffect(() => {
    setDragOffset(null);
  }, [position]);

  // Listen for shortcut (default Alt+Shift+O) in web/non-Electron mode
  useEffect(() => {
    if (isElectronOverlaySupported) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (matchesOverlayAccelerator(e, shortcut)) {
        e.preventDefault();
        toggleMiniPlayerWidget();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isElectronOverlaySupported, shortcut, toggleMiniPlayerWidget]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      const drag = dragStartRef.current;
      if (!drag) return;
      const nextX = Math.max(
        12,
        Math.min(
          window.innerWidth - 332,
          drag.elemLeft + (e.clientX - drag.mouseX),
        ),
      );
      const nextY = Math.max(
        12,
        Math.min(
          window.innerHeight - 60,
          drag.elemTop + (e.clientY - drag.mouseY),
        ),
      );
      setDragOffset({ x: nextX, y: nextY });
    };
    const onMouseUp = () => {
      dragStartRef.current = null;
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  if (isElectronOverlaySupported || !enabled) {
    return null;
  }

  const isPlaying = player.status === "playing";
  const progressRatio =
    player.durationMs > 0
      ? Math.max(0, Math.min(1, player.positionMs / player.durationMs))
      : 0;

  const positionStyle: React.CSSProperties = dragOffset
    ? { left: `${dragOffset.x}px`, top: `${dragOffset.y}px` }
    : position === "top-left"
      ? { left: "20px", top: "18px" }
      : position === "top-right"
        ? { right: "20px", top: "18px" }
        : { left: "50%", top: "18px", transform: "translateX(-50%)" };

  return (
    <AnimatePresence>
      {inAppWidgetOpen && (
        <motion.div
          ref={cardRef}
          data-testid="floating-mini-player-widget"
          initial={{ opacity: 0, scale: 0.92, y: -6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: -6 }}
          transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
          onMouseDown={(e) => {
            if ((e.target as HTMLElement).closest("button")) return;
            const rect = cardRef.current?.getBoundingClientRect();
            if (!rect) return;
            dragStartRef.current = {
              mouseX: e.clientX,
              mouseY: e.clientY,
              elemLeft: rect.left,
              elemTop: rect.top,
            };
          }}
          style={positionStyle}
          className="fixed z-[95] flex h-[48px] w-[328px] select-none flex-col overflow-hidden rounded-[12px] bg-[#0d0d10]/95 backdrop-blur-xl border border-white/[0.12] shadow-[0_14px_38px_rgba(0,0,0,0.62)] cursor-grab active:cursor-grabbing"
        >
          {/* Rectangular progress fill matching OverlayPlayer */}
          <div
            className="pointer-events-none absolute inset-y-0 left-0 z-[1] rounded-none"
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.08)",
              width: `${progressRatio * 100}%`,
              transition: "width 200ms cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          />

          <div className="relative z-[2] flex h-full w-full items-center justify-between px-2.5">
            {/* Artwork + Track Info */}
            <div
              className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden pr-1.5"
              onMouseEnter={() => setIsInfoHovered(true)}
              onMouseLeave={() => setIsInfoHovered(false)}
            >
              <div className="relative h-[32px] w-[32px] shrink-0 overflow-hidden rounded-[9px] bg-[#16161a] border border-white/[0.08]">
                {effectiveCover || currentTrack?.coverUrl ? (
                  <CoverImage
                    src={effectiveCover || currentTrack?.coverUrl || ""}
                    alt={currentTrack?.title || "Artwork"}
                    fill
                    sizes="32px"
                    priority
                    unoptimized
                    draggable={false}
                    className="rounded-[9px] object-cover pointer-events-none select-none"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[11px] text-white/35 select-none">
                    ♪
                  </div>
                )}
              </div>

              <div
                data-music-title="true"
                className="flex min-w-0 flex-1 flex-col justify-center overflow-hidden"
              >
                <ScrollableText
                  text={
                    currentTrack?.title ||
                    t("player.no_track_playing", {
                      defaultValue: "No track playing",
                    })
                  }
                  isParentHovered={isInfoHovered}
                  className="text-[13px] font-normal leading-[16px] text-white tracking-tight"
                />
                <ScrollableText
                  text={currentTrack?.artists || ""}
                  isParentHovered={isInfoHovered}
                  className="mt-[1px] text-[11px] font-light leading-[14px] text-white/50"
                  style={{ fontFamily: "var(--font-inter), sans-serif" }}
                />
              </div>
            </div>

            {/* Playback & Widget Controls */}
            <div
              className="flex items-center gap-0.5 shrink-0 pl-1"
              onMouseDown={(e) => e.stopPropagation()}
            >
              {currentTrack && (
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => {
                    if (isLiked) unlikeMutation.mutate(currentTrack.id);
                    else likeMutation.mutate(currentTrack.id);
                  }}
                  className={`flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-lg border-0 bg-transparent transition-colors outline-none cursor-pointer active:scale-90 ${
                    isLiked
                      ? "text-[#ff3b5c]"
                      : "text-white/40 hover:text-white"
                  }`}
                  aria-label={isLiked ? "Unlike" : "Like"}
                >
                  {isLiked ? <HeartFill size={15} /> : <HeartLine size={15} />}
                </button>
              )}

              <button
                type="button"
                tabIndex={-1}
                onClick={() => void playerEngine.skipPrevious()}
                className="flex h-[26px] w-[26px] items-center justify-center rounded-lg border-0 bg-transparent text-white/60 hover:text-white active:scale-90 transition-all outline-none cursor-pointer"
                aria-label={t("player.previous", { defaultValue: "Previous" })}
              >
                <SkipPrevious size={15} weight="Bold" />
              </button>

              <button
                type="button"
                tabIndex={-1}
                onClick={() => void playerEngine.togglePlayPause()}
                className="inline-flex h-[28px] w-[28px] items-center justify-center rounded-full bg-white text-black shadow transition-all duration-150 ease-out hover:scale-105 active:scale-95 border-none cursor-pointer"
                aria-label={
                  isPlaying
                    ? t("player.pause", { defaultValue: "Pause" })
                    : t("player.play", { defaultValue: "Play" })
                }
              >
                <span
                  className={`flex items-center justify-center transition-transform ${
                    isPlaying ? "" : "translate-x-[0.5px]"
                  }`}
                >
                  <PlayerMorphIcon
                    icon={isPlaying ? ICON_PAUSE : ICON_PLAY}
                    size={14}
                  />
                </span>
              </button>

              <button
                type="button"
                tabIndex={-1}
                onClick={() => void playerEngine.skipNext()}
                className="flex h-[26px] w-[26px] items-center justify-center rounded-lg border-0 bg-transparent text-white/60 hover:text-white active:scale-90 transition-all outline-none cursor-pointer"
                aria-label={t("player.next", { defaultValue: "Next" })}
              >
                <SkipNext size={15} weight="Bold" />
              </button>

              <button
                type="button"
                tabIndex={-1}
                onClick={() => setInAppWidgetOpen(false)}
                className="flex h-[24px] w-[24px] items-center justify-center rounded-lg border-0 bg-transparent text-white/35 hover:text-white/90 active:scale-90 transition-all outline-none cursor-pointer"
                aria-label={t("common.close", { defaultValue: "Close" })}
              >
                <CloseLine size={14} />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
