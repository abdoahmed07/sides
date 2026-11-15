import { z } from "zod";
import type { IsoDate } from "@/core/dates";
import { PlanConfigSchema, type PlanConfig } from "@/core/plan/schema";
import type { MemUnit, Strength } from "@/core/srs";

export type PlanVersion = {
  id: number;
  config: PlanConfig;
  createdAt: string;
  source: "manual" | "ai" | "checkin" | "catchup" | "revert" | "onboarding";
  note: string;
};

export type DayItem = {
  id: string;
  kind: "sabaq" | "sabqi" | "manzil";
  /** Ayah global indices (sabaq) */
  ayahs?: number[];
  /** Page (sabqi/manzil) */
  page?: number;
  lines: number;
  done: boolean;
  rating: Strength | null;
  doneAt: string | null;
  /** Units of the touched pages before this item was ticked (for undo/re-rating). */
  undo?: { page: number; unit: MemUnit | null }[] | null;
};

export type DayLog = {
  date: IsoDate;
  planVersionId: number;
  items: DayItem[];
  note: string | null;
};

export type ChatMessage = { role: "user" | "assistant"; text: string; at: string; proposalId?: string };
export type Chat = { id: string; messages: ChatMessage[]; updatedAt: string };

export type CheckinSuggestion = {
  id: string;
  title: string;
  reason: string;
  patch: unknown;
  status: "pending" | "accepted" | "dismissed";
};
export type Checkin = { id: string; date: IsoDate; summary: unknown; suggestions: CheckinSuggestion[]; message: string };

export type { MemUnit };

/* Backup format (export/import) */
const StrengthSchema = z.enum(["strong", "okay", "weak"]);
const MemUnitSchema = z.object({
  page: z.number().int().min(1).max(604),
  ayahs: z.array(z.number().int().min(0).max(6235)),
  firstMemorized: z.string(),
  lastAdded: z.string(),
  lastRevised: z.string().nullable(),
  strength: StrengthSchema.nullable(),
  intervalDays: z.number(),
  ease: z.number(),
  nextDue: z.string(),
  origin: z.enum(["plan", "prior"]),
});
export const BackupSchema = z.object({
  app: z.literal("hifz-tracker"),
  version: z.literal(1),
  exportedAt: z.string(),
  planVersions: z.array(
    z.object({
      id: z.number(),
      config: PlanConfigSchema,
      createdAt: z.string(),
      source: z.string(),
      note: z.string(),
    }),
  ),
  units: z.array(MemUnitSchema),
  dayLogs: z.array(
    z.object({
      date: z.string(),
      planVersionId: z.number(),
      items: z.array(z.any()),
      note: z.string().nullable(),
    }),
  ),
  chats: z.array(z.any()),
  checkins: z.array(z.any()),
  meta: z.array(z.object({ key: z.string(), value: z.any() })),
});
export type Backup = z.infer<typeof BackupSchema>;
