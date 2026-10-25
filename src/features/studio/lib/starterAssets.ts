import { VINYL_COVER_DATA_URL } from "@/features/offline/lib/sampleLibrary";

export type FontCategory = "sans" | "serif" | "mono" | "retro";

export interface FontAsset {
  id: string;
  name: string;
  cssFamily: string;
  category: FontCategory;
  tags: string[];
  description: string;
  source: "starter" | "imported" | "folder";
  fileName?: string;
  localFilePath?: string;
  letterSpacing?: string;
}

export interface CoverAsset {
  id: string;
  name: string;
  imageUrl: string;
  tags: string[];
  description: string;
  source: "starter" | "imported" | "folder";
  trackId?: string;
  albumId?: string;
  fileName?: string;
  localFilePath?: string;
}

export const STARTER_FONTS: FontAsset[] = [
  {
    id: "font-montserrat-geometric",
    name: "Montserrat Geometric",
    cssFamily:
      '"Montserrat", "Inter", "Noto Sans Ethiopic", system-ui, sans-serif',
    category: "sans",
    tags: ["geometric", "sleek", "default", "modern", "bold"],
    description: "Liner's signature geometric display grotesque for song titles.",
    source: "starter",
  },
  {
    id: "font-inter-clean",
    name: "Inter Clean",
    cssFamily:
      '"Inter", "Noto Sans Ethiopic", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    category: "sans",
    tags: ["clean", "minimal", "modern", "sans", "swiss", "neutral", "glass"],
    description: "Ultra-clean neo-grotesque tuned for crisp song title legibility.",
    source: "starter",
    letterSpacing: "-0.02em",
  },
  {
    id: "font-editorial-serif",
    name: "Editorial Serif",
    cssFamily:
      '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, "Noto Serif Ethiopic", "Noto Sans Ethiopic", serif',
    category: "serif",
    tags: [
      "serif",
      "editorial",
      "classic",
      "literary",
      "organic",
      "folk",
      "intimate",
    ],
    description:
      "Warm literary old-style serif with classic liner-note character.",
    source: "starter",
    letterSpacing: "-0.01em",
  },
  {
    id: "font-playfair-luxe",
    name: "Didot Luxe Serif",
    cssFamily:
      '"Didot", "Bodoni MT", "Times New Roman", Georgia, "Noto Serif Ethiopic", serif',
    category: "serif",
    tags: [
      "serif",
      "luxury",
      "dramatic",
      "classical",
      "cinematic",
      "orchestral",
      "high-contrast",
    ],
    description: "High-contrast philharmonic display serif for song titles.",
    source: "starter",
  },
  {
    id: "font-syne-retro",
    name: "Avant Retro Display",
    cssFamily:
      '"Trebuchet MS", "Arial Black", "Montserrat", "Noto Sans Ethiopic", sans-serif',
    category: "retro",
    tags: [
      "retro",
      "synthwave",
      "80s",
      "display",
      "futuristic",
      "analog",
      "neon",
    ],
    description:
      "Wide, punchy display typography built for synthwave & analog sleeves.",
    source: "starter",
    letterSpacing: "0.03em",
  },
  {
    id: "font-geist-mono",
    name: "Geist Studio Mono",
    cssFamily:
      '"Geist Mono", ui-monospace, "SFMono-Regular", Menlo, Consolas, "Noto Sans Ethiopic", monospace',
    category: "mono",
    tags: [
      "mono",
      "monospace",
      "technical",
      "cyber",
      "electronic",
      "code",
      "minimal",
      "studio",
    ],
    description: "Precision studio monospace with crisp tabular alignment.",
    source: "starter",
    letterSpacing: "-0.03em",
  },
  {
    id: "font-humanist-warm",
    name: "Humanist Warm",
    cssFamily:
      'Optima, Candara, "Gill Sans", "Roboto Flex", "Noto Sans Ethiopic", sans-serif',
    category: "sans",
    tags: ["warm", "friendly", "lofi", "soft", "cozy", "acoustic", "humanist"],
    description:
      "Gentle organic stroke modulation suited to lo-fi & acoustic sessions.",
    source: "starter",
  },
];

export const STARTER_COVERS: CoverAsset[] = [
  {
    id: "cover-minimal-vinyl",
    name: "Minimalist Vinyl",
    imageUrl: VINYL_COVER_DATA_URL,
    tags: ["vinyl", "minimal", "clean", "wax", "dark", "classic", "default"],
    description:
      "Heavyweight 180g black wax pressing with crimson center label.",
    source: "starter",
  },
];
