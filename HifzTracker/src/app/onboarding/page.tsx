"use client";
import Link from "next/link";
import { usePlan, useToday, useUnits } from "@/data/hooks";
import { AI_ENABLED } from "@/lib/ai-client";
import { PlanChat } from "@/components/PlanChat";
import { Notice, PageTitle } from "@/components/ui";

export default function OnboardingPage() {
  const today = useToday();
  const plan = usePlan();
  const units = useUnits();
  if (plan === undefined || units === undefined) return null;
  return (
    <div className="space-y-4">
      <PageTitle
        title="Describe your goal"
        subtitle={
          <>
            The assistant proposes a plan; the app computes the schedule; you decide.{" "}
            <Link href="/plan/" className="underline underline-offset-2">
              Prefer a form?
            </Link>
          </>
        }
      />
      {plan && <Notice tone="warn">You already have a plan. Accepting a new one here replaces it (the old one stays in History).</Notice>}
      {AI_ENABLED ? (
        <PlanChat purpose={plan ? "adjust" : "create"} plan={plan} units={units} today={today} />
      ) : (
        <Notice>AI planning works when you run the app locally. Use the form instead.</Notice>
      )}
    </div>
  );
}
