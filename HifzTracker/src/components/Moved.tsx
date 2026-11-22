"use client";
import { useEffect, useState } from "react";
import { repo } from "@/data/dexie";
import { t } from "@/i18n";
import { useLang } from "@/i18n/react";
import { Rich } from "./Language";
import { Notice } from "./ui";
import { useSyncStatus } from "./Account";

/** Set on the old GitHub Pages build once the app lives elsewhere (e.g. Vercel). */
const MOVED_TO = process.env.NEXT_PUBLIC_MOVED_TO ?? "";
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

function newAddress() {
  const path = location.pathname.startsWith(BASE) ? location.pathname.slice(BASE.length) : location.pathname;
  return `${MOVED_TO}${path || "/"}${location.search}${location.hash}`;
}

/**
 * On the old address: people with nothing saved here go straight to the new
 * one. People with progress are asked to sign in first (that saves it to
 * their account), because the new address can't read this browser's data.
 */
export function MovedBanner() {
  const s = useSyncStatus();
  const [hasData, setHasData] = useState<boolean | null>(null);
  useLang();

  useEffect(() => {
    if (!MOVED_TO) return;
    let live = true;
    void repo.exportAll().then((b) => {
      const any = b.planVersions.length > 0 || b.units.length > 0 || b.dayLogs.length > 0;
      if (!any) location.replace(newAddress());
      else if (live) setHasData(true);
    });
    return () => {
      live = false;
    };
  }, []);

  if (!MOVED_TO || !hasData) return null;
  const signedIn = s.email !== null && s.phase !== "signed-out";
  const saved = signedIn && s.phase === "synced";
  const link = (
    <a href={MOVED_TO + "/"} className="font-medium text-accent underline underline-offset-2">
      {MOVED_TO.replace(/^https?:\/\//, "")}
    </a>
  );
  return (
    <div className="mb-4">
      <Notice tone="warn">
        <p className="font-medium">
          {t("Hifz Tracker has moved to a new address, with the AI assistant for everyone:")} {link}
        </p>
        {saved ? (
          <p className="mt-1">{t("Your progress is saved to your account. Open the new address and sign in with the same email and password.")}</p>
        ) : (
          <p className="mt-1">
            <Rich
              text={t(
                "To take your progress with you, first [create an account or sign in here](/settings/#account) so it's saved. Then open the new address and sign in there with the same email and password.",
              )}
            />
          </p>
        )}
      </Notice>
    </div>
  );
}
