"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { addDays, formatDate } from "@/core/dates";
import { dayIntensity } from "@/core/plan/engine";
import { gains, surahProgress, totals, weeklySummary, type Gains } from "@/core/stats";
import { useCheckins, useDayLogs, usePlan, useToday, useUnits } from "@/data/hooks";
import { repo } from "@/data/dexie";
import type { Checkin, CheckinSuggestion } from "@/data/types";
import { AI_ENABLED, askAssistant } from "@/lib/ai-client";
import { acceptPreview, forecastFor, previewChange, q } from "@/lib/app";
import type { PlanConfig, PlanPatch } from "@/core/plan/schema";
import type { MemUnit } from "@/core/srs";
import { getLang, t, tp } from "@/i18n";
import { useLang } from "@/i18n/react";
import { Button, Card, PageTitle, PrivacyNote, Spinner } from "@/components/ui";
import { PreviewTable } from "@/components/Preview";

/**
 * The week in review: what you learned and revised in the last 7 days (and how that compares with the
 * week before), what you finished, how revision went, and a word on what might help. Suggestions from
 * the assistant, where it's available.
 */
export default function CheckinPage() {
  useLang();
  const today = useToday();
  const plan = usePlan();
  const units = useUnits();
  const logs = useDayLogs();
  const checkins = useCheckins();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Seen: the reminder on Today waits for next week.
  useEffect(() => {
    void repo.setMeta("weekSeen", today);
  }, [today]);

  const from = addDays(today, -6);
  const data = useMemo(() => {
    if (!plan || !units || !logs) return null;
    let studyDays = 0;
    for (let k = 0; k < 7; k++) if (dayIntensity(plan.config, addDays(from, k)).active) studyDays++;
    return {
      week: gains(units, logs, q, from, today),
      before: gains(units, logs, q, addDays(from, -7), addDays(from, -1)),
      studyDays,
      total: totals(units, q),
      surahsDone: surahProgress(units, q).filter((s) => s.memorized === s.total).length,
      weakNow: units.filter((u) => u.strength === "weak").length,
      overdue: units.filter((u) => u.nextDue < today).length,
      forecast: forecastFor(plan.config, units, today),
      summary: weeklySummary(plan.config, logs, units, q, today),
    };
  }, [plan, units, logs, today, from]);
  const current = checkins?.find((c) => c.date === today) ?? null;

  if (plan === undefined || (plan && !data)) return null;
  if (!plan || !data) return <Card>{t("No plan yet.")}</Card>;
  const { week, before } = data;

  const run = async () => {
    setLoading(true);
    setError(null);
    const r = await askAssistant({ mode: "checkin", today, config: plan.config, summary: data.summary, language: getLang() });
    setLoading(false);
    if (!r.ok) return setError(r.error.message);
    if (r.mode !== "checkin") return;
    const c: Checkin = {
      id: `checkin-${today}`,
      date: today,
      summary: data.summary,
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

  const diff = week.ayahs - before.ayahs;
  const compare =
    before.ayahs === 0 && week.ayahs === 0
      ? null
      : diff > 0
        ? t("{n} more than last week", { n: diff })
        : diff < 0
          ? t("{n} fewer than last week", { n: -diff })
          : t("same as last week");
  const finished = [
    ...week.surahs.map((n) => q.surahName(n)),
    ...week.juz.map((n) => t("Juz {n}", { n })),
  ];

  return (
    <div className="space-y-4">
      <PageTitle
        title={t("Your week")}
        subtitle={`${formatDate(from, { day: "numeric", month: "short" })} – ${formatDate(today, { day: "numeric", month: "short" })}`}
      />

      <Card className="space-y-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Big value={`+${week.ayahs}`} label={tp({ one: "ayah learned", other: "ayahs learned" }, week.ayahs)} sub={compare} accent />
          <Big value={`+${week.pages}`} label={tp({ one: "whole page", other: "whole pages" }, week.pages)} />
          <Big value={`${week.revised}`} label={tp({ one: "page revised", other: "pages revised" }, week.revised)} />
          <Big value={`${week.days}/${data.studyDays}`} label={t("study days")} />
        </div>
        {finished.length > 0 && (
          <p className="rounded-xl bg-accent-soft px-3 py-2 text-sm">
            <span className="font-medium">{t("Finished this week:")}</span> {finished.join(" · ")}
          </p>
        )}
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold">{t("How revision went")}</h2>
        <Ratings week={week} />
        <p className="text-xs text-muted">
          {t("A page you rate weak comes back the next day, and one you rate okay after 3 days, so nothing slips.")}
          {data.weakNow > 0 && " " + tp({ one: "{n} page is weak right now.", other: "{n} pages are weak right now." }, data.weakNow)}
        </p>
      </Card>

      <Card className="space-y-2">
        <h2 className="font-semibold">{t("A word on your week")}</h2>
        <ul className="space-y-2">
          {notes(week, before, data.studyDays, data.overdue).map((n, k) => (
            <li key={k} className="flex gap-2 text-sm leading-relaxed">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
              <span>
                {n.text}
                {n.adjust && (
                  <>
                    {" "}
                    <Link href="/adjust/" className="font-medium text-accent underline-offset-2 hover:underline">
                      {t("Adjust plan")}
                    </Link>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="space-y-1">
        <h2 className="font-semibold">{t("So far")}</h2>
        <p className="text-sm">
          {[
            tp({ one: "{n} ayah", other: "{n} ayahs" }, data.total.ayahs),
            tp({ one: "{n} whole page", other: "{n} whole pages" }, data.total.fullPages),
            data.surahsDone > 0 && tp({ one: "{n} whole surah", other: "{n} whole surahs" }, data.surahsDone),
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <p className="text-xs text-muted">
          {data.forecast.done
            ? t("Everything in your target is memorized. Revision continues every day.")
            : data.forecast.completionDate
              ? t("At this pace you'll finish your target around {date}.", { date: formatDate(data.forecast.completionDate) })
              : t("With the current settings no new material is scheduled.")}
        </p>
      </Card>

      {AI_ENABLED &&
        (!current ? (
          <div className="space-y-2">
            <Button onClick={run} disabled={loading}>
              {loading ? (
                <>
                  <Spinner /> {t("Asking…")}
                </>
              ) : (
                t("Ask the assistant for suggestions")
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
            {current.suggestions.length === 0 && <p className="text-sm text-muted">{t("No changes suggested. Keep going.")}</p>}
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
        ))}
    </div>
  );
}

/** A few honest words on the week: what went well, and what might help. */
function notes(week: Gains, before: Gains, studyDays: number, overdue: number): { text: string; adjust?: boolean }[] {
  const out: { text: string; adjust?: boolean }[] = [];
  if (studyDays > 0 && week.days >= studyDays) out.push({ text: t("You didn't miss a single study day this week. Masha'Allah!") });
  else if (week.days > 0 && week.days < studyDays) out.push({ text: t("Some days were missed. Even a few minutes keeps the streak and the pages alive.") });
  if (before.ayahs > 0 && week.ayahs > before.ayahs) out.push({ text: t("You learned more than last week. Keep it up!") });
  const s = week.sabaqRatings;
  const newRated = s.strong + s.okay + s.weak;
  if (newRated >= 4 && s.strong === newRated)
    out.push({ text: t("Your new portions were strong all week. If it feels easy, you could take a little more each day."), adjust: true });
  else if (newRated >= 3 && s.weak * 2 >= newRated)
    out.push({ text: t("Many new portions felt weak. A smaller daily portion for a while can make them stick."), adjust: true });
  const r = week.ratings;
  const rated = r.strong + r.okay + r.weak;
  if (rated >= 6 && r.weak * 3 >= rated) out.push({ text: t("Quite a few pages felt weak. They come back sooner by themselves; give revision a little extra care.") });
  if (overdue > 0) out.push({ text: t("Some revision is overdue. Today's list puts it first, so nothing slips.") });
  if (!out.length) out.push({ text: t("Steady steps. A little every day is how the Quran stays with you.") });
  return out;
}

function Big({ value, label, sub, accent }: { value: string; label: string; sub?: string | null; accent?: boolean }) {
  return (
    <div>
      <p className={`text-2xl font-semibold tabular-nums ${accent ? "text-accent" : ""}`}>
        <span dir="ltr">{value}</span>
      </p>
      <p className="text-xs text-muted">{label}</p>
      {sub && <p className="mt-0.5 text-xs font-medium text-accent">{sub}</p>}
    </div>
  );
}

/** Strong, okay and weak ratings of the week, as one bar. */
function Ratings({ week }: { week: Gains }) {
  const r = week.ratings;
  const all = r.strong + r.okay + r.weak;
  if (!all) return <p className="text-sm text-muted">{t("No ratings this week yet. Rating each page after reciting it decides when it comes back.")}</p>;
  const parts = [
    { key: "strong", n: r.strong, label: t("Strong"), cls: "bg-accent" },
    { key: "okay", n: r.okay, label: t("Okay"), cls: "bg-warn" },
    { key: "weak", n: r.weak, label: t("Weak"), cls: "bg-danger" },
  ];
  return (
    <div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
        {parts.map((p) => p.n > 0 && <span key={p.key} className={p.cls} style={{ width: `${(p.n / all) * 100}%` }} />)}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {parts.map((p) => (
          <li key={p.key} className="flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-full ${p.cls}`} aria-hidden />
            {p.label} <span className="font-medium text-text tabular-nums">{p.n}</span>
          </li>
        ))}
      </ul>
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
  useLang();
  const preview = previewChange({ base: config, hasPlan: true, patch: s.patch as PlanPatch, units, today });
  return (
    <Card className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-medium">{s.title}</h3>
        {s.status !== "pending" && <span className="text-xs text-muted">{s.status === "accepted" ? t("Accepted") : t("Dismissed")}</span>}
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
                {t("Accept")}
              </Button>
              <Button
                onClick={async () => {
                  await repo.setMeta("draft", { config: preview.config, note: s.title });
                  router.push("/plan/");
                }}
              >
                {t("Edit")}
              </Button>
              <Button variant="ghost" onClick={() => onStatus("dismissed")}>
                {t("Dismiss")}
              </Button>
            </div>
          </>
        ) : (
          <p className="text-sm text-danger">{t("This suggestion no longer fits your plan ({reason}).", { reason: preview.errors[0] })}</p>
        ))}
    </Card>
  );
}
