# PR Review Comment Templates

These are the kinds of comments I leave when reviewing other people's PRs.
I try to be specific and constructive — not just "looks good" or "needs changes".

---

## When a test is missing

> Does this change have test coverage? I tried to reproduce the fix locally and it works,
> but I think a test would make sure this doesn't regress. The existing test for similar
> behavior is in `playground/xxx/` if you're looking for a reference.

---

## When I spot something inconsistent with the codebase

> This looks functionally correct, but I noticed that similar code elsewhere in the codebase
> uses `normalizePath()` before building file paths (e.g., in `utils.ts:L243`). Would it
> make sense to do the same here for consistency?

---

## When the change looks good

> Looks good to me. I tested this locally against a project with the scenario described in
> the issue and it works as expected. The existing tests still pass.

---

## When I reproduced a bug from an issue

> I was able to reproduce this on macOS with Vite 5.2.1. Steps:
> 1. Create a project with `npm create vite`
> 2. Add a symlinked `node_modules` via `ln -s ../shared/node_modules ./node_modules`
> 3. Import a package from the symlinked directory
> 4. Error message shows symlink path instead of resolved path
>
> Stack trace: [paste stack trace]
> This is consistent with what the issue reporter described.

---

## When I find a bug in a PR

> I noticed a potential issue on line 47: if `options.root` is undefined (it's optional in
> the type signature), calling `.resolve()` on it will throw. There's an existing pattern
> for handling this case at `packages/vite/src/node/config.ts:L88` that might be worth
> following here.

---

## General rules I follow for reviews

1. **Only comment on things I understand.** If I don't understand a part of the code, I ask
   a question instead of pretending to review it.
2. **Be specific.** "This looks off" is useless. "This will fail when X because Y" is helpful.
3. **Point to precedent.** "The existing code does Y at location Z" is much more convincing
   than "I think you should do Y".
4. **Respond to every review comment on my own PRs within 24 hours.** Even if just to say
   "Good point, I'll fix this" or "I think this is intentional because X — does that make sense?"
