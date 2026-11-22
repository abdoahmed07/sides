/**
 * The browser side of the speech model: one background worker per session,
 * loaded on demand, one transcription at a time.
 */
import type { Out } from "./worker";

let worker: Worker | null = null;
let ready: Promise<void> | null = null;
let nextId = 1;
const pending = new Map<number, { resolve: (t: string) => void; reject: (e: Error) => void }>();
const progressListeners = new Set<(loaded: number, total: number) => void>();

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
  worker.onmessage = (e: MessageEvent<Out>) => {
    const m = e.data;
    if (m.type === "progress") progressListeners.forEach((l) => l(m.loaded, m.total));
    else if (m.type === "result") {
      pending.get(m.id)?.resolve(m.text);
      pending.delete(m.id);
    } else if (m.type === "error" && m.id !== undefined) {
      pending.get(m.id)?.reject(new Error(m.message));
      pending.delete(m.id);
    }
  };
  return worker;
}

/** Downloads (first time) and starts the model. `onProgress` gets bytes loaded / total. */
export function loadModel(onProgress?: (loaded: number, total: number) => void): Promise<void> {
  if (onProgress) progressListeners.add(onProgress);
  ready ??= new Promise<void>((resolve, reject) => {
    const w = getWorker();
    const onMsg = (e: MessageEvent<Out>) => {
      if (e.data.type === "ready") {
        w.removeEventListener("message", onMsg);
        resolve();
      } else if (e.data.type === "error" && e.data.id === undefined) {
        w.removeEventListener("message", onMsg);
        ready = null;
        reject(new Error(e.data.message));
      }
    };
    w.addEventListener("message", onMsg);
    w.postMessage({ type: "load" });
  });
  return ready.finally(() => onProgress && progressListeners.delete(onProgress));
}

/** Whether the model files are already on this device (so no download is needed). */
export async function modelIsDownloaded(): Promise<boolean> {
  try {
    const cache = await caches.open("transformers-cache");
    const keys = await cache.keys();
    return keys.some((k) => k.url.includes("whisper-tiny-ar-quran-onnx") && k.url.includes("decoder_model_merged_quantized"));
  } catch {
    return false;
  }
}

/** 16 kHz mono audio → the text the model heard. */
export function transcribe(audio: Float32Array): Promise<string> {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ type: "transcribe", id, audio }, [audio.buffer]);
  });
}
