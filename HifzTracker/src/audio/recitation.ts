/**
 * Listen and repeat: which ayahs to play next, and where the audio comes from.
 * Pure, so it can be tested; the player component drives an <audio> element with it.
 *
 * Audio: one MP3 per ayah from the Islamic Network CDN (free for non-commercial
 * use, as used by alquran.cloud). Files are numbered 1–6236 in mushaf order,
 * which is our ayah index + 1.
 */
import { tx } from "@/i18n";

export type Reciter = { id: string; name: string; style: string; edition: string; bitrate: number };

export const RECITERS: Reciter[] = [
  { id: "alafasy", name: "Mishary Alafasy", style: tx("Clear and well-known"), edition: "ar.alafasy", bitrate: 128 },
  { id: "abdulbasit", name: "Abdul Basit Abdul Samad", style: tx("Classic, calm murattal"), edition: "ar.abdulbasitmurattal", bitrate: 64 },
  { id: "husary", name: "Mahmoud Khalil Al-Husary", style: tx("Slow and precise, good for memorizing"), edition: "ar.husary", bitrate: 128 },
];

export function reciterById(id: string | null | undefined): Reciter {
  return RECITERS.find((r) => r.id === id) ?? RECITERS[0];
}

export function audioUrl(reciter: Reciter, ayahIndex: number): string {
  return `https://cdn.islamic.network/quran/audio/${reciter.bitrate}/${reciter.edition}/${ayahIndex + 1}.mp3`;
}

/** listen: play straight through · repeat: one ayah, then wait · link: ayahs 1…k, then wait. */
export type Mode = "listen" | "repeat" | "link";

/**
 * The ayahs (positions in the portion) to play for this step.
 * `pos` is the current ayah; in link mode it is the last ayah of the growing run.
 */
export function segment(mode: Mode, count: number, pos: number): number[] {
  if (count === 0) return [];
  const p = Math.min(Math.max(pos, 0), count - 1);
  if (mode === "repeat") return [p];
  if (mode === "link") return Array.from({ length: p + 1 }, (_, k) => k);
  return Array.from({ length: count - p }, (_, k) => p + k);
}

/** After a step: listen stops at the end; repeat and link wait for the person (no timers). */
export function waitsAfter(mode: Mode): boolean {
  return mode !== "listen";
}

export const SPEEDS = [0.75, 1, 1.25];

/**
 * Reading order of a portion: surahs in the order they come in the portion
 * (so a plan "from the end" starts with An-Nas), each surah top to bottom.
 */
export function portionOrder(indices: number[], surahOf: ArrayLike<number>): number[] {
  const order: number[] = [];
  const bySurah = new Map<number, number[]>();
  for (const i of indices) {
    const s = surahOf[i];
    if (!bySurah.has(s)) {
      bySurah.set(s, []);
      order.push(s);
    }
    bySurah.get(s)!.push(i);
  }
  return order.flatMap((s) => [...new Set(bySurah.get(s)!)].sort((a, b) => a - b));
}
