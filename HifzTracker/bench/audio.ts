/**
 * Downloads the recitation audio the bench needs (one MP3 per ayah, from EveryAyah), once.
 *   tsx bench/audio.ts [recitation…]      (default: alafasy)
 */
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { dir, fileOf, RECITATIONS } from "./common";
import { neededAyahs } from "./pages";

async function download(folder: string, ayahs: number[]) {
  const into = dir("audio", folder);
  const todo = ayahs.filter((a) => !existsSync(join(into, fileOf(a) + ".mp3")));
  let done = 0;
  let failed = 0;
  const next = async (): Promise<void> => {
    const a = todo.shift();
    if (a === undefined) return;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(`https://everyayah.com/data/${folder}/${fileOf(a)}.mp3`);
        if (!res.ok) throw new Error(String(res.status));
        writeFileSync(join(into, fileOf(a) + ".mp3"), Buffer.from(await res.arrayBuffer()));
        done++;
        break;
      } catch (e) {
        if (attempt === 2) {
          failed++;
          console.error(`${folder}/${fileOf(a)}: ${(e as Error).message}`);
        }
      }
    }
    if ((done + failed) % 100 === 0) console.log(`${folder}: ${done} downloaded`);
    return next();
  };
  await Promise.all(Array.from({ length: 6 }, next));
  console.log(`${folder}: ${done} downloaded, ${failed} failed, ${ayahs.length - todo.length - done - failed} already here`);
}

async function main() {
  const which = process.argv.slice(2);
  for (const r of which.length ? which : ["alafasy"]) await download(RECITATIONS[r] ?? r, neededAyahs());
}
if (process.argv[1]?.endsWith("audio.ts")) void main();
