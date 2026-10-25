export type SynthPreset =
  | "ambient"
  | "synthwave"
  | "lofi"
  | "classical"
  | "disco"
  | "folk";

interface PresetConfig {
  bpm: number;
  chords: number[][];
  arpPattern: number[];
  padDetune: number;
  arpGain: number;
  bassGain: number;
  shimmer: number;
}

const PRESETS: Record<SynthPreset, PresetConfig> = {
  ambient: {
    bpm: 72,
    chords: [
      [220.0, 261.63, 329.63, 392.0], // Am7
      [174.61, 220.0, 261.63, 329.63], // Fmaj7
      [130.81, 196.0, 246.94, 329.63], // Cmaj7
      [196.0, 246.94, 293.66, 392.0], // G6
    ],
    arpPattern: [0, 2, 3, 2, 1, 3, 2, 0],
    padDetune: 1.0035,
    arpGain: 0.12,
    bassGain: 0.18,
    shimmer: 0.08,
  },
  synthwave: {
    bpm: 108,
    chords: [
      [146.83, 220.0, 261.63, 349.23], // Dm7
      [116.54, 174.61, 233.08, 293.66], // Bbmaj7
      [130.81, 196.0, 261.63, 329.63], // C
      [110.0, 164.81, 220.0, 277.18], // A
    ],
    arpPattern: [0, 1, 2, 3, 2, 1, 3, 1],
    padDetune: 1.006,
    arpGain: 0.2,
    bassGain: 0.26,
    shimmer: 0.12,
  },
  lofi: {
    bpm: 82,
    chords: [
      [164.81, 246.94, 293.66, 369.99], // Em9
      [220.0, 261.63, 329.63, 392.0], // Am7
      [146.83, 220.0, 261.63, 329.63], // Dm9
      [196.0, 246.94, 293.66, 349.23], // G7
    ],
    arpPattern: [0, 2, 1, 3, 0, 3, 2, 1],
    padDetune: 1.0025,
    arpGain: 0.14,
    bassGain: 0.22,
    shimmer: 0.04,
  },
  classical: {
    bpm: 68,
    chords: [
      [130.81, 196.0, 261.63, 329.63], // C
      [164.81, 246.94, 329.63, 392.0], // Em
      [174.61, 220.0, 261.63, 349.23], // F
      [196.0, 246.94, 293.66, 392.0], // G
    ],
    arpPattern: [0, 1, 2, 3, 2, 1, 0, 2],
    padDetune: 1.0018,
    arpGain: 0.16,
    bassGain: 0.16,
    shimmer: 0.06,
  },
  disco: {
    bpm: 118,
    chords: [
      [185.0, 220.0, 277.18, 329.63], // F#m7
      [146.83, 220.0, 277.18, 329.63], // Dmaj7
      [123.47, 185.0, 220.0, 293.66], // Bm7
      [164.81, 207.65, 246.94, 329.63], // E7
    ],
    arpPattern: [0, 3, 1, 3, 2, 3, 1, 2],
    padDetune: 1.004,
    arpGain: 0.2,
    bassGain: 0.28,
    shimmer: 0.1,
  },
  folk: {
    bpm: 88,
    chords: [
      [196.0, 246.94, 293.66, 392.0], // G
      [130.81, 196.0, 246.94, 329.63], // Cmaj7
      [164.81, 246.94, 293.66, 392.0], // Em7
      [146.83, 220.0, 293.66, 369.99], // D
    ],
    arpPattern: [0, 2, 1, 3, 2, 0, 3, 1],
    padDetune: 1.002,
    arpGain: 0.18,
    bassGain: 0.17,
    shimmer: 0.05,
  },
};

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i++) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}

export function synthesizeSampleTrackWav(
  preset: SynthPreset,
  durationSeconds = 28,
): Blob {
  const sampleRate = 22050;
  const numChannels = 2;
  const numSamples = Math.max(1, Math.floor(sampleRate * durationSeconds));
  const dataSize = numSamples * numChannels * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // RIFF / WAVE PCM header
  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, dataSize, true);

  const cfg = PRESETS[preset] ?? PRESETS.ambient;
  const beatDur = 60 / cfg.bpm;
  const barDur = beatDur * 4;
  const stepDur = beatDur / 2;
  const twoPi = Math.PI * 2;

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;

    // Master fade-in & fade-out
    const fadeIn = Math.min(1, t / 1.4);
    const fadeOut = Math.min(1, (durationSeconds - t) / 2.0);
    const masterEnv = Math.max(0, fadeIn * fadeOut);

    const chordIdx = Math.floor(t / barDur) % cfg.chords.length;
    const chord = cfg.chords[chordIdx];
    const barPos = (t % barDur) / barDur;
    const chordEnv = Math.sin(Math.min(1, barPos * 8) * (Math.PI / 2)) * (1 - 0.15 * barPos);

    // Warm stereo pad
    let padL = 0;
    let padR = 0;
    for (let n = 0; n < chord.length; n++) {
      const f = chord[n];
      padL += Math.sin(twoPi * f * t) * 0.11;
      padR += Math.sin(twoPi * f * cfg.padDetune * t + n * 0.4) * 0.11;
    }

    // Sub / rhythmic bass
    const rootFreq = chord[0] * 0.5;
    const beatPos = (t % beatDur) / beatDur;
    const pulseEnv =
      preset === "synthwave" || preset === "disco"
        ? Math.exp(-beatPos * 3.8)
        : 0.7 + 0.3 * Math.exp(-beatPos * 2.2);
    const bass =
      (Math.sin(twoPi * rootFreq * t) * 0.75 +
        Math.sin(twoPi * rootFreq * 2 * t) * 0.25) *
      cfg.bassGain *
      pulseEnv;

    // Melodic arpeggio / bell plucks
    const stepIdx = Math.floor(t / stepDur);
    const stepPos = (t % stepDur) / stepDur;
    const noteIdx = cfg.arpPattern[stepIdx % cfg.arpPattern.length] % chord.length;
    const arpFreq = chord[noteIdx] * 2;
    const pluckEnv = Math.exp(-stepPos * 5.2);
    const arpVoice =
      (Math.sin(twoPi * arpFreq * t) +
        cfg.shimmer * Math.sin(twoPi * arpFreq * 2 * t)) *
      cfg.arpGain *
      pluckEnv;

    const pan = 0.5 + 0.32 * Math.sin(twoPi * 0.25 * t + stepIdx * 0.7);
    const left = Math.max(
      -0.95,
      Math.min(0.95, (padL * chordEnv + bass + arpVoice * pan) * masterEnv),
    );
    const right = Math.max(
      -0.95,
      Math.min(0.95, (padR * chordEnv + bass + arpVoice * (1 - pan)) * masterEnv),
    );

    view.setInt16(offset, Math.round(left * 32767), true);
    view.setInt16(offset + 2, Math.round(right * 32767), true);
    offset += 4;
  }

  return new Blob([buffer], { type: "audio/wav" });
}
