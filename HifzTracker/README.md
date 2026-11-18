# Hifz Tracker

A calm, local-first app for memorizing the Quran. You describe your goal (in a chat or a form), the planning engine turns it into a daily routine, and the app tracks your progress and revision strength.

- **Sabaq** (new), **sabqi** (last N days) and **manzil** (a rotating slice of everything older) each day.
- Spaced repetition per page: Strong pushes a page later, Weak brings it back tomorrow, and overdue revision comes before new material.
- If you miss days, nothing piles up. You choose to shift the plan, take a catch-up day, or pause new material.
- Did more than your portion? Tap **I memorized further** under Sabaq and pick the last ayah you reached. It is recorded as memorized today, tomorrow continues after it, and the finish date moves earlier. Your daily amount stays the same.
- Weekly readings (e.g. Al-Kahf on Fridays) appear on Today that day as a separate Reading card: tick only, no rating, no effect on revision or the finish date.
- Mushaf map (604 pages), progress by juz and surah, streaks, heatmap, JSON backup.

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

1. Supabase → SQL Editor: run `supabase/schema.sql`.
2. Authentication → Sign In / Providers → Email: keep it enabled, with **Confirm email** on. New accounts get one confirmation email; the link can be opened on any device, then the person signs in with their password anywhere. "Forgot password?" sends a reset link.
3. Authentication → URL Configuration: Site URL `https://abdoahmed07.github.io/sides/hifz/`; Redirect URLs `http://localhost:3000/**`, `http://localhost:3100/**` and `https://abdoahmed07.github.io/sides/hifz/**`.
4. Locally: put the project URL and anon key (Project Settings → API) in `.env.local` as `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, then restart `pnpm dev`.
5. For the Pages build: add the same two values as repository variables `HIFZ_SUPABASE_URL` and `HIFZ_SUPABASE_ANON_KEY` (GitHub → Settings → Secrets and variables → Actions → Variables).

Supabase's built-in email sender only allows a few emails per hour; for more users, add your own SMTP in Authentication → Emails.

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
