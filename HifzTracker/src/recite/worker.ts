/// <reference lib="webworker" />
/**
 * Runs Tarteel's Quran speech model (whisper-tiny-ar-quran, Apache-2.0, as an
 * ONNX conversion) in the browser, off the main thread. Audio never leaves the
 * device. The model files (~45 MB, compressed) download once and are kept in
 * the browser's cache.
 */
import { env, pipeline, type AutomaticSpeechRecognitionPipeline } from "@huggingface/transformers";

export const MODEL = "Sharjeelbaig/whisper-tiny-ar-quran-onnx";

env.allowLocalModels = false;
env.useBrowserCache = true;

type In = { type: "load" } | { type: "transcribe"; id: number; audio: Float32Array };
export type Out =
  | { type: "progress"; loaded: number; total: number }
  | { type: "ready" }
  | { type: "result"; id: number; text: string }
  | { type: "error"; id?: number; message: string };

const post = (m: Out) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(m);

let asr: Promise<AutomaticSpeechRecognitionPipeline> | null = null;
const files = new Map<string, { loaded: number; total: number }>();

function load() {
  asr ??= pipeline("automatic-speech-recognition", MODEL, {
    dtype: "q8",
    device: "wasm",
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
  return asr;
}

self.onmessage = async (e: MessageEvent<In>) => {
  const msg = e.data;
  try {
    if (msg.type === "load") {
      await load();
      post({ type: "ready" });
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
