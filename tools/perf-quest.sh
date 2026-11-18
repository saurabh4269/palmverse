#!/usr/bin/env bash
# Frame-rate and render-setup capture on a real Quest 3/3S (Quest Browser), for docs/TESTING.md.
# Prerequisites: the Quest is connected over USB with developer mode on (`adb devices` lists it),
# `npx metavr` works, and the dev server is up here (`npx @iwsdk/cli dev up --ai-mode agent`, port 8087).
#
#   tools/perf-quest.sh [label]      → artifacts/perf/<label>-*.{txt,md,json} + the trace
#
# Steps it runs (each can be run by hand):
#   1. adb reverse tcp:8087 → the headset opens https://localhost:8087/ (accept the dev certificate once)
#   2. opens Quest Browser on that URL; you press "Enter", raise your palm, continue to the mounts
#   3. reads the app's own dev log from logcat: `xr-render` (layer type, antialias, multiview,
#      foveation, resolution) and `gpu` (draw calls, triangles, texture MB) at the mounts phase
#   4. a 10 s Perfetto trace in VR mode while the mounts are lit (the busiest moment), then the
#      frame analysis (`metavr perf analyze-trace --focus frames`) and the GPU view (`--focus gpu`)
set -euo pipefail
LABEL=${1:-$(date +%H%M)}
OUT=artifacts/perf
mkdir -p "$OUT"
PKG=com.oculus.browser

adb get-state >/dev/null || { echo "no headset: adb devices is empty" >&2; exit 1; }
adb reverse tcp:8087 tcp:8087
adb logcat -c
adb shell am start -a android.intent.action.VIEW -d "https://localhost:8087/" "$PKG" >/dev/null
echo "On the headset: Enter → raise your right palm → poke Continue until the seven mounts are lit."
read -r -p "Press Return here when the mounts are lit… " _

adb logcat -d | grep -E "\[hast\] (xr-render|gpu)" | tail -4 | tee "$OUT/$LABEL-render.txt"

npx metavr perf capture --mode vr --duration 10000 --app "$PKG" -o "hast-$LABEL"
npx metavr perf analyze-trace "hast-$LABEL" --app "$PKG" --focus frames \
  --report-out "$OUT/$LABEL-frames.md" --json-out "$OUT/$LABEL-frames.json" | tail -30
npx metavr perf analyze-trace "hast-$LABEL" --app "$PKG" --focus gpu --report-out "$OUT/$LABEL-gpu.md" | tail -20
echo "reports in $OUT/ (artifacts/ is gitignored; copy the numbers into docs/TESTING.md)"
