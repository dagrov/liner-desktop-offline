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

export const VINYL_COVER_DATA_URL = svgToDataUrl(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">
    <rect width="1000" height="1000" fill="#121214"/>
    <circle cx="500" cy="500" r="390" fill="#09090b" stroke="#27272a" stroke-width="4"/>
    <circle cx="500" cy="500" r="330" fill="none" stroke="#27272a" stroke-width="1.5"/>
    <circle cx="500" cy="500" r="270" fill="none" stroke="#27272a" stroke-width="1.5"/>
    <circle cx="500" cy="500" r="210" fill="none" stroke="#27272a" stroke-width="1.5"/>
    <circle cx="500" cy="500" r="130" fill="#e11d48"/>
    <circle cx="500" cy="500" r="22" fill="#121214"/>
  </svg>
`);

export const SAMPLE_COVERS = {
  midnightGlass: VINYL_COVER_DATA_URL,
  velvetStatic: VINYL_COVER_DATA_URL,
  paperLanterns: VINYL_COVER_DATA_URL,
  solarisDrift: VINYL_COVER_DATA_URL,
  chromeBoulevard: VINYL_COVER_DATA_URL,
  rainOnCedar: VINYL_COVER_DATA_URL,
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
