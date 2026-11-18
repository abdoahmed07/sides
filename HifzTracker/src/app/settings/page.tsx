"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { BackupSchema } from "@/data/types";
import { repo } from "@/data/dexie";
import { usePlan } from "@/data/hooks";
import { AI_ENABLED } from "@/lib/ai-client";
import { Button, Card, Notice, PageTitle } from "@/components/ui";
import { AccountCard, useSyncStatus } from "@/components/Account";

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

export default function SettingsPage() {
  const plan = usePlan();
  const sync = useSyncStatus();
  const signedIn = sync.email !== null && sync.phase !== "signed-out";
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => "system" as Theme);
  const [msg, setMsg] = useState<{ tone: "info" | "danger"; text: string } | null>(null);
  const [aiStatus, setAiStatus] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (AI_ENABLED)
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
      if (!parsed.success) throw new Error("This file isn't a valid Hifz Tracker backup.");
      if (!confirm("Replace everything on this device with the backup? This can't be undone (export first if unsure).")) return;
      await repo.importAll(parsed.data);
      setMsg({ tone: "info", text: `Imported backup from ${parsed.data.exportedAt.slice(0, 10)}.` });
    } catch (e) {
      setMsg({ tone: "danger", text: (e as Error).message });
    }
  };

  const reset = async () => {
    const where = signedIn ? "on this device and in your account" : "on this device";
    if (!confirm(`Delete all plans, progress and history ${where}? Export a backup first if you might need it.`)) return;
    await repo.clearAll();
    setMsg({ tone: "info", text: "All data deleted." });
  };

  return (
    <div className="space-y-4">
      <PageTitle title="Settings" />
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}

      <AccountCard />

      <Card className="space-y-2">
        <h2 className="font-semibold">Plan</h2>
        <p className="text-sm text-muted">Target, daily amount, study days, revision windows, exceptions and history.</p>
        <div className="flex flex-wrap gap-2">
          <Link href="/plan/">
            <Button>Edit plan</Button>
          </Link>
          {plan && AI_ENABLED && (
            <Link href="/adjust/">
              <Button>Adjust with AI</Button>
            </Link>
          )}
          {plan && AI_ENABLED && (
            <Link href="/checkin/">
              <Button variant="ghost">Weekly check-in</Button>
            </Link>
          )}
        </div>
      </Card>

      <Card className="space-y-2">
        <h2 className="font-semibold">Appearance</h2>
        <div className="flex gap-1.5" role="radiogroup" aria-label="Theme">
          {(["system", "light", "dark"] as Theme[]).map((t) => (
            <button
              key={t}
              role="radio"
              aria-checked={theme === t}
              onClick={() => applyTheme(t)}
              className={`rounded-full border px-3 py-1.5 text-sm capitalize ${theme === t ? "border-accent bg-accent text-accent-text" : "border-border text-muted"}`}
            >
              {t}
            </button>
          ))}
        </div>
      </Card>

      <Card className="space-y-2">
        <h2 className="font-semibold">Backup</h2>
        <p className="text-sm text-muted">
          {signedIn
            ? "Your progress is saved to your account automatically. You can also keep a copy as a file."
            : "Without an account, everything is stored only in this browser. Export a backup now and then so you don't lose it."}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={exportData}>Export JSON</Button>
          <Button onClick={() => file.current?.click()}>Import JSON</Button>
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
      </Card>

      <Card className="space-y-2">
        <h2 className="font-semibold">AI and privacy</h2>
        {AI_ENABLED ? (
          <p className="text-sm text-muted">Assistant: {aiStatus ?? "checking…"}</p>
        ) : (
          <p className="text-sm text-muted">This copy of the app runs without a server, so the AI assistant is off. Run it locally to use it.</p>
        )}
        <p className="text-sm leading-relaxed text-muted">
          When you use the assistant, only your message and aggregate numbers are sent: your plan settings, a short summary like
          &ldquo;about 23 pages memorized&rdquo;, and for check-ins weekly totals (completion rate, strong/okay/weak counts, overdue pages,
          streak). Your day-by-day history, notes and backups never leave this device. The AI never writes your schedule or any Quran
          text: it proposes settings, the app computes the plan, and you approve.
        </p>
        <p className="text-xs text-muted">Quran text: Uthmani script from the Quran.com API (v4), Madinah Mushaf page layout.</p>
      </Card>

      <Card className="space-y-2">
        <h2 className="font-semibold">Danger zone</h2>
        <Button variant="danger" onClick={reset}>
          Delete all data on this device
        </Button>
      </Card>
    </div>
  );
}
