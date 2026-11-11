"""
Turns a recorded run of the airport simulator (its raw terminal output) into JSON the
animated airport page can play back. Run by Landing/build.sh:

    python3 airport_frames.py run.txt run.json

The simulator redraws its whole screen once per simulated minute, so each screen is one
frame. Everything here is read from what the C++ program printed; nothing is invented.
If the program's screen layout changes in a way this parser doesn't understand, it stops
with an error instead of producing a wrong animation.
"""
import json
import re
import sys

ANSI = re.compile(r"\x1b\[[0-9;]*m")
CLEAR = "\x1b[2J\x1b[H"

HEADER = re.compile(r"Time: (\d+):(\d+) / (\d+):(\d+)")
RUNWAY_BUSY = re.compile(
    r"^(RW-\d+)\s+(LANDING|TAKEOFF)\s+(\S+) \(([^)]*)\)\s+([#-]+)\s+(\d+) min\s+"
    r"(?:fuel=[#-]+(?: (EMERGENCY))?|to (.+))$"
)
RUNWAY_CLEAR = re.compile(r"^(RW-\d+)\s+CLEAR\b")
ARRIVAL = re.compile(r"^\d+\.\s+(EMRG|LOW)?\s*(\S+) \(\s*([^)]*?)\s*\)\s+(.+?) → (.+?)\s+fuel=[#-]+\s+(\d+)\s*%$")
DEPARTURE = re.compile(r"^\d+\.\s+(\S+) \(\s*([^)]*?)\s*\)\s+(.+?) → (.+?)\s+waited=(\d+) min$")
STATS = re.compile(r"Landed: (\d+)\s+Departed: (\d+)\s+Emergencies: (\d+)\s+Crashes: (\d+)")
EVENT = re.compile(r"^\[(\d+):(\d+)\] (\S) (.*)$")


def inner(line: str) -> str:
    """Contents of one '| ... |' box row, without the border."""
    line = line.strip()
    if line.startswith("|"):
        line = line[1:]
    if line.endswith("|"):
        line = line[:-1]
    return line.strip()


def parse_frame(text: str) -> dict:
    lines = [inner(l) for l in ANSI.sub("", text).splitlines()]
    frame = {"runways": [], "arrivals": [], "departures": [], "events": []}
    section = None

    for line in lines:
        if not line or set(line) <= set("+-="):
            continue
        if m := HEADER.search(line):
            frame["minute"] = int(m[1]) * 60 + int(m[2])
            frame["duration"] = int(m[3]) * 60 + int(m[4])
            continue
        if line.startswith("RUNWAYS"):
            section = "runways"; continue
        if line.startswith("ARRIVAL QUEUE"):
            section = "arrivals"; continue
        if line.startswith("DEPARTURE QUEUE"):
            section = "departures"; continue
        if line.startswith("STATISTICS"):
            section = "stats"; continue
        if line.startswith("EVENT LOG"):
            section = "events"; continue
        if line in ("(empty)", "(no events yet)"):
            continue

        if section == "runways":
            if m := RUNWAY_CLEAR.match(line):
                frame["runways"].append({"name": m[1], "op": "clear"})
            elif m := RUNWAY_BUSY.match(line):
                bar = m[5]
                frame["runways"].append({
                    "name": m[1],
                    "op": "landing" if m[2] == "LANDING" else "takeoff",
                    "id": m[3],
                    "airline": m[4],
                    "progress": bar.count("#") / len(bar),
                    "minutesLeft": int(m[6]),
                    "emergency": m[7] == "EMERGENCY",
                    "to": m[8],
                })
            else:
                raise ValueError(f"unrecognised runway line: {line!r}")
        elif section == "arrivals":
            m = ARRIVAL.match(line)
            if not m:
                raise ValueError(f"unrecognised arrival line: {line!r}")
            frame["arrivals"].append({
                "id": m[2], "airline": m[3], "from": m[4], "fuel": int(m[6]),
                "status": {"EMRG": "emergency", "LOW": "low"}.get(m[1] or "", "ok"),
            })
        elif section == "departures":
            m = DEPARTURE.match(line)
            if not m:
                raise ValueError(f"unrecognised departure line: {line!r}")
            frame["departures"].append({"id": m[1], "airline": m[2], "to": m[4], "waited": int(m[5])})
        elif section == "stats":
            if m := STATS.search(line):
                frame["stats"] = {"landed": int(m[1]), "departed": int(m[2]),
                                  "emergencies": int(m[3]), "crashes": int(m[4])}
        elif section == "events":
            if m := EVENT.match(line):
                frame["events"].append({"minute": int(m[1]) * 60 + int(m[2]), "kind": m[3],
                                        "text": re.sub(r"\s{2,}", " ", m[4]).strip()})

    for key in ("minute", "duration", "stats"):
        if key not in frame:
            raise ValueError(f"frame is missing {key}")
    if not frame["runways"]:
        raise ValueError("frame has no runways")
    return frame


def main(src: str, dst: str) -> None:
    raw = open(src, encoding="utf-8").read()
    screens = raw.split(CLEAR)
    frames = [parse_frame(s) for s in screens if "Time:" in s]
    name = re.search(r"Starting simulation: (.+)", ANSI.sub("", raw))
    final = next((s for s in screens if "SIMULATION COMPLETE" in s), "")
    with open(dst, "w", encoding="utf-8") as out:
        json.dump({
            "name": name[1].strip() if name else "",
            "frames": frames,
            # Raw screens too, so the page can show exactly what the program printed.
            "screens": [s for s in screens if "Time:" in s] + ([final] if final else []),
        }, out, ensure_ascii=False, separators=(",", ":"))
    print(f"{src}: {len(frames)} frames")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
