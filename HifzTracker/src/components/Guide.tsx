"use client";
import type { ReactNode } from "react";
import { t, tx } from "@/i18n";
import { useLang } from "@/i18n/react";
import { Rich } from "./Language";
import { Card, PageTitle } from "./ui";

const SECTIONS = [
  { id: "words", title: tx("The words") },
  { id: "day", title: tx("Your day, step by step") },
  { id: "memorize", title: tx("How to memorize a new portion") },
  { id: "revise", title: tx("How to revise") },
  { id: "rate", title: tx("How to rate a page") },
  { id: "behind", title: tx("When life gets in the way") },
  { id: "tips", title: tx("Tips that help") },
];

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <Card className="scroll-mt-20 space-y-3">
      <h2 id={id} className="text-lg font-semibold tracking-tight">
        {title}
      </h2>
      <div className="space-y-3 text-[15px] leading-relaxed">{children}</div>
    </Card>
  );
}

function Term({ word, text }: { word: string; text: string }) {
  return (
    <div>
      <dt className="font-semibold">{word}</dt>
      <dd className="text-muted">{text}</dd>
    </div>
  );
}

function Steps({ items }: { items: string[] }) {
  return (
    <ol className="space-y-2">
      {items.map((it, k) => (
        <li key={k} className="flex gap-3">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent">
            {k + 1}
          </span>
          <span>
            <Rich text={it} />
          </span>
        </li>
      ))}
    </ol>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-2 ps-5">
      {items.map((it, k) => (
        <li key={k}>
          <Rich text={it} />
        </li>
      ))}
    </ul>
  );
}

export function Guide() {
  useLang();
  return (
    <div className="space-y-4">
      <PageTitle title={t("Guide")} subtitle={t("What everything means and how to do it. Five minutes to read, worth it once.")} />

      <nav aria-label={t("On this page")} className="flex flex-wrap gap-2">
        {SECTIONS.map((s) => (
          <a key={s.id} href={`#${s.id}`} className="rounded-full border border-border px-3 py-1 text-sm text-muted hover:border-accent hover:text-text">
            {t(s.title)}
          </a>
        ))}
      </nav>

      <Section id="words" title={t("The words")}>
        <dl className="space-y-3">
          <Term word={t("Hifz")} text={t("Memorizing the Quran by heart.")} />
          <Term
            word={t("Sabaq (new)")}
            text={t("Today's new portion: the ayahs you memorize for the first time today. The app picks where it starts and how long it is.")}
          />
          <Term
            word={t("Sabqi (recent)")}
            text={t(
              "Everything you memorized in the last few days (7 by default). New material is fragile, so you recite it every day until it settles.",
            )}
          />
          <Term
            word={t("Manzil (older)")}
            text={t(
              "Everything older, revised in rotation so all of it comes round once per cycle (30 days by default). This is what keeps what you know from fading.",
            )}
          />
          <Term word={t("Juz")} text={t("One of the 30 equal parts of the Quran. Juz 30 is the last, from An-Naba to An-Nas.")} />
          <Term
            word={t("Page and lines")}
            text={t("The app uses the standard Madinah Mushaf: 604 pages, 15 lines a page. “7 lines” means about half a page.")}
          />
          <Term word={t("Cycle")} text={t("How many days it takes manzil to go through everything you know once.")} />
        </dl>
      </Section>

      <Section id="day" title={t("Your day, step by step")}>
        <p className="text-muted">{t("Do them in this order. Revision first means new material never pushes out what you already know.")}</p>
        <Steps
          items={[
            t("**Sabqi:** recite each recent page from memory, then tick it and rate it."),
            t("**Manzil:** recite today's older pages from memory, check against the text, tick and rate."),
            t("**Sabaq:** memorize today's new portion (see below), recite it from memory, then tick it."),
            t("Went further than the portion? Tap **I memorized further** and pick the last ayah you reached. Tomorrow continues from there."),
          ]}
        />
        <p className="text-muted">
          {t(
            "Tap any portion to open its text. The time shown at the top of Today is an estimate; it grows as you know more, because there is more to revise.",
          )}
        </p>
      </Section>

      <Section id="memorize" title={t("How to memorize a new portion")}>
        <p className="text-muted">{t("A method many teachers use. Adjust it to what works for you.")}</p>
        <Steps
          items={[
            t(
              "**Listen first.** Play the portion from a reciter you like two or three times while following the text, so you hear the correct pronunciation before it sticks.",
            ),
            t(
              "**Read it correctly.** Read the whole portion looking at the text, slowly and with tajweed, until you read it without mistakes. Ask a teacher if a word is unclear.",
            ),
            t(
              "**One ayah at a time.** Read the first ayah looking about 5 times, then recite it without looking about 5 times. Long ayahs can be split into phrases.",
            ),
            t(
              "**Link as you go.** After each new ayah, recite it together with the ones before it from the start of the portion. This joins them so you don't get stuck between ayahs.",
            ),
            t("**Recite the whole portion** from memory 3 to 5 times without a mistake. Then it counts as memorized and you can tick it."),
            t(
              "**Recite it again later** the same day, for example in your prayers or before you sleep. It's much stronger tomorrow if you do.",
            ),
          ]}
        />
        <p className="text-muted">
          {t("Always use the same mushaf layout. Your memory holds where each ayah sits on the page, and that helps when you recite.")}
        </p>
      </Section>

      <Section id="revise" title={t("How to revise (sabqi and manzil)")}>
        <p>
          <Rich
            text={t(
              "Revision is **reciting from memory**, not reading. Reading a page you know feels easy and tells you little; reciting it shows you exactly where it's weak.",
            )}
          />
        </p>
        <Steps
          items={[
            t("Glance at the start of the page if you need to, then close it or look away."),
            t("Recite the whole page from memory, out loud or under your breath."),
            t("Where you get stuck or unsure, check the text, then recite that part again from memory."),
            t("Rate it honestly (see below). That decides when the page comes back."),
          ]}
        />
        <p className="text-muted">
          {t(
            "Best of all is reciting to someone who can follow along: a teacher, a friend, or a family member. If nobody is around, record yourself and check the recording against the text.",
          )}
        </p>
      </Section>

      <Section id="rate" title={t("How to rate a page")}>
        <dl className="space-y-3">
          <Term word={t("Strong")} text={t("No mistakes, or one tiny slip you corrected yourself. The page comes back later each time.")} />
          <Term word={t("Okay")} text={t("A few hesitations or small mistakes, but you got through. The page comes back in 3 days.")} />
          <Term word={t("Weak")} text={t("You had to look, got stuck, or made several mistakes. The page comes back tomorrow.")} />
        </dl>
        <p>{t("What a rating changes:")}</p>
        <Bullets
          items={[
            t("**Manzil:** the page comes back when the rating says, ahead of the rest."),
            t("**Sabqi:** a weak page stays in sabqi 3 more days before it moves on to manzil."),
            t("**Sabaq:** if a new portion felt weak, the next one is lighter, so you can make it solid first."),
          ]}
        />
        <p className="text-muted">
          {t(
            "Be honest. If you rate Strong after only reading a page, the app spaces it out too far and it slips without you noticing. Even Strong pages come back at least once per manzil cycle.",
          )}
        </p>
      </Section>

      <Section id="behind" title={t("When life gets in the way")}>
        <Bullets
          items={[
            t("**Missed a day?** Nothing piles up. Today shows a notice where you choose: shift the plan, take a catch-up day, or pause new material for a while."),
            t(
              "**Revision behind?** Overdue pages come first. If the backlog grows, the app halves the new portion or makes the day revision-only until you catch up.",
            ),
            t("**Travel, exams, Ramadan?** Add them in **Plan → More options** (or tell the assistant). Those days get lighter automatically."),
            t("**Too much or too little?** Use **Adjust plan** on Today. Every change shows the new finish date and time before you accept it."),
          ]}
        />
      </Section>

      <Section id="tips" title={t("Tips that help")}>
        <Bullets
          items={[
            t("Same time every day. Many people find the time after Fajr easiest, when the mind is fresh."),
            t("Short and daily beats long and occasional. A small portion every day lasts longer than a big one once a week."),
            t("Recite what you've memorized in your prayers. It's the most natural revision there is."),
            t("Understand what you memorize: read a translation of the portion once. Meaning makes it easier to hold."),
            t("Never skip revision to do more new material. Strong old pages are worth more than many weak new ones."),
          ]}
        />
      </Section>
    </div>
  );
}
