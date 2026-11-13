import type { SignalIconId } from "@kent/engine";

/**
 * Every sound is synthesized with the Web Audio API: no audio files to download or license.
 * Browsers only allow audio after the player interacts with the page, so the audio context is
 * created on the first click/tap.
 */

const MUTE_KEY = "kent:muted";
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = readMuted();

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

function unlock() {
  if (ctx) {
    if (ctx.state === "suspended") void ctx.resume();
    return;
  }
  ctx = new AudioContext();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.6;
  master.connect(ctx.destination);
}
window.addEventListener("pointerdown", unlock, { capture: true });
window.addEventListener("keydown", unlock, { capture: true });

export function isMuted(): boolean {
  return muted;
}

export function setMuted(value: boolean): void {
  muted = value;
  try {
    localStorage.setItem(MUTE_KEY, value ? "1" : "0");
  } catch {
    // Not persisted in private mode; fine.
  }
  if (master && ctx) master.gain.setTargetAtTime(value ? 0 : 0.6, ctx.currentTime, 0.02);
}

function ready(): AudioContext | null {
  if (!ctx || !master || muted || ctx.state !== "running") return null;
  return ctx;
}

/** A pitched note with a quick attack and exponential decay. */
function tone(freq: number, { at = 0, dur = 0.18, type = "sine" as OscillatorType, gain = 0.3, slideTo = 0 } = {}) {
  const ac = ready();
  if (!ac || !master) return;
  const t = ac.currentTime + at;
  const osc = ac.createOscillator();
  const env = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(gain, t + 0.012);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(env).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

/** Filtered noise: the "fwip" of a card sliding across felt. */
function swish({ at = 0, dur = 0.13, from = 3200, to = 900, gain = 0.25 } = {}) {
  const ac = ready();
  if (!ac || !master) return;
  const t = ac.currentTime + at;
  const length = Math.ceil(ac.sampleRate * dur);
  const buffer = ac.createBuffer(1, length, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = "bandpass";
  filter.Q.value = 1.2;
  filter.frequency.setValueAtTime(from, t);
  filter.frequency.exponentialRampToValueAtTime(to, t + dur);
  const env = ac.createGain();
  env.gain.setValueAtTime(gain, t);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter).connect(env).connect(master);
  src.start(t);
}

// One note per gesture, so you can hear which one was tapped (the gestures are public anyway).
const SIGNAL_NOTE: Record<SignalIconId, number> = { palm: 523.25, ok: 659.25, peace: 783.99, crossed: 880 };

export const sounds = {
  /** You swapped a card. */
  swap() {
    swish({ gain: 0.32 });
    tone(220, { at: 0.11, dur: 0.06, type: "triangle", gain: 0.12 });
  },
  /** Someone else swapped. Softer, so the table sounds busy without being noisy. */
  swapOther() {
    swish({ gain: 0.12, from: 2600, to: 1100, dur: 0.1 });
  },
  /** A gesture was tapped. A bright pop for yours, a softer one for others. */
  signal(icon: SignalIconId, mine: boolean) {
    const f = SIGNAL_NOTE[icon];
    tone(f, { dur: 0.16, gain: mine ? 0.3 : 0.12, slideTo: f * 0.94 });
    if (mine) tone(f * 2, { at: 0.02, dur: 0.08, gain: 0.08 });
  },
  /** You declared done for the round. */
  done() {
    tone(392, { dur: 0.1, type: "triangle", gain: 0.18 });
    tone(523.25, { at: 0.08, dur: 0.14, type: "triangle", gain: 0.18 });
  },
  /** Everyone was done: the four center cards are cleared and four new ones dealt. */
  newRound() {
    for (let i = 0; i < 4; i++) swish({ at: i * 0.07, gain: 0.18, from: 3600 - i * 300, to: 1200 });
  },
  /** A fresh hand is dealt. */
  deal() {
    for (let i = 0; i < 8; i++) swish({ at: i * 0.055, gain: 0.14, dur: 0.09 });
  },
  /** Your team won the hand (or caught the other team). */
  win() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, { at: i * 0.09, dur: 0.32, type: "triangle", gain: 0.22 }));
  },
  /** Your team took a letter. */
  lose() {
    [392, 329.63, 261.63].forEach((f, i) => tone(f, { at: i * 0.13, dur: 0.34, type: "triangle", gain: 0.2 }));
  },
  /** A hand ended with no score (Real Deal), or a hand that didn't involve your team. */
  neutral() {
    tone(440, { dur: 0.2, type: "triangle", gain: 0.16 });
    tone(440, { at: 0.16, dur: 0.24, type: "triangle", gain: 0.12 });
  },
  /** Someone shouted KENT! or COUNTER KENT! (plays before the result). */
  call() {
    tone(196, { dur: 0.18, type: "sawtooth", gain: 0.12, slideTo: 392 });
  },
  /** The match ended. */
  matchOver(won: boolean) {
    const notes = won ? [523.25, 659.25, 783.99, 1046.5, 1318.5] : [392, 349.23, 311.13, 261.63];
    notes.forEach((f, i) => tone(f, { at: i * 0.14, dur: 0.5, type: "triangle", gain: 0.2 }));
  },
};
