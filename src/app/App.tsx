import { useEffect, useState } from "react";
import { HashRouter, useLocation } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import {
  ToastProvider,
  AppleEmojiProvider,
  RootErrorBoundary,
  GlobalTooltip,
  WindowAnimationContainer,
  showToast,
} from "@/shared/ui";
import { useWindowDrag } from "@/shared/hooks";
import {
  FloatingMiniPlayerWidget,
  useAppIconSync,
} from "@/features/player";
import { I18nProvider } from "@/languages";
import { CoverSwRegistrar } from "@/features/covers";
import { usePresenceSync } from "@/shared/presence";
import { useTouchBarSync } from "@/features/touchbar";
import { useOverlaySync } from "@/features/overlay";
import { useDiscordSync } from "@/features/discord";
import { useThemeCustomizationSync } from "@/features/settings";
import AppFrame from "@/features/navigation/ui/AppFrame";
import { useWindowState } from "@/features/navigation/hooks/useWindowState";
import { OfflineBootstrap } from "@/features/offline";
import {
  CoverPickerModal,
  LyricsEditorModal,
  handleDroppedFilesImport,
  useStudioTypographySync,
} from "@/features/studio";
import { AssistantCommandBar } from "@/features/assistant";
import { AppRoutes } from "./routes";
import DeeplinkHandler from "./DeeplinkHandler";
import "./globals.css";

function OfflineShell({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  useWindowState();

  useEffect(() => {
    if (typeof window !== "undefined" && !window.linerElectron) {
      document.documentElement.style.backgroundColor = "#000000";
      document.body.style.backgroundColor = "#000000";
    }
  }, []);

  return pathname === "/login" ? <>{children}</> : <AppFrame>{children}</AppFrame>;
}

function AppIconSync() {
  useAppIconSync();
  return null;
}

function PresenceSync() {
  usePresenceSync();
  return null;
}

function ThemeSync() {
  useThemeCustomizationSync();
  return null;
}

function StudioSync() {
  useStudioTypographySync();
  return null;
}

function TouchBarSync() {
  useTouchBarSync();
  return null;
}

function OverlaySync() {
  useOverlaySync();
  return null;
}

function DiscordSync() {
  useDiscordSync();
  return null;
}

function GlobalDropOverlay() {
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    let dragCounter = 0;

    const hasFiles = (e: DragEvent) =>
      Array.from(e.dataTransfer?.types ?? []).includes("Files");

    const onDragEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragCounter += 1;
      setDragging(true);
    };

    const onDragOver = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    };

    const onDragLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      dragCounter = Math.max(0, dragCounter - 1);
      if (dragCounter === 0) setDragging(false);
    };

    const onDrop = async (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragCounter = 0;
      setDragging(false);
      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;
      const result = await handleDroppedFilesImport(files);
      const parts: string[] = [];
      if (result.audio > 0) {
        parts.push(`${result.audio} track${result.audio === 1 ? "" : "s"}`);
      }
      if (result.fonts > 0) {
        parts.push(`${result.fonts} font${result.fonts === 1 ? "" : "s"}`);
      }
      if (result.covers > 0) {
        parts.push(`${result.covers} cover${result.covers === 1 ? "" : "s"}`);
      }
      if (result.lyrics > 0) {
        parts.push(`${result.lyrics} lyrics file${result.lyrics === 1 ? "" : "s"}`);
      }
      if (parts.length > 0) {
        showToast(`Imported ${parts.join(", ")}`, "success");
      } else {
        showToast(
          "Unsupported file format — drop audio (.mp3/.flac/.wav), lyrics (.lrc/.txt/.srt), fonts (.ttf/.otf/.woff2), or images (.png/.jpg/.svg)",
          "info",
        );
      }
    };

    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, []);

  if (!dragging) return null;

  return (
    <div className="fixed inset-3 z-[9500] pointer-events-none rounded-[18px] border-2 border-dashed border-accent-primary bg-black/55 backdrop-blur-md flex flex-col items-center justify-center gap-2 text-center px-6">
      <div className="text-[18px] font-[700] text-white tracking-tight">
        Drop into Liner Offline Studio
      </div>
      <div className="text-[13px] text-white/70">
        Audio (.mp3, .flac, .wav, .ogg, .m4a) · Lyrics (.lrc, .txt, .srt) ·
        Fonts (.ttf, .otf, .woff2) · Cover Art (.png, .jpg, .webp, .svg)
      </div>
    </div>
  );
}

export default function App() {
  useWindowDrag();

  return (
    <HashRouter>
      <CoverSwRegistrar />
      <ThemeProvider
        attribute="data-theme"
        defaultTheme="dark"
        enableSystem={true}
        disableTransitionOnChange
      >
        <GlobalTooltip />
        <ThemeSync />
        <StudioSync />
        <AppIconSync />
        <PresenceSync />
        <TouchBarSync />
        <OverlaySync />
        <DiscordSync />
        <AppleEmojiProvider>
          <I18nProvider>
            <ToastProvider>
              <RootErrorBoundary>
                <OfflineBootstrap>
                  <WindowAnimationContainer>
                    <DeeplinkHandler />
                    <OfflineShell>
                      <AppRoutes />
                    </OfflineShell>
                    <CoverPickerModal />
                    <LyricsEditorModal />
                    <FloatingMiniPlayerWidget />
                    <AssistantCommandBar />
                    <GlobalDropOverlay />
                  </WindowAnimationContainer>
                </OfflineBootstrap>
              </RootErrorBoundary>
            </ToastProvider>
          </I18nProvider>
        </AppleEmojiProvider>
      </ThemeProvider>
    </HashRouter>
  );
}
