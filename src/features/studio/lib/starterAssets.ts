import { svgToDataUrl } from "@/features/offline/lib/sampleLibrary";

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
    cssFamily: '"Montserrat", "Inter", system-ui, sans-serif',
    category: "sans",
    tags: ["geometric", "sleek", "default", "modern", "bold"],
    description: "Liner's signature geometric display grotesque.",
    source: "starter",
  },
  {
    id: "font-inter-clean",
    name: "Inter Clean",
    cssFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    category: "sans",
    tags: ["clean", "minimal", "modern", "sans", "swiss", "neutral", "glass"],
    description: "Ultra-clean neo-grotesque tuned for crisp legibility.",
    source: "starter",
    letterSpacing: "-0.02em",
  },
  {
    id: "font-editorial-serif",
    name: "Editorial Serif",
    cssFamily: '"Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif',
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
    description: "Warm literary old-style serif with classic liner-note character.",
    source: "starter",
    letterSpacing: "-0.01em",
  },
  {
    id: "font-playfair-luxe",
    name: "Didot Luxe Serif",
    cssFamily: '"Didot", "Bodoni MT", "Times New Roman", Georgia, serif',
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
    description: "High-contrast fashion & philharmonic display serif.",
    source: "starter",
  },
  {
    id: "font-syne-retro",
    name: "Avant Retro Display",
    cssFamily: '"Trebuchet MS", "Arial Black", "Montserrat", sans-serif',
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
    description: "Wide, punchy display typography built for synthwave & analog sleeves.",
    source: "starter",
    letterSpacing: "0.03em",
  },
  {
    id: "font-geist-mono",
    name: "Geist Studio Mono",
    cssFamily: '"Geist Mono", ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace',
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
    cssFamily: 'Optima, Candara, " Gill Sans", "Roboto Flex", sans-serif',
    category: "sans",
    tags: ["warm", "friendly", "lofi", "soft", "cozy", "acoustic", "humanist"],
    description: "Gentle organic stroke modulation suited to lo-fi & acoustic sessions.",
    source: "starter",
  },
];

export const STARTER_COVERS: CoverAsset[] = [
  {
    id: "cover-retro-sunset",
    name: "Retro Version",
    imageUrl: svgToDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">
        <defs>
          <linearGradient id="rbg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#190826"/>
            <stop offset="52%" stop-color="#6b104b"/>
            <stop offset="100%" stop-color="#0d0417"/>
          </linearGradient>
          <linearGradient id="rsun" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#fde047"/>
            <stop offset="50%" stop-color="#fb7185"/>
            <stop offset="100%" stop-color="#a855f7"/>
          </linearGradient>
        </defs>
        <rect width="1000" height="1000" fill="url(#rbg)"/>
        <circle cx="500" cy="430" r="265" fill="url(#rsun)"/>
        <rect x="190" y="455" width="620" height="14" fill="#2a0a38"/>
        <rect x="190" y="495" width="620" height="20" fill="#2a0a38"/>
        <rect x="190" y="544" width="620" height="28" fill="#2a0a38"/>
        <rect x="190" y="600" width="620" height="38" fill="#2a0a38"/>
        <path d="M0 680 L1000 680 M0 735 L1000 735 M0 805 L1000 805 M0 895 L1000 895" stroke="#22d3ee" stroke-opacity="0.55" stroke-width="3"/>
        <path d="M500 680 L100 1000 M500 680 L300 1000 M500 680 L500 1000 M500 680 L700 1000 M500 680 L900 1000" stroke="#f472b6" stroke-opacity="0.4" stroke-width="2"/>
      </svg>
    `),
    tags: ["retro", "80s", "synthwave", "sunset", "neon", "vintage"],
    description: "1984 outrun chrome grid & sunset horizon edition.",
    source: "starter",
  },
  {
    id: "cover-minimal-vinyl",
    name: "Minimalist Vinyl",
    imageUrl: svgToDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">
        <rect width="1000" height="1000" fill="#121214"/>
        <circle cx="500" cy="500" r="390" fill="#09090b" stroke="#27272a" stroke-width="4"/>
        <circle cx="500" cy="500" r="330" fill="none" stroke="#27272a" stroke-width="1.5"/>
        <circle cx="500" cy="500" r="270" fill="none" stroke="#27272a" stroke-width="1.5"/>
        <circle cx="500" cy="500" r="210" fill="none" stroke="#27272a" stroke-width="1.5"/>
        <circle cx="500" cy="500" r="130" fill="#e11d48"/>
        <circle cx="500" cy="500" r="22" fill="#121214"/>
      </svg>
    `),
    tags: ["vinyl", "minimal", "clean", "wax", "dark", "classic"],
    description: "Heavyweight 180g black wax pressing with crimson center label.",
    source: "starter",
  },
  {
    id: "cover-neon-noir",
    name: "Neon Noir",
    imageUrl: svgToDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">
        <defs>
          <radialGradient id="nn" cx="50%" cy="50%" r="55%">
            <stop offset="0%" stop-color="#06b6d4" stop-opacity="0.75"/>
            <stop offset="50%" stop-color="#3b82f6" stop-opacity="0.28"/>
            <stop offset="100%" stop-color="#020617" stop-opacity="0"/>
          </radialGradient>
        </defs>
        <rect width="1000" height="1000" fill="#020617"/>
        <circle cx="500" cy="500" r="460" fill="url(#nn)"/>
        <rect x="230" y="230" width="540" height="540" rx="28" fill="none" stroke="#22d3ee" stroke-width="4" stroke-opacity="0.75"/>
        <rect x="290" y="290" width="420" height="420" rx="20" fill="none" stroke="#f43f5e" stroke-width="3" stroke-opacity="0.65"/>
      </svg>
    `),
    tags: ["noir", "neon", "cyber", "dark", "electronic", "club", "night"],
    description: "Cyan and crimson neon geometry set against midnight slate.",
    source: "starter",
  },
  {
    id: "cover-editorial-mono",
    name: "Editorial Monochrome",
    imageUrl: svgToDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">
        <rect width="1000" height="1000" fill="#f4f4f5"/>
        <rect x="90" y="90" width="820" height="820" fill="#18181b"/>
        <circle cx="500" cy="460" r="210" fill="#fafafa"/>
        <rect x="220" y="610" width="560" height="190" fill="#18181b"/>
        <line x1="220" y1="680" x2="780" y2="680" stroke="#a1a1aa" stroke-width="3"/>
      </svg>
    `),
    tags: ["monochrome", "editorial", "black and white", "minimal", "swiss", "serif"],
    description: "High-contrast Swiss gallery sleeve in archival monochrome.",
    source: "starter",
  },
  {
    id: "cover-warm-analog",
    name: "Warm Analog Tape",
    imageUrl: svgToDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">
        <defs>
          <linearGradient id="wa" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#291811"/>
            <stop offset="100%" stop-color="#451a03"/>
          </linearGradient>
        </defs>
        <rect width="1000" height="1000" fill="url(#wa)"/>
        <rect x="140" y="260" width="720" height="480" rx="44" fill="#f59e0b" fill-opacity="0.14" stroke="#fbbf24" stroke-opacity="0.5" stroke-width="4"/>
        <circle cx="355" cy="500" r="105" fill="none" stroke="#fde68a" stroke-width="8" stroke-opacity="0.75"/>
        <circle cx="645" cy="500" r="105" fill="none" stroke="#fde68a" stroke-width="8" stroke-opacity="0.75"/>
        <circle cx="355" cy="500" r="32" fill="#fde68a" fill-opacity="0.65"/>
        <circle cx="645" cy="500" r="32" fill="#fde68a" fill-opacity="0.65"/>
      </svg>
    `),
    tags: ["analog", "tape", "warm", "lofi", "cassette", "cozy", "vintage"],
    description: "Amber studio reel cassette edition with warm brass accents.",
    source: "starter",
  },
  {
    id: "cover-orbital-blueprint",
    name: "Orbital Blueprint",
    imageUrl: svgToDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">
        <rect width="1000" height="1000" fill="#0c2461"/>
        <g stroke="#82ccdd" stroke-opacity="0.22" stroke-width="1.5">
          <line x1="200" y1="0" x2="200" y2="1000"/><line x1="400" y1="0" x2="400" y2="1000"/>
          <line x1="600" y1="0" x2="600" y2="1000"/><line x1="800" y1="0" x2="800" y2="1000"/>
          <line x1="0" y1="200" x2="1000" y2="200"/><line x1="0" y1="400" x2="1000" y2="400"/>
          <line x1="0" y1="600" x2="1000" y2="600"/><line x1="0" y1="800" x2="1000" y2="800"/>
        </g>
        <circle cx="500" cy="500" r="300" fill="none" stroke="#f8fafc" stroke-width="3" stroke-dasharray="14 10"/>
        <circle cx="500" cy="500" r="170" fill="none" stroke="#60a5fa" stroke-width="3"/>
        <line x1="120" y1="500" x2="880" y2="500" stroke="#f8fafc" stroke-opacity="0.5" stroke-width="2"/>
        <line x1="500" y1="120" x2="500" y2="880" stroke="#f8fafc" stroke-opacity="0.5" stroke-width="2"/>
      </svg>
    `),
    tags: ["blueprint", "technical", "ambient", "space", "architectural", "blue"],
    description: "Cyanotype architectural schematic sleeve.",
    source: "starter",
  },
  {
    id: "cover-botanical-amber",
    name: "Botanical Cedar",
    imageUrl: svgToDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">
        <defs>
          <linearGradient id="ba" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#132a13"/>
            <stop offset="100%" stop-color="#081c15"/>
          </linearGradient>
        </defs>
        <rect width="1000" height="1000" fill="url(#ba)"/>
        <circle cx="500" cy="500" r="290" fill="#4f772d" fill-opacity="0.28"/>
        <ellipse cx="500" cy="520" rx="140" ry="280" fill="none" stroke="#ecf39e" stroke-opacity="0.65" stroke-width="4"/>
        <line x1="500" y1="220" x2="500" y2="820" stroke="#ecf39e" stroke-opacity="0.65" stroke-width="3"/>
      </svg>
    `),
    tags: ["botanical", "organic", "folk", "nature", "green", "acoustic"],
    description: "Deep forest sage & botanical gold-leaf illustration.",
    source: "starter",
  },
  {
    id: "cover-chromatic-prism",
    name: "Chromatic Prism",
    imageUrl: svgToDataUrl(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">
        <defs>
          <linearGradient id="cp" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#ec4899"/>
            <stop offset="50%" stop-color="#8b5cf6"/>
            <stop offset="100%" stop-color="#06b6d4"/>
          </linearGradient>
        </defs>
        <rect width="1000" height="1000" fill="#09090b"/>
        <polygon points="500,170 830,770 170,770" fill="url(#cp)" fill-opacity="0.82"/>
        <polygon points="500,270 740,710 260,710" fill="#09090b" fill-opacity="0.72"/>
      </svg>
    `),
    tags: ["prism", "chromatic", "colorful", "disco", "vibrant", "modern"],
    description: "Iridescent spectral prism over obsidian canvas.",
    source: "starter",
  },
];
