# Airport Simulator — C++

A terminal-based airport simulator written in C++ with manually implemented data structures. Manages plane arrivals, departures, runway assignments, fuel emergencies, and live statistics — all rendered in a live ANSI terminal display.

---

## How to Build and Run

```bash
make run        # build and launch
make            # build only
make clean      # remove compiled files
./airport_sim   # run after building
```

Requires a C++17 compiler (`g++` or `clang++`).

---

## Configuration

On launch you are prompted for:

| Option | Default | Description |
|---|---|---|
| Airport name | Metro International Airport | Display name |
| Number of runways | 2 | 1–6 runways |
| Simulation duration | 60 min | Total simulated minutes |
| Arrivals per 10 min | 3 | Average arrival rate |
| Departures per 10 min | 3 | Average departure rate |
| Step mode | No | Press Enter each minute manually |
| Fast mode | No | No delay between ticks |

---

## How the Simulation Works

### Time

The simulation runs in discrete **1-minute ticks** from `t=0` to `t=duration`. Each tick:

1. New planes are randomly generated and added to queues
2. Fuel burns for every plane waiting to land
3. Runways tick (planes in progress move forward)
4. Completed planes are removed and logged
5. Free runways pull the next plane from a queue
6. The terminal display refreshes

### Plane Generation

Each minute, the simulator independently rolls for a new arrival and a new departure based on the configured rates. A rate of 3 per 10 minutes means roughly a 30% chance each tick.

Each arriving plane is given:
- A random airline, flight number, origin, and destination
- A fuel level between 20% and 99%
- A runway duration of 3–5 minutes (landing takes longer)

Each departing plane is given:
- Full fuel (departures don't burn fuel while waiting)
- A runway duration of 2–4 minutes (takeoff is quicker)

### Fuel and Emergencies

Arriving planes burn **1% fuel per minute** while waiting in the queue. This creates urgency:

| Fuel level | Status | Priority |
|---|---|---|
| Below 20% | EMERGENCY | 0 (highest) |
| 20% – 39% | LOW FUEL | 1 |
| 40% – 100% | Normal | 2 |

If a plane reaches **0% fuel** before reaching a runway, it crashes and is counted as a loss.

### Runway Assignment

- Arrivals always take priority over departures on a free runway
- Within the arrival queue, planes are sorted by priority (emergency first, then low fuel, then normal)
- Within the same priority level, planes are served in the order they arrived (FIFO)
- Departures are served FIFO — no priority system needed since fuel is not a concern

### Statistics

Tracked throughout the simulation:
- Total arrivals and departures queued
- Completed landings and takeoffs
- Emergency landings handled
- Planes lost to fuel exhaustion
- Average and maximum wait times

---

## Data Structures

Both data structures are manually implemented from scratch using linked lists — no `std::queue`, `std::priority_queue`, or any STL container is used for the queues.

### Queue (FIFO)

Used for the **departure queue**.

Implemented as a singly linked list with a `front` and `rear` pointer.

```
enqueue → rear
dequeue ← front
```

Operations:
- `enqueue(item)` — add to back: O(1)
- `dequeue()` — remove from front: O(1)
- `peek()` — view front without removing: O(1)
- `isEmpty()`, `size()` — O(1)
- `forEach(fn)` — traverse all elements: O(n)

### PriorityQueue (Sorted Linked List)

Used for the **arrival queue**.

Implemented as a sorted singly linked list. On every insertion, the new node is placed in the correct position according to the comparator. The front of the list always holds the highest-priority plane.

```
enqueue → inserted in sorted position: O(n)
dequeue ← always from front (highest priority): O(1)
```

The comparator used:
```
a has higher priority than b if:
  a.priority() < b.priority()
  OR (same priority AND a arrived in queue earlier)
```

This makes it both priority-ordered and stable (FIFO within the same tier).

---

## File Structure

```
Airplane-simulator/
├── Makefile
└── src/
    ├── Plane.h
    ├── Queue.h
    ├── Runway.h
    ├── Runway.cpp
    ├── Airport.h
    ├── Airport.cpp
    ├── Simulation.h
    ├── Simulation.cpp
    └── main.cpp
```

### `Plane.h`

Defines the `Plane` struct — the core data unit passed through every queue and runway.

Key fields:
- `flightNumber`, `airline`, `origin`, `destination` — identity
- `fuelLevel` — 0–100%, decremented each tick for arrivals in queue
- `type` — `ARRIVING` or `DEPARTING`
- `status` — `IN_QUEUE`, `ON_RUNWAY`, or `COMPLETED`
- `queueEntryTime` — tick when the plane joined the queue
- `runwayStartTime` — tick when the plane was assigned a runway
- `completionTime` — tick when the plane finished
- `runwayDuration` — how many minutes it needs on the runway

Key methods:
- `isEmergency()` — true if fuel < 20%
- `isLowFuel()` — true if fuel 20–39%
- `priority()` — returns 0, 1, or 2 for the priority queue comparator
- `waitTime()` — `runwayStartTime - queueEntryTime`
- `Plane::createArrival(id, time)` — factory for a random arriving plane
- `Plane::createDeparture(id, time)` — factory for a random departing plane

### `Queue.h`

Template header containing both data structures:

**`Queue<T>`** — generic FIFO queue (linked list). Used for departures.

**`PriorityQueue<T>`** — generic sorted linked list. Takes a comparator function at construction. Used for arrivals.

Both are non-copyable to prevent accidental shallow copies of the linked list. Both support `forEach(fn)` and `forEachMut(fn)` for traversal without removing elements (used for display).

### `Runway.h` / `Runway.cpp`

Represents a single runway. Operates as a simple state machine:

```
AVAILABLE  →  assign(plane)  →  LANDING or TAKEOFF
LANDING / TAKEOFF  →  tick() each minute  →  AVAILABLE (returns completed plane)
```

Key methods:
- `assign(plane, time)` — places a plane on the runway, sets status and timer
- `tick(time)` — decrements time remaining; returns the completed `Plane` wrapped in `std::optional` when done, `std::nullopt` otherwise
- `isAvailable()` — true when the runway has no plane

### `Airport.h` / `Airport.cpp`

The central manager. Owns a vector of `Runway` objects, one `PriorityQueue<Plane>` for arrivals, and one `Queue<Plane>` for departures.

Key methods:
- `addArrival(plane)` — enqueues a plane into the priority arrival queue
- `addDeparture(plane)` — enqueues a plane into the FIFO departure queue
- `step(time)` — one full simulation tick: burns fuel, ticks runways, assigns planes
- `stats()` — returns the accumulated `Stats` struct

Internal methods:
- `_burnQueuedFuel()` — calls `burnFuel()` on every plane in the arrival queue
- `_assignToRunways(time)` — iterates free runways and pulls from arrival queue first, then departure queue; skips and discards zero-fuel planes

### `Simulation.h` / `Simulation.cpp`

Owns the `Airport` and drives the main loop. Handles:
- Traffic generation (random plane spawning each tick)
- The simulation clock
- Terminal rendering (ANSI box UI, color-coded by status)
- Event log (last 8 events shown on screen)
- Final statistics screen

The display renders:
- Each runway with an operation label, plane identity, a progress bar, and fuel bar
- The arrival queue sorted by priority with fuel bars and emergency flags
- The departure queue with wait times
- Live statistics
- A scrolling event log

### `main.cpp`

Entry point. Reads configuration from stdin (with defaults), constructs a `SimConfig`, and hands it to `Simulation::run()`.

---

## Display Guide

```
+------------------------------------------------------------------+
|  Metro International Airport   Time: 00:23 / 01:00   Step: 23/60|
+------------------------------------------------------------------+
|  RUNWAYS                                                         |
|  RW-01  LANDING  De384 (Delta)    ##########  2 min  fuel=65%   |
|  RW-02  CLEAR    — awaiting assignment                           |
+------------------------------------------------------------------+
|  ARRIVAL QUEUE  (2 planes)                                       |
|   1.  EMRG  Sw215 (Southwest)  Houston → Dallas   fuel=### 14%  |
|   2.  LOW   Al448 (Alaska)     NYC → Chicago      fuel=### 33%  |
+------------------------------------------------------------------+
|  DEPARTURE QUEUE  (1 plane)                                      |
|   1.        Am102 (American)   Dallas → San Diego  waited=3 min |
+------------------------------------------------------------------+
|  STATISTICS                                                      |
|  Landed: 13  Departed: 9  Emergencies: 2  Crashes: 0            |
|  In queue: arrivals=2 / departures=1  Avg wait: 2.8 min         |
+------------------------------------------------------------------+
|  EVENT LOG                                                       |
|  [00:21]  + Arrival   De384 (Delta) from San Antonio  fuel=65%  |
|  [00:22]  v Landed    Sw419 [EMERGENCY]  wait=4 min             |
|  [00:23]  ^ Departed  Un312  wait=6 min                         |
+------------------------------------------------------------------+
```

**Symbols in the event log:**
- `+` — new plane entered a queue
- `v` — plane landed
- `^` — plane departed
- `CRASH` — plane ran out of fuel before reaching a runway
