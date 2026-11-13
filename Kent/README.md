# Kent

A web version of **Kent**, a partnership card game about secret signals (a variant of Kemps / Cash). Collect four of a kind, then tip off your partner with a hand gesture — without the other team catching you.

**[Play it here](https://abdoahmed07.github.io/sides/kent/)** — runs entirely in your browser, you vs. bots. No account, no install.

> 🚧 **Still in progress.** The game is fully playable, but I'm still adjusting the rules, the bots and the design, so expect things to change.

## Why I made it

Kent is a game I grew up playing as a kid — sitting around a table with friends and family, trying to sneak a signal to my partner while everyone else stared at our hands. It was always one of the most fun games we played, but it only works when you're all in the same room.

I wanted to bring it online: a virtual version that keeps what made it fun (the bluffing, the secret signals, catching someone in the act) and that anyone can play from their own device. Right now it's you against bots while I get the game itself right; playing with friends online is the next step.

## How to play

**Teams.** 4, 6 or 8 players, in teams of two. Partners always sit directly across the table from each other. You're at the bottom; your partner is the bot opposite you.

**The goal.** Get four cards of the same rank (four Kings, four 7s…) in your 4-card hand.

**Swapping.** Four cards lie face-up in the middle for everyone. At any time — no turns — tap a card in your hand, then tap a middle card to trade them. Your card takes its place, so others can grab it. First to swap gets the card.

**Rounds.** When you don't want to swap any more, press **I'm done swapping**. Once *everyone* is done, the four middle cards are cleared away and four new ones are dealt from the deck, and everyone can swap again.

**Signals.** Before each hand, your team secretly picks one of four gestures (✋ 👌 ✌️ 🤞) as its real signal. During play anyone can tap any gesture at any time, and everyone sees who tapped what. Only your partner knows which one is real — the other three are bluffs.

**Ending a hand.** A hand ends when someone calls:

| Call | Who calls it | Right | Wrong |
|---|---|---|---|
| **KENT!** | You, when you think your *partner* has four of a kind | Every other team gets a letter | Your team gets a letter |
| **COUNTER KENT!** | You, when you think an *opponent* is signalling their partner right now | That team gets a letter | Your team gets a letter |

A Counter Kent only counts if the opponent really has four of a kind **and** tapped their team's real signal in the last 3 seconds — catching a bluff doesn't count. If the deck runs out before anyone calls, it's a draw (a "Real Deal") and the hand is redealt.

**Winning.** Each lost hand gives your team the next letter of **K-E-N-T**. The first team to spell the whole word loses the match.

**Bots.** Pick Easy, Medium or Hard before you play. Bots swap toward four of a kind, signal their partner when they get it, call KENT when their partner signals, and call COUNTER KENT when an opponent keeps tapping the same gesture — so don't spam your real one. They also bluff: now and then a bot taps a fake gesture to throw you off. Easy bots are sloppy and rarely catch you; Hard bots swap sharply, space out their real signal, and only get suspicious of players who are already done.

**Sound.** Swaps, gestures, new rounds and wins/losses all have their own sounds. Use the speaker button in the top-right corner to mute.

## Run it locally

Needs Node 20+ and [pnpm](https://pnpm.io).

```bash
pnpm install
pnpm dev      # opens on http://localhost:5173 (or the next free port)
pnpm test     # runs the game-rule tests
pnpm build    # production build → apps/client/dist
```

## How it's built

```
Kent/
  packages/engine/   all game rules + bot AI, in plain TypeScript (no UI), with tests
  apps/client/       the React app you see — reads from the engine, draws the table
```

The rules live in the engine so they can be tested on their own and reused later (an online version or a mobile app could use the same engine).

| Part | File |
|---|---|
| Dealing | `packages/engine/src/rules/dealing.ts` |
| Swapping, "done" and rounds | `packages/engine/src/rules/swapping.ts` |
| Signals, Kent and Counter Kent | `packages/engine/src/rules/kent.ts` |
| Letters and match end | `packages/engine/src/rules/scoring.ts` |
| Bot decisions | `packages/engine/src/rules/bots.ts` |
| Setting up a game vs. bots | `packages/engine/src/solo.ts` |

**Tech:** TypeScript · React 19 · Vite · Tailwind CSS · Zustand · Framer Motion · Vitest

## Deployment

Every push to `main` that touches `Kent/` rebuilds the game and publishes it to GitHub Pages via [`.github/workflows/deploy-pages.yml`](../.github/workflows/deploy-pages.yml), at **https://abdoahmed07.github.io/sides/kent/**.

## Planned

- Online multiplayer, so friends can play from their own devices
