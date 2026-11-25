# Hifz Tracker

A calm, local-first app for memorizing the Quran. You describe your goal (in a chat or a form), the planning engine turns it into a daily routine, and the app tracks your progress and revision strength.

- **Sabaq** (new), **sabqi** (last N days) and **manzil** (a rotating slice of everything older) each day.
- Ratings change the plan, and Today says how: in manzil a page rated Weak comes back the next day and Okay after 3 days (on top of the day's usual share), Strong pushes it later; a Weak page in sabqi stays there 3 more days; after a Weak new portion the next one is lighter. Overdue revision comes before new material.
- If you miss days, nothing piles up. You choose to shift the plan, take a catch-up day, or pause new material.
- Did more than your portion? Tap **I memorized further** under Sabaq and pick the last ayah you reached. It is recorded as memorized today, tomorrow continues after it, and the finish date moves earlier. Your daily amount stays the same.
- Weekly readings (e.g. Al-Kahf on Fridays) appear on Today that day as a separate Reading card: tick only, no rating, no effect on revision or the finish date.
- Mushaf map (604 pages), progress by juz and surah, streaks, heatmap, JSON backup. Progress shows what today added (+5 ayahs); finishing the day shows what it added, any surah, juz or round number reached, and an ayah about the Quran.
- **Your week** (`/checkin/`): ayahs learned, whole pages, revision and study days compared with the week before, what you finished, how revision went, and a few honest words on what might help. Today points to it once a week; the assistant's suggestions come on top where it's available.
- The Quran tab lists the surahs and the 30 juz (where each starts, its pages and opening words), each with a ring for how much you've memorized, and picks up where you left off.

**AI proposes, the engine computes, you approve.** The assistant (Claude) only ever returns a validated `PlanConfig` patch and never a schedule or Quran text. The deterministic engine computes the schedule and the numbers, and nothing changes until you tap Accept.

## Run it locally (everything, including AI)

```bash
pnpm install
cp .env.example .env.local   # then put your ANTHROPIC_API_KEY in it
pnpm dev                     # http://localhost:3000
```

Without a key the app still works: the AI screens show a friendly message and point you to the manual form.

## Sign-in and sync (optional)

People can make an account (email and password) to keep their progress in their account and use it on several devices. Without signing in, everything stays in the browser as before.

How it works: the whole local database is stored as one private row per account in Supabase (`hifz_snapshots`, only readable by its owner). Every change uploads a few seconds later; opening the app or coming back to it downloads newer progress. Each upload carries a revision number, so two devices can't silently overwrite each other: if both changed, the app asks which progress to keep.

One-time setup (Hifz Tracker has its own Supabase project):

1. Supabase → SQL Editor: run `supabase/schema.sql`, then `supabase/delete-account.sql` (lets people delete their own account in Settings).
2. Authentication → Sign In / Providers → Email: keep it enabled, with **Confirm email** on. New accounts get one confirmation email; the link can be opened on any device, then the person signs in with their password anywhere. "Forgot password?" sends a reset link.
3. Authentication → URL Configuration: Site URL `https://abdoahmed07.github.io/sides/hifz/`; Redirect URLs `http://localhost:3000/**`, `http://localhost:3100/**` and `https://abdoahmed07.github.io/sides/hifz/**`.
4. Locally: put the project URL and anon key (Project Settings → API) in `.env.local` as `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, then restart `pnpm dev`.
5. For the Pages build: add the same two values as repository variables `HIFZ_SUPABASE_URL` and `HIFZ_SUPABASE_ANON_KEY` (GitHub → Settings → Secrets and variables → Actions → Variables).

Supabase's built-in email sender only allows a few emails per hour; for more users, add your own SMTP in Authentication → Emails.

## Listen and Recite

Every portion's text sheet has a player (`src/components/Listen.tsx`): **Listen** (straight through), **Repeat after** (one ayah, then it waits for you; no timers) and **Link** (ayah 1, 1–2, 1–3…), with Alafasy, Abdul Basit and Al-Husary from EveryAyah (everyayah.com, one MP3 per ayah; it sends CORS headers, which the cross-origin-isolated pages need).

**Recite** checks a recitation word by word, like Tarteel, in one of two modes:

- **Phone recognition** (default where the browser has it: Chrome, Edge, Safari, Samsung Internet): the browser's own speech recognition (Web Speech API, `ar-SA`; Google on Android/Chrome, Apple on iPhone/Safari), in `src/recite/webspeech.ts`. Nothing to download, it streams words back while you speak, and it copes with all kinds of voices. Like voice typing, the audio goes to Google or Apple. Browsers differ (Chrome sends pieces marked final; Android and iPhone send one growing result, and iPhone may never mark it final), so results are assembled into one running text. When the text stops changing for a moment (or the browser marks it final) you've paused, and what you said is settled, a wrong word you stopped on included. `follow.ts` keeps track of where you are: you can start anywhere in the portion (Ayat al-Kursi in a whole Al-Baqarah: the first words you say are looked up, listening on while they fit more than one place, as with يا أيها الذين آمنوا or Ash-Shu'ara's repeated ayahs), skip ahead (the words in between are skipped, even across Ar-Rahman's refrain) or go back to repeat yourself (not a mistake). Reciting on without a pause, older words are settled as you go, so each word costs the same to check however long you recite. Reciting freely (from the Quran tab), the result counts the stretch you recited; a portion you were given counts whole. Sessions that end are restarted; if it can't run (blocked, dictation off, some installed iPhone apps), the app says why and offers private mode.
- **Private mode** (and the fallback, e.g. in Firefox): everything stays on the device. Tarteel's open `whisper-tiny-ar-quran` model (Apache-2.0, ONNX conversion `Sharjeelbaig/whisper-tiny-ar-quran-onnx`, downloaded once on request) runs in a web worker with transformers.js (`src/recite/`). Where the graphics chip is fast (WebGPU, timed at start-up), the encoder runs there in full precision (~70 MB download); otherwise everything runs compressed on the processor (~45 MB).

How it listens (`mic.ts`): the microphone is read on the browser's audio thread (an AudioWorklet), so a busy page never drops sound; audio is cut at pauses, with a short pre-roll before the voice starts and an overlap at forced cuts, so no word is lost at a cut. Live previews run whenever the model is free. The hosted build sends cross-origin-isolation headers (`next.config.ts`), so the model uses several processor cores (2–3× faster); that's why the audio comes from a CORS-enabled source. Reciting shows one mushaf page at a time (about as much as Al-Fatiha's page): before you start you can turn to the page you want to start on, and while you recite the page turns by itself; finding where you are only looks as far as the next page, so a phrase that comes again much later can't pull you there. The opening letters of a surah (الٓمٓ, حمٓ…), recited as long drawn-out letter names that phones hear badly, count as said once the words after them are heard. A pause only settles what you said after 1.8 s, long enough for a drawn-out word (madd), and if the phone corrects itself after that, a word marked wrong becomes right. The ring around the microphone shows the real level (on a decibel scale, so a quiet voice moves it too; with phone recognition it listens alongside, and turns itself off on a device where that gets in the way). What shows (`reveal.ts`): words are revealed strictly in order, a live mistake shows once two right words follow it, and the last heard word only when it's (almost) exact, since it may be cut off. When you pause, a mistake you stopped on shows too (a word that may be the start of the next one, like the يا of يا أيها, waits for the rest). How it judges (`match.ts`, `ReciteCheck.tsx`): heard words are aligned to the Uthmani text (folded to one spelling, fuzzy edit distance; both spellings of small-alef words count, إِلَـٰهِ = إله and مَـٰلِكِ = مالك; one heard word may match two written ones or the reverse, as with يَٰٓأَيُّهَا = "يا أيها"; on a tie, a repeated word like الناس goes with its first place). Phone recognition writes real words, so it's checked strictly (`known`: every word of the Quran): a heard word counts only when it's the same word in some spelling (hamza, small alef, silent letters, the alef of tanween, يا written apart, opening letters said by name as in ألف لام ميم), and another word of the Quran (الرحيم for الرحمن, تعلمون for يعلمون) is a mistake. Checked against Tanzil's plain-spelling text of the whole Quran: a correct recitation gets 5 of 77,433 words flagged, and 99% of similar-word slips put in on purpose are caught. Private mode stays forgiving (a misheard letter or two), since the small model mishears. A word any check heard confidently stays right; before calling anything a mistake, the part is listened to a second time together with the part before it (the model recognizes a continuation far better than a fragment), and a part it couldn't make sense of is checked again with the next one instead of being lost. It checks words, not tajweed, and can mishear; people can tap a red word to correct it. The rating is only suggested and confirmed by the person. In development, `window.__recite` in the browser console logs every check.

**Recordings, for fixing what goes wrong.** Every recitation is recorded (`src/recite/record.ts`): what the phone's recognition wrote and when, the microphone level and what the app decided; never sound. After a recitation, **What the app heard → Save a recording of this recitation** saves it (on a phone through the share sheet, e.g. AirDrop to a computer). While developing (`pnpm dev`), each finished recording is also saved in `recordings/` (git-ignored) by `/api/recordings`. A recording can be replayed in the app with a stand-in recognizer that sends the same results at the same moments, to see exactly what the app made of them and to check a fix.

## Install as an app

The app can be installed from the browser (no app store): iPhone → Share → **Add to Home Screen**; Android/Chrome → **Install app**. Settings shows the right steps for each device. Installed, it opens full screen and works offline: `public/sw.js` keeps a copy of the pages and built files (network first for pages, so updates arrive when online), and `src/app/manifest.ts` gives the name, colours and icons. The worker is off during `pnpm dev`.

The logo is the ۞ Rub el Hizb with a progress ring. `python3 scripts/make-icons.py` redraws every icon (needs Pillow).

## Hosting on Vercel (everything, including AI, for everyone)

The full app (with the AI route) runs on Vercel's free Hobby plan. Every assistant message is billed to your Anthropic key, so on the hosted app the AI only works for **signed-in** people, with a **daily limit per account** (`AI_DAILY_LIMIT`, default 30). `pnpm dev` skips both unless you set `AI_REQUIRE_SIGN_IN=1`.

One-time setup:

1. Supabase → SQL Editor: run `supabase/ai-usage.sql` (the daily counter).
2. vercel.com → Add New → Project → import the `sides` repo. **Root Directory: `HifzTracker`** (framework: Next.js; the build command stays `pnpm build`).
3. Environment variables (Project → Settings → Environment Variables):
   - `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` (e.g. `claude-haiku-5-5`)
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - optional: `AI_DAILY_LIMIT`
4. Deploy. Every push to `main` deploys again.
5. Supabase → Authentication → URL Configuration: Site URL = the Vercel address; add `https://<your-app>.vercel.app/**` to Redirect URLs.
6. Anthropic console → set a monthly spend limit.
7. GitHub → repo variable `HIFZ_APP_URL` = the Vercel address (no trailing slash). The old Pages address then sends people with nothing saved straight there, and asks people with progress to sign in first so it comes with them.

## GitHub Pages build (no server, no AI)

```bash
pnpm build:pages             # static export in ./out, served under /sides/hifz
```

The repo's Pages workflow builds this on every push to `main` that touches `HifzTracker/`. The AI route is left out of this build (files named `*.server.ts` are only included in the local build; see `next.config.ts`), and the UI hides the chat. To move data between your computer and your phone, sign in on both (or use **Settings → Export / Import JSON**).

## Scripts

| Command | What it does |
|---|---|
| `pnpm test` | Vitest: engine, spaced repetition, missed days, stats, patches, AI-output validation |
| `pnpm fetch:quran` | Re-downloads the Quran data from Quran.com API v4 and re-derives the layout/text files (rarely needed) |
| `pnpm lint` | ESLint |

## Quran data

`data/quran.json` is fetched once by `scripts/fetch-quran.ts` from the Quran.com API v4: Uthmani text, juz, and the Madinah Mushaf page and line of every ayah (604 pages, 15 lines). The script checks there are 6,236 ayahs, 604 pages and the right count per surah before writing, and stores a SHA-256 checksum. `quran-layout.json` (numbers only, used by the engine) and `quran-text.json` (loaded only when you open a portion) are derived from it. No Quran text is written by hand or by AI.

## Layout

```
src/core/      pure logic, no React/DB/AI: dates, quran index, plan schema + patches,
               engine (forecast, alternatives), schedule (daily plan), srs, missed days, stats
src/ai/        server-only: system-prompt.md, Zod schemas, validation, Claude client, rate limit
src/app/api/plan-assistant/route.server.ts   the only server route
src/data/      Repo interface + Dexie (IndexedDB) implementation + React hooks
src/lib/app.ts glue between storage, core and UI (atomic commits)
src/app/       pages: Today, Plan, Adjust, Check-in, Progress, Settings, Onboarding
tests/         Vitest suites
```

To move to a real backend later (e.g. Supabase), implement `Repo` in `src/data/` and swap the hooks; core and UI stay the same.

## AI details

- Model: `ANTHROPIC_MODEL` (default `claude-opus-5-5`; `claude-haiku-5-5` is much cheaper and fine for this). The key stays on the server.
- Structured output (`output_config.format`) generated from the Zod schemas. Every reply is re-validated with strict Zod (bounds, no unknown fields, no Arabic script) and retried once with the validation error. Server-side refusal fallbacks are on.
- The model has one tool, `preview_plan`, which runs the deterministic engine on the server for a candidate change and returns the real numbers (finish date, minutes per day, lines per day needed to finish by a target date, alternatives). Its reply may only use numbers from those results or from your own words; anything else is rejected and retried.
- The proposal card lists **what changes**, generated from the patch itself (not from the AI's wording), above the before/after table.
- Your daily amount wins: if you say "a page a day", the plan is a page a day, and the time per day is shown as information (with a smaller amount offered as an option if it is more than the time you set). Only a target date that can't be met marks the plan as not realistic; then the preview shows up to 3 engine-computed alternatives (keep your time, keep your deadline, study every day, move the deadline). If a plan finishes well before your target date, it also offers to spread it out to finish by that date.
- Abuse protection: 4,000 characters per message, 120 KB request bodies, 20 requests per 10 minutes per IP.
- Privacy: only your message, your plan settings and aggregate numbers are sent to the AI. If you sign in, your progress is stored in your own Supabase row.
