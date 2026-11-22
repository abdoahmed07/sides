"use client";
import { useState, useSyncExternalStore } from "react";
import { t } from "@/i18n";
import { useLang } from "@/i18n/react";
import { Rich } from "./Language";
import { Button, Card } from "./ui";

/* Chrome/Edge/Android offer their own install dialog through this event; we keep it for the button. */
type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
let deferred: InstallPrompt | null = null;
const listeners = new Set<() => void>();
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallPrompt;
    listeners.forEach((l) => l());
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    listeners.forEach((l) => l());
  });
}
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

type Platform = "installed" | "ios" | "android" | "mac-safari" | "desktop" | "unknown";

function detect(): Platform {
  const nav = navigator as Navigator & { standalone?: boolean };
  if (matchMedia("(display-mode: standalone)").matches || nav.standalone) return "installed";
  const ua = navigator.userAgent;
  const iOS = /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
  if (iOS) return "ios";
  if (/Android/.test(ua)) return "android";
  if (/Macintosh/.test(ua) && /Safari/.test(ua) && !/Chrome|Chromium|Edg/.test(ua)) return "mac-safari";
  return "desktop";
}

/** How to put Hifz Tracker on the home screen. Hidden once it's installed. */
export function InstallCard() {
  const platform = useSyncExternalStore(subscribe, detect, () => "unknown" as Platform);
  const prompt = useSyncExternalStore(subscribe, () => deferred, () => null);
  const [done, setDone] = useState(false);
  useLang();

  if (platform === "installed" || platform === "unknown" || done) return null;

  const install = async () => {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    deferred = null;
    if (outcome === "accepted") setDone(true);
    listeners.forEach((l) => l());
  };

  return (
    <Card className="space-y-2">
      <h2 className="font-semibold">{t("Install the app")}</h2>
      <p className="text-sm text-muted">
        {platform === "ios" || platform === "android"
          ? t("Put Hifz Tracker on your home screen: it opens full screen like a normal app and works without internet. Your progress stays the same.")
          : t("Put Hifz Tracker on your computer: it opens in its own window like a normal app and works without internet. Your progress stays the same.")}
      </p>
      {prompt ? (
        <Button variant="primary" onClick={() => void install()}>
          {t("Install Hifz Tracker")}
        </Button>
      ) : platform === "ios" ? (
        <ol className="list-decimal space-y-1 ps-5 text-sm">
          <li>
            <Rich text={t("Tap the **Share** button")} /> <ShareIcon /> <Rich text={t("(in Safari it's at the bottom, or under the **⋯** button).")} />
          </li>
          <li>
            <Rich text={t("Scroll down and tap **Add to Home Screen**.")} />
          </li>
          <li>
            <Rich text={t("If you see **Open as Web App**, leave it on. Then tap **Add**.")} />
          </li>
        </ol>
      ) : platform === "android" ? (
        <ol className="list-decimal space-y-1 ps-5 text-sm">
          <li>
            <Rich text={t("Open the browser menu **⋮** (top right).")} />
          </li>
          <li>
            <Rich text={t("Tap **Install app** or **Add to Home screen**.")} />
          </li>
        </ol>
      ) : platform === "mac-safari" ? (
        <p className="text-sm">
          <Rich text={t("In the menu bar choose **File → Add to Dock**.")} />
        </p>
      ) : (
        <p className="text-sm">
          <Rich text={t("In Chrome or Edge, click the **install** icon at the end of the address bar (or menu → **Install Hifz Tracker**).")} />
        </p>
      )}
    </Card>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" className="inline h-4 w-4 align-text-bottom" fill="none" stroke="currentColor" strokeWidth={2} aria-label={t("(square with an arrow up)")}>
      <path d="M12 3v12M8 7l4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" strokeLinecap="round" />
    </svg>
  );
}
