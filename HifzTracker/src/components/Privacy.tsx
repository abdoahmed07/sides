"use client";
import type { ReactNode } from "react";
import { t } from "@/i18n";
import { useLang } from "@/i18n/react";
import { Rich } from "./Language";
import { Card, PageTitle } from "./ui";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="space-y-2">
      <h2 className="font-semibold">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-muted">{children}</div>
    </Card>
  );
}

const P = ({ text }: { text: string }) => (
  <p>
    <Rich text={text} />
  </p>
);

/** What Hifz Tracker stores, where, who else is involved, and how to remove it. Keep it true to the app. */
export function Privacy() {
  useLang();
  return (
    <div className="space-y-4">
      <PageTitle title={t("Privacy")} subtitle={t("What Hifz Tracker stores, where, and how to remove it. Last updated: November 2026.")} />

      <Section title={t("In short")}>
        <P text={t("Your plan and progress stay on your device. If you make an account, a copy is saved so you can use it on other devices. No ads, no tracking, nothing sold.")} />
        <P text={t("Hifz Tracker is a free, independent project. Questions about your data? [Contact us](/contact/).")} />
      </Section>

      <Section title={t("On your device")}>
        <P text={t("Your plan, progress, ratings, history and settings are stored in your browser on this device. Without an account, they never leave it (except what you send to the assistant, see below).")} />
      </Section>

      <Section title={t("If you make an account")}>
        <P
          text={t(
            "We store your email, your password (encrypted; nobody can read it) and a copy of your plan and progress, so it can sync between your devices. This is stored with Supabase, in the EU.",
          )}
        />
        <P text={t("The app only lets you read your own data. The developer has technical access to the database to keep it running, but does not look at your progress.")} />
      </Section>

      <Section title={t("If you use the assistant")}>
        <P
          text={t(
            "Your message, your plan settings and short totals (like “about 23 pages memorized”) are sent to Anthropic's Claude to write the reply. Your day-by-day history is not. Under Anthropic's API terms this isn't used to train their models.",
          )}
        />
        <P text={t("To keep the assistant free, we count how many messages each account sends per day. Only the count is stored, not the messages.")} />
      </Section>

      <Section title={t("Listening and reciting")}>
        <P text={t("Recitation audio streams from the Islamic Network audio library when you press play.")} />
        <P
          text={t(
            "**Recite and check** listens through your microphone only while you recite, and the speech recognition runs on your device: your voice is never recorded or sent anywhere. The first time, the speech model (about 45 MB) downloads from Hugging Face.",
          )}
        />
      </Section>

      <Section title={t("If you contact us")}>
        <P text={t("Your email and message are sent through Formspree to the developer's inbox, only to answer you.")} />
      </Section>

      <Section title={t("Hosting")}>
        <P text={t("The app is hosted on Vercel. Like any website, it handles basic technical data (such as your IP address) to deliver the pages. We don't use analytics or tracking cookies.")} />
      </Section>

      <Section title={t("Your choices")}>
        <P text={t("**Download a copy** of everything any time: Settings → Your data.")} />
        <P text={t("**Delete your progress:** Settings → Delete my progress (on this device, and in your account if you're signed in).")} />
        <P text={t("**Delete your account:** Settings → Delete my account. This removes your login, the progress saved in it and your assistant counts.")} />
        <P text={t("For anything else, like deleting a message you sent us, [contact us](/contact/).")} />
      </Section>
    </div>
  );
}
