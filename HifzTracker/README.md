# Hifz Tracker

A calm, local-first app for memorizing the Quran. You describe your goal (in a chat or a form), the planning engine turns it into a daily routine, and the app tracks your progress and revision strength.

- **Sabaq** (new), **sabqi** (last N days) and **manzil** (a rotating slice of everything older) each day.
- Spaced repetition per page: Strong pushes a page later, Weak brings it back tomorrow, and overdue revision comes before new material.
- If you miss days, nothing piles up. You choose to shift the plan, take a catch-up day, or pause new material.
- Mushaf map (604 pages), progress by juz and surah, streaks, heatmap, JSON backup.

**AI proposes, the engine computes, you approve.** The assistant (Claude) only ever returns a validated `PlanConfig` patch and never a schedule or Quran text. The deterministic engine computes the schedule and the numbers, and nothing changes until you tap Accept.

## Run it locally (everything, including AI)

```bash
pnpm install
cp .env.example .env.local   # then put your ANTHROPIC_API_KEY in it
pnpm dev                     # http://localhost:3000
```

Without a key the app still works: the AI screens show a friendly message and point you to the manual form.

## GitHub Pages build (no server, no AI)

```bash
pnpm build:pages             # static export in ./out, served under /sides/hifz
```

The repo's Pages workflow builds this on every push to `main` that touches `HifzTracker/`. The AI route is left out of this build (files named `*.server.ts` are only included in the local build; see `next.config.ts`), and the UI hides the chat. To move data between your computer and your phone, use **Settings → Export / Import JSON**.

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
- Explanations may only use numbers the engine produced. Any other number triggers a rewrite, and if that still fails, a plain engine-generated summary is shown instead.
- Unrealistic goals: the preview marks the plan as not realistic and shows up to 3 engine-computed alternatives (keep your time, keep your deadline, study every day, move the deadline).
- Abuse protection: 4,000 characters per message, 120 KB request bodies, 20 requests per 10 minutes per IP.
- Privacy: only your message, your plan settings and aggregate numbers are sent.
