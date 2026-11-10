// Game music, synthesised live with Web Audio: no files to download, and it can drift up with the level.
// Lofi on the miyako-bushi scale (D E♭ G A B♭): warm electric-piano chords, a soft swung beat, vinyl crackle and a quiet
// koto line, all through a gentle low-pass. Levels only nudge the tempo and add detail, so it stays background music.

const SCALE = [0, 1, 5, 7, 8];
const ROOT = 146.83; // D3
/** Bar roots as scale degrees: D, B♭ below, G below, A below. */
const PROGRESSION = [0, -1, -3, -2];
/** Koto line over each bar; null is a rest. Sparse so it never competes with reading. */
const MELODY: (number | null)[] = [4, null, null, 5, null, null, 4, null, 2, null, null, null, 3, null, 2, null];
const ARP = [0, 2, 4, 7, 5, 4, 2, 4, 0, 2, 4, 5, 7, 5, 4, 2];

/** Frequency of a scale degree; degree 5 is the octave above degree 0. */
export function noteFreq(degree: number, octave = 0) {
  const oct = Math.floor(degree / 5);
  return ROOT * 2 ** ((SCALE[degree - oct * 5] + 12 * (oct + octave)) / 12);
}

export const bpmFor = (level: number) => 76 + Math.min(level - 1, 6) * 3;

export type MusicEvent =
  | { kind: 'kick' | 'snare' | 'hat' }
  | { kind: 'bass' | 'pluck' | 'keys'; freq: number };

/** What plays on one 16th-note step (0–63 across the four-bar loop) at a given level. Pure, so it can be tested. */
export function musicEvents(step: number, level: number): MusicEvent[] {
  const s = step % 16;
  const bar = Math.floor(step / 16) % 4;
  const chord = PROGRESSION[bar];
  const out: MusicEvent[] = [];
  if (s === 0 || (s === 10 && level >= 2)) for (const d of [0, 2, 4]) out.push({ kind: 'keys', freq: noteFreq(chord + d) });
  if (s === 0 || s === 10) out.push({ kind: 'bass', freq: noteFreq(chord, -1) });
  if (s === 0 || s === 7 || (s === 10 && level >= 3)) out.push({ kind: 'kick' });
  if (s === 4 || s === 12) out.push({ kind: 'snare' });
  if (level >= 3 ? s % 2 === 0 || s === 15 : s % 4 === 2) out.push({ kind: 'hat' });
  const note = level >= 4 ? ARP[s] : MELODY[s];
  // The melody is the lead from the first second: an octave above the chords, louder than everything under it.
  if (note !== null && (level < 4 || s % 2 === 0)) out.push({ kind: 'pluck', freq: noteFreq(chord + note, 1) });
  return out;
}

export type GameMusic = { play(): void; pause(): void; setLevel(level: number): void; close(): void };

export function createMusic(): GameMusic | null {
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  const ctx = new Ctx();
  const master = ctx.createGain();
  master.gain.value = 0.5;
  // The lofi colour: everything above ~3 kHz rolled off, sub-bass cut so small speakers stay clean.
  const warm = ctx.createBiquadFilter();
  warm.type = 'lowpass';
  warm.frequency.value = 4200;
  const lowCut = ctx.createBiquadFilter();
  lowCut.type = 'highpass';
  lowCut.frequency.value = 130;
  const comp = ctx.createDynamicsCompressor();
  master.connect(warm).connect(lowCut).connect(comp).connect(ctx.destination);
  const echo = ctx.createDelay(1);
  const feedback = ctx.createGain();
  const wet = ctx.createGain();
  feedback.gain.value = 0.28;
  wet.gain.value = 0.3;
  echo.connect(feedback).connect(echo);
  echo.connect(wet).connect(master);

  const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

  // Vinyl: a faint hiss with the odd pop, looped under everything.
  const vinyl = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const v = vinyl.getChannelData(0);
  for (let i = 0; i < v.length; i++) v[i] = (Math.random() * 2 - 1) * 0.05 + (Math.random() < 0.0004 ? (Math.random() * 2 - 1) * 0.9 : 0);
  const crackle = ctx.createBufferSource();
  crackle.buffer = vinyl;
  crackle.loop = true;
  const crackleGain = ctx.createGain();
  crackleGain.gain.value = 0.06;
  crackle.connect(crackleGain).connect(master);
  crackle.start();

  const env = (t: number, peak: number, attack: number, decay: number) => {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    return g;
  };
  const tone = (type: OscillatorType, freq: number, t: number, length: number, out: AudioNode, detune = 0) => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    o.detune.value = detune;
    o.connect(out);
    o.start(t);
    o.stop(t + length);
    return o;
  };
  const hiss = (t: number, length: number, out: AudioNode) => {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.connect(out);
    src.start(t, Math.random() * 0.5, length);
  };
  const filtered = (type: BiquadFilterType, freq: number, out: AudioNode) => {
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.connect(out);
    return f;
  };

  let level = 1;
  let step = 0;
  let next = 0;
  let timer = 0;
  const sixteenth = () => 60 / bpmFor(level) / 4;

  const voice = (e: MusicEvent, t: number) => {
    switch (e.kind) {
      case 'kick': {
        const g = env(t, 0.1, 0.003, 0.14);
        g.connect(master);
        tone('sine', 120, t, 0.18, g).frequency.exponentialRampToValueAtTime(60, t + 0.1);
        break;
      }
      case 'snare': {
        const g = env(t, 0.07, 0.004, 0.16);
        g.connect(master);
        hiss(t, 0.2, filtered('bandpass', 1800, g));
        break;
      }
      case 'hat': {
        const g = env(t, 0.035, 0.002, 0.05);
        g.connect(master);
        hiss(t, 0.08, filtered('highpass', 6000, g));
        break;
      }
      case 'bass': {
        const g = env(t, 0.035, 0.02, sixteenth() * 4);
        g.connect(master);
        tone('sine', e.freq, t, sixteenth() * 6, g);
        break;
      }
      case 'keys': {
        // Electric-piano-ish: a sine body, a soft octave bell that fades first, slightly detuned like worn tape.
        const g = env(t, 0.028, 0.025, 2.2);
        g.connect(master);
        g.connect(echo);
        tone('sine', e.freq, t, 2.4, g, -6 + Math.random() * 12);
        const bell = env(t, 0.012, 0.01, 0.6);
        bell.connect(master);
        tone('triangle', e.freq * 2, t, 0.7, bell);
        break;
      }
      case 'pluck': {
        const g = env(t, 0.11, 0.004, 0.9);
        g.connect(master);
        g.connect(echo);
        tone('triangle', e.freq, t, 1, g);
        const shine = env(t, 0.02, 0.003, 0.3);
        shine.connect(master);
        tone('sine', e.freq * 2, t, 0.4, shine);
        break;
      }
    }
  };

  // Lookahead scheduler: a coarse timer queues notes slightly ahead on the audio clock, so timing stays tight.
  // Off-beat 16ths land a little late: that lazy swing is most of what makes it sound lofi.
  const schedule = () => {
    while (next < ctx.currentTime + 0.12) {
      const swing = step % 2 ? sixteenth() * 0.28 : 0;
      echo.delayTime.setValueAtTime(sixteenth() * 3, next);
      for (const e of musicEvents(step, level)) voice(e, next + swing);
      step = (step + 1) % 64;
      next += sixteenth();
    }
  };

  return {
    play() {
      void ctx.resume();
      if (!timer) { next = Math.max(next, ctx.currentTime + 0.05); timer = window.setInterval(schedule, 25); }
    },
    pause() { window.clearInterval(timer); timer = 0; void ctx.suspend(); },
    setLevel(n) { level = Math.max(1, n); },
    close() { window.clearInterval(timer); timer = 0; void ctx.close(); },
  };
}
