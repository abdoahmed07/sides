"use client";
import Link from "next/link";
import { Fragment, useEffect } from "react";
import { LANGS, preferredLang, setLang, type Lang } from "@/i18n";
import { useLang } from "@/i18n/react";

/** Switches to the saved (or the phone's) language once the app has started. */
export function LanguageStarter() {
  useEffect(() => setLang(preferredLang(), false), []);
  return null;
}

/** Runs before the page is shown: right-to-left and hidden until the language is applied (no flash of English). */
export const languageScript = `(function(){try{var l=localStorage.getItem('hifz:lang');if(!l){var n=(navigator.language||'').toLowerCase();l=n.indexOf('sv')===0?'sv':n.indexOf('ar')===0?'ar':'en';}if(l!=='en'){var d=document.documentElement;d.lang=l;d.dir=l==='ar'?'rtl':'ltr';d.classList.add('i18n-pending');setTimeout(function(){d.classList.remove('i18n-pending')},1500);}}catch(e){}})();`;

/** Language chips (Settings). */
export function LanguagePicker() {
  const lang = useLang();
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Language">
      {LANGS.map((l) => (
        <button
          key={l.code}
          role="radio"
          aria-checked={lang === l.code}
          lang={l.code}
          onClick={() => setLang(l.code as Lang)}
          className={`rounded-full border px-3.5 py-1.5 text-sm ${lang === l.code ? "border-accent bg-accent text-accent-text" : "border-border text-muted hover:border-accent hover:text-text"}`}
        >
          {l.name}
        </button>
      ))}
    </div>
  );
}

/** A small globe button that cycles the language (top bar). */
export function LanguageButton() {
  const lang = useLang();
  const i = LANGS.findIndex((l) => l.code === lang);
  const next = LANGS[(i + 1) % LANGS.length];
  return (
    <button
      onClick={() => setLang(next.code)}
      className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-muted hover:bg-surface-2 hover:text-text"
      aria-label={`Language: ${LANGS[i].name}. Switch to ${next.name}`}
      title={next.name}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.7} aria-hidden>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z" />
      </svg>
      <span lang={lang}>{LANGS[i].code.toUpperCase()}</span>
    </button>
  );
}

/**
 * Renders translated text with **bold** and [links](/path/) inside it, so
 * whole sentences can be translated (word order differs between languages).
 */
export function Rich({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g);
  return (
    <>
      {parts.map((p, k) => {
        const bold = p.match(/^\*\*([^*]+)\*\*$/);
        if (bold) return <b key={k}>{bold[1]}</b>;
        const link = p.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (link)
          return (
            <Link key={k} href={link[2]} className="font-medium text-accent underline-offset-2 hover:underline">
              {link[1]}
            </Link>
          );
        return <Fragment key={k}>{p}</Fragment>;
      })}
    </>
  );
}
