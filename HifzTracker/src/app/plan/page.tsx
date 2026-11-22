"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { defaultConfig } from "@/core/plan/schema";
import { useMeta, usePlan, usePlanVersions, useToday, useUnits } from "@/data/hooks";
import { repo } from "@/data/dexie";
import type { PlanConfig } from "@/core/plan/schema";
import { planNoteLabel, revertTo, savePlan } from "@/lib/app";
import { locale, t, tx } from "@/i18n";
import { useLang } from "@/i18n/react";
import { AI_ENABLED } from "@/lib/ai-client";
import { PlanForm } from "@/components/PlanForm";
import { MemorizedEditor } from "@/components/MemorizedEditor";
import { Button, Card, Notice, PageTitle } from "@/components/ui";

const SOURCE_LABEL: Record<string, string> = {
  manual: tx("Edited by hand"),
  ai: tx("AI suggestion"),
  checkin: tx("Weekly check-in"),
  catchup: tx("Missed days"),
  revert: tx("Reverted"),
  onboarding: tx("First plan"),
};

export default function PlanPage() {
  const today = useToday();
  const plan = usePlan();
  const units = useUnits();
  const versions = usePlanVersions();
  const draft = useMeta<{ config: PlanConfig; note: string }>("draft");
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  useLang();
  // Re-mount the form when a different version becomes active (e.g. after a revert or an AI change).
  const formKey = `${plan?.id ?? "new"}-${draft ? JSON.stringify(draft).length : 0}`;

  if (plan === undefined || units === undefined || draft === undefined) return null;
  const isNew = plan === null;

  return (
    <div className="space-y-4">
      <PageTitle
        title={isNew ? t("Set up your plan") : t("Plan")}
        subtitle={isNew ? t("You can change everything later.") : t("Edit anything by hand. AI and manual edits change the same plan.")}
        action={
          !isNew && AI_ENABLED ? (
            <Link href="/adjust/">
              <Button>{t("Ask AI")}</Button>
            </Link>
          ) : undefined
        }
      />
      {draft && (
        <Notice tone="warn">
          {t("You're editing a suggested change. It isn't saved until you press Save.")}{" "}
          <button className="font-medium underline underline-offset-2" onClick={() => repo.setMeta("draft", null)}>
            {t("Discard it")}
          </button>
        </Notice>
      )}
      {saved && <Notice>{t("Saved. Today's plan updates if you haven't started it yet.")}</Notice>}
      <PlanForm
        key={formKey}
        initial={draft?.config ?? plan?.config ?? defaultConfig(today)}
        current={plan?.config ?? null}
        units={units}
        today={today}
        saveLabel={isNew ? t("Start this plan") : t("Save changes")}
        memorized={<MemorizedEditor bare units={units} today={today} cycleDays={plan?.config.manzilCycleDays ?? 30} />}
        onSave={async (c) => {
          // Stored in English; shown in the active language (planNoteLabel).
          const note = draft ? `Edited suggestion: ${draft.note}` : isNew ? tx("Created by hand") : tx("Edited by hand");
          await savePlan(isNew ? { ...c, startDate: today } : c, isNew ? "onboarding" : "manual", note, today);
          if (draft) await repo.setMeta("draft", null);
          if (isNew) router.push("/");
          else setSaved(true);
        }}
      />
      {versions && versions.length > 0 && (
        <Card>
          <h2 className="font-semibold">{t("History")}</h2>
          <p className="text-xs text-muted">{t("Every change is kept. Reverting creates a new version; past days stay as they were.")}</p>
          <ul className="mt-2 divide-y divide-border text-sm">
            {versions.slice(0, 30).map((v, k) => (
              <li key={v.id} className="flex items-center justify-between gap-2 py-2">
                <span>
                  <span className="font-medium">{SOURCE_LABEL[v.source] ? t(SOURCE_LABEL[v.source]) : v.source}</span>
                  <span className="text-muted"> · {new Date(v.createdAt).toLocaleString(locale(), { dateStyle: "medium", timeStyle: "short" })}</span>
                  {v.note && <span className="block text-xs text-muted">{planNoteLabel(v.note)}</span>}
                </span>
                {k === 0 ? (
                  <span className="text-xs text-accent">{t("Current")}</span>
                ) : (
                  <Button variant="ghost" className="min-h-8 px-2" onClick={() => revertTo(v, today)}>
                    {t("Revert")}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
