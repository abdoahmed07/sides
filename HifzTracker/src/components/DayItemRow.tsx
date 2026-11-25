"use client";
import type { Strength } from "@/core/srs";
import type { DayItem } from "@/data/types";
import { t, tx } from "@/i18n";

const RATINGS: { value: Strength; label: string; cls: string }[] = [
  { value: "strong", label: tx("Strong"), cls: "data-[on=true]:bg-accent data-[on=true]:text-accent-text" },
  { value: "okay", label: tx("Okay"), cls: "data-[on=true]:bg-warn data-[on=true]:text-white dark:data-[on=true]:text-black" },
  { value: "weak", label: tx("Weak"), cls: "data-[on=true]:bg-danger data-[on=true]:text-white dark:data-[on=true]:text-black" },
];

export function DayItemRow({
  item,
  title,
  detail,
  onToggle,
  onRate,
  onOpen,
  disabled,
  rateable = true,
  note,
}: {
  item: DayItem;
  title: string;
  detail: string;
  /** What the rating does (when the page comes back), shown under it. */
  note?: string | null;
  onToggle: (done: boolean) => void;
  onRate: (r: Strength) => void;
  onOpen: () => void;
  disabled?: boolean;
  rateable?: boolean;
}) {
  return (
    <li className="py-3">
      <div className="flex items-start gap-3">
        <button
          role="checkbox"
          aria-checked={item.done}
          aria-label={item.done ? t("Mark {title} as not done", { title }) : t("Mark {title} as done", { title })}
          disabled={disabled}
          onClick={() => onToggle(!item.done)}
          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 transition ${
            item.done ? "border-accent bg-accent text-accent-text" : "border-border hover:border-accent"
          }`}
        >
          {item.done && (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={3} aria-hidden>
              <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
        <button onClick={onOpen} className="min-w-0 flex-1 text-start" aria-label={t("Show the text of {title}", { title })}>
          <span className={`block text-[15px] font-medium ${item.done ? "text-muted line-through decoration-1" : ""}`}>{title}</span>
          <span className="block text-xs text-muted">
            {detail} · {t("tap to read")}
          </span>
        </button>
      </div>
      {item.done && rateable && (
        <div className="mt-2 ms-9 flex gap-1.5" role="group" aria-label={t("How well did it go?")}>
          {RATINGS.map((r) => (
            <button
              key={r.value}
              data-on={item.rating === r.value}
              aria-pressed={item.rating === r.value}
              onClick={() => onRate(r.value)}
              disabled={disabled}
              className={`rounded-full border border-border px-3 py-1 text-xs font-medium text-muted transition hover:text-text data-[on=true]:border-transparent ${r.cls}`}
            >
              {t(r.label)}
            </button>
          ))}
        </div>
      )}
      {item.done && rateable && note && <p className="mt-1.5 ms-9 text-xs text-muted">{note}</p>}
    </li>
  );
}
