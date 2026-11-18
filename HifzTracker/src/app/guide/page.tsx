import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Card, PageTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Guide · Hifz Tracker" };

const SECTIONS = [
  { id: "words", title: "The words" },
  { id: "day", title: "Your day, step by step" },
  { id: "memorize", title: "How to memorize a new portion" },
  { id: "revise", title: "How to revise" },
  { id: "rate", title: "How to rate a page" },
  { id: "behind", title: "When life gets in the way" },
  { id: "tips", title: "Tips that help" },
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

function Term({ word, children }: { word: string; children: ReactNode }) {
  return (
    <div>
      <dt className="font-semibold">{word}</dt>
      <dd className="text-muted">{children}</dd>
    </div>
  );
}

function Steps({ items }: { items: ReactNode[] }) {
  return (
    <ol className="space-y-2">
      {items.map((it, k) => (
        <li key={k} className="flex gap-3">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent">
            {k + 1}
          </span>
          <span>{it}</span>
        </li>
      ))}
    </ol>
  );
}

export default function GuidePage() {
  return (
    <div className="space-y-4">
      <PageTitle title="Guide" subtitle="What everything means and how to do it. Five minutes to read, worth it once." />

      <nav aria-label="On this page" className="flex flex-wrap gap-2">
        {SECTIONS.map((s) => (
          <a key={s.id} href={`#${s.id}`} className="rounded-full border border-border px-3 py-1 text-sm text-muted hover:border-accent hover:text-text">
            {s.title}
          </a>
        ))}
      </nav>

      <Section id="words" title="The words">
        <dl className="space-y-3">
          <Term word="Hifz">Memorizing the Quran by heart.</Term>
          <Term word="Sabaq (new)">
            Today&apos;s new portion: the ayahs you memorize for the first time today. The app picks where it starts and how long it is.
          </Term>
          <Term word="Sabqi (recent)">
            Everything you memorized in the last few days (7 by default). New material is fragile, so you recite it every day until it
            settles.
          </Term>
          <Term word="Manzil (older)">
            Everything older, revised in rotation so all of it comes round once per cycle (30 days by default). This is what keeps
            what you know from fading.
          </Term>
          <Term word="Juz">One of the 30 equal parts of the Quran. Juz 30 is the last, from An-Naba to An-Nas.</Term>
          <Term word="Page and lines">
            The app uses the standard Madinah Mushaf: 604 pages, 15 lines a page. &ldquo;7 lines&rdquo; means about half a page.
          </Term>
          <Term word="Cycle">How many days it takes manzil to go through everything you know once.</Term>
        </dl>
      </Section>

      <Section id="day" title="Your day, step by step">
        <p className="text-muted">Do them in this order. Revision first means new material never pushes out what you already know.</p>
        <Steps
          items={[
            <>
              <b>Sabqi:</b> recite each recent page from memory, then tick it and rate it.
            </>,
            <>
              <b>Manzil:</b> recite today&apos;s older pages from memory, check against the text, tick and rate.
            </>,
            <>
              <b>Sabaq:</b> memorize today&apos;s new portion (see below), recite it from memory, then tick it.
            </>,
            <>
              Went further than the portion? Tap <b>I memorized further</b> and pick the last ayah you reached. Tomorrow continues from
              there.
            </>,
          ]}
        />
        <p className="text-muted">
          Tap any portion to open its text. The time shown at the top of Today is an estimate; it grows as you know more, because there
          is more to revise.
        </p>
      </Section>

      <Section id="memorize" title="How to memorize a new portion">
        <p className="text-muted">A method many teachers use. Adjust it to what works for you.</p>
        <Steps
          items={[
            <>
              <b>Listen first.</b> Play the portion from a reciter you like two or three times while following the text, so you hear the
              correct pronunciation before it sticks.
            </>,
            <>
              <b>Read it correctly.</b> Read the whole portion looking at the text, slowly and with tajweed, until you read it without
              mistakes. Ask a teacher if a word is unclear.
            </>,
            <>
              <b>One ayah at a time.</b> Read the first ayah looking about 5 times, then recite it without looking about 5 times. Long
              ayahs can be split into phrases.
            </>,
            <>
              <b>Link as you go.</b> After each new ayah, recite it together with the ones before it from the start of the portion. This
              joins them so you don&apos;t get stuck between ayahs.
            </>,
            <>
              <b>Recite the whole portion</b> from memory 3 to 5 times without a mistake. Then it counts as memorized and you can tick it.
            </>,
            <>
              <b>Recite it again later</b> the same day, for example in your prayers or before you sleep. It&apos;s much stronger
              tomorrow if you do.
            </>,
          ]}
        />
        <p className="text-muted">
          Always use the same mushaf layout. Your memory holds where each ayah sits on the page, and that helps when you recite.
        </p>
      </Section>

      <Section id="revise" title="How to revise (sabqi and manzil)">
        <p>
          Revision is <b>reciting from memory</b>, not reading. Reading a page you know feels easy and tells you little; reciting it
          shows you exactly where it&apos;s weak.
        </p>
        <Steps
          items={[
            <>Glance at the start of the page if you need to, then close it or look away.</>,
            <>Recite the whole page from memory, out loud or under your breath.</>,
            <>Where you get stuck or unsure, check the text, then recite that part again from memory.</>,
            <>Rate it honestly (see below). That decides when the page comes back.</>,
          ]}
        />
        <p className="text-muted">
          Best of all is reciting to someone who can follow along: a teacher, a friend, or a family member. If nobody is around, record
          yourself and check the recording against the text.
        </p>
      </Section>

      <Section id="rate" title="How to rate a page">
        <dl className="space-y-3">
          <Term word="Strong">No mistakes, or one tiny slip you corrected yourself. The page comes back later each time.</Term>
          <Term word="Okay">A few hesitations or small mistakes, but you got through. The page comes back a little later.</Term>
          <Term word="Weak">You had to look, got stuck, or made several mistakes. The page comes back tomorrow.</Term>
        </dl>
        <p className="text-muted">
          Be honest. If you rate Strong after only reading a page, the app spaces it out too far and it slips without you noticing. Even
          Strong pages come back at least once per manzil cycle.
        </p>
      </Section>

      <Section id="behind" title="When life gets in the way">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <b>Missed a day?</b> Nothing piles up. Today shows a notice where you choose: shift the plan, take a catch-up day, or pause
            new material for a while.
          </li>
          <li>
            <b>Revision behind?</b> Overdue pages come first. If the backlog grows, the app halves the new portion or makes the day
            revision-only until you catch up.
          </li>
          <li>
            <b>Travel, exams, Ramadan?</b> Add an exception in <b>Plan</b> (or tell the assistant). Those days get lighter automatically.
          </li>
          <li>
            <b>Too much or too little?</b> Use <b>Adjust plan</b> on Today. Every change shows the new finish date and time before you
            accept it.
          </li>
        </ul>
      </Section>

      <Section id="tips" title="Tips that help">
        <ul className="list-disc space-y-2 pl-5">
          <li>Same time every day. Many people find the time after Fajr easiest, when the mind is fresh.</li>
          <li>Short and daily beats long and occasional. A small portion every day lasts longer than a big one once a week.</li>
          <li>Recite what you&apos;ve memorized in your prayers. It&apos;s the most natural revision there is.</li>
          <li>Understand what you memorize: read a translation of the portion once. Meaning makes it easier to hold.</li>
          <li>Never skip revision to do more new material. Strong old pages are worth more than many weak new ones.</li>
        </ul>
      </Section>
    </div>
  );
}
