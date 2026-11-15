"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { weeklySummary } from "@/core/stats";
import { useCheckins, useDayLogs, usePlan, useToday, useUnits } from "@/data/hooks";
import { repo } from "@/data/dexie";
import type { Checkin, CheckinSuggestion } from "@/data/types";
import { AI_ENABLED, askAssistant } from "@/lib/ai-client";
import { acceptPreview, previewChange, q } from "@/lib/app";
import type { PlanConfig, PlanPatch } from "@/core/plan/schema";
import type { MemUnit } from "@/core/srs";
import { Button, Card, Notice, PageTitle, PrivacyNote, Spinner } from "@/components/ui";
import { PreviewTable } from "@/components/Preview";

export default function CheckinPage() {
  const today = useToday();
  const plan = usePlan();
  const units = useUnits();
  const logs = useDayLogs();
  const checkins = useCheckins();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const summary = useMemo(
    () => (plan && units && logs ? weeklySummary(plan.config, logs, units, q, today) : null),
    [plan, units, logs, today],
  );
  const current = checkins?.find((c) => c.date === today) ?? null;

  if (plan === undefined || !summary) return null;
  if (!plan) return <Card>No plan yet.</Card>;

  const run = async () => {
    setLoading(true);
    setError(null);
    const r = await askAssistant({ mode: "checkin", today, config: plan.config, summary });
    setLoading(false);
    if (!r.ok) return setError(r.error.message);
    if (r.mode !== "checkin") return;
    const c: Checkin = {
      id: `checkin-${today}`,
      date: today,
      summary,
      message: r.reply.message,
      suggestions: r.reply.suggestions.map((s, k) => ({
        id: `s${k}`,
        title: s.title,
        reason: s.reason,
        patch: s.patch,
        status: "pending",
      })),
    };
    await repo.putCheckin(c);
    await repo.setMeta("lastCheckin", today);
  };

  const setStatus = async (c: Checkin, id: string, status: CheckinSuggestion["status"]) => {
    await repo.putCheckin({ ...c, suggestions: c.suggestions.map((s) => (s.id === id ? { ...s, status } : s)) });
  };

  return (
    <div className="space-y-4">
      <PageTitle title="Weekly check-in" subtitle="A look at the last 7 days, with up to 3 suggestions you can take or leave." />
      <Card>
        <h2 className="mb-2 font-semibold">This week</h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
          <Stat label="Active days" value={`${summary.activeDays}/${summary.scheduledDays}`} />
          <Stat label="Items done" value={`${summary.completionRate}%`} />
          <Stat label="Streak" value={`${summary.currentStreak}`} />
          <Stat label="Strong / okay / weak" value={`${summary.ratings.strong} / ${summary.ratings.okay} / ${summary.ratings.weak}`} />
          <Stat label="Overdue pages" value={`${summary.overduePages}`} />
          <Stat label="Weak pages" value={`${summary.weakPages}`} />
        </dl>
      </Card>

      {!AI_ENABLED ? (
        <Notice>
          Check-in suggestions come from the AI, which works when the app runs locally. You can always{" "}
          <Link href="/plan/" className="underline">
            adjust the plan by hand
          </Link>
          .
        </Notice>
      ) : !current ? (
        <div className="space-y-2">
          <Button variant="primary" onClick={run} disabled={loading}>
            {loading ? (
              <>
                <Spinner /> Asking…
              </>
            ) : (
              "Get suggestions"
            )}
          </Button>
          {error && <p className="rounded-xl bg-danger-soft px-3 py-2 text-sm">{error}</p>}
          <PrivacyNote />
        </div>
      ) : (
        <>
          <Card>
            <p className="text-sm leading-relaxed">{current.message}</p>
          </Card>
          {current.suggestions.length === 0 && <p className="text-sm text-muted">No changes suggested. Keep going.</p>}
          {current.suggestions.map((s) => (
            <SuggestionCard
              key={s.id}
              s={s}
              config={plan.config}
              units={units!}
              today={today}
              onStatus={(st) => setStatus(current, s.id, st)}
            />
          ))}
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function SuggestionCard({
  s,
  config,
  units,
  today,
  onStatus,
}: {
  s: CheckinSuggestion;
  config: PlanConfig;
  units: MemUnit[];
  today: string;
  onStatus: (st: CheckinSuggestion["status"]) => Promise<void>;
}) {
  const router = useRouter();
  const preview = previewChange({ base: config, hasPlan: true, patch: s.patch as PlanPatch, units, today });
  return (
    <Card className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-medium">{s.title}</h3>
        {s.status !== "pending" && <span className="text-xs text-muted">{s.status === "accepted" ? "Accepted" : "Dismissed"}</span>}
      </div>
      <p className="text-sm text-muted">{s.reason}</p>
      {s.status === "pending" &&
        (preview.ok ? (
          <>
            <PreviewTable before={preview.before} after={preview.after} />
            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                onClick={async () => {
                  await acceptPreview(preview, "checkin", s.title, today);
                  await onStatus("accepted");
                }}
              >
                Accept
              </Button>
              <Button
                onClick={async () => {
                  await repo.setMeta("draft", { config: preview.config, note: s.title });
                  router.push("/plan/");
                }}
              >
                Edit
              </Button>
              <Button variant="ghost" onClick={() => onStatus("dismissed")}>
                Dismiss
              </Button>
            </div>
          </>
        ) : (
          <p className="text-sm text-danger">This suggestion no longer fits your plan ({preview.errors[0]}).</p>
        ))}
    </Card>
  );
}
