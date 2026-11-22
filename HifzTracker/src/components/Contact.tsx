"use client";
import Link from "next/link";
import { useState } from "react";
import { getLang, t } from "@/i18n";
import { useLang } from "@/i18n/react";
import { useSyncStatus } from "./Account";
import { Button, Card, Field, inputCls, PageTitle, Spinner } from "./ui";

/** Same Formspree form as the portfolio's contact form; messages arrive by email with the subject "Hifz Tracker". */
const FORM_URL = "https://formspree.io/f/xvzdrjpg";

export function ContactForm() {
  useLang();
  const sync = useSyncStatus();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const from = email || sync.email || "";

  const send = async () => {
    setState("sending");
    try {
      const body = new FormData();
      body.set("email", from.trim());
      body.set("message", message.trim());
      body.set("_subject", "Hifz Tracker");
      body.set("app", `Hifz Tracker (${getLang()}${sync.email ? ", signed in" : ""})`);
      const res = await fetch(FORM_URL, { method: "POST", body, headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(String(res.status));
      setMessage("");
      setState("sent");
    } catch {
      setState("error");
    }
  };

  return (
    <div className="space-y-4">
      <PageTitle title={t("Contact us")} subtitle={t("Questions, problems or ideas? Send a message and we'll answer by email.")} />
      <Card className="space-y-3">
        {state === "sent" ? (
          <>
            <p className="font-medium">{t("Thanks, your message was sent.")}</p>
            <p className="text-sm text-muted">{t("We'll reply to {email} as soon as we can.", { email: from })}</p>
            <Button onClick={() => setState("idle")}>{t("Send another message")}</Button>
          </>
        ) : (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <Field label={t("Your email")}>
              <input type="email" required autoComplete="email" className={inputCls} value={from} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label={t("Message")}>
              <textarea
                required
                rows={6}
                maxLength={5000}
                className={`${inputCls} min-h-32 py-2`}
                value={message}
                placeholder={t("What can we help with?")}
                onChange={(e) => setMessage(e.target.value)}
              />
            </Field>
            <Button type="submit" variant="primary" disabled={state === "sending" || !/\S+@\S+\.\S+/.test(from) || !message.trim()}>
              {state === "sending" ? <Spinner /> : t("Send message")}
            </Button>
            {state === "error" && <p className="text-sm text-danger">{t("Something went wrong. Check your connection and try again.")}</p>}
          </form>
        )}
      </Card>
      <p className="px-1 text-xs text-muted">
        {t("Your email is only used to answer you.")}{" "}
        <Link href="/guide/" className="text-accent underline-offset-2 hover:underline">
          {t("The guide answers the most common questions.")}
        </Link>
      </p>
    </div>
  );
}

/** "Need help? Contact us" at the bottom of every page. */
export function HelpFooter() {
  useLang();
  return (
    <footer className="mt-10 border-t border-border pt-4 text-center text-xs text-muted">
      {t("Need help or have an idea?")}{" "}
      <Link href="/contact/" className="font-medium text-accent underline-offset-2 hover:underline">
        {t("Contact us")}
      </Link>
      <span aria-hidden> · </span>
      <Link href="/privacy/" className="underline-offset-2 hover:underline">
        {t("Privacy")}
      </Link>
    </footer>
  );
}
