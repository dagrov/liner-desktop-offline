import { forwardRef, memo, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeftLine,
  FontSizeLine,
  RadarLine,
  SparklesFill,
  Upload2Line,
} from "@mingcute/react";
import { useTranslation } from "@/languages";
import WindowControls from "@/features/navigation/ui/WindowControls";
import { useModalStore } from "@/features/library";
import { useOfflineLibraryStore } from "@/features/offline";
import {
  pickAndImportMusicFiles,
  triggerManualPcAudioScan,
} from "@/features/studio";
import { useAssistantStore } from "@/features/assistant";
import { showToast } from "@/shared/ui";
import logo from "@/assets/logo.svg";
import { cn } from "@/shared/lib";

const BACK_BUTTON_ROUTES = ["/library/playlist", "/artist", "/collection"];

function BackButton() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleBack = useCallback(() => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/library");
    }
  }, [navigate]);

  return (
    <button
      type="button"
      onClick={handleBack}
      aria-label={t("common.back")}
      data-no-tooltip="true"
      data-no-window-drag
      className="group relative inline-flex h-[38px] shrink-0 items-center gap-[6px] rounded-[10px] px-[12px] active:scale-[0.96] transition-transform cursor-pointer select-none text-[13px] font-[500] border-0 !border-none bg-bg-glass backdrop-blur-[20px] text-text-primary after:pointer-events-none after:absolute after:inset-0 after:rounded-[10px] after:transition-colors after:duration-150 hover:after:bg-black/[0.05] dark:hover:after:bg-white/[0.08]"
      style={{ fontFamily: "var(--font-inter), sans-serif" }}
    >
      <ArrowLeftLine
        size={16}
        className="transition-transform duration-150 group-hover:-translate-x-0.5"
      />
      <span className="relative -left-[1.5px] top-[1px]">{t("common.back")}</span>
    </button>
  );
}

export interface HeaderProps {
  searchOpen?: boolean;
  onSearchToggle?: () => void;
  className?: string;
}

export const Header = forwardRef<HTMLElement, HeaderProps>(function Header(
  { className },
  ref,
) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const showBack = BACK_BUTTON_ROUTES.includes(pathname);
  const openSettings = useModalStore((s) => s.openSettings);
  const assistantEnabled = useAssistantStore((s) => s.enabled);
  const setCommandBarOpen = useAssistantStore((s) => s.setCommandBarOpen);
  const isScanningPc = useOfflineLibraryStore((s) => s.isScanningPc);

  const handleQuickScanPc = useCallback(async () => {
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

  const handleQuickImport = useCallback(async () => {
    const count = await pickAndImportMusicFiles();
    if (count > 0) {
      showToast(
        `Imported ${count} local audio track${count === 1 ? "" : "s"}`,
        "success",
      );
    }
  }, []);

  return (
    <header
      ref={ref}
      data-window-drag
      className={cn(
        "relative z-45 w-full shrink-0 select-none bg-transparent h-[50px] flex items-center justify-between",
        className,
      )}
    >
      <div className="w-[58px] h-full flex items-center justify-center shrink-0">
        <Link
          to="/"
          data-no-window-drag
          title="Liner"
          className="flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
        >
          <img
            src={logo}
            alt="Liner"
            width={39}
            height={30}
            className="h-[30px] w-auto object-contain theme-logo invert dark:invert-0 select-none"
            draggable={false}
          />
        </Link>
      </div>

      {showBack && (
        <div className="flex-1 min-w-0 flex items-center pl-[22px]">
          <BackButton />
        </div>
      )}

      <div className="flex items-center gap-[8px] mr-[6px] shrink-0 ml-auto">
        <button
          type="button"
          data-no-window-drag
          disabled={isScanningPc}
          onClick={() => void handleQuickScanPc()}
          title={t("offline.scanPc")}
          className="h-[36px] px-[12px] rounded-[10px] border-0 bg-bg-glass backdrop-blur-[20px] text-text-secondary hover:text-text-primary hover:bg-white/[0.1] disabled:opacity-60 text-[12.5px] font-[500] inline-flex items-center gap-[6px] cursor-pointer transition-colors"
        >
          <RadarLine
            size={15}
            className={isScanningPc ? "animate-spin" : undefined}
          />
          <span className="hidden sm:inline">
            {isScanningPc ? t("offline.scanningPc") : t("offline.scanPc")}
          </span>
        </button>

        <button
          type="button"
          data-no-window-drag
          onClick={() => void handleQuickImport()}
          title={t("offline.importMusic")}
          className="h-[36px] px-[12px] rounded-[10px] border-0 bg-bg-glass backdrop-blur-[20px] text-text-secondary hover:text-text-primary hover:bg-white/[0.1] text-[12.5px] font-[500] inline-flex items-center gap-[6px] cursor-pointer transition-colors"
        >
          <Upload2Line size={15} />
          <span className="hidden sm:inline">{t("offline.importMusic")}</span>
        </button>

        <button
          type="button"
          data-no-window-drag
          onClick={() => openSettings("Studio")}
          title={t("offline.coversAndFonts")}
          className="h-[36px] px-[12px] rounded-[10px] border-0 bg-bg-glass backdrop-blur-[20px] text-text-secondary hover:text-text-primary hover:bg-white/[0.1] text-[12.5px] font-[500] inline-flex items-center gap-[6px] cursor-pointer transition-colors"
        >
          <FontSizeLine size={15} />
          <span className="hidden sm:inline">{t("offline.coversAndFonts")}</span>
        </button>

        {assistantEnabled && (
          <button
            type="button"
            data-no-window-drag
            onClick={() => setCommandBarOpen(true)}
            title="Music Assistant (Ctrl/Cmd+J)"
            className="h-[36px] px-[12px] rounded-[10px] border border-accent-primary/25 bg-accent-primary/10 backdrop-blur-[20px] text-text-primary hover:bg-accent-primary/20 text-[12.5px] font-[600] inline-flex items-center gap-[6px] cursor-pointer transition-colors"
          >
            <SparklesFill size={14} className="text-accent-primary" />
            <span className="hidden sm:inline">{t("offline.assistant")}</span>
          </button>
        )}

        <div
          data-no-window-drag
          data-no-tooltip="true"
          className="h-[38px] flex items-center gap-[2px] px-[4px] rounded-[10px] shrink-0 bg-bg-glass backdrop-blur-[20px]"
        >
          <WindowControls bare />
        </div>
      </div>
    </header>
  );
});

export default memo(Header);
