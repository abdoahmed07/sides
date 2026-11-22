/*
 * Hifz Tracker service worker: makes the installed app open and work offline.
 *  - Pages: network first (so updates arrive), the saved copy when offline.
 *  - Built files (/_next/static, icons): saved once; their names change when they change.
 *  - Never touches the AI route, sign-in/sync (other sites) or anything but GET.
 * Your progress lives in the browser's database, not here; this only stores the app itself.
 */
const VERSION = "hifz-v1";
const SCOPE = new URL(self.registration.scope);
const ROUTES = ["", "plan/", "progress/", "guide/", "settings/"].map((p) => new URL(p, SCOPE).href);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((c) => Promise.allSettled(ROUTES.map((u) => c.add(new Request(u, { cache: "reload" })))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const isStatic = (url) => url.pathname.includes("/_next/static/") || url.pathname.includes("/icons/") || /\.(woff2?|png|ico|svg)$/.test(url.pathname);

async function networkFirst(request, fallbackUrl) {
  const cache = await caches.open(VERSION);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch {
    const hit = (await cache.match(request, { ignoreSearch: true })) || (fallbackUrl && (await cache.match(fallbackUrl)));
    if (hit) return hit;
    throw new Error("offline");
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== SCOPE.origin || !url.href.startsWith(SCOPE.href)) return;
  if (url.pathname.includes("/api/")) return;
  if (request.mode === "navigate") return event.respondWith(networkFirst(request, ROUTES[0]));
  if (isStatic(url)) return event.respondWith(cacheFirst(request));
  event.respondWith(networkFirst(request));
});
