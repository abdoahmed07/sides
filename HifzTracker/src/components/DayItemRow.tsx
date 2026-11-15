"use client";
import type { Strength } from "@/core/srs";
import type { DayItem } from "@/data/types";

const RATINGS: { value: Strength; label: string; cls: string }[] = [
  { value: "strong", label: "Strong", cls: "data-[on=true]:bg-accent data-[on=true]:text-accent-text" },
  { value: "okay", label: "Okay", cls: "data-[on=true]:bg-warn data-[on=true]:text-white dark:data-[on=true]:text-black" },
  { value: "weak", label: "Weak", cls: "data-[on=true]:bg-danger data-[on=true]:text-white dark:data-[on=true]:text-black" },
];

export function DayItemRow({
  item,
  title,
  detail,
  onToggle,
  onRate,
  onOpen,
  disabled,
}: {
  item: DayItem;
  title: string;
  detail: string;
  onToggle: (done: boolean) => void;
  onRate: (r: Strength) => void;
  onOpen: () => void;
  disabled?: boolean;
}) {
  return (
    <li className="py-3">
      <div className="flex items-start gap-3">
        <button
          role="checkbox"
          aria-checked={item.done}
          aria-label={`Mark ${title} as ${item.done ? "not done" : "done"}`}
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
        <button onClick={onOpen} className="min-w-0 flex-1 text-left" aria-label={`Show the text of ${title}`}>
          <span className={`block text-[15px] font-medium ${item.done ? "text-muted line-through decoration-1" : ""}`}>{title}</span>
          <span className="block text-xs text-muted">{detail} · tap to read</span>
        </button>
      </div>
      {item.done && (
        <div className="mt-2 ml-9 flex gap-1.5" role="group" aria-label="How well did it go?">
          {RATINGS.map((r) => (
            <button
              key={r.value}
              data-on={item.rating === r.value}
              aria-pressed={item.rating === r.value}
              onClick={() => onRate(r.value)}
              disabled={disabled}
              className={`rounded-full border border-border px-3 py-1 text-xs font-medium text-muted transition hover:text-text data-[on=true]:border-transparent ${r.cls}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}
    </li>
  );
}
