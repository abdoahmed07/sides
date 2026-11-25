"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { BackupSchema } from "@/data/types";
import { repo } from "@/data/dexie";
import { usePlan } from "@/data/hooks";
import { AI_ENABLED } from "@/lib/ai-client";
import { Button, Card, Notice, PageTitle } from "@/components/ui";
import { AccountCard, useSyncStatus } from "@/components/Account";
import { deleteAccount } from "@/sync/sync";
import { InstallCard } from "@/components/InstallCard";
import { LanguagePicker, Rich } from "@/components/Language";
import { t, tx } from "@/i18n";
import { useLang } from "@/i18n/react";

type Theme = "system" | "light" | "dark";

const themeListeners = new Set<() => void>();
function readTheme(): Theme {
  try {
    return (localStorage.getItem("hifz:theme") as Theme) || "system";
  } catch {
    return "system";
  }
}
function subscribeTheme(cb: () => void) {
  themeListeners.add(cb);
  return () => themeListeners.delete(cb);
}

function applyTheme(t: Theme) {
  try {
    localStorage.setItem("hifz:theme", t);
  } catch {}
  const dark = t === "dark" || (t === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  themeListeners.forEach((l) => l());
}

const THEMES: { value: Theme; label: string }[] = [
  { value: "system", label: tx("Same as device") },
  { value: "light", label: tx("Light") },
  { value: "dark", label: tx("Dark") },
];

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <Card className="space-y-3">
      <div>
        <h2 className="font-semibold">{t(title)}</h2>
        {hint && <p className="text-sm text-muted">{t(hint)}</p>}
      </div>
      {children}
    </Card>
  );
}

export default function SettingsPage() {
  const plan = usePlan();
  const sync = useSyncStatus();
  const signedIn = sync.email !== null && sync.phase !== "signed-out";
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => "system" as Theme);
  const [msg, setMsg] = useState<{ tone: "info" | "danger"; text: string } | null>(null);
  const [aiStatus, setAiStatus] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<"data" | "account" | null>(null);
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  useLang();

  // Setup details for whoever runs the app; regular users never see this.
  useEffect(() => {
    if (AI_ENABLED && process.env.NODE_ENV !== "production")
      fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/plan-assistant`)
        .then((r) => r.json())
        .then((j) => setAiStatus(j.configured ? `Connected (model: ${j.model})` : "No API key: add ANTHROPIC_API_KEY to .env.local"))
        .catch(() => setAiStatus("Not reachable"));
  }, []);

  const exportData = async () => {
    const data = await repo.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `hifz-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importData = async (f: File) => {
    try {
      const parsed = BackupSchema.safeParse(JSON.parse(await f.text()));
      if (!parsed.success) throw new Error(t("This file isn't a Hifz Tracker backup."));
      const date = parsed.data.exportedAt.slice(0, 10);
      const ask = signedIn
        ? t("Replace everything on this device and in your account with this backup from {date}? This can't be undone.", { date })
        : t("Replace everything on this device with this backup from {date}? This can't be undone.", { date });
      if (!confirm(ask)) return;
      await repo.importAll(parsed.data);
      setMsg({ tone: "info", text: t("Restored your backup from {date}.", { date }) });
    } catch (e) {
      setMsg({ tone: "danger", text: e instanceof SyntaxError ? t("This file isn't a Hifz Tracker backup.") : (e as Error).message });
    }
  };

  const deleteData = async () => {
    setBusy(true);
    try {
      await repo.clearAll();
      setConfirming(null);
      setMsg({ tone: "info", text: signedIn ? t("Your plan and progress were deleted here and in your account.") : t("Your plan and progress were deleted.") });
    } finally {
      setBusy(false);
    }
  };

  const removeAccount = async () => {
    setBusy(true);
    try {
      const err = await deleteAccount();
      if (err) return setMsg({ tone: "danger", text: err });
      setConfirming(null);
      setMsg({ tone: "info", text: t("Your account and everything saved in it were deleted. This device still has its own copy.") });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageTitle title={t("Settings")} />
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}

      <AccountCard />
      <InstallCard />

      <Section title={tx("Your plan")} hint={tx("What you memorize, how much a day, which days, revision, travel and history.")}>
        <div className="flex flex-wrap gap-2">
          <Link href="/plan/">
            <Button>{plan ? t("Edit plan") : t("Set up a plan")}</Button>
          </Link>
          {plan && AI_ENABLED && (
            <Link href="/adjust/">
              <Button>{t("Change it with the assistant")}</Button>
            </Link>
          )}
          {plan && (
            <Link href="/checkin/">
              <Button variant="ghost">{t("Your week")}</Button>
            </Link>
          )}
        </div>
      </Section>

      <Section title={tx("Guide")} hint={tx("How the app works: sabaq, sabqi and manzil, how to memorize and revise, and what each rating does.")}>
        <Link href="/guide/">
          <Button>{t("Open the guide")}</Button>
        </Link>
      </Section>

      <Section title={tx("Language and appearance")}>
        <LanguagePicker />
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t("Theme")}>
          {THEMES.map((th) => (
            <button
              key={th.value}
              role="radio"
              aria-checked={theme === th.value}
              onClick={() => applyTheme(th.value)}
              className={`rounded-full border px-3.5 py-1.5 text-sm ${theme === th.value ? "border-accent bg-accent text-accent-text" : "border-border text-muted hover:border-accent hover:text-text"}`}
            >
              {t(th.label)}
            </button>
          ))}
        </div>
      </Section>

      <Section title={tx("Your data")}>
        <p className="text-sm">
          {signedIn ? (
            <Rich text={t("✓ Saved on this device **and in your account**, so you can use it on other devices too.")} />
          ) : (
            <Rich
              text={t(
                "Saved **only in this browser**. If you clear your browser data or lose this device, it's gone. [Make an account](#account) to keep it safe, or download a copy now and then.",
              )}
            />
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={exportData}>{t("Download a copy")}</Button>
          <Button variant="ghost" onClick={() => file.current?.click()}>
            {t("Restore from a copy")}
          </Button>
          <input
            ref={file}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importData(f);
              e.target.value = "";
            }}
          />
        </div>

        <details className="group rounded-xl bg-surface-2 px-3 py-2 text-sm">
          <summary className="cursor-pointer font-medium">{t("What's stored where")}</summary>
          <ul className="mt-2 list-disc space-y-1.5 ps-5 leading-relaxed text-muted">
            <li>
              <Rich text={t("**On this device:** your plan, progress, ratings and history.")} />
            </li>
            <li>
              <Rich
                text={t(
                  "**In your account** (only if you make one): your email, and a copy of that same data so it syncs between devices. Only you can read it.",
                )}
              />
            </li>
            {AI_ENABLED && (
              <li>
                <Rich
                  text={t(
                    "**When you use the assistant:** your message, your plan settings and short totals (like “about 23 pages memorized”) are sent to the AI (Anthropic's Claude) to answer. Not your day-by-day history.",
                  )}
                />
              </li>
            )}
            <li>{t("No ads, no tracking, nothing sold. The AI never writes your schedule or any Quran text: the app computes the plan and you approve.")}</li>
            <li>
              <Rich text={t("[Read the full privacy page](/privacy/)")} />
            </li>
          </ul>
        </details>

        <div className="space-y-2 border-t border-border pt-3">
          {confirming === "data" ? (
            <ConfirmBox
              text={
                signedIn
                  ? t("This deletes your plan, progress and history on this device and in your account. It can't be undone. Download a copy first if you might want it back.")
                  : t("This deletes your plan, progress and history on this device. It can't be undone. Download a copy first if you might want it back.")
              }
              action={t("Yes, delete my progress")}
              busy={busy}
              onConfirm={deleteData}
              onCancel={() => setConfirming(null)}
            />
          ) : confirming === "account" ? (
            <ConfirmBox
              text={t(
                "This deletes your account and the progress saved in it, on every device. This device keeps its own copy, without an account. It can't be undone.",
              )}
              action={t("Yes, delete my account")}
              busy={busy}
              onConfirm={removeAccount}
              onCancel={() => setConfirming(null)}
            />
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button variant="danger" onClick={() => setConfirming("data")}>
                {t("Delete my progress")}
              </Button>
              {signedIn && (
                <Button variant="danger" onClick={() => setConfirming("account")}>
                  {t("Delete my account")}
                </Button>
              )}
            </div>
          )}
        </div>
      </Section>

      <section className="space-y-1 px-1 text-xs text-muted">
        <p>{t("Quran text: Uthmani script from the Quran.com API (v4), Madinah Mushaf page layout.")}</p>
        {aiStatus && <p>Assistant (only shown while developing): {aiStatus}</p>}
      </section>
    </div>
  );
}

function ConfirmBox({ text, action, busy, onConfirm, onCancel }: { text: string; action: string; busy: boolean; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="space-y-3 rounded-xl border border-danger/40 bg-danger-soft p-3">
      <p className="text-sm">{text}</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="danger" disabled={busy} onClick={onConfirm}>
          {busy ? t("Deleting…") : action}
        </Button>
        <Button variant="ghost" disabled={busy} onClick={onCancel}>
          {t("Keep it")}
        </Button>
      </div>
    </div>
  );
}
