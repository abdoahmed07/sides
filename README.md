# Sides

My side projects, all in one place. Each folder is a self-contained project with its own README that goes into the details. This page is the map.

**Website: [abdoahmed07.github.io/sides](https://abdoahmed07.github.io/sides/)**

## Try them in your browser

No install, no setup. Open the link and go.

| Project | What it is | Link |
|---|---|---|
| 🃏 **[Kent](Kent/)** | A card game from my childhood. Collect four of a kind, then secretly signal your partner with a hand gesture before the other team catches you. You vs. bots. | [Play](https://abdoahmed07.github.io/sides/kent/) |
| ✅ **[Streak](Habit_tracker/)** | A calm, minimal habit tracker. One tap a day to keep your streaks going, synced across your devices. | [Open](https://abdoahmed07.github.io/sides/streak/) |
| 💬 **[Code Review](Summer%202026/project-01-code-review/)** | Paste code, share the link, and comment on any line. Everyone viewing sees new comments instantly. | [Open](https://codereview-rho.vercel.app) |
| ✏️ **[Draw a Digit](Summer%202026/project-08-neural-network/)** | Draw a number and a neural network I wrote from scratch guesses it as you draw. | [Try it](https://abdoahmed07.github.io/sides/digits/) |
| ✈️ **[Airport Simulator](Airplane-simulator/)** | Watch planes hold, land, taxi and take off as dusk turns to night, animated from the real C++ program's output. | [Watch it run](https://abdoahmed07.github.io/sides/airport/) |

## More projects

### Built from scratch

| Project | Language | What it is |
|---|---|---|
| [Ray Tracer](Summer%202026/project-04-ray-tracer/) | C++ | Renders realistic 3D scenes with matte, metal and glass, from first principles. |
| [Interpreter](Summer%202026/project-06-interpreter/) | Java, C | A small programming language, built twice: once as a tree-walker, once as a bytecode VM. |
| [Packet Analyser](Summer%202026/project-07-packet-analyser/) | C | Captures live network traffic and decodes each packet by hand. |
| [Neural Network](Summer%202026/project-08-neural-network/) | Python | The model behind Draw a Digit: training, backpropagation and all. |
| [HeroFight](HeroFight/) | C# | A text RPG: pick a class, clear seven rooms, beat the Ancient Dragon. |

### Security, open source and writing

| Project | Type | What it is |
|---|---|---|
| [Capture the Flag](Summer%202026/project-09-ctf/) | Security | Write-ups for ten security challenges, plus one I built. |
| [socket.io fix](Summer%202026/project-02-open-source/) | TypeScript | A bug fix contributed to a widely used real-time library. |
| [Technical writing](Summer%202026/project-03-technical-writing/) | Blog posts | Five posts on what I learned building and deploying apps. |

## How the website is built

Everything under [abdoahmed07.github.io/sides](https://abdoahmed07.github.io/sides/) is published by one GitHub Actions workflow, [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml), on every push to `main`. The landing page and the two demos live in [`Landing/`](Landing/); [`Landing/build.sh`](Landing/build.sh) builds them, recording fresh runs of the airport simulator and converting the neural network's trained weights so both demos always match the real code.
