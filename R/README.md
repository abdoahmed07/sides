# Streak

A dark, minimal habit tracker. React + Vite + TypeScript on GitHub Pages, Supabase for auth and data,
installable as a PWA. "Streak" is a placeholder name: change `APP_NAME` in `src/config.ts`.

Build-order steps 1–9 of the version 1 spec are built, plus the guided "new habit" chat.
Step 10 (a week of real use) is yours: see [the checklist](#step-10-a-week-of-real-use) below.

## Setup

1. **Supabase project.** Create a free project at supabase.com.
   - SQL Editor → paste and run [`supabase/schema.sql`](supabase/schema.sql).
   - Authentication → Sign In / Providers → Email: enabled (email + password).
   - Authentication → URL Configuration → add your site URL
     (`https://abdoahmed07.github.io/sides/`) and `http://localhost:5173` to the redirect URLs,
     so the confirmation email links back to the app.
   - Once your friends have accounts, you can turn off "Allow new users to sign up" to keep it private.
2. **Local env.** `cp .env.example .env.local` and fill in the project URL and **anon** key
   (Project Settings → API). Never the service-role key.
3. **Run.**
   ```bash
   npm install
   npm run dev
   ```

## Deploy (GitHub Pages)

The workflow `.github/workflows/deploy-streak.yml` (at the root of the Sides repo) tests, builds and
publishes `R/` on every push to `main` that touches `R/`. One-time setup in the GitHub repo:

- Settings → Pages → Source: **GitHub Actions**.
- Settings → Secrets and variables → Actions → **Variables**: add `VITE_SUPABASE_URL` and
  `VITE_SUPABASE_ANON_KEY`.

The build uses a relative base and hash routes (`#/new`), so it works under `/sides/` and refreshes
never 404.

**Install on a phone:** open the site, then Share → Add to Home Screen (iPhone, Safari) or
⋮ → Install app (Android, Chrome). It opens straight on Today.

## Tests

```bash
npm test
```

- `src/lib/streak.ts`: all streak logic, pure (entries + habit settings + today in, numbers out).
  `streak.test.ts` covers the ten required cases plus extra rules.
- `src/lib/habitFlow.ts`: the new-habit conversation, pure and data-driven. `habitFlow.test.ts`
  covers each path.

## How it's organised

| Area | Where |
| --- | --- |
| Rules constants (backfill days, milestone, app name, seed habits) | `src/config.ts` |
| Colours, spacing, radii | CSS variables at the top of `src/styles.css` |
| Streak maths | `src/lib/streak.ts` |
| New-habit questions | `src/lib/habitFlow.ts` |
| Data, optimistic sync, offline copy | `src/data/store.tsx` |
| Screens | `src/screens/` (Today, Overview, HabitDetail, NewHabitChat, HabitForm, Login) |
| PWA manifest and service worker | `vite.config.ts`, icons in `public/` (from `public/icon.svg` via `npx pwa-assets-generator`) |

### The new-habit chat (and swapping in an AI later)

`#/new` asks one question at a time: what habit, then follow-ups that depend on its kind, then how
often, a tiny minimum version, rest days and the start date. Kinds are detected from the name
(`HABIT_KINDS`): exercise suggests a few times a week, wake-up asks for the target time and turns it
into the minimum ("Out of bed by 6:30am"), and a habit to avoid ("No sugar") skips the schedule and asks
what counts as a win. Weekly habits skip rest days.

The screen only talks to the `HabitInterviewer` interface (`start`, `answer`, `undo`, each returning a
`Turn` of messages, the next input, and a final `HabitInput`). The scripted version is
`createScriptedInterviewer`. An AI version only has to return the same `Turn` shape, ending with a
`HabitInput`, which is exactly what the edit form produces. It must run server-side (a Supabase Edge
Function), never with an AI key in the browser.

The classic form is still used for editing (`#/habit/<id>/edit`) and is reachable from the chat
("Use the form instead").

## Decisions worth knowing

- **Rest days over the allowance** (for example after lowering the allowance) count as misses, so the
  numbers always follow the current settings.
- **A weekly habit's first week** caps the target at the days left in that week, so starting on a
  Saturday with "4× a week" is not an instant miss.
- **Backfill:** the detail heatmap lets you change the last 7 days (`BACKFILL_DAYS`). Older days show
  their status but are locked.
- **Check-ins are optimistic:** a tap shows at once, is queued on the device, and syncs. If a sync
  fails, a notice offers Retry. The queue also retries on reconnect and when the app returns to the
  foreground, and survives a reload. Signing out with unsynced taps asks first.
- **Offline and fast start:** the last loaded data is kept on the device, so Today opens instantly and
  works offline. It is replaced by fresh data as soon as the network answers, and removed on sign out.
- **Sync across devices** happens on load and each time the app returns to the foreground.
- **Never colour alone:** rest days carry a bar, excused days a dot (squares and diamonds in the
  Overview dots), and every heatmap day has a label.
- **Contrast** (checked): muted text is 5.5:1 on cards and 5.1:1 on raised surfaces; the input
  placeholder is 4.6:1.

## Check that accounts are private

After running the schema, verify row-level security with two accounts:

1. Sign up as account A, add a habit and check it in.
2. Sign out, sign up as account B. Today should show the empty state, not A's habit.
3. Optional: in the browser console as B, try reading A's habit by id through the Supabase client;
   it returns no rows.

## Step 10: a week of real use

Use it for seven days with the three real habits on your phone and laptop, then tick these off
(the spec's definition of done):

- [ ] Gym, Read a page and Wake up early set up with your real numbers (target, wake time, rest days).
- [ ] Installed on the phone's home screen; it opens on Today.
- [ ] A check-in on the phone shows on the laptop after switching to it (and the other way round).
- [ ] Streak, best streak and totals look right, including across Sunday → Monday and the end of the
      month.
- [ ] A rest day and an excused day kept a streak alive without adding to it.
- [ ] A forgotten day was backfilled from the detail heatmap and the streak repaired.
- [ ] Account B could not see account A's data.
- [ ] Nothing felt guilt-y, loud or slow. Note anything that felt wrong; that's the list for fixes.
