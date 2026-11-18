"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { defaultConfig } from "@/core/plan/schema";
import { useMeta, usePlan, usePlanVersions, useToday, useUnits } from "@/data/hooks";
import { repo } from "@/data/dexie";
import type { PlanConfig } from "@/core/plan/schema";
import { revertTo, savePlan } from "@/lib/app";
import { AI_ENABLED } from "@/lib/ai-client";
import { PlanForm } from "@/components/PlanForm";
import { MemorizedEditor } from "@/components/MemorizedEditor";
import { Button, Card, Notice, PageTitle } from "@/components/ui";

const SOURCE_LABEL: Record<string, string> = {
  manual: "Edited by hand",
  ai: "AI suggestion",
  checkin: "Weekly check-in",
  catchup: "Missed days",
  revert: "Reverted",
  onboarding: "First plan",
};

export default function PlanPage() {
  const today = useToday();
  const plan = usePlan();
  const units = useUnits();
  const versions = usePlanVersions();
  const draft = useMeta<{ config: PlanConfig; note: string }>("draft");
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  // Re-mount the form when a different version becomes active (e.g. after a revert or an AI change).
  const formKey = `${plan?.id ?? "new"}-${draft ? JSON.stringify(draft).length : 0}`;

  if (plan === undefined || units === undefined || draft === undefined) return null;
  const isNew = plan === null;

  return (
    <div className="space-y-4">
      <PageTitle
        title={isNew ? "Set up your plan" : "Plan"}
        subtitle={isNew ? "You can change everything later." : "Edit anything by hand. AI and manual edits change the same plan."}
        action={
          !isNew && AI_ENABLED ? (
            <Link href="/adjust/">
              <Button>Ask AI</Button>
            </Link>
          ) : undefined
        }
      />
      {draft && (
        <Notice tone="warn">
          You&apos;re editing a suggested change. It isn&apos;t saved until you press Save.{" "}
          <button className="font-medium underline underline-offset-2" onClick={() => repo.setMeta("draft", null)}>
            Discard it
          </button>
        </Notice>
      )}
      {saved && <Notice>Saved. Today&apos;s plan updates if you haven&apos;t started it yet.</Notice>}
      <PlanForm
        key={formKey}
        initial={draft?.config ?? plan?.config ?? defaultConfig(today)}
        current={plan?.config ?? null}
        units={units}
        today={today}
        saveLabel={isNew ? "Start this plan" : "Save changes"}
        memorized={<MemorizedEditor bare units={units} today={today} cycleDays={plan?.config.manzilCycleDays ?? 30} />}
        onSave={async (c) => {
          const note = draft ? `Edited suggestion: ${draft.note}` : isNew ? "Created by hand" : "Edited by hand";
          await savePlan(isNew ? { ...c, startDate: today } : c, isNew ? "onboarding" : "manual", note, today);
          if (draft) await repo.setMeta("draft", null);
          if (isNew) router.push("/");
          else setSaved(true);
        }}
      />
      {versions && versions.length > 0 && (
        <Card>
          <h2 className="font-semibold">History</h2>
          <p className="text-xs text-muted">Every change is kept. Reverting creates a new version; past days stay as they were.</p>
          <ul className="mt-2 divide-y divide-border text-sm">
            {versions.slice(0, 30).map((v, k) => (
              <li key={v.id} className="flex items-center justify-between gap-2 py-2">
                <span>
                  <span className="font-medium">{SOURCE_LABEL[v.source] ?? v.source}</span>
                  <span className="text-muted"> · {new Date(v.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</span>
                  {v.note && <span className="block text-xs text-muted">{v.note}</span>}
                </span>
                {k === 0 ? (
                  <span className="text-xs text-accent">Current</span>
                ) : (
                  <Button variant="ghost" className="min-h-8 px-2" onClick={() => revertTo(v, today)}>
                    Revert
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
