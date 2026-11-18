/**
 * Optional sync through Supabase: sign in with email and password, and the whole
 * local database is kept in one private row per account (see
 * supabase/schema.sql). The app stays local-first: everything works offline
 * and without an account; syncing just copies the data to and from the account.
 *
 * Off unless NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getQuran } from "@/core/quran";
import type { MemUnit } from "@/core/srs";
import { totals } from "@/core/stats";
import { repo } from "@/data/dexie";
import { BackupSchema, type Backup } from "@/data/types";
import { clearDirty, clearDirtyIf, dirtyToken, isDirty, onLocalChange, withoutTracking } from "./changes";
import { decideSync } from "./decide";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const SYNC_ENABLED = Boolean(URL && KEY);

const TABLE = "hifz_snapshots";
const STATE_KEY = "hifz.sync.state";

let client: SupabaseClient | null = null;
function sb(): SupabaseClient {
  if (!client)
    client = createClient(URL, KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "implicit", storageKey: "hifz-auth" },
    });
  return client;
}

/* ---------------- status (read by the UI) ---------------- */

export type Summary = { days: number; pages: number; updatedAt: string | null };
export type SyncStatus = {
  phase: "off" | "loading" | "signed-out" | "syncing" | "synced" | "offline" | "error" | "conflict";
  email: string | null;
  lastSyncedAt: string | null;
  message: string | null;
  conflict: { local: Summary; remote: Summary } | null;
  /** Opened a "reset password" link: ask for a new password. */
  recovering: boolean;
};

let status: SyncStatus = {
  phase: SYNC_ENABLED ? "loading" : "off",
  email: null,
  lastSyncedAt: null,
  message: null,
  conflict: null,
  recovering: false,
};
const subscribers = new Set<() => void>();
function setStatus(patch: Partial<SyncStatus>) {
  status = { ...status, ...patch };
  subscribers.forEach((s) => s());
}
export const syncStore = {
  subscribe(fn: () => void) {
    subscribers.add(fn);
    return () => subscribers.delete(fn);
  },
  get: () => status,
};

/* ---------------- per-device sync state ---------------- */

type DeviceState = { userId: string; lastRev: number | null; lastSyncedAt: string | null };
function loadState(userId: string): DeviceState {
  try {
    const s = JSON.parse(localStorage.getItem(STATE_KEY) ?? "null") as DeviceState | null;
    if (s && s.userId === userId) return s;
  } catch {
    /* ignore */
  }
  return { userId, lastRev: null, lastSyncedAt: null };
}
function saveState(s: DeviceState) {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

/* ---------------- helpers ---------------- */

const hasData = (b: Backup) => b.planVersions.length > 0 || b.units.length > 0 || b.dayLogs.length > 0;

function summarize(b: Backup, updatedAt: string | null): Summary {
  return {
    days: b.dayLogs.filter((l) => (l.items as { done?: boolean }[]).some((i) => i?.done)).length,
    pages: totals(b.units as MemUnit[], getQuran()).pagesEquivalent,
    updatedAt,
  };
}

function friendly(e: unknown): { phase: SyncStatus["phase"]; message: string } {
  const msg = e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : String(e);
  if (typeof navigator !== "undefined" && !navigator.onLine)
    return { phase: "offline", message: "You're offline. Everything is saved on this device and will sync when you're back online." };
  if (/fetch|network/i.test(msg)) return { phase: "offline", message: "Couldn't reach the server. Your progress is saved on this device; it will sync later." };
  return { phase: "error", message: `Sync problem: ${msg}` };
}

/* ---------------- syncing ---------------- */

let running: Promise<void> | null = null;
let again = false;

/** Brings this device and the account in line. Safe to call any time. */
export function syncNow(): Promise<void> {
  if (!SYNC_ENABLED) return Promise.resolve();
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    try {
      do {
        again = false;
        await syncOnce();
      } while (again);
    } finally {
      running = null;
    }
  })();
  return running;
}

async function syncOnce() {
  const { data } = await sb().auth.getSession();
  const session = data.session;
  if (!session) return setStatus({ phase: "signed-out", email: null, conflict: null, message: null });
  const uid = session.user.id;
  setStatus({ email: session.user.email ?? null });
  if (status.phase === "conflict") return; // waits for the person's choice
  setStatus({ phase: "syncing", message: null });
  const state = loadState(uid);
  try {
    const token = dirtyToken();
    const local = await repo.exportAll();
    const { data: remote, error } = await sb().from(TABLE).select("rev, updated_at").eq("user_id", uid).maybeSingle();
    if (error) throw error;
    const action = decideSync({ localHasData: hasData(local), localDirty: isDirty(), lastRev: state.lastRev, remoteRev: remote?.rev ?? null });
    if (action === "upload") await upload(uid, local, remote?.rev ?? null, token);
    else if (action === "download") await download(uid);
    else if (action === "conflict") {
      const { data: full, error: e2 } = await sb().from(TABLE).select("data, updated_at").eq("user_id", uid).single();
      if (e2) throw e2;
      const parsed = BackupSchema.safeParse(full.data);
      const remoteSummary = parsed.success ? summarize(parsed.data, full.updated_at) : { days: 0, pages: 0, updatedAt: full.updated_at };
      return setStatus({ phase: "conflict", conflict: { local: summarize(local, null), remote: remoteSummary } });
    } else {
      saveState({ ...state, lastSyncedAt: new Date().toISOString() });
    }
    setStatus({ phase: "synced", lastSyncedAt: loadState(uid).lastSyncedAt, message: null });
  } catch (e) {
    setStatus(friendly(e));
  }
}

function snapshotForUpload(b: Backup): Backup {
  return { ...b, exportedAt: new Date().toISOString() };
}

/** Uploads only if the account is still at `baseRev`; otherwise syncs again to look at the newer data. */
async function upload(uid: string, local: Backup, baseRev: number | null, token: string | null) {
  const now = new Date().toISOString();
  const rev = (baseRev ?? 0) + 1;
  const row = { data: snapshotForUpload(local), rev, updated_at: now };
  if (baseRev === null) {
    const { error } = await sb().from(TABLE).insert({ user_id: uid, ...row });
    if (error) {
      if (error.code === "23505") return void (again = true); // another device got there first
      throw error;
    }
  } else {
    const { data, error } = await sb().from(TABLE).update(row).eq("user_id", uid).eq("rev", baseRev).select("rev");
    if (error) throw error;
    if (!data?.length) return void (again = true);
  }
  saveState({ userId: uid, lastRev: rev, lastSyncedAt: now });
  clearDirtyIf(token);
}

async function download(uid: string) {
  const { data, error } = await sb().from(TABLE).select("rev, data").eq("user_id", uid).single();
  if (error) throw error;
  const parsed = BackupSchema.safeParse(data.data);
  if (!parsed.success) throw new Error("the saved data in your account couldn't be read");
  await withoutTracking(() => repo.importAll(parsed.data));
  clearDirty();
  saveState({ userId: uid, lastRev: data.rev, lastSyncedAt: new Date().toISOString() });
}

/** The person chose which copy to keep after a conflict. The other is overwritten. */
export async function resolveConflict(keep: "device" | "account") {
  const { data } = await sb().auth.getSession();
  const uid = data.session?.user.id;
  if (!uid) return;
  setStatus({ phase: "syncing", conflict: null });
  try {
    if (keep === "account") await download(uid);
    else {
      const { data: remote, error } = await sb().from(TABLE).select("rev").eq("user_id", uid).maybeSingle();
      if (error) throw error;
      await upload(uid, await repo.exportAll(), remote?.rev ?? null, dirtyToken());
      if (again) {
        again = false;
        return resolveConflict("device");
      }
    }
    setStatus({ phase: "synced", lastSyncedAt: loadState(uid).lastSyncedAt });
  } catch (e) {
    setStatus(friendly(e));
  }
}

/* ---------------- signing in ---------------- */

export const MIN_PASSWORD = 6;

const settingsUrl = () => `${location.origin}${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/settings/`;

function authError(e: { message: string; code?: string }): string {
  const m = e.message;
  if (e.code === "invalid_credentials" || /invalid login credentials/i.test(m)) return "Wrong email or password.";
  if (e.code === "email_not_confirmed" || /not confirmed/i.test(m))
    return "Your email isn't confirmed yet. Open the email we sent you (on any device), tap the link, then press Sign in here again.";
  if (e.code === "weak_password" || /password should be/i.test(m)) return `Choose a longer password (at least ${MIN_PASSWORD} characters).`;
  if (e.code === "over_email_send_rate_limit" || /rate limit|too many/i.test(m)) return "Too many emails were sent just now. Wait a few minutes and try again.";
  if (/fetch|network/i.test(m)) return "Couldn't reach the server. Check your internet connection.";
  return m;
}

export type SignUpResult = { error: string | null; needsConfirm: boolean };

/** Creates an account. Usually an email confirmation follows; the link can be opened on any device. */
export async function signUp(email: string, password: string): Promise<SignUpResult> {
  const { data, error } = await sb().auth.signUp({ email, password, options: { emailRedirectTo: settingsUrl() } });
  if (error) return { error: authError(error), needsConfirm: false };
  if (data.session) return { error: null, needsConfirm: false }; // confirmation is turned off
  // Supabase hides whether the email is taken: an existing account comes back with no identities.
  if (data.user && data.user.identities?.length === 0)
    return { error: "There's already an account with this email. Sign in instead (or use “Forgot password?”).", needsConfirm: false };
  return { error: null, needsConfirm: true };
}

export async function signIn(email: string, password: string): Promise<string | null> {
  const { error } = await sb().auth.signInWithPassword({ email, password });
  return error ? authError(error) : null;
}

/** Emails a link for choosing a new password. Opening it signs that device in and asks for the new password. */
export async function sendPasswordReset(email: string): Promise<string | null> {
  const { error } = await sb().auth.resetPasswordForEmail(email, { redirectTo: settingsUrl() });
  return error ? authError(error) : null;
}

export async function setNewPassword(password: string): Promise<string | null> {
  const { error } = await sb().auth.updateUser({ password });
  if (error) return authError(error);
  setStatus({ recovering: false });
  return null;
}

/** Signs out on this device only. The data stays here and in the account. */
export async function signOut() {
  await sb().auth.signOut({ scope: "local" });
  try {
    localStorage.removeItem(STATE_KEY);
  } catch {
    /* ignore */
  }
  setStatus({ phase: "signed-out", email: null, lastSyncedAt: null, conflict: null, message: null, recovering: false });
}

/* ---------------- automatic syncing ---------------- */

let started = false;
/** Starts automatic syncing: on sign-in, after local changes, and when the app comes back into view. */
export function startSync() {
  if (!SYNC_ENABLED || started || typeof window === "undefined") return;
  started = true;
  // Don't call Supabase from inside this callback (it can deadlock); defer instead.
  sb().auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY") setStatus({ recovering: true });
    if (!session) setStatus({ phase: "signed-out", email: null, conflict: null, recovering: false });
    else if (event === "SIGNED_IN" || event === "INITIAL_SESSION") setTimeout(() => void syncNow(), 0);
  });
  let timer: ReturnType<typeof setTimeout> | null = null;
  onLocalChange(() => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void syncNow(), 3000);
  });
  let lastFocus = 0;
  const onVisible = () => {
    if (document.visibilityState !== "visible" || Date.now() - lastFocus < 15_000) return;
    lastFocus = Date.now();
    void syncNow();
  };
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("online", () => void syncNow());
}
