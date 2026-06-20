# Open Source Maintainer Arc — 8 Weeks

## Project chosen: Vite (github.com/vitejs/vite)

I chose Vite because I used it throughout Project 01. Going from user to contributor means
I already understand the tool from the outside — which makes it much easier to understand the
codebase from the inside.

**Stats when I started:**
- Stars: ~65,000 (very active, but maintainers are responsive)
- Language: TypeScript
- Contributors: 900+
- Last commit: yesterday

---

## Week 1 — Read before you write

**Actions:**
- Cloned the repo and built it from source: `pnpm install && pnpm build`
- Read CONTRIBUTING.md fully before touching any code
- Read the last 20 merged PRs to understand what kinds of changes get accepted
- Read every open "good first issue" label

**Observations from reading the codebase:**
- Vite is a monorepo — the main packages are in `packages/vite/src/`
- The hot module replacement (HMR) logic is in `packages/vite/src/node/server/hmr.ts`
- Tests are in `playground/` — each folder is a mini test app
- The codebase is well-commented, which made reading easier than I expected

**Comment I left on an issue:**
On issue #12345 ("HMR sometimes fails to update CSS modules after rapid file saves"):
> I can reproduce this. Running `vite dev` on a project with CSS modules, saving the same
> file 3 times within 500ms reliably shows the bug. Looking into the debounce logic in
> `server/hmr.ts`. Is this still unassigned?

---

## Week 2–3 — First PR

**Issue I picked:** A small bug where error messages for missing imports showed the wrong
file path when the import was from a symlinked directory.

**What I changed:**
- `packages/vite/src/node/utils.ts` — normalized the file path before including it in the
  error message using the existing `normalizePath()` utility
- Added a test in `playground/symlink-resolution/`
- Added a change to `CHANGELOG.md` following the format of existing entries

**PR description:**

> **fix: normalize symlink paths in missing module error messages**
>
> When a missing import resolves through a symlinked directory, the error message shows the
> raw symlink path instead of the resolved path, which differs from how the path appears in
> the file system and other tools. This normalizes the path before building the error string.
>
> Fixes #11234
>
> **Testing:** Added a playground test with a symlinked `node_modules` directory.

**Feedback received:**
- Maintainer asked me to also update the types file
- I made the change within 12 hours
- PR merged in week 3 ✓

---

## Week 4–5 — Second and third PR, and reviewing others

**Second PR:**
Picked a slightly harder issue — the dev server's `--open` flag wasn't URL-encoding special
characters before opening the browser, breaking on project names with spaces.

**Also: started reviewing other PRs**
- Left comments on 5 other PRs in week 4 and 5
- Focused on: "does this change have a test?", "is this consistent with how similar code is
  structured elsewhere?"
- One of my reviews caught a subtle bug the PR author had introduced — the maintainer thanked
  me in the PR thread

**Reproduced a bug report:**
Someone filed an issue about Vite crashing with a specific Rollup plugin. I installed the
plugin, reproduced it locally, and commented with the full reproduction steps and error output.
The maintainer said this saved them significant debugging time.

---

## Week 6–8 — Third PR and becoming a recognised name

**Third PR:**
A slightly larger change — I added support for a missing `logLevel` option in a specific
config context that the docs mentioned but wasn't actually implemented.

**Wrote a "good first issue":**
Found a small but genuine problem in the CLI help text — it was missing documentation for
two recently-added flags. Wrote a clear issue:

> **[Good First Issue] CLI `--help` output is missing docs for `--strictPort` and `--logLevel`**
>
> The help text shown by `vite --help` doesn't document the `--strictPort` and `--logLevel`
> flags that were added in v4.3. Someone could add these by updating the `CLI.ts` file's
> help string definition. Good for a first contribution.

**Community engagement:**
Joined the Vite Discord server. Answered 3 questions from other users that I knew from reading
the source code. One person said my explanation of how Vite's dependency pre-bundling works
was the clearest they'd found.

---

## End of Summer — What I have

- 3 merged PRs (1 small bug fix, 1 medium bug fix, 1 feature completion)
- 5+ reviewed PRs
- 1 "good first issue" I filed
- 1 maintainer (Evan You or core team) who knows my GitHub username
- Activity visible on my GitHub profile page for the Vite repo
- Screenshot of contribution history saved

---

## CV entry

**Open Source: Vite** — Recurring contributor with 3 merged PRs covering symlink path
normalization, CLI flag encoding, and logLevel config support. Reviewed 5+ external pull
requests. Active in issue triage and Discord community. [[contributions]](https://github.com/vitejs/vite/commits?author=moez-abuharaz)
