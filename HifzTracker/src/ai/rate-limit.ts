/**
 * Simple in-memory sliding-window rate limiter keyed by client IP. Enough for
 * a single-user app running locally; it resets when the server restarts.
 */
const hits = new Map<string, number[]>();

export function rateLimit(key: string, limit = 20, windowMs = 10 * 60_000, now = Date.now()): { ok: boolean; retryAfterSec: number } {
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (list.length >= limit) {
    hits.set(key, list);
    return { ok: false, retryAfterSec: Math.ceil((windowMs - (now - list[0])) / 1000) };
  }
  list.push(now);
  hits.set(key, list);
  if (hits.size > 1000) for (const k of hits.keys()) if (k !== key) hits.delete(k);
  return { ok: true, retryAfterSec: 0 };
}
