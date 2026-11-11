// Cleanup worker. Streak used to live at /sides/ and registered a service worker
// there whose scope covers every page under /sides/ (including /sides/kent/).
// Browsers that still have it fetch this file when checking for updates; this
// version deletes that old worker's caches, unregisters itself, and reloads
// the open tabs so they load the real pages.
// The landing page at /sides/ does not use a service worker, so this can stay
// until enough time has passed that no browser still has the old one, then be deleted.

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const scope = self.registration.scope; // https://abdoahmed07.github.io/sides/
      const keys = await caches.keys();
      // Only the old /sides/ caches — Streak's new caches end in /sides/streak/.
      await Promise.all(keys.filter((k) => k.endsWith(scope)).map((k) => caches.delete(k)));
      await self.registration.unregister();
      const tabs = await self.clients.matchAll({ type: "window" });
      tabs.forEach((tab) => tab.navigate(tab.url));
    })(),
  );
});
