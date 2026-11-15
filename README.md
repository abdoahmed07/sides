# Sides

The source code for my side projects. Each folder is a self-contained project with its own README on how to build and run it.

**Want to see them in action? Head to my portfolio: [abdoahmed07.github.io/portfolio](https://abdoahmed07.github.io/portfolio/portfolio-site/index.html).** That's where every project is explained and most of them run right in your browser.

## What's in here

### Apps and games

| Folder | Language | What it is |
|---|---|---|
| [Kent](Kent/) | TypeScript, React | A card game about secretly signalling your partner. You and a bot partner against bot teams. |
| [Habit_tracker](Habit_tracker/) | React, Supabase | Streak, a calm habit tracker. One tap a day, synced across devices. |
| [Code Review](Summer%202026/project-01-code-review/) | React, Node | Paste code, share the link and comment on any line in real time. |
| [HeroFight](HeroFight/) | C# | A text RPG: pick a class, clear seven rooms, beat the Ancient Dragon. |

### Built from scratch

| Folder | Language | What it is |
|---|---|---|
| [Airplane-simulator](Airplane-simulator/) | C++ | An airport simulator: planes hold, land, taxi and take off. |
| [Ray Tracer](Summer%202026/project-04-ray-tracer/) | C++ | Renders 3D scenes with matte, metal and glass from first principles. |
| [Interpreter](Summer%202026/project-06-interpreter/) | Java, C | A small programming language, built as a tree-walker and as a bytecode VM. |
| [Packet Analyser](Summer%202026/project-07-packet-analyser/) | C | Captures live network traffic and decodes each packet by hand. |
| [Neural Network](Summer%202026/project-08-neural-network/) | Python | A digit recogniser trained from scratch: backpropagation and all. |

### Security, open source and writing

| Folder | Type | What it is |
|---|---|---|
| [Capture the Flag](Summer%202026/project-09-ctf/) | Security | Write-ups for ten security challenges, plus one I built. |
| [socket.io fix](Summer%202026/project-02-open-source/) | TypeScript | A bug fix contributed to a widely used real-time library. |
| [Technical writing](Summer%202026/project-03-technical-writing/) | Blog posts | Five posts on what I learned building and deploying apps. |

## Live builds

Only the projects that need to run in a browser get a site. One GitHub Actions workflow, [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml), runs the tests and publishes them on every push to `main`, so the portfolio always links to the latest version:

| Project | Live at |
|---|---|
| Kent | [abdoahmed07.github.io/sides/kent](https://abdoahmed07.github.io/sides/kent/) |
| Streak | [abdoahmed07.github.io/sides/streak](https://abdoahmed07.github.io/sides/streak/) |
| Airport simulator | [abdoahmed07.github.io/sides/airport](https://abdoahmed07.github.io/sides/airport/) |
| Draw a Digit | [abdoahmed07.github.io/sides/digits](https://abdoahmed07.github.io/sides/digits/) |

The airport and digit demos live in [`Demos/`](Demos/). [`Demos/build.sh`](Demos/build.sh) records fresh runs of the C++ airport simulator and converts the network's trained weights, so both demos always match the real code.
