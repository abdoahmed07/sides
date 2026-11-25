/**
 * How loud the microphone is, for the ring around the microphone button.
 *
 * Loudness is shown on a decibel scale, the way ears hear it: a quiet voice moves the ring as
 * clearly as a loud one, and the room's background noise doesn't. (A plain amplitude barely moves
 * for a quiet voice and jumps to the top for a loud one.)
 *
 * With the phone's speech recognition the browser gives no level at all, so `LevelMeter` listens to
 * the microphone alongside it. Should that ever upset the recognition (some phones only let one thing
 * use the microphone), the app turns the meter off for that device (`meterOff`).
 */

/** 0–1 from a frame's RMS: −55 dB (a quiet room) is 0, −15 dB (speaking up close) is 1. */
export function levelOf(rms: number): number {
  if (rms <= 0) return 0;
  const db = 20 * Math.log10(rms);
  return Math.min(1, Math.max(0, (db + 55) / 40));
}

const OFF_KEY = "hifz:meterOff";

/** Whether the meter was turned off on this device because it got in the way of speech recognition. */
export function meterOff(): boolean {
  try {
    return localStorage.getItem(OFF_KEY) === "1";
  } catch {
    return false;
  }
}

export function turnMeterOff() {
  try {
    localStorage.setItem(OFF_KEY, "1");
  } catch {
    /* fine */
  }
}

export class LevelMeter {
  private stream: MediaStream | null = null;
  private ctx: AudioContext | null = null;
  private raf = 0;
  private stopped = false;

  constructor(private onLevel: (level: number) => void) {}

  async start() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    if (this.stopped) return stream.getTracks().forEach((t) => t.stop());
    this.stream = stream;
    const ctx = new AudioContext();
    this.ctx = ctx;
    await ctx.resume().catch(() => {});
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const buf = new Float32Array(analyser.fftSize);
    let shown = 0;
    const tick = () => {
      if (this.stopped) return;
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      const level = levelOf(Math.sqrt(sum / buf.length));
      // Quick to rise, slower to fall: steady to look at, but it follows each syllable.
      shown = level > shown ? shown + (level - shown) * 0.6 : shown + (level - shown) * 0.15;
      this.onLevel(shown);
      this.raf = requestAnimationFrame(tick);
    };
    tick();
  }

  stop() {
    this.stopped = true;
    cancelAnimationFrame(this.raf);
    this.stream?.getTracks().forEach((t) => t.stop());
    void this.ctx?.close().catch(() => {});
    this.stream = null;
    this.ctx = null;
  }
}
