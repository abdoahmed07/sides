/**
 * Microphone for Recite and check: 16 kHz mono audio, split into parts at the
 * natural pauses (breaths between ayahs). Each finished part goes to
 * `onPart`; while a part is still going, `onPartial` gets it every couple of
 * seconds so words can appear before you pause.
 */
export const RATE = 16000;

/** Pause length that ends a part, and the longest part (the model handles up to 30 s). */
const PAUSE_S = 0.7;
const MAX_PART_S = 20;
const PARTIAL_EVERY_S = 2.5;

export type MicHandlers = {
  onPart: (audio: Float32Array) => void;
  onPartial: (audio: Float32Array) => void;
  /** 0–1, for a level meter. */
  onLevel?: (level: number) => void;
};

/**
 * To 16 kHz. Each output sample is the average of the input samples it
 * covers: a simple low-pass filter, so downsampling (48 kHz on most phones)
 * doesn't add the distortion that confuses the speech model.
 */
function resample(input: Float32Array, from: number): Float32Array {
  if (from === RATE) return input;
  const ratio = from / RATE;
  const out = new Float32Array(Math.floor(input.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const a = i * ratio;
    const b = Math.min(input.length, (i + 1) * ratio);
    let sum = 0;
    let n = 0;
    for (let k = Math.floor(a); k < b; k++) {
      sum += input[k];
      n++;
    }
    out[i] = n ? sum / n : 0;
  }
  return out;
}

function concat(chunks: Float32Array[]): Float32Array {
  const out = new Float32Array(chunks.reduce((s, c) => s + c.length, 0));
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

export class Mic {
  private stream: MediaStream | null = null;
  private ctx: AudioContext | null = null;
  private node: ScriptProcessorNode | null = null;
  private part: Float32Array[] = [];
  private partSamples = 0;
  private silentSamples = 0;
  private speaking = false;
  private sincePartial = 0;
  private floor = 0.01;

  constructor(private h: MicHandlers) {}

  /**
   * Call straight from the tap on "Start": the audio engine is created before
   * anything is awaited, because phones (iPhone especially) keep an audio
   * engine paused unless it starts from a tap, and then it hears only silence.
   */
  async start() {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    // The device's own sample rate (asking phones for 16 kHz is unreliable); we convert to 16 kHz ourselves.
    const ctx = new Ctx();
    this.ctx = ctx;
    const resumed = ctx.resume().catch(() => {});
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch (e) {
      void ctx.close();
      this.ctx = null;
      throw e;
    }
    await resumed;
    if (ctx.state !== "running") await ctx.resume().catch(() => {});
    const src = ctx.createMediaStreamSource(this.stream);
    // ScriptProcessor is old but works everywhere, including iPhones.
    this.node = ctx.createScriptProcessor(4096, 1, 1);
    this.node.onaudioprocess = (e) => this.feed(resample(new Float32Array(e.inputBuffer.getChannelData(0)), ctx.sampleRate));
    src.connect(this.node);
    this.node.connect(ctx.destination);
    // iPhone can pause the engine when a call or another app takes the audio; pick up again.
    ctx.onstatechange = () => {
      if (ctx.state === "suspended" || (ctx.state as string) === "interrupted") void ctx.resume().catch(() => {});
    };
  }

  /** Whether sound is actually arriving (for the on-screen check). */
  get running(): boolean {
    return this.ctx?.state === "running";
  }

  private feed(frame: Float32Array) {
    let sum = 0;
    for (const v of frame) sum += v * v;
    const rms = Math.sqrt(sum / frame.length);
    const voice = rms > Math.max(0.006, this.floor * 2.5);
    // Learn the background noise level only in the quiet moments, so a quiet room and a
    // noisy one both work, and a long stretch of reciting never starts to count as "silence".
    if (!voice) this.floor = rms < this.floor ? rms : this.floor * 0.98 + rms * 0.02;
    this.h.onLevel?.(Math.min(1, rms * 8));

    if (!this.speaking && !voice) return;
    this.speaking = true;
    this.part.push(frame);
    this.partSamples += frame.length;
    this.silentSamples = voice ? 0 : this.silentSamples + frame.length;
    this.sincePartial += frame.length;

    if (this.silentSamples >= PAUSE_S * RATE || this.partSamples >= MAX_PART_S * RATE) this.endPart();
    else if (this.sincePartial >= PARTIAL_EVERY_S * RATE) {
      this.sincePartial = 0;
      this.h.onPartial(concat(this.part));
    }
  }

  private endPart() {
    if (this.partSamples > 0.3 * RATE) this.h.onPart(concat(this.part));
    this.part = [];
    this.partSamples = 0;
    this.silentSamples = 0;
    this.sincePartial = 0;
    this.speaking = false;
  }

  /** Stops listening; whatever was being said is sent as a last part. */
  stop() {
    if (this.speaking) this.endPart();
    this.node?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    void this.ctx?.close();
    this.node = null;
    this.stream = null;
    this.ctx = null;
  }
}
