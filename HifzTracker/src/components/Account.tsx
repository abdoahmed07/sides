"use client";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { formatDate } from "@/core/dates";
import { t, tp } from "@/i18n";
import { useLang } from "@/i18n/react";
import { Rich } from "./Language";
import {
  MIN_PASSWORD,
  resolveConflict,
  sendPasswordReset,
  setNewPassword,
  signIn,
  signOut,
  signUp,
  startSync,
  SYNC_ENABLED,
  syncNow,
  syncStore,
  type SyncStatus,
} from "@/sync/sync";
import { Button, Card, Field, inputCls, Notice, Spinner } from "./ui";

const SERVER_STATUS: SyncStatus = { phase: SYNC_ENABLED ? "loading" : "off", email: null, lastSyncedAt: null, message: null, conflict: null, recovering: false };

export function useSyncStatus(): SyncStatus {
  useLang();
  return useSyncExternalStore(syncStore.subscribe, syncStore.get, () => SERVER_STATUS);
}

function ago(iso: string | null): string {
  if (!iso) return t("not yet");
  const s = Math.round((Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return t("just now");
  if (s < 3600) return t("{n} min ago", { n: Math.round(s / 60) });
  if (s < 86400) return t("{n} h ago", { n: Math.round(s / 3600) });
  return formatDate(iso.slice(0, 10));
}

/** Starts automatic syncing and shows sync problems that need the person (on every page). */
export function SyncBanner() {
  const s = useSyncStatus();
  const [busy, setBusy] = useState(false);
  useEffect(() => startSync(), []);
  if (s.phase === "conflict" && s.conflict) {
    const { local, remote } = s.conflict;
    const choose = async (keep: "device" | "account") => {
      setBusy(true);
      try {
        await resolveConflict(keep);
      } finally {
        setBusy(false);
      }
    };
    return (
      <div className="mb-4">
        <Notice tone="warn">
          <p className="font-medium">{t("This device and your account have different progress. Which one should we keep?")}</p>
          <p className="mt-1 text-muted">{t("The other one is replaced. If unsure, keep the one with more days.")}</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Button disabled={busy} onClick={() => choose("account")} className="h-auto flex-col items-start whitespace-normal py-2 text-start">
              <span>{t("Keep my account's")}</span>
              <span className="text-xs font-normal text-muted">
                {tp({ one: "{n} day done", other: "{n} days done" }, remote.days)} · {tp({ one: "{n} page", other: "{n} pages" }, remote.pages)} ·{" "}
                {t("saved {when}", { when: ago(remote.updatedAt) })}
              </span>
            </Button>
            <Button disabled={busy} onClick={() => choose("device")} className="h-auto flex-col items-start whitespace-normal py-2 text-start">
              <span>{t("Keep this device's")}</span>
              <span className="text-xs font-normal text-muted">
                {tp({ one: "{n} day done", other: "{n} days done" }, local.days)} · {tp({ one: "{n} page", other: "{n} pages" }, local.pages)}
              </span>
            </Button>
          </div>
        </Notice>
      </div>
    );
  }
  if (s.phase === "error" && s.message)
    return (
      <div className="mb-4">
        <Notice tone="danger">
          {s.message}{" "}
          <button className="font-medium underline underline-offset-2" onClick={() => void syncNow()}>
            {t("Try again")}
          </button>
        </Notice>
      </div>
    );
  return null;
}

type Mode = "signup" | "signin" | "forgot" | "confirm" | "reset-sent";

/** Sign in / account status, for Settings. */
export function AccountCard() {
  const s = useSyncStatus();
  // Links that say "Sign in" open the sign-in tab. (Safe for hydration: the first render shows "Checking…" either way.)
  const [mode, setMode] = useState<Mode>(() => (typeof location !== "undefined" && location.hash === "#sign-in" ? "signin" : "signup"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!SYNC_ENABLED) return null;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };
  const go = (m: Mode) => {
    setMode(m);
    setError(null);
  };

  const signedIn = s.email !== null && s.phase !== "signed-out";
  const emailOk = /\S+@\S+\.\S+/.test(email.trim());
  const passwordOk = password.length >= MIN_PASSWORD;

  const emailField = (
    <Field label={t("Email")}>
      <input type="email" required autoComplete="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} />
    </Field>
  );
  const passwordField = (isNew: boolean) => (
    <Field label={isNew ? t("Password (at least {n} characters)", { n: MIN_PASSWORD }) : t("Password")}>
      <div className="relative">
        <input
          type={showPassword ? "text" : "password"}
          required
          minLength={isNew ? MIN_PASSWORD : undefined}
          autoComplete={isNew ? "new-password" : "current-password"}
          className={`${inputCls} pe-16`}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button
          type="button"
          className="absolute inset-y-0 end-0 px-3 text-xs text-muted hover:text-text"
          onClick={() => setShowPassword((v) => !v)}
        >
          {showPassword ? t("Hide") : t("Show")}
        </button>
      </div>
    </Field>
  );
  const linkBtn = (label: string, to: Mode) => (
    <button type="button" className="font-medium text-accent underline-offset-2 hover:underline" onClick={() => go(to)}>
      {label}
    </button>
  );

  let body: React.ReactNode;
  if (s.phase === "loading") {
    body = (
      <p className="flex items-center gap-2 text-sm text-muted">
        <Spinner /> {t("Checking…")}
      </p>
    );
  } else if (signedIn && s.recovering) {
    body = (
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            const err = await setNewPassword(password);
            if (err) setError(err);
            else setPassword("");
          });
        }}
      >
        <p className="text-sm">
          <Rich text={t("Choose a new password for **{email}**.", { email: s.email ?? "" })} />
        </p>
        {passwordField(true)}
        <Button type="submit" variant="primary" disabled={busy || !passwordOk}>
          {busy ? <Spinner /> : t("Save new password")}
        </Button>
      </form>
    );
  } else if (signedIn) {
    body = (
      <>
        <p className="text-sm">
          <Rich text={t("Signed in as **{email}**", { email: s.email ?? "" })} />
        </p>
        <p className="flex items-center gap-2 text-sm text-muted">
          {s.phase === "syncing" ? (
            <>
              <Spinner /> {t("Syncing…")}
            </>
          ) : s.phase === "offline" ? (
            s.message
          ) : s.phase === "conflict" ? (
            t("Waiting for you to choose which progress to keep (see the top of the page).")
          ) : (
            t("Everything is saved to your account. Last synced {when}.", { when: ago(s.lastSyncedAt) })
          )}
        </p>
        <p className="text-xs text-muted">{t("To use it on another device, open Hifz Tracker there and sign in with the same email and password.")}</p>
        <div className="flex flex-wrap gap-2">
          <Button disabled={s.phase === "syncing"} onClick={() => void syncNow()}>
            {t("Sync now")}
          </Button>
          <Button variant="ghost" onClick={() => void signOut()}>
            {t("Sign out")}
          </Button>
        </div>
      </>
    );
  } else if (mode === "confirm") {
    body = (
      <div className="space-y-3">
        <p className="text-sm">
          <Rich
            text={t("Almost done. We sent an email to **{email}**. Open it on **any device** (your phone is fine) and tap the link to confirm.", {
              email: email.trim(),
            })}
          />
        </p>
        <p className="text-sm">{t("Then come back here and press Sign in.")}</p>
        <Button
          variant="primary"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const err = await signIn(email.trim(), password);
              if (err) setError(err);
            })
          }
        >
          {busy ? <Spinner /> : t("I've confirmed, sign me in")}
        </Button>
        <p className="text-xs text-muted">
          {t("No email? Check your spam folder.")} {linkBtn(t("Change email"), "signup")}
        </p>
      </div>
    );
  } else if (mode === "reset-sent") {
    body = (
      <div className="space-y-3">
        <p className="text-sm">
          <Rich
            text={t(
              "If there's an account for **{email}**, we sent it a link. Open the link **on the device where you want to sign in**, and you'll be asked for a new password.",
              { email: email.trim() },
            )}
          />
        </p>
        <p className="text-sm">{t("Opened it on another device? That's fine: set the new password there, then sign in here with it.")}</p>
        <p className="text-sm">{linkBtn(t("Back to sign in"), "signin")}</p>
      </div>
    );
  } else if (mode === "forgot") {
    body = (
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            const err = await sendPasswordReset(email.trim());
            if (err) setError(err);
            else go("reset-sent");
          });
        }}
      >
        <p className="text-sm">{t("Enter your email and we'll send you a link to choose a new password.")}</p>
        {emailField}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="primary" disabled={busy || !emailOk}>
            {busy ? <Spinner /> : t("Send link")}
          </Button>
          <span className="text-sm">{linkBtn(t("Back to sign in"), "signin")}</span>
        </div>
      </form>
    );
  } else {
    const isNew = mode === "signup";
    body = (
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            const to = email.trim();
            if (isNew) {
              const r = await signUp(to, password);
              if (r.error) setError(r.error);
              else if (r.needsConfirm) go("confirm");
            } else {
              const err = await signIn(to, password);
              if (err) setError(err);
            }
          });
        }}
      >
        <div className="flex rounded-lg border border-border p-0.5 text-sm" role="tablist">
          {(["signup", "signin"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              className={`flex-1 rounded-md px-3 py-1.5 font-medium ${mode === m ? "bg-accent text-accent-text" : "text-muted hover:text-text"}`}
              onClick={() => go(m)}
            >
              {m === "signup" ? t("Create account") : t("I have an account")}
            </button>
          ))}
        </div>
        {emailField}
        {passwordField(isNew)}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="primary" disabled={busy || !emailOk || (isNew ? !passwordOk : !password)}>
            {busy ? <Spinner /> : isNew ? t("Create account") : t("Sign in")}
          </Button>
          {!isNew && <span className="text-sm">{linkBtn(t("Forgot password?"), "forgot")}</span>}
        </div>
        {isNew && <p className="text-xs text-muted">{t("Your progress on this device is kept and saved to the new account.")}</p>}
      </form>
    );
  }

  return (
    <Card className="space-y-3">
      <div id="account" className="scroll-mt-20">
        <span id="sign-in" className="block scroll-mt-20" />
        <h2 className="font-semibold">{t("Your account")}</h2>
        {!signedIn && s.phase !== "loading" && (
          <p className="text-sm text-muted">{t("Make an account to keep your progress safe and use it on your phone and computer.")}</p>
        )}
      </div>
      {body}
      {error && <p className="text-sm text-danger">{error}</p>}
    </Card>
  );
}

/** A gentle prompt to sign in, for people who have a plan but no account yet. */
export function SignInNudge({ newUser = false }: { newUser?: boolean }) {
  const s = useSyncStatus();
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem("hifz.nudge.dismissed") === "1";
    } catch {
      return false;
    }
  });
  if (!SYNC_ENABLED || s.phase !== "signed-out") return null;
  if (newUser)
    return (
      <p className="text-sm text-muted">
        <Rich text={t("Already using Hifz Tracker on another device? [Sign in](/settings/#sign-in) to bring your progress here.")} />
      </p>
    );
  if (hidden) return null;
  return (
    <Notice>
      <Rich text={t("**Keep your progress safe.** Make a free account to save it and use it on your phone and computer.")} />{" "}
      <Link href="/settings/#account" className="font-medium text-accent underline underline-offset-2">
        {t("Create account")}
      </Link>
      <button
        className="ms-3 text-muted underline-offset-2 hover:underline"
        onClick={() => {
          try {
            localStorage.setItem("hifz.nudge.dismissed", "1");
          } catch {
            /* ignore */
          }
          setHidden(true);
        }}
      >
        {t("Not now")}
      </button>
    </Notice>
  );
}
