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
  { value: "system", label: "Same as phone" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <Card className="space-y-3">
      <div>
        <h2 className="font-semibold">{title}</h2>
        {hint && <p className="text-sm text-muted">{hint}</p>}
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
      if (!parsed.success) throw new Error("This file isn't a Hifz Tracker backup.");
      const where = signedIn ? "on this device and in your account" : "on this device";
      if (!confirm(`Replace everything ${where} with this backup from ${parsed.data.exportedAt.slice(0, 10)}? This can't be undone.`)) return;
      await repo.importAll(parsed.data);
      setMsg({ tone: "info", text: `Restored your backup from ${parsed.data.exportedAt.slice(0, 10)}.` });
    } catch (e) {
      setMsg({ tone: "danger", text: e instanceof SyntaxError ? "This file isn't a Hifz Tracker backup." : (e as Error).message });
    }
  };

  const deleteData = async () => {
    setBusy(true);
    try {
      await repo.clearAll();
      setConfirming(null);
      setMsg({ tone: "info", text: signedIn ? "Your plan and progress were deleted here and in your account." : "Your plan and progress were deleted." });
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
      setMsg({ tone: "info", text: "Your account and everything saved in it were deleted. This device still has its own copy." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageTitle title="Settings" />
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}

      <AccountCard />
      <InstallCard />

      <Section title="Your plan" hint="What you memorize, how much a day, which days, revision, travel and history.">
        <div className="flex flex-wrap gap-2">
          <Link href="/plan/">
            <Button>{plan ? "Edit plan" : "Set up a plan"}</Button>
          </Link>
          {plan && AI_ENABLED && (
            <Link href="/adjust/">
              <Button>Change it with the assistant</Button>
            </Link>
          )}
          {plan && AI_ENABLED && (
            <Link href="/checkin/">
              <Button variant="ghost">Weekly check-in</Button>
            </Link>
          )}
        </div>
      </Section>

      <Section title="Appearance">
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Theme">
          {THEMES.map((t) => (
            <button
              key={t.value}
              role="radio"
              aria-checked={theme === t.value}
              onClick={() => applyTheme(t.value)}
              className={`rounded-full border px-3.5 py-1.5 text-sm ${theme === t.value ? "border-accent bg-accent text-accent-text" : "border-border text-muted hover:border-accent hover:text-text"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Your data">
        <p className="text-sm">
          {signedIn ? (
            <>
              ✓ Saved on this device <b>and in your account</b>, so you can use it on other devices too.
            </>
          ) : (
            <>
              Saved <b>only in this browser</b>. If you clear your browser data or lose this phone, it&apos;s gone.{" "}
              <a href="#account" className="font-medium text-accent underline-offset-2 hover:underline">
                Make an account
              </a>{" "}
              to keep it safe, or download a copy now and then.
            </>
          )}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={exportData}>Download a copy</Button>
          <Button variant="ghost" onClick={() => file.current?.click()}>
            Restore from a copy
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
          <summary className="cursor-pointer font-medium">What&apos;s stored where</summary>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 leading-relaxed text-muted">
            <li>
              <b className="text-text">On this device:</b> your plan, progress, ratings and history.
            </li>
            <li>
              <b className="text-text">In your account</b> (only if you make one): your email, and a copy of that same data so it syncs between
              devices. Only you can read it.
            </li>
            {AI_ENABLED && (
              <li>
                <b className="text-text">When you use the assistant:</b> your message, your plan settings and short totals (like &ldquo;about 23 pages
                memorized&rdquo;) are sent to the AI (Anthropic&apos;s Claude) to answer. Not your day-by-day history.
              </li>
            )}
            <li>No ads, no tracking, nothing sold. The AI never writes your schedule or any Quran text: the app computes the plan and you approve.</li>
          </ul>
        </details>

        <div className="space-y-2 border-t border-border pt-3">
          {confirming === "data" ? (
            <ConfirmBox
              text={`This deletes your plan, progress and history ${signedIn ? "on this device and in your account" : "on this device"}. It can't be undone. Download a copy first if you might want it back.`}
              action="Yes, delete my progress"
              busy={busy}
              onConfirm={deleteData}
              onCancel={() => setConfirming(null)}
            />
          ) : confirming === "account" ? (
            <ConfirmBox
              text="This deletes your account and the progress saved in it, on every device. This device keeps its own copy, without an account. It can't be undone."
              action="Yes, delete my account"
              busy={busy}
              onConfirm={removeAccount}
              onCancel={() => setConfirming(null)}
            />
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button variant="danger" onClick={() => setConfirming("data")}>
                Delete my progress
              </Button>
              {signedIn && (
                <Button variant="danger" onClick={() => setConfirming("account")}>
                  Delete my account
                </Button>
              )}
            </div>
          )}
        </div>
      </Section>

      <section className="space-y-1 px-1 text-xs text-muted">
        <p>Quran text: Uthmani script from the Quran.com API (v4), Madinah Mushaf page layout.</p>
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
          {busy ? "Deleting…" : action}
        </Button>
        <Button variant="ghost" disabled={busy} onClick={onCancel}>
          Keep it
        </Button>
      </div>
    </div>
  );
}
