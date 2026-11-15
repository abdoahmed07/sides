"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { formatDate, type IsoDate } from "@/core/dates";
import { defaultConfig, type PlanPatch } from "@/core/plan/schema";
import { keyNumbers, type KeyNumbers } from "@/core/plan/summary";
import type { MemUnit } from "@/core/srs";
import type { ChatMessage, PlanVersion } from "@/data/types";
import { repo } from "@/data/dexie";
import { MAX_MESSAGE_CHARS } from "@/ai/schemas";
import { askAssistant } from "@/lib/ai-client";
import { acceptPreview, forecastFor, memorizedSummary, previewChange, ramadanHint, type Preview } from "@/lib/app";
import { Button, Card, PrivacyNote, Spinner, inputCls } from "./ui";
import { FeasibilityNote, PreviewTable } from "./Preview";

type Proposal = { preview: Preview; explanation: string | null; explaining: boolean; request: string; source: PlanVersion["source"] };

const GREETING: Record<"create" | "adjust", string> = {
  create:
    "Tell me about your goal in your own words: what you'd like to memorize, where you'd like to start, how much time you have on which days, and anything you already know by heart.",
  adjust:
    "What would you like to change? For example: “I'm travelling Nov 20–27”, “make Fridays lighter”, “I want to finish before Ramadan”, “this is too fast”, or “add more revision”.",
};

/** Fallback explanation built only from engine numbers, used when AI explanation fails verification. */
export function plainExplanation(after: KeyNumbers, before: KeyNumbers | null): string {
  const parts: string[] = [];
  parts.push(`${after.dailyNewLines} new lines (${after.dailyNewPages} of a page) on ${after.studyDaysPerWeek} days a week (${after.studyDays}).`);
  if (after.done) parts.push("Your whole target is already memorized; the plan is revision only.");
  else if (after.completionDate) parts.push(`Estimated finish: ${formatDate(after.completionDate)}${before?.completionDate && before.completionDate !== after.completionDate ? ` (was ${formatDate(before.completionDate)})` : ""}.`);
  else parts.push("At this setting no new material gets scheduled.");
  parts.push(`About ${after.typicalMinutes} minutes a study day now, rising to about ${after.peakMinutes} as revision grows.`);
  if (!after.feasible) parts.push("This doesn't meet your target date or time limit; see the alternatives below.");
  return parts.join(" ");
}

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

  useEffect(() => {
    let live = true;
    repo.getChat(chatId).then((c) => {
      if (live) setMessages(c?.messages ?? [{ role: "assistant", text: GREETING[purpose], at: new Date().toISOString() }]);
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

  const explain = async (preview: Preview, request: string) => {
    const facts = {
      today,
      before: preview.before,
      after: preview.after,
      alternatives: preview.alternatives.map((a) => ({ label: a.label, numbers: a.numbers })),
    };
    const r = await askAssistant({ mode: "explain", request: request.slice(0, MAX_MESSAGE_CHARS), facts });
    const text = r.ok && r.mode === "explain" && r.verified ? r.reply.text : plainExplanation(preview.after, preview.before);
    setProposal((p) => (p && p.preview === preview ? { ...p, explanation: text, explaining: false } : p));
  };

  const showPreview = (preview: Preview, request: string, source: PlanVersion["source"], withAi: boolean) => {
    setProposal({ preview, explanation: withAi ? null : plainExplanation(preview.after, preview.before), explaining: withAi, request, source });
    setAccepted(false);
    if (withAi) explain(preview, request);
  };

  const send = async () => {
    const text = input.trim();
    if (!text || !messages || sending) return;
    if (text.length > MAX_MESSAGE_CHARS) return setError(`Please keep it under ${MAX_MESSAGE_CHARS} characters.`);
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
          current: plan ? keyNumbers(base, forecastFor(base, units, today)) : null,
          upcomingExceptions: base.exceptions.filter((e) => e.to >= today).map(({ id, from, to, kind }) => ({ id, from, to, kind })),
          nextRamadanStart: ramadanHint(today),
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
          setError(`That change didn't pass the plan's checks (${preview.errors.slice(0, 2).join("; ")}), so nothing was changed. Try rephrasing, or edit by hand.`);
          return;
        }
        showPreview(preview, text, purpose === "create" ? "onboarding" : "ai", true);
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
    showPreview({ ...preview, before: proposal.preview.before }, proposal.request, proposal.source, false);
  };

  const accept = async () => {
    if (!proposal) return;
    const p = purpose === "create" ? { ...proposal.preview, config: { ...proposal.preview.config, startDate: today } } : proposal.preview;
    await acceptPreview(p, proposal.source, proposal.request.slice(0, 200), today);
    setAccepted(true);
    setProposal(null);
    persist([...(messages ?? []), { role: "assistant", text: "Done: the plan is updated.", at: new Date().toISOString() }]);
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
              {m.text}
            </div>
          </li>
        ))}
        {sending && (
          <li className="flex items-center gap-2 text-sm text-muted">
            <Spinner /> Thinking…
          </li>
        )}
      </ol>

      {proposal && (
        <Card className="space-y-3 border-accent/40">
          <h2 className="font-semibold">Proposed change</h2>
          <PreviewTable before={proposal.preview.before} after={proposal.preview.after} />
          <FeasibilityNote k={proposal.preview.after} />
          <p className="text-sm leading-relaxed">
            {proposal.explaining ? (
              <span className="flex items-center gap-2 text-muted">
                <Spinner /> Explaining…
              </span>
            ) : (
              proposal.explanation
            )}
          </p>
          {proposal.preview.alternatives.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Realistic alternatives</p>
              {proposal.preview.alternatives.map((a) => (
                <button
                  key={a.id}
                  onClick={() => pickAlternative(a.patch)}
                  className="w-full rounded-xl border border-border p-3 text-left text-sm hover:border-accent hover:bg-surface-2"
                >
                  <span className="font-medium">{a.label}</span>
                  <span className="block text-xs text-muted">
                    {a.numbers.dailyNewLines} lines/day · {a.numbers.studyDaysPerWeek} days/week · ~{a.numbers.typicalMinutes} min · finish{" "}
                    {a.numbers.completionDate ? formatDate(a.numbers.completionDate) : "—"}
                  </span>
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={accept}>
              Accept
            </Button>
            <Button onClick={editByHand}>Edit by hand</Button>
            <Button variant="ghost" onClick={() => setProposal(null)}>
              Dismiss
            </Button>
          </div>
        </Card>
      )}

      {accepted && purpose === "adjust" && (
        <p className="text-sm text-accent">
          Saved. <Link href="/" className="underline underline-offset-2">Back to today</Link>
        </p>
      )}
      {error && (
        <p className="rounded-xl bg-danger-soft px-3 py-2 text-sm">
          {error}{" "}
          <Link href="/plan/" className="font-medium underline underline-offset-2">
            Edit by hand
          </Link>
        </p>
      )}

      <div ref={bottom} />
      <form
        className="sticky bottom-20 flex gap-2 rounded-2xl border border-border bg-surface p-2 shadow-sm sm:bottom-4"
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
          placeholder="Type your message…"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          aria-label="Message"
        />
        <Button type="submit" variant="primary" disabled={sending || !input.trim()}>
          Send
        </Button>
      </form>
      <div className="flex items-start justify-between gap-4">
        <PrivacyNote />
        <button onClick={clear} className="shrink-0 text-xs text-muted underline underline-offset-2">
          New conversation
        </button>
      </div>
    </div>
  );
}
