import { ThemeProvider } from "next-themes";
import GlobalTooltip from "@/shared/ui/GlobalTooltip";
import { OverlayPlayer } from "@/features/overlay/ui/OverlayPlayer";
import "./globals.css";

export default function OverlayApp() {
  return (
    <ThemeProvider attribute="data-theme" defaultTheme="dark" enableSystem={false} forcedTheme="dark">
      <GlobalTooltip />
      <OverlayPlayer />
    </ThemeProvider>
  );
}
