"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { formatDate, type IsoDate } from "@/core/dates";
import { defaultConfig, type PlanPatch } from "@/core/plan/schema";
import { keyNumbers } from "@/core/plan/summary";
import { memorizedRanges } from "@/core/plan/preview";
import type { MemUnit } from "@/core/srs";
import type { ChatMessage, PlanVersion } from "@/data/types";
import { repo } from "@/data/dexie";
import { MAX_MESSAGE_CHARS } from "@/ai/schemas";
import { AI_NEEDS_SIGN_IN, askAssistant } from "@/lib/ai-client";
import { acceptPreview, forecastFor, memorizedSummary, previewChange, q, ramadanHint, type Preview } from "@/lib/app";
import { Button, Card, PrivacyNote, Spinner, inputCls } from "./ui";
import { FeasibilityNote, PreviewTable } from "./Preview";
import { useSyncStatus } from "./Account";
import { getLang, t, tx } from "@/i18n";
import { useLang } from "@/i18n/react";
import { Rich } from "./Language";

type Proposal = { preview: Preview; request: string; source: PlanVersion["source"] };

const GREETING: Record<"create" | "adjust", string> = {
  create: tx(
    "Tell me about your goal in your own words: what you'd like to memorize, where you'd like to start, how much time you have on which days, and anything you already know by heart.",
  ),
  adjust: tx(
    "What would you like to change? For example: “I'm travelling Nov 20–27”, “make Fridays lighter”, “I want to finish before Ramadan”, “this is too fast”, or “add more revision”.",
  ),
};
const DONE_TEXT = tx("Done: the plan is updated.");
/** A conversation left for longer than this starts over the next time. */
const RESUME_WITHIN_MS = 2 * 60 * 60 * 1000;
/** Messages the app wrote itself are stored in English and shown in the active language. */
const shown = (text: string) => (text === GREETING.create || text === GREETING.adjust || text === DONE_TEXT ? t(text) : text);

export function PlanChat({
  purpose,
  plan,
  units,
  today,
}: {
  purpose: "create" | "adjust";
  plan: PlanVersion | null;
  units: MemUnit[];
  today: IsoDate;
}) {
  const router = useRouter();
  const chatId = `plan-${purpose}`;
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [accepted, setAccepted] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  useLang();
  const sync = useSyncStatus();
  const needsSignIn = AI_NEEDS_SIGN_IN && (sync.phase === "signed-out" || sync.phase === "off");

  useEffect(() => {
    let live = true;
    repo.getChat(chatId).then((c) => {
      if (!live) return;
      // Pick up a conversation that's still going; otherwise start fresh (after a change was saved, or after a break).
      const last = c?.messages[c.messages.length - 1];
      const fresh = !c || last?.text === DONE_TEXT || Date.now() - Date.parse(c.updatedAt) > RESUME_WITHIN_MS;
      setMessages(fresh ? [{ role: "assistant", text: GREETING[purpose], at: new Date().toISOString() }] : c.messages);
    });
    return () => {
      live = false;
    };
  }, [chatId, purpose]);
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, proposal]);

  const persist = (msgs: ChatMessage[]) => {
    setMessages(msgs);
    repo.putChat({ id: chatId, messages: msgs.slice(-40), updatedAt: new Date().toISOString() });
  };

  const base = plan?.config ?? defaultConfig(today);

  const showPreview = (preview: Preview, request: string, source: PlanVersion["source"]) => {
    setProposal({ preview, request, source });
    setAccepted(false);
  };

  const send = async () => {
    const text = input.trim();
    if (!text || !messages || sending) return;
    if (text.length > MAX_MESSAGE_CHARS) return setError(t("Please keep it under {n} characters.", { n: MAX_MESSAGE_CHARS }));
    setError(null);
    setSending(true);
    setProposal(null);
    const now = new Date().toISOString();
    const msgs: ChatMessage[] = [...messages, { role: "user", text, at: now }];
    persist(msgs);
    setInput("");
    try {
      const turns = msgs.slice(-12).map((m) => ({ role: m.role, text: m.text.slice(0, MAX_MESSAGE_CHARS) }));
      const r = await askAssistant({
        mode: "plan",
        purpose,
        messages: turns,
        context: {
          today,
          config: base,
          memorizedSummary: memorizedSummary(units),
          memorizedRanges: memorizedRanges(units, q),
          current: plan ? keyNumbers(base, forecastFor(base, units, today)) : null,
          upcomingExceptions: base.exceptions.filter((e) => e.to >= today).map(({ id, from, to, kind }) => ({ id, from, to, kind })),
          nextRamadanStart: ramadanHint(today),
          language: getLang(),
        },
      });
      if (!r.ok) {
        setError(r.error.message);
        return;
      }
      if (r.mode !== "plan") return;
      const reply = r.reply;
      let replyText = reply.message;
      if (reply.kind === "ask" && reply.questions.length) replyText += "\n\n" + reply.questions.map((x) => `• ${x}`).join("\n");
      persist([...msgs, { role: "assistant", text: replyText, at: new Date().toISOString() }]);
      if (reply.kind === "propose") {
        const preview = previewChange({ base, hasPlan: !!plan, patch: reply.patch, markMemorized: reply.markMemorized, units, today });
        if (!preview.ok) {
          setError(
            t("That change didn't pass the plan's checks ({errors}), so nothing was changed. Try rephrasing, or edit by hand.", {
              errors: preview.errors.slice(0, 2).join("; "),
            }),
          );
          return;
        }
        showPreview(preview, text, purpose === "create" ? "onboarding" : "ai");
      }
    } finally {
      setSending(false);
    }
  };

  const pickAlternative = (patch: PlanPatch) => {
    if (!proposal) return;
    const preview = previewChange({ base: proposal.preview.config, hasPlan: !!plan, patch, units: proposal.preview.units, today });
    if (!preview.ok) return setError(preview.errors.join("; "));
    // Keep "before" as the saved plan, not the rejected proposal.
    showPreview({ ...preview, before: proposal.preview.before }, proposal.request, proposal.source);
  };

  const accept = async () => {
    if (!proposal) return;
    const p = purpose === "create" ? { ...proposal.preview, config: { ...proposal.preview.config, startDate: today } } : proposal.preview;
    await acceptPreview(p, proposal.source, proposal.request.slice(0, 200), today);
    setAccepted(true);
    setProposal(null);
    persist([...(messages ?? []), { role: "assistant", text: DONE_TEXT, at: new Date().toISOString() }]);
    if (purpose === "create") router.push("/");
  };

  const editByHand = async () => {
    if (!proposal) return;
    await repo.setMeta("draft", { config: proposal.preview.config, note: proposal.request.slice(0, 200) });
    router.push("/plan/");
  };

  const clear = () => {
    setProposal(null);
    persist([{ role: "assistant", text: GREETING[purpose], at: new Date().toISOString() }]);
  };

  if (!messages) return null;

  return (
    <div className="space-y-3">
      <ol className="space-y-3" aria-live="polite">
        {messages.map((m, k) => (
          <li key={k} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed ${
                m.role === "user" ? "bg-accent text-accent-text" : "border border-border bg-surface"
              }`}
            >
              {m.role === "assistant" ? shown(m.text) : m.text}
            </div>
          </li>
        ))}
        {sending && (
          <li className="flex items-center gap-2 text-sm text-muted">
            <Spinner /> {t("Thinking…")}
          </li>
        )}
      </ol>

      {proposal && (
        <Card className="space-y-3 border-accent/40">
          <h2 className="font-semibold">{t("Proposed change")}</h2>
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">{t("What changes")}</p>
            <ul className="list-disc space-y-0.5 ps-5 text-sm">
              {proposal.preview.changes.length ? proposal.preview.changes.map((c) => <li key={c}>{c}</li>) : <li>{t("Nothing")}</li>}
            </ul>
          </div>
          <PreviewTable before={proposal.preview.before} after={proposal.preview.after} />
          <FeasibilityNote k={proposal.preview.after} />
          {proposal.preview.alternatives.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">{proposal.preview.after.meetsTarget === false ? t("Realistic alternatives") : t("Other options")}</p>
              {proposal.preview.alternatives.map((a) => (
                <button
                  key={a.id}
                  onClick={() => pickAlternative(a.patch)}
                  className="w-full rounded-xl border border-border p-3 text-start text-sm hover:border-accent hover:bg-surface-2"
                >
                  <span className="font-medium">{a.label}</span>
                  <span className="block text-xs text-muted">
                    {t("{lines} lines/day · {days} days/week · ~{min} min · finish {date}", {
                      lines: a.numbers.dailyNewLines,
                      days: a.numbers.studyDaysPerWeek,
                      min: a.numbers.typicalMinutes,
                      date: a.numbers.completionDate ? formatDate(a.numbers.completionDate) : "—",
                    })}
                  </span>
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={accept}>
              {t("Accept")}
            </Button>
            <Button onClick={editByHand}>{t("Edit by hand")}</Button>
            <Button variant="ghost" onClick={() => setProposal(null)}>
              {t("Dismiss")}
            </Button>
          </div>
        </Card>
      )}

      {accepted && purpose === "adjust" && (
        <p className="text-sm text-accent">
          {t("Saved.")}{" "}
          <Link href="/" className="underline underline-offset-2">
            {t("Back to today")}
          </Link>
        </p>
      )}
      {error && (
        <p className="rounded-xl bg-danger-soft px-3 py-2 text-sm">
          {error}{" "}
          <Link href="/plan/" className="font-medium underline underline-offset-2">
            {t("Edit by hand")}
          </Link>
        </p>
      )}

      <div ref={bottom} />
      {needsSignIn ? (
        <Card className="space-y-2 text-sm">
          <p className="font-medium">{t("Make a free account to use the assistant.")}</p>
          <p className="text-muted">{t("It keeps your progress safe and lets you use it on your phone and computer. Your progress on this device is kept.")}</p>
          <Link href="/settings/#account">
            <Button variant="primary">{t("Create account or sign in")}</Button>
          </Link>
          <p className="text-muted">
            <Rich
              text={t("Or [set up the plan by hand]({href}), no account needed.", { href: purpose === "create" ? "/plan/?new=1" : "/plan/" })}
            />
          </p>
        </Card>
      ) : (
        <form
          className="sticky bottom-[calc(5.25rem+env(safe-area-inset-bottom))] flex gap-2 rounded-2xl border border-border bg-surface p-2 shadow-sm sm:bottom-4"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <textarea
            className={`${inputCls} min-h-11 resize-none border-0 focus:ring-0`}
            rows={2}
            value={input}
            maxLength={MAX_MESSAGE_CHARS}
            placeholder={t("Type your message…")}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            aria-label={t("Message")}
          />
          <Button type="submit" variant="primary" disabled={sending || !input.trim()}>
            {t("Send")}
          </Button>
        </form>
      )}
      <div className="flex items-start justify-between gap-4">
        <PrivacyNote />
        <button onClick={clear} className="shrink-0 text-xs text-muted underline underline-offset-2">
          {t("New conversation")}
        </button>
      </div>
    </div>
  );
}
