/**
 * Tracks whether this device has changes the account hasn't seen yet.
 * Kept in localStorage (not IndexedDB) so restoring a downloaded snapshot
 * never overwrites it. Every write through the repo calls markDirty().
 */
const DIRTY_KEY = "hifz.sync.dirty";
const listeners = new Set<() => void>();
let suppressed = 0;

function read(): string | null {
  try {
    return localStorage.getItem(DIRTY_KEY);
  } catch {
    return null;
  }
}

/** Called after every local write. */
export function markDirty() {
  if (suppressed) return;
  try {
    localStorage.setItem(DIRTY_KEY, String(Date.now()) + Math.random().toString(36).slice(2, 6));
  } catch {
    /* storage unavailable: syncing on focus still works */
  }
  listeners.forEach((l) => l());
}

export function isDirty(): boolean {
  return read() !== null;
}

/** A token for the current dirty state; pass it to clearDirtyIf after uploading. */
export function dirtyToken(): string | null {
  return read();
}

/** Clears the flag only if nothing changed since `token` was taken. */
export function clearDirtyIf(token: string | null) {
  if (read() !== token) return;
  try {
    localStorage.removeItem(DIRTY_KEY);
  } catch {
    /* ignore */
  }
}

export function clearDirty() {
  try {
    localStorage.removeItem(DIRTY_KEY);
  } catch {
    /* ignore */
  }
}

/** Runs writes that come from the account (a download), without marking the device as changed. */
export async function withoutTracking<T>(fn: () => Promise<T>): Promise<T> {
  suppressed++;
  try {
    return await fn();
  } finally {
    suppressed--;
  }
}

export function onLocalChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
