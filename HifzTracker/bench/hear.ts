/**
 * Turns the bench's audio into text with a recognizer, once per recognizer and recitation (it picks
 * up where it left off). Kept in bench/.cache/heard/<recognizer>/<recitation>.json.
 *
 *   tsx bench/hear.ts <recognizer> [recitation]
 *
 *   apple         Apple's speech recognition, as on iPhone (Safari's phone mode): through Apple's servers
 *   apple-device  the same, on this computer
 *   tarteel       Tarteel's Quran model, as private mode runs it (whisper-tiny-ar-quran)
 *   groq          Whisper large-v3 turbo on Groq (needs GROQ_API_KEY)
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { BENCH, dir, fileOf, RECITATIONS } from "./common";
import { neededAyahs } from "./pages";

export type Heard = { text?: string; error?: string; seconds?: number };
export type HeardFile = Record<string, Heard>;

export const heardPath = (recognizer: string, folder: string) => join(dir("heard", recognizer), folder + ".json");
export const loadHeard = (recognizer: string, folder: string): HeardFile => {
  const p = heardPath(recognizer, folder);
  return existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as HeardFile) : {};
};

/** The Apple recognizer, as a small app of its own (macOS asks for permission per app). */
function appleApp(): string {
  const app = join(dir(), "Transcribe.app");
  const exe = join(app, "Contents/MacOS/transcribe");
  const src = join(BENCH, "apple/transcribe.swift");
  if (existsSync(exe) && statSync(exe).mtimeMs > statSync(src).mtimeMs) return app;
  dir("Transcribe.app", "Contents", "MacOS");
  execFileSync("swiftc", ["-O", "-o", exe, src, "-Xlinker", "-sectcreate", "-Xlinker", "__TEXT", "-Xlinker", "__info_plist", "-Xlinker", join(BENCH, "apple/Info.plist")]);
  const plist = readFileSync(join(BENCH, "apple/Info.plist"), "utf8").replace(
    "<dict>",
    "<dict>\n  <key>CFBundleExecutable</key><string>transcribe</string>\n  <key>CFBundlePackageType</key><string>APPL</string>\n  <key>LSUIElement</key><true/>",
  );
  writeFileSync(join(app, "Contents/Info.plist"), plist);
  execFileSync("codesign", ["--force", "--sign", "-", app]);
  return app;
}

function apple(files: string[], onDevice: boolean): HeardFile {
  const out = join(dir("tmp"), `apple-${process.pid}.jsonl`);
  // (macOS's launcher won't write to an output file that's already there.)
  rmSync(out, { force: true });
  rmSync(out + ".err", { force: true });
  execFileSync("open", ["-W", "-n", "--stdout", out, "--stderr", out + ".err", appleApp(), "--args", "ar-SA", ...(onDevice ? ["--on-device"] : []), ...files]);
  const got: HeardFile = {};
  for (const line of readFileSync(out, "utf8").split("\n").filter(Boolean)) {
    const r = JSON.parse(line) as { file?: string; text?: string; error?: string; seconds?: number };
    if (!r.file) throw new Error(r.error ?? line);
    got[r.file.replace(".mp3", "")] = { text: r.text, error: r.error, seconds: r.seconds };
  }
  return got;
}

/** 16 kHz mono samples of an MP3 (macOS's afconvert), for the Whisper models. */
function samples(mp3: string): Float32Array {
  const wav = join(dir("tmp"), `${process.pid}.wav`);
  execFileSync("afconvert", ["-f", "WAVE", "-d", "LEI16@16000", "-c", "1", mp3, wav]);
  const b = readFileSync(wav);
  let at = 12;
  while (at < b.length - 8 && b.toString("ascii", at, at + 4) !== "data") at += 8 + b.readUInt32LE(at + 4);
  const n = b.readUInt32LE(at + 4) / 2;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = b.readInt16LE(at + 8 + 2 * i) / 32768;
  return out;
}

type Asr = (audio: Float32Array, opts: Record<string, unknown>) => Promise<{ text: string } | { text: string }[]>;
let tarteelAsr: Promise<Asr> | null = null;
async function tarteel(mp3: string): Promise<Heard> {
  tarteelAsr ??= (async () => {
    const { pipeline, env } = await import("@huggingface/transformers");
    env.cacheDir = dir("models");
    return (await pipeline("automatic-speech-recognition", "Sharjeelbaig/whisper-tiny-ar-quran-onnx", { dtype: "q8" })) as unknown as Asr;
  })();
  const asr = await tarteelAsr;
  const t0 = Date.now();
  const out = await asr(samples(mp3), { language: "arabic", task: "transcribe", chunk_length_s: 30, stride_length_s: 5 });
  return { text: (Array.isArray(out) ? out.map((o) => o.text).join(" ") : out.text).trim(), seconds: (Date.now() - t0) / 1000 };
}

async function groq(mp3: string, key: string): Promise<Heard> {
  for (let attempt = 0; ; attempt++) {
    const form = new FormData();
    form.append("file", new Blob([readFileSync(mp3)], { type: "audio/mpeg" }), mp3.split("/").pop()!);
    form.append("model", "whisper-large-v3-turbo");
    form.append("language", "ar");
    form.append("temperature", "0");
    form.append("response_format", "json");
    const t0 = Date.now();
    const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form });
    if (res.status === 429 && attempt < 5) {
      await new Promise((r) => setTimeout(r, 1000 * Number(res.headers.get("retry-after") ?? 10)));
      continue;
    }
    if (!res.ok) return { error: `${res.status} ${(await res.text()).slice(0, 200)}` };
    return { text: ((await res.json()) as { text: string }).text.trim(), seconds: (Date.now() - t0) / 1000 };
  }
}

async function main() {
  const [recognizer, recitation = "alafasy"] = process.argv.slice(2);
  const folder = RECITATIONS[recitation] ?? recitation;
  const heard = loadHeard(recognizer, folder);
  const audio = dir("audio", folder);
  const todo = neededAyahs().map(fileOf).filter((f) => !heard[f]?.text && existsSync(join(audio, f + ".mp3")));
  const save = () => writeFileSync(heardPath(recognizer, folder), JSON.stringify(heard, null, 0));
  console.log(`${recognizer} on ${folder}: ${todo.length} to do`);
  if (recognizer === "apple" || recognizer === "apple-device") {
    for (let k = 0; k < todo.length; k += 50) {
      Object.assign(heard, apple(todo.slice(k, k + 50).map((f) => join(audio, f + ".mp3")), recognizer === "apple-device"));
      save();
      console.log(`  ${Math.min(k + 50, todo.length)}/${todo.length}`);
    }
  } else if (recognizer === "tarteel" || recognizer === "groq") {
    const key = process.env.GROQ_API_KEY;
    if (recognizer === "groq" && !key) throw new Error("Set GROQ_API_KEY (a free key from console.groq.com).");
    for (const [k, f] of todo.entries()) {
      const mp3 = join(audio, f + ".mp3");
      heard[f] = recognizer === "groq" ? await groq(mp3, key!) : await tarteel(mp3);
      if (recognizer === "groq") await new Promise((r) => setTimeout(r, 3100)); // the free tier: 20 a minute
      if (k % 25 === 24) {
        save();
        console.log(`  ${k + 1}/${todo.length}`);
      }
    }
    save();
  } else throw new Error(`unknown recognizer: ${recognizer}`);
  const errors = Object.values(heard).filter((h) => h.error).length;
  console.log(`done: ${Object.keys(heard).length} heard, ${errors} errors`);
}
if (process.argv[1]?.endsWith("hear.ts")) void main();
