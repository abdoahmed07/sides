/**
 * A word of encouragement for a finished day: an ayah about the Quran and remembering it, one a
 * day in turn. The Arabic comes from the mushaf text the app already has; the meaning is a short
 * rendering in the reader's language (none in Arabic, where the ayah speaks for itself).
 */
import { diffDays, type IsoDate } from "@/core/dates";
import { tx } from "@/i18n";

export const AYAHS: { surah: number; ayah: number; meaning: string }[] = [
  { surah: 54, ayah: 17, meaning: tx("We have made the Quran easy to remember. So is there anyone who will take heed?") },
  { surah: 15, ayah: 9, meaning: tx("It is We who sent down the Reminder, and it is We who will preserve it.") },
  {
    surah: 13,
    ayah: 28,
    meaning: tx("Those who believe and whose hearts find peace in the remembrance of Allah. Truly, in the remembrance of Allah hearts find peace."),
  },
  { surah: 2, ayah: 152, meaning: tx("So remember Me, and I will remember you. Be grateful to Me, and do not be ungrateful.") },
  { surah: 94, ayah: 5, meaning: tx("Surely, with hardship comes ease.") },
  {
    surah: 38,
    ayah: 29,
    meaning: tx("A blessed Book We have sent down to you, so that they reflect on its verses and people of understanding take heed."),
  },
  { surah: 2, ayah: 2, meaning: tx("This is the Book in which there is no doubt, a guidance for those mindful of Allah.") },
];

/** The ayah for a day: a different one each day, in turn. */
export function ayahOfDay(date: IsoDate) {
  const n = diffDays("2026-01-01", date);
  return AYAHS[((n % AYAHS.length) + AYAHS.length) % AYAHS.length];
}
