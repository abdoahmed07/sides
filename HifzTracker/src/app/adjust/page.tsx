"use client";
import Link from "next/link";
import { usePlan, useToday, useUnits } from "@/data/hooks";
import { AI_ENABLED } from "@/lib/ai-client";
import { PlanChat } from "@/components/PlanChat";
import { Button, Card, Notice, PageTitle } from "@/components/ui";
import { t } from "@/i18n";
import { useLang } from "@/i18n/react";
import { Rich } from "@/components/Language";

export default function AdjustPage() {
  useLang();
  const today = useToday();
  const plan = usePlan();
  const units = useUnits();
  if (plan === undefined || units === undefined) return null;
  if (!plan)
    return (
      <Card>
        <p className="text-sm">
          {t("There's no plan yet.")}{" "}
          <Link href="/" className="underline">
            {t("Create one first.")}
          </Link>
        </p>
      </Card>
    );
  return (
    <div className="space-y-4">
      <PageTitle
        title={t("Adjust plan")}
        subtitle={t("Changes affect future days only. Nothing changes until you accept.")}
        action={
          <Link href="/plan/">
            <Button variant="ghost">{t("Edit by hand")}</Button>
          </Link>
        }
      />
      {AI_ENABLED ? (
        <PlanChat purpose="adjust" plan={plan} units={units} today={today} />
      ) : (
        <Notice>
          <Rich text={t("Chatting with the assistant works when you run the app on your computer. Here you can [edit the plan by hand](/plan/).")} />
        </Notice>
      )}
    </div>
  );
}
