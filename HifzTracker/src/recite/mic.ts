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

function resample(input: Float32Array, from: number): Float32Array {
  if (from === RATE) return input;
  const ratio = from / RATE;
  const out = new Float32Array(Math.floor(input.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const x = i * ratio;
    const k = Math.floor(x);
    out[i] = input[k] + (input[Math.min(k + 1, input.length - 1)] - input[k]) * (x - k);
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

  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    try {
      this.ctx = new Ctx({ sampleRate: RATE });
    } catch {
      this.ctx = new Ctx();
    }
    const src = this.ctx.createMediaStreamSource(this.stream);
    // ScriptProcessor is old but works everywhere, including iPhones.
    this.node = this.ctx.createScriptProcessor(4096, 1, 1);
    this.node.onaudioprocess = (e) => this.feed(resample(new Float32Array(e.inputBuffer.getChannelData(0)), this.ctx!.sampleRate));
    src.connect(this.node);
    this.node.connect(this.ctx.destination);
  }

  private feed(frame: Float32Array) {
    let sum = 0;
    for (const v of frame) sum += v * v;
    const rms = Math.sqrt(sum / frame.length);
    // Follow the background noise level, so a quiet room and a noisy one both work.
    this.floor = rms < this.floor ? rms : this.floor * 0.995 + rms * 0.005;
    const voice = rms > Math.max(0.012, this.floor * 3);
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
