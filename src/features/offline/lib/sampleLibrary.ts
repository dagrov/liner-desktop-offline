import type { SynthPreset } from "./synthAudioGenerator";

export interface SampleTrackEntry {
  id: string;
  title: string;
  artistName: string;
  artistId: string;
  albumTitle: string;
  albumId: string;
  durationMs: number;
  releaseDate: string;
  genre: string;
  moods: string[];
  vibeTags: string[];
  recommendedFontCategory: "sans" | "serif" | "mono" | "retro";
  bpm: number;
  synthPreset: SynthPreset;
  coverUrl: string;
  curatorFact: string;
  albumLinerNotes: string;
  artistBio: string;
  lrcLyrics: string;
  playCount: number;
}

export function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg.trim())}`;
}

export const SAMPLE_COVERS = {
  midnightGlass: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#071126"/>
          <stop offset="52%" stop-color="#0f294a"/>
          <stop offset="100%" stop-color="#090c16"/>
        </linearGradient>
        <radialGradient id="orb" cx="62%" cy="38%" r="48%">
          <stop offset="0%" stop-color="#5eead4" stop-opacity="0.85"/>
          <stop offset="45%" stop-color="#38bdf8" stop-opacity="0.45"/>
          <stop offset="100%" stop-color="#0f172a" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="1000" height="1000" fill="url(#bg)"/>
      <circle cx="610" cy="390" r="410" fill="url(#orb)"/>
      <rect x="140" y="180" width="520" height="640" rx="34" fill="#ffffff" fill-opacity="0.06" stroke="#99f6e4" stroke-opacity="0.28" stroke-width="2"/>
      <line x1="140" y1="520" x2="860" y2="520" stroke="#38bdf8" stroke-opacity="0.35" stroke-width="2"/>
      <circle cx="380" cy="520" r="145" fill="none" stroke="#e0f2fe" stroke-opacity="0.55" stroke-width="3"/>
      <circle cx="380" cy="520" r="68" fill="#5eead4" fill-opacity="0.22"/>
    </svg>
  `),
  velvetStatic: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">
      <defs>
        <linearGradient id="bg2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#1a092b"/>
          <stop offset="55%" stop-color="#4c1147"/>
          <stop offset="100%" stop-color="#12061c"/>
        </linearGradient>
        <linearGradient id="sun" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#fb7185"/>
          <stop offset="55%" stop-color="#f59e0b"/>
          <stop offset="100%" stop-color="#ec4899"/>
        </linearGradient>
      </defs>
      <rect width="1000" height="1000" fill="url(#bg2)"/>
      <circle cx="500" cy="460" r="250" fill="url(#sun)"/>
      <rect x="200" y="490" width="600" height="14" fill="#2c0b3a"/>
      <rect x="200" y="530" width="600" height="20" fill="#2c0b3a"/>
      <rect x="200" y="578" width="600" height="28" fill="#2c0b3a"/>
      <rect x="200" y="634" width="600" height="36" fill="#2c0b3a"/>
      <path d="M0 700 L1000 700 M0 760 L1000 760 M0 835 L1000 835 M0 925 L1000 925" stroke="#f472b6" stroke-opacity="0.38" stroke-width="2"/>
    </svg>
  `),
  paperLanterns: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">
      <defs>
        <linearGradient id="bg3" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#1f1a17"/>
          <stop offset="55%" stop-color="#3b2b20"/>
          <stop offset="100%" stop-color="#161210"/>
        </linearGradient>
        <radialGradient id="glow3" cx="50%" cy="46%" r="42%">
          <stop offset="0%" stop-color="#fde68a" stop-opacity="0.92"/>
          <stop offset="48%" stop-color="#f97316" stop-opacity="0.45"/>
          <stop offset="100%" stop-color="#1f1a17" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="1000" height="1000" fill="url(#bg3)"/>
      <circle cx="500" cy="460" r="390" fill="url(#glow3)"/>
      <rect x="360" y="270" width="280" height="380" rx="120" fill="#fef3c7" fill-opacity="0.16" stroke="#fdba74" stroke-opacity="0.55" stroke-width="3"/>
      <line x1="360" y1="390" x2="640" y2="390" stroke="#fed7aa" stroke-opacity="0.35" stroke-width="2"/>
      <line x1="360" y1="520" x2="640" y2="520" stroke="#fed7aa" stroke-opacity="0.35" stroke-width="2"/>
    </svg>
  `),
  solarisDrift: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">
      <defs>
        <linearGradient id="bg4" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#0b1020"/>
          <stop offset="50%" stop-color="#1e1b4b"/>
          <stop offset="100%" stop-color="#090a14"/>
        </linearGradient>
      </defs>
      <rect width="1000" height="1000" fill="url(#bg4)"/>
      <circle cx="500" cy="500" r="330" fill="none" stroke="#c7d2fe" stroke-opacity="0.28" stroke-width="2"/>
      <circle cx="500" cy="500" r="235" fill="none" stroke="#a5b4fc" stroke-opacity="0.45" stroke-width="2"/>
      <circle cx="500" cy="500" r="135" fill="#818cf8" fill-opacity="0.22" stroke="#e0e7ff" stroke-opacity="0.7" stroke-width="3"/>
      <circle cx="735" cy="500" r="24" fill="#fde047"/>
      <circle cx="335" cy="335" r="14" fill="#c7d2fe"/>
    </svg>
  `),
  chromeBoulevard: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">
      <defs>
        <linearGradient id="bg5" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#041f1e"/>
          <stop offset="50%" stop-color="#064e3b"/>
          <stop offset="100%" stop-color="#022c22"/>
        </linearGradient>
        <linearGradient id="beam" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#34d399"/>
          <stop offset="50%" stop-color="#22d3ee"/>
          <stop offset="100%" stop-color="#a7f3d0"/>
        </linearGradient>
      </defs>
      <rect width="1000" height="1000" fill="url(#bg5)"/>
      <polygon points="160,820 460,180 540,180 840,820" fill="url(#beam)" fill-opacity="0.22"/>
      <line x1="500" y1="180" x2="500" y2="820" stroke="#6ee7b7" stroke-width="4" stroke-opacity="0.8"/>
      <circle cx="500" cy="360" r="95" fill="none" stroke="#a7f3d0" stroke-width="3" stroke-opacity="0.65"/>
    </svg>
  `),
  rainOnCedar: svgToDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">
      <defs>
        <linearGradient id="bg6" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#18221d"/>
          <stop offset="58%" stop-color="#28382f"/>
          <stop offset="100%" stop-color="#101714"/>
        </linearGradient>
      </defs>
      <rect width="1000" height="1000" fill="url(#bg6)"/>
      <circle cx="500" cy="340" r="140" fill="#d9f99d" fill-opacity="0.16"/>
      <polygon points="180,820 420,430 660,820" fill="#3f6212" fill-opacity="0.45"/>
      <polygon points="360,820 610,380 860,820" fill="#365314" fill-opacity="0.62"/>
      <line x1="280" y1="200" x2="250" y2="310" stroke="#bef264" stroke-opacity="0.28" stroke-width="2"/>
      <line x1="680" y1="220" x2="650" y2="330" stroke="#bef264" stroke-opacity="0.28" stroke-width="2"/>
    </svg>
  `),
};

export const SAMPLE_TRACKS: SampleTrackEntry[] = [
  {
    id: "sample:midnight-glass",
    title: "Midnight Glass",
    artistName: "Sora Vance",
    artistId: "artist:sora-vance",
    albumTitle: "Nocturne Architecture",
    albumId: "album:nocturne-architecture",
    durationMs: 28_000,
    releaseDate: "2026-02-14",
    genre: "Ambient Electronic",
    moods: ["chill", "focus", "nocturnal", "calm", "late night"],
    vibeTags: ["clean", "minimal", "modern", "glass", "ambient"],
    recommendedFontCategory: "sans",
    bpm: 72,
    synthPreset: "ambient",
    coverUrl: SAMPLE_COVERS.midnightGlass,
    curatorFact:
      "Sora Vance recorded 'Midnight Glass' using resonant glass harmonica samples layered over detuned analog polysynths in a rain-soaked Tokyo studio.",
    albumLinerNotes:
      "Nocturne Architecture explores how city skylines sound after 2 AM—minimalist, translucent, and weightless.",
    artistBio:
      "Sora Vance is a Tokyo-born ambient electronic composer known for architectural soundscapes, crystalline textures, and meditative late-night minimalism.",
    lrcLyrics: `[00:00.80]City lights dissolve in rain
[00:07.20]Reflections on the windowpane
[00:14.00]Quiet hours drift in blue
[00:20.60]Midnight glass is shining through`,
    playCount: 1420,
  },
  {
    id: "sample:velvet-static",
    title: "Velvet Static",
    artistName: "Analogue Hearts",
    artistId: "artist:analogue-hearts",
    albumTitle: "Tape Saturation",
    albumId: "album:tape-saturation",
    durationMs: 28_000,
    releaseDate: "2025-11-08",
    genre: "Synthwave",
    moods: ["retro", "energetic", "night drive", "nostalgic", "80s"],
    vibeTags: ["retro", "synthwave", "80s", "neon", "bold"],
    recommendedFontCategory: "retro",
    bpm: 108,
    synthPreset: "synthwave",
    coverUrl: SAMPLE_COVERS.velvetStatic,
    curatorFact:
      "'Velvet Static' was bounced through a restored 1983 quarter-inch reel-to-reel deck to capture natural tape flutter and warm harmonic saturation.",
    albumLinerNotes:
      "Tape Saturation is a love letter to neon coastal highways, gated drums, and warm analog synthesis.",
    artistBio:
      "Analogue Hearts is a Montreal synthwave duo blending vintage hardware arpeggiators with cinematic widescreen melodies.",
    lrcLyrics: `[00:00.60]Neon horizon on the dashboard glow
[00:07.00]Radio humming from a world we know
[00:13.80]Chasing the sunset down an open lane
[00:20.40]Velvet static in our veins again`,
    playCount: 1890,
  },
  {
    id: "sample:paper-lanterns",
    title: "Paper Lanterns",
    artistName: "Kaito & The Pines",
    artistId: "artist:kaito-pines",
    albumTitle: "Quiet Meridians",
    albumId: "album:quiet-meridians",
    durationMs: 28_000,
    releaseDate: "2026-04-21",
    genre: "Lo-Fi Chillhop",
    moods: ["warm", "cozy", "study", "relaxed", "chill"],
    vibeTags: ["warm", "lofi", "analog", "friendly", "soft"],
    recommendedFontCategory: "sans",
    bpm: 82,
    synthPreset: "lofi",
    coverUrl: SAMPLE_COVERS.paperLanterns,
    curatorFact:
      "Kaito & The Pines recorded upright Rhodes chords with room microphones placed beside an open courtyard in Kyoto at dusk.",
    albumLinerNotes:
      "Quiet Meridians pairs dusty Rhodes voicings with unhurried grooves crafted for deep reading and quiet evenings.",
    artistBio:
      "Kaito & The Pines craft tactile lo-fi instrumentals and warm acoustic sketches rooted in jazz harmony.",
    lrcLyrics: `[00:01.00]Amber glow across the wooden floor
[00:07.60]Evening breeze beside the open door
[00:14.20]Paper lanterns floating slow and bright
[00:21.00]Holding warmth inside the quiet night`,
    playCount: 1160,
  },
  {
    id: "sample:solaris-drift",
    title: "Solaris Drift",
    artistName: "Helios Ensemble",
    artistId: "artist:helios-ensemble",
    albumTitle: "Orbital Studies",
    albumId: "album:orbital-studies",
    durationMs: 30_000,
    releaseDate: "2025-09-19",
    genre: "Neo-Classical",
    moods: ["cinematic", "editorial", "focused", "dramatic", "reflective"],
    vibeTags: ["serif", "editorial", "classical", "cinematic", "luxury"],
    recommendedFontCategory: "serif",
    bpm: 68,
    synthPreset: "classical",
    coverUrl: SAMPLE_COVERS.solarisDrift,
    curatorFact:
      "Helios Ensemble tuned their chamber strings to 432 Hz for 'Solaris Drift', creating slow-moving harmonic overtones inspired by planetary orbits.",
    albumLinerNotes:
      "Orbital Studies bridges intimate chamber scoring and cosmic minimalism across six contemplative movements.",
    artistBio:
      "Helios Ensemble is a Reykjavik chamber collective merging neo-classical string arrangements with subtle modular electronics.",
    lrcLyrics: `[00:01.20]Silver arcs across the silent deep
[00:08.40]Ancient orbits that the heavens keep
[00:15.80]Gravity is singing soft and low
[00:22.80]Drifting where the golden echoes go`,
    playCount: 980,
  },
  {
    id: "sample:chrome-boulevard",
    title: "Chrome Boulevard",
    artistName: "Neon District",
    artistId: "artist:neon-district",
    albumTitle: "Afterhours FM",
    albumId: "album:afterhours-fm",
    durationMs: 26_000,
    releaseDate: "2026-06-03",
    genre: "Nu-Disco Electronic",
    moods: ["upbeat", "dance", "energetic", "groovy", "party"],
    vibeTags: ["mono", "technical", "cyber", "electronic", "vibrant"],
    recommendedFontCategory: "mono",
    bpm: 118,
    synthPreset: "disco",
    coverUrl: SAMPLE_COVERS.chromeBoulevard,
    curatorFact:
      "Neon District built the bassline of 'Chrome Boulevard' on a classic FM synthesizer layered with French-touch filter sweeps.",
    albumLinerNotes:
      "Afterhours FM captures the kinetic pulse of subterranean club nights and emerald laser beams.",
    artistBio:
      "Neon District produces high-gloss nu-disco and French-touch electroniccuts built for late-night dancefloors.",
    lrcLyrics: `[00:00.50]Emerald lights along the avenue
[00:06.80]Every heartbeat locking in the groove
[00:13.20]Chrome reflections spinning in the dark
[00:19.60]Turn the dial and let the rhythm spark`,
    playCount: 1640,
  },
  {
    id: "sample:rain-on-cedar",
    title: "Rain on Cedar",
    artistName: "Maren Sol",
    artistId: "artist:maren-sol",
    albumTitle: "Northern Light",
    albumId: "album:northern-light",
    durationMs: 28_000,
    releaseDate: "2026-01-27",
    genre: "Indie Folk",
    moods: ["acoustic", "intimate", "melancholic", "organic", "peaceful"],
    vibeTags: ["serif", "organic", "warm", "folk", "editorial"],
    recommendedFontCategory: "serif",
    bpm: 88,
    synthPreset: "folk",
    coverUrl: SAMPLE_COVERS.rainOnCedar,
    curatorFact:
      "Maren Sol tracked 'Rain on Cedar' in a timber cabin outside Bergen while an autumn rainstorm tapped steadily on the cedar roof.",
    albumLinerNotes:
      "Northern Light gathers intimate acoustic songs written during coastal Norwegian winters.",
    artistBio:
      "Maren Sol is a Bergen singer-songwriter celebrated for warm fingerpicked arrangements and poetic natural imagery.",
    lrcLyrics: `[00:00.90]Soft rain falling through the cedar trees
[00:07.50]Silver mist upon the northern seas
[00:14.20]Every memory is warm and still
[00:20.80]Morning light above the quiet hill`,
    playCount: 1310,
  },
];
