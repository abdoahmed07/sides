"use client";
import Link from "next/link";
import { usePlan, useToday, useUnits } from "@/data/hooks";
import { AI_ENABLED } from "@/lib/ai-client";
import { PlanChat } from "@/components/PlanChat";
import { Button, Card, Notice, PageTitle } from "@/components/ui";

export default function AdjustPage() {
  const today = useToday();
  const plan = usePlan();
  const units = useUnits();
  if (plan === undefined || units === undefined) return null;
  if (!plan)
    return (
      <Card>
        <p className="text-sm">
          There&apos;s no plan yet. <Link href="/" className="underline">Create one first.</Link>
        </p>
      </Card>
    );
  return (
    <div className="space-y-4">
      <PageTitle
        title="Adjust plan"
        subtitle="Changes affect future days only. Nothing changes until you accept."
        action={
          <Link href="/plan/">
            <Button variant="ghost">Edit by hand</Button>
          </Link>
        }
      />
      {AI_ENABLED ? (
        <PlanChat purpose="adjust" plan={plan} units={units} today={today} />
      ) : (
        <Notice>
          Chatting with the assistant works when you run the app on your computer. Here you can{" "}
          <Link href="/plan/" className="font-medium underline">
            edit the plan by hand
          </Link>
          .
        </Notice>
      )}
    </div>
  );
}
