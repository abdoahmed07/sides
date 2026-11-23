"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { t, tx } from "@/i18n";
import { useLang } from "@/i18n/react";
import { LanguageButton } from "./Language";

const LINKS = [
  { href: "/", label: tx("Today"), icon: "M3 12l9-9 9 9M5 10v10h14V10" },
  { href: "/read/", label: tx("Quran"), icon: "M12 6.5C10.5 5 8 4.5 4 4.5v13c4 0 6.5.5 8 2 1.5-1.5 4-2 8-2v-13c-4 0-6.5.5-8 2zM12 6.5v13" },
  { href: "/progress/", label: tx("Progress"), icon: "M4 20V10M10 20V4M16 20v-7M22 20H2" },
  { href: "/plan/", label: tx("Plan"), icon: "M5 4h14v16H5zM9 8h6M9 12h6M9 16h4" },
  { href: "/guide/", label: tx("Guide"), icon: "M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2zM4 5v16M8 7h7M8 11h7" },
  { href: "/settings/", label: tx("Settings"), icon: "M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" },
];

export function Nav() {
  const path = usePathname();
  useLang();
  const norm = (p: string) => (p.endsWith("/") ? p : p + "/");
  const isActive = (href: string) => (href === "/" ? path === "/" : norm(path).startsWith(href));
  return (
    <nav
      aria-label={t("Main")}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur sm:top-0 sm:bottom-auto sm:border-t-0 sm:border-b"
    >
      <div className="mx-auto flex max-w-2xl items-stretch justify-around px-2 sm:justify-start sm:gap-1 sm:px-4">
        <span className="me-auto hidden items-center pe-6 text-[15px] font-semibold tracking-tight sm:flex">Hifz Tracker</span>
        {LINKS.map((l) => {
          const active = isActive(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] sm:flex-none sm:flex-row sm:gap-2 sm:px-3 sm:py-4 sm:text-sm ${
                active ? "text-accent" : "text-muted hover:text-text"
              }`}
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5 sm:hidden" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d={l.icon} />
              </svg>
              <span className="max-w-full truncate px-0.5">{t(l.label)}</span>
            </Link>
          );
        })}
        <div className="hidden items-center sm:flex">
          <LanguageButton />
        </div>
      </div>
    </nav>
  );
}
