import { useEffect } from "react";
import { STARTER_FONTS } from "../lib/starterAssets";
import { getStudioBinaryAsset } from "../lib/studioDb";
import {
  MATCH_TITLE_LYRICS_FONT_ID,
  syncElectronStudioFolder,
  useStudioStore,
} from "../store/studioStore";

const STYLE_ELEMENT_ID = "liner-studio-typography-vars";
const loadedCustomFontIds = new Set<string>();

async function ensureCustomFontRegistered(
  fontId: string,
  cssFamily: string,
): Promise<void> {
  if (typeof document === "undefined" || typeof FontFace === "undefined") {
    return;
  }
  if (loadedCustomFontIds.has(fontId)) return;

  const stored = await getStudioBinaryAsset(fontId);
  if (!stored?.dataUrl) return;

  const match = cssFamily.match(/"([^"]+)"/);
  const familyName = match ? match[1] : cssFamily.split(",")[0].trim();
  try {
    const face = new FontFace(familyName, `url(${stored.dataUrl})`);
    const loaded = await face.load();
    document.fonts.add(loaded);
    loadedCustomFontIds.add(fontId);
  } catch {
    // fallback CSS injection if FontFace constructor declines data URL
    const fallbackId = `liner-fontface-${fontId}`;
    if (!document.getElementById(fallbackId)) {
      const style = document.createElement("style");
      style.id = fallbackId;
      style.textContent = `@font-face { font-family: "${familyName}"; src: url("${stored.dataUrl}"); font-display: swap; }`;
      document.head.appendChild(style);
    }
    loadedCustomFontIds.add(fontId);
  }
}

export function useStudioTypographySync(): void {
  const customFonts = useStudioStore((s) => s.customFonts);
  const activeTitleFontId = useStudioStore((s) => s.activeTitleFontId);
  const activeLyricsFontId = useStudioStore((s) => s.activeLyricsFontId);
  const syncedFontsFolder = useStudioStore((s) => s.syncedFontsFolder);
  const syncedCoversFolder = useStudioStore((s) => s.syncedCoversFolder);

  // Register custom @font-face entries
  useEffect(() => {
    for (const font of customFonts) {
      void ensureCustomFontRegistered(font.id, font.cssFamily);
    }
  }, [customFonts]);

  // Apply custom fonts STRICTLY to music track titles ([data-music-title="true"])
  // AND lyrics verses ([data-lyrics-verse="true"] / braccato synced lyrics)
  // without altering Liner's application UI font
  useEffect(() => {
    if (typeof document === "undefined") return;
    const allFonts = [...customFonts, ...STARTER_FONTS];
    const titleFont =
      allFonts.find((f) => f.id === activeTitleFontId) ?? STARTER_FONTS[0];
    const lyricsFont =
      !activeLyricsFontId || activeLyricsFontId === MATCH_TITLE_LYRICS_FONT_ID
        ? titleFont
        : (allFonts.find((f) => f.id === activeLyricsFontId) ?? titleFont);

    const root = document.documentElement;
    // Ensure no legacy global UI font overrides linger
    root.style.removeProperty("--font-montserrat-family");
    root.style.removeProperty("--font-inter");
    document.body.style.removeProperty("font-family");
    root.style.setProperty("--font-music-title", titleFont.cssFamily);
    root.style.setProperty("--font-lyrics-verse", lyricsFont.cssFamily);

    let styleEl = document.getElementById(
      STYLE_ELEMENT_ID,
    ) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = STYLE_ELEMENT_ID;
      document.head.appendChild(styleEl);
    }

    const titleSpacingRule = titleFont.letterSpacing
      ? `letter-spacing: ${titleFont.letterSpacing};`
      : "";
    const lyricsSpacingRule = lyricsFont.letterSpacing
      ? `letter-spacing: ${lyricsFont.letterSpacing};`
      : "";
    styleEl.textContent = `
      [data-music-title="true"] {
        font-family: ${titleFont.cssFamily} !important;
        ${titleSpacingRule}
      }
      [data-lyrics-verse="true"],
      braccato-lyrics,
      .blyrics-container,
      .blyrics--line {
        --blyrics-font-family: ${lyricsFont.cssFamily};
        font-family: ${lyricsFont.cssFamily} !important;
        ${lyricsSpacingRule}
      }
    `;
  }, [customFonts, activeTitleFontId, activeLyricsFontId]);

  // Watch synced Electron folders for fonts & covers
  useEffect(() => {
    if (!syncedFontsFolder || !window.linerElectron?.localMedia) return;
    void syncElectronStudioFolder(syncedFontsFolder, "fonts");
    return window.linerElectron.localMedia.onDirectoryChanged((ev) => {
      if (ev.kind === "fonts" && ev.dirPath === syncedFontsFolder) {
        void syncElectronStudioFolder(syncedFontsFolder, "fonts");
      }
    });
  }, [syncedFontsFolder]);

  useEffect(() => {
    if (!syncedCoversFolder || !window.linerElectron?.localMedia) return;
    void syncElectronStudioFolder(syncedCoversFolder, "covers");
    return window.linerElectron.localMedia.onDirectoryChanged((ev) => {
      if (ev.kind === "covers" && ev.dirPath === syncedCoversFolder) {
        void syncElectronStudioFolder(syncedCoversFolder, "covers");
      }
    });
  }, [syncedCoversFolder]);
}
