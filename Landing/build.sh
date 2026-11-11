#!/usr/bin/env bash
# Builds the landing site (everything served at /sides/, apart from the Streak and Kent apps)
# into the folder given as $1. Used by .github/workflows/deploy-pages.yml; run it locally the same way:
#   Landing/build.sh /tmp/site
#
# Besides copying the static pages, it generates two things from the real projects so the
# demos can never drift from the code:
#   airport/runs/*.json  - runs recorded from the actual C++ airport simulator, parsed per minute
#   digits/model.bin     - the trained neural-network weights, converted for the browser
set -euo pipefail

OUT="${1:?usage: Landing/build.sh <output-dir>}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$OUT"
OUT="$(cd "$OUT" && pwd)"

# Static pages and images (skip this script itself).
rsync -a --exclude build.sh --exclude tools "$ROOT/Landing/" "$OUT/"

# ── Airport simulator: build it, then record a few runs ──────────────────────
SIM="$ROOT/Airplane-simulator"
BUILD="$(mktemp -d)"
trap 'rm -rf "$BUILD"' EXIT
# Compile straight into a temp folder so the project folder (and its committed build files) is untouched.
"${CXX:-g++}" -std=c++17 -O2 -o "$BUILD/airport_sim" "$SIM"/src/*.cpp

mkdir -p "$OUT/airport/runs"
# Answers to the simulator's own prompts, in order:
# name, runways, duration (min), arrivals/10min, departures/10min, step mode, fast mode.
record() {
  local id="$1"; shift
  printf '%s\n' "$@" n y | "$BUILD/airport_sim" > "$BUILD/$id.txt"
  # Turn the recorded screens into data for the animated airport (fails loudly if the format changes).
  python3 "$ROOT/Landing/tools/airport_frames.py" "$BUILD/$id.txt" "$OUT/airport/runs/$id.json"
}
record regional "Harbour Regional"        1 60 3 3
record hub      "Metro International"     4 90 8 8
record overload "One Runway Too Few"      1 75 7 6

# ── Neural network: export trained weights as raw float32 ───────────────────
mkdir -p "$OUT/digits"
python3 - "$ROOT/Summer 2026/project-08-neural-network/weights/mnist_weights.npz" "$OUT/digits/model.bin" <<'PY'
import sys
import numpy as np

weights = np.load(sys.argv[1])
# Layout the browser expects: W0 (784x256), b0, W1 (256x128), b1, W2 (128x10), b2, row-major float32.
parts = [weights[k].astype("<f4").ravel() for k in ("W0", "b0", "W1", "b1", "W2", "b2")]
np.concatenate(parts).tofile(sys.argv[2])
PY

echo "Landing site built in $OUT"
