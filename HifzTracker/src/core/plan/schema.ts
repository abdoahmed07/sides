/**
 * PlanConfig: the single source of truth for a memorization plan. Manual
 * edits and AI proposals both produce a PlanConfig (or a PlanPatch applied to
 * one); the deterministic engine turns it into a schedule.
 *
 * Every number is bounded so out-of-range or malicious values fail validation.
 */
import { z } from "zod";
import { isIsoDate, WEEKDAYS } from "../dates";
import { SURAH_AYAH_COUNTS } from "../quran";

export const IsoDateSchema = z.string().refine(isIsoDate, "Must be a real date in YYYY-MM-DD format");
export const WeekdaySchema = z.enum(WEEKDAYS);

export const TargetSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("quran") }).strict(),
  z.object({ type: z.literal("juz"), juz: z.array(z.number().int().min(1).max(30)).min(1).max(30) }).strict(),
  z.object({ type: z.literal("surah"), surahs: z.array(z.number().int().min(1).max(114)).min(1).max(114) }).strict(),
  z
    .object({ type: z.literal("pages"), from: z.number().int().min(1).max(604), to: z.number().int().min(1).max(604) })
    .strict()
    .refine((t) => t.from <= t.to, "Page range must go from low to high"),
]);
export type Target = z.infer<typeof TargetSchema>;

export const AyahRefSchema = z
  .object({ surah: z.number().int().min(1).max(114), ayah: z.number().int().min(1).max(286) })
  .strict()
  .refine((r) => r.ayah <= SURAH_AYAH_COUNTS[r.surah - 1], "That surah does not have this many ayahs");

export const EXCEPTION_KINDS = ["travel", "exams", "ramadan", "rest", "light", "catchup"] as const;
export const ExceptionKindSchema = z.enum(EXCEPTION_KINDS);
export const RevisionLevelSchema = z.enum(["normal", "light", "none", "extra"]);
export type RevisionLevel = z.infer<typeof RevisionLevelSchema>;

/** Defaults per exception kind (used when the exception does not override them). */
export const EXCEPTION_DEFAULTS: Record<z.infer<typeof ExceptionKindSchema>, { newMultiplier: number; revision: RevisionLevel; label: string }> = {
  travel: { newMultiplier: 0, revision: "light", label: "Travel" },
  exams: { newMultiplier: 0.5, revision: "light", label: "Exams" },
  ramadan: { newMultiplier: 0.5, revision: "normal", label: "Ramadan" },
  rest: { newMultiplier: 0, revision: "none", label: "Rest" },
  light: { newMultiplier: 0.5, revision: "normal", label: "Lighter day" },
  catchup: { newMultiplier: 0, revision: "extra", label: "Catch-up" },
};

const ExceptionBody = {
  from: IsoDateSchema,
  to: IsoDateSchema,
  kind: ExceptionKindSchema,
  newMultiplier: z.number().min(0).max(2).optional(),
  revision: RevisionLevelSchema.optional(),
  note: z.string().max(120).optional(),
};
const spanOk = (e: { from: string; to: string }) =>
  e.from <= e.to && (Date.parse(e.to) - Date.parse(e.from)) / 86_400_000 <= 366;

export const DateExceptionSchema = z
  .object({ id: z.string().min(1).max(40), ...ExceptionBody })
  .strict()
  .refine(spanOk, "Exception must end on/after it starts and last at most a year");
export type DateException = z.infer<typeof DateExceptionSchema>;

export const NewExceptionSchema = z.object(ExceptionBody).strict().refine(spanOk, "Exception must end on/after it starts and last at most a year");
export type NewException = z.infer<typeof NewExceptionSchema>;

export const WeekdayOverrideSchema = z
  .object({ newMultiplier: z.number().min(0).max(2), revisionOnly: z.boolean().optional() })
  .strict();

/** A surah to read (not memorize) every week on a given day, e.g. Al-Kahf on Fridays. */
export const WeeklyReadingSchema = z.object({ day: WeekdaySchema, surah: z.number().int().min(1).max(114) }).strict();
export type WeeklyReading = z.infer<typeof WeeklyReadingSchema>;
const WeeklyReadingsSchema = z
  .array(WeeklyReadingSchema)
  .max(14)
  .refine((r) => new Set(r.map((x) => `${x.day}-${x.surah}`)).size === r.length, "Each reading is listed once");

export const ExperienceSchema = z.enum(["beginner", "intermediate", "advanced"]);
export type Experience = z.infer<typeof ExperienceSchema>;

export const PaceSchema = z
  .object({
    minutesPerNewLine: z.number().min(0.5).max(20),
    minutesPerRevisionPage: z.number().min(0.5).max(15),
  })
  .strict();

export const PlanConfigSchema = z
  .object({
    version: z.literal(1),
    target: TargetSchema,
    start: AyahRefSchema,
    direction: z.enum(["forward", "backward"]),
    startDate: IsoDateSchema,
    dailyNewLines: z.number().int().min(1).max(45),
    studyWeekdays: z.array(WeekdaySchema).min(1).max(7).refine((d) => new Set(d).size === d.length, "Weekdays must be unique"),
    weekdayOverrides: z.partialRecord(WeekdaySchema, WeekdayOverrideSchema),
    sabqiWindowDays: z.number().int().min(1).max(30),
    manzilCycleDays: z.number().int().min(7).max(120),
    targetFinishDate: IsoDateSchema.nullable(),
    dailyMinutesBudget: z.number().int().min(5).max(600).nullable(),
    exceptions: z.array(DateExceptionSchema).max(60),
    experience: ExperienceSchema,
    pace: PaceSchema,
    pauseNewUntilCaughtUp: z.boolean(),
    /** Optional so plans saved before this field existed stay valid. */
    weeklyReadings: WeeklyReadingsSchema.optional(),
  })
  .strict();
export type PlanConfig = z.infer<typeof PlanConfigSchema>;

export const readingsOf = (c: Pick<PlanConfig, "weeklyReadings">): WeeklyReading[] => c.weeklyReadings ?? [];

export const PACE_BY_EXPERIENCE: Record<Experience, z.infer<typeof PaceSchema>> = {
  beginner: { minutesPerNewLine: 6, minutesPerRevisionPage: 4 },
  intermediate: { minutesPerNewLine: 4, minutesPerRevisionPage: 3 },
  advanced: { minutesPerNewLine: 3, minutesPerRevisionPage: 2 },
};

export function defaultConfig(today: string): PlanConfig {
  return {
    version: 1,
    target: { type: "juz", juz: [30] },
    start: { surah: 114, ayah: 1 },
    direction: "backward",
    startDate: today,
    dailyNewLines: 5,
    studyWeekdays: ["sat", "sun", "mon", "tue", "wed", "thu"],
    weekdayOverrides: {},
    sabqiWindowDays: 7,
    manzilCycleDays: 30,
    targetFinishDate: null,
    dailyMinutesBudget: null,
    exceptions: [],
    experience: "beginner",
    pace: PACE_BY_EXPERIENCE.beginner,
    pauseNewUntilCaughtUp: false,
  };
}

/* ------------------------------------------------------------------ */
/* Patches: what AI proposals (and some UI actions) produce.            */
/* ------------------------------------------------------------------ */

export const PlanPatchSchema = z
  .object({
    set: z
      .object({
        target: TargetSchema.optional(),
        start: AyahRefSchema.optional(),
        direction: z.enum(["forward", "backward"]).optional(),
        dailyNewLines: z.number().int().min(1).max(45).optional(),
        studyWeekdays: z.array(WeekdaySchema).min(1).max(7).optional(),
        sabqiWindowDays: z.number().int().min(1).max(30).optional(),
        manzilCycleDays: z.number().int().min(7).max(120).optional(),
        /** A date, or "none" to clear the target date. */
        targetFinishDate: z.union([IsoDateSchema, z.literal("none")]).optional(),
        /** Minutes, or 0 to clear the budget. */
        dailyMinutesBudget: z.number().int().min(0).max(600).optional(),
        experience: ExperienceSchema.optional(),
        minutesPerNewLine: z.number().min(0.5).max(20).optional(),
        minutesPerRevisionPage: z.number().min(0.5).max(15).optional(),
        pauseNewUntilCaughtUp: z.boolean().optional(),
        /** The full list of weekly readings (replaces the current one; [] removes all). */
        weeklyReadings: WeeklyReadingsSchema.optional(),
      })
      .strict()
      .optional(),
    weekdayOverrides: z
      .array(
        z
          .object({
            day: WeekdaySchema,
            newMultiplier: z.number().min(0).max(2).optional(),
            revisionOnly: z.boolean().optional(),
            remove: z.boolean().optional(),
          })
          .strict(),
      )
      .max(7)
      .optional(),
    addExceptions: z.array(NewExceptionSchema).max(10).optional(),
    removeExceptionIds: z.array(z.string().max(40)).max(20).optional(),
  })
  .strict();
export type PlanPatch = z.infer<typeof PlanPatchSchema>;

/* ------------------------------------------------------------------ */
/* Selections of already-memorized material.                           */
/* ------------------------------------------------------------------ */

export const MemorizedSelectionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("surah"), surahs: z.array(z.number().int().min(1).max(114)).min(1).max(114) }).strict(),
  z.object({ type: z.literal("juz"), juz: z.array(z.number().int().min(1).max(30)).min(1).max(30) }).strict(),
  z
    .object({ type: z.literal("pages"), from: z.number().int().min(1).max(604), to: z.number().int().min(1).max(604) })
    .strict()
    .refine((s) => s.from <= s.to, "Page range must go from low to high"),
  z
    .object({
      type: z.literal("ayahs"),
      surah: z.number().int().min(1).max(114),
      from: z.number().int().min(1).max(286),
      to: z.number().int().min(1).max(286),
    })
    .strict()
    .refine((s) => s.from <= s.to && s.to <= SURAH_AYAH_COUNTS[s.surah - 1], "Ayah range is not valid for that surah"),
]);
export type MemorizedSelection = z.infer<typeof MemorizedSelectionSchema>;
