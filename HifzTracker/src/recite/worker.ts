/// <reference lib="webworker" />
/**
 * Runs Tarteel's Quran speech model (whisper-tiny-ar-quran, Apache-2.0, as an
 * ONNX conversion) in the browser, off the main thread. Audio never leaves the
 * device. The model files (~45 MB, or ~70 MB where the graphics chip is used)
 * download once and are kept in the browser's cache.
 */
import { env, pipeline, type AutomaticSpeechRecognitionPipeline } from "@huggingface/transformers";

export const MODEL = "Sharjeelbaig/whisper-tiny-ar-quran-onnx";

env.allowLocalModels = false;
env.useBrowserCache = true;

type In = { type: "load" } | { type: "transcribe"; id: number; audio: Float32Array };
/** gpu: the heavy encoder runs on the graphics chip (much faster); cpu: everything on the processor. */
export type Backend = "gpu" | "cpu";
export type Out =
  | { type: "progress"; loaded: number; total: number }
  | { type: "ready"; backend: Backend; threads: number }
  | { type: "result"; id: number; text: string }
  | { type: "error"; id?: number; message: string };

const post = (m: Out) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(m);

/**
 * On a cross-origin-isolated page the processor uses several cores (about 0.5–1 s per check), so the
 * graphics chip must be clearly quicker than that to be worth it; on one core it's 1–2.5 s.
 */
const ISOLATED = (self as unknown as { crossOriginIsolated?: boolean }).crossOriginIsolated === true;
const GPU_MAX_MS = ISOLATED ? 700 : 1500;
/** How many processor cores the model runs on (the runtime decides once it starts). */
const threads = () => (env.backends.onnx as unknown as { wasm?: { numThreads?: number } }).wasm?.numThreads ?? 1;

let asr: Promise<AutomaticSpeechRecognitionPipeline> | null = null;
let backend: Backend = "cpu";
const files = new Map<string, { loaded: number; total: number }>();

/** WebGPU (iPhone with iOS 26, recent Android and computers): worth it only if an adapter really exists. */
async function hasGpu(): Promise<boolean> {
  const gpu = (navigator as unknown as { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
  if (!gpu) return false;
  try {
    return !!(await gpu.requestAdapter());
  } catch {
    return false;
  }
}

function build(useGpu: boolean) {
  return pipeline("automatic-speech-recognition", MODEL, {
    // Whisper reads a full 30 s window every time; that encoder is the slow part, so it goes to the
    // graphics chip (full precision there). The decoder is small and stays compressed on the processor.
    dtype: useGpu ? { encoder_model: "fp32", decoder_model_merged: "q8" } : "q8",
    device: useGpu ? { encoder_model: "webgpu", decoder_model_merged: "wasm" } : "wasm",
    progress_callback: (p: { status: string; file?: string; loaded?: number; total?: number }) => {
      if (p.status !== "progress" || !p.file) return;
      files.set(p.file, { loaded: p.loaded ?? 0, total: p.total ?? 0 });
      let loaded = 0;
      let total = 0;
      for (const f of files.values()) {
        loaded += f.loaded;
        total += f.total;
      }
      post({ type: "progress", loaded, total });
    },
  }) as Promise<AutomaticSpeechRecognitionPipeline>;
}

function load() {
  asr ??= (async () => {
    if (await hasGpu()) {
      try {
        const p = await build(true);
        // Warm-up: the first run prepares the graphics chip (and some only fail when used);
        // the second shows its real speed. A weak graphics chip can be slower than the processor.
        const opts = { language: "arabic", task: "transcribe" } as const;
        await p(new Float32Array(16000), opts);
        const t0 = performance.now();
        await p(new Float32Array(16000), opts);
        if (performance.now() - t0 < GPU_MAX_MS) {
          backend = "gpu";
          return p;
        }
        await p.dispose().catch(() => {});
      } catch {
        /* fall back to the processor */
      }
    }
    backend = "cpu";
    return build(false);
  })();
  return asr;
}

self.onmessage = async (e: MessageEvent<In>) => {
  const msg = e.data;
  try {
    if (msg.type === "load") {
      await load();
      post({ type: "ready", backend, threads: threads() });
    } else {
      const run = await load();
      const out = await run(msg.audio, { language: "arabic", task: "transcribe" });
      const text = Array.isArray(out) ? out.map((o) => o.text).join(" ") : out.text;
      post({ type: "result", id: msg.id, text });
    }
  } catch (err) {
    asr = msg.type === "load" ? null : asr;
    post({ type: "error", id: msg.type === "transcribe" ? msg.id : undefined, message: (err as Error).message });
  }
};
