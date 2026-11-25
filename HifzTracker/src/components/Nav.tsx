"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { t, tx } from "@/i18n";
import { useLang } from "@/i18n/react";
import { LanguageButton } from "./Language";

/** The main sections (the guide is linked from the footer, Settings and the "How?" links). */
const LINKS = [
  { href: "/", label: tx("Today"), icon: "M4 10.5L12 4l8 6.5V19a1 1 0 01-1 1h-4.5v-5.5h-5V20H5a1 1 0 01-1-1z" },
  { href: "/read/", label: tx("Quran"), icon: "M12 6.5C10.5 5 8 4.5 4 4.5v13c4 0 6.5.5 8 2 1.5-1.5 4-2 8-2v-13c-4 0-6.5.5-8 2zM12 6.5v13" },
  { href: "/progress/", label: tx("Progress"), icon: "M5 20v-7M10.5 20V9M16 20V4.5M3 20h18" },
  { href: "/plan/", label: tx("Plan"), icon: "M7 3.5v3M17 3.5v3M4.5 8.5h15M5.5 5h13a1 1 0 011 1v13a1 1 0 01-1 1h-13a1 1 0 01-1-1V6a1 1 0 011-1zM8.5 12.5h3M8.5 16h6" },
  {
    href: "/settings/",
    label: tx("Settings"),
    icon: "M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z",
  },
];

/** The app's mark, as on its icon: an eight-pointed star around an open ring. */
export function Logo({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={className} aria-hidden>
      <rect width="28" height="28" rx="7" fill="#2f6b4f" />
      <g fill="none" stroke="#efe6cf" strokeWidth="1.4" strokeLinejoin="round">
        <rect x="8" y="8" width="12" height="12" />
        <path d="M14 5.5l8.5 8.5-8.5 8.5L5.5 14z" />
      </g>
      <path d="M14 10.6a3.4 3.4 0 11-3.3 2.6" fill="none" stroke="#d6a84d" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/**
 * The tab bar: at the bottom on phones (above the home bar on iPhone, which it leaves room for),
 * across the top on wider screens.
 */
export function Nav() {
  const path = usePathname();
  useLang();
  const norm = (p: string) => (p.endsWith("/") ? p : p + "/");
  const isActive = (href: string) => (href === "/" ? path === "/" : norm(path).startsWith(href));
  return (
    <nav
      aria-label={t("Main")}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl sm:top-0 sm:bottom-auto sm:border-t-0 sm:border-b sm:pb-0"
    >
      <div className="mx-auto flex max-w-2xl items-stretch px-1 sm:h-14 sm:items-center sm:gap-0.5 sm:px-4 lg:max-w-4xl">
        <Link href="/" className="me-auto hidden items-center gap-2.5 pe-3 sm:flex" aria-label="Hifz Tracker">
          <Logo />
          <span className="hidden whitespace-nowrap text-[15px] font-semibold tracking-tight lg:inline">Hifz Tracker</span>
        </Link>
        {LINKS.map((l) => {
          const active = isActive(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-w-0 flex-1 flex-col items-center gap-1 pb-1.5 pt-2 text-[11px] font-medium transition-colors sm:flex-none sm:flex-row sm:gap-1.5 sm:whitespace-nowrap sm:rounded-full sm:px-2.5 sm:py-1.5 sm:text-sm lg:px-3 ${
                active ? "text-accent sm:bg-accent-soft" : "text-muted hover:text-text sm:hover:bg-surface-2"
              }`}
            >
              {/* On phones the active tab's icon sits in a soft pill. */}
              <span className={`flex h-8 w-14 items-center justify-center rounded-full transition-colors sm:h-auto sm:w-auto ${active ? "bg-accent-soft sm:bg-transparent" : ""}`}>
                <svg
                  viewBox="0 0 24 24"
                  className="h-[22px] w-[22px] sm:h-[18px] sm:w-[18px]"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={active ? 2 : 1.7}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d={l.icon} />
                </svg>
              </span>
              <span className="max-w-full truncate px-0.5 leading-tight">{t(l.label)}</span>
            </Link>
          );
        })}
        <div className="hidden items-center ps-1 sm:flex">
          <LanguageButton />
        </div>
      </div>
    </nav>
  );
}
