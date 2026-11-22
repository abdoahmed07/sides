"use client";
import { useState } from "react";
import type { IsoDate } from "@/core/dates";
import type { MemorizedSelection } from "@/core/plan/schema";
import type { MemUnit } from "@/core/srs";
import { pagesLabel, totals } from "@/core/stats";
import { markMemorized, q, unmarkMemorized } from "@/lib/app";
import { parseNumberList } from "./PlanForm";
import { Button, Card, Field, inputCls } from "./ui";
import { t } from "@/i18n";
import { useLang } from "@/i18n/react";

type Kind = MemorizedSelection["type"];

export function MemorizedEditor({
  units,
  today,
  cycleDays,
  bare = false,
}: {
  units: MemUnit[];
  today: IsoDate;
  cycleDays: number;
  /** Without its own card and heading, for use inside the plan form. */
  bare?: boolean;
}) {
  useLang();
  const [kind, setKind] = useState<Kind>("surah");
  const [list, setList] = useState("");
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(1);
  const [surah, setSurah] = useState(1);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const tot = totals(units, q);

  const selection = (): MemorizedSelection | null => {
    if (kind === "surah") {
      const surahs = parseNumberList(list, 1, 114);
      return surahs.length ? { type: "surah", surahs } : null;
    }
    if (kind === "juz") {
      const juz = parseNumberList(list, 1, 30);
      return juz.length ? { type: "juz", juz } : null;
    }
    if (kind === "pages") return from <= to ? { type: "pages", from, to } : null;
    const max = q.surah(surah).ayahs;
    return from <= to && to <= max ? { type: "ayahs", surah, from, to } : null;
  };

  const run = async (mark: boolean) => {
    const s = selection();
    if (!s) return setMsg(t("Please check the numbers."));
    setBusy(true);
    try {
      if (mark) await markMemorized([s], today, cycleDays);
      else await unmarkMemorized([s], today);
      setMsg(mark ? t("Marked as memorized. Its revision is spread over your manzil cycle.") : t("Removed."));
    } finally {
      setBusy(false);
    }
  };

  const status = units.length ? t("You know {pages} so far.", { pages: pagesLabel(tot.fullPages, tot.partialPages) }) : t("Nothing marked yet.");
  const body = (
    <>
      <div className="grid gap-2 sm:grid-cols-[10rem_1fr]">
        <Field label={t("By")}>
          <select className={inputCls} value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
            <option value="surah">{t("Surah")}</option>
            <option value="juz">{t("Juz")}</option>
            <option value="pages">{t("Page range")}</option>
            <option value="ayahs">{t("Ayah range")}</option>
          </select>
        </Field>
        {kind === "surah" || kind === "juz" ? (
          <Field label={kind === "surah" ? t("Surah numbers") : t("Juz numbers")} hint={t("e.g. 1, 78-114")}>
            <input className={inputCls} value={list} onChange={(e) => setList(e.target.value)} />
          </Field>
        ) : (
          <div className="grid grid-cols-[1fr_5rem_5rem] gap-2">
            {kind === "ayahs" ? (
              <Field label={t("Surah")}>
                <select className={inputCls} value={surah} onChange={(e) => setSurah(+e.target.value)}>
                  {q.surahs.map((s) => (
                    <option key={s.n} value={s.n}>
                      {s.n}. {q.surahName(s.n)}
                    </option>
                  ))}
                </select>
              </Field>
            ) : (
              <span />
            )}
            <Field label={t("From")}>
              <input type="number" min={1} className={inputCls} value={from} onChange={(e) => setFrom(+e.target.value)} />
            </Field>
            <Field label={t("To")}>
              <input type="number" min={1} className={inputCls} value={to} onChange={(e) => setTo(+e.target.value)} />
            </Field>
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <Button variant="primary" disabled={busy} onClick={() => run(true)}>
          {t("Mark memorized")}
        </Button>
        <Button variant="ghost" disabled={busy} onClick={() => run(false)}>
          {t("Unmark")}
        </Button>
      </div>
      {msg && <p className="text-sm text-muted">{msg}</p>}
    </>
  );

  if (bare)
    return (
      <div className="space-y-2.5">
        <p className="text-sm text-muted">
          {status} {t("It goes into revision instead of being scheduled as new.")}
        </p>
        <details className="space-y-3 text-sm">
          <summary className="cursor-pointer text-accent">{t("Mark something I already know")}</summary>
          <div className="mt-3 space-y-3">{body}</div>
        </details>
      </div>
    );

  return (
    <Card className="space-y-3">
      <div>
        <h2 className="font-semibold">{t("Already memorized")}</h2>
        <p className="text-xs text-muted">
          {status} {t("Mark what you knew before starting so it joins your revision and isn't scheduled as new.")}
        </p>
      </div>
      {body}
    </Card>
  );
}
