#!/usr/bin/env bash
# KTX2 (Basis Universal) for the GLBs, with mipmaps. Run from projects/hast-rekha/ after a model build:
#   assets-src/models/*.glb (Blender) → public/models/*.glb (KTX2, loaded by the app)
#   UASTC: the skin atlas (it carries the face), the eyes, and alpha-tested strand cards
#          (hair, beard, brows, lashes): ETC1S would smear the cut-out edges.
#   ETC1S: baked AO maps and the plain cloth/mouth colour maps (smooth, low detail).
# Needs KTX-Software 4.x (`ktx`/`toktx`) on PATH: default ~/.local/ktx/bin.
set -euo pipefail
export PATH="$HOME/.local/ktx/bin:$PATH"
GT="npx -y @gltf-transform/cli@4.5.1"
SRC=${1:-assets-src/models}   # Blender outputs (uncompressed, not deployed)
OUT=${2:-public/models}       # what the app loads
tmp=$(mktemp -d)

# pandit.glb
cp "$SRC/pandit.glb" "$tmp/p1.glb"
# one pass per name: npx re-parses arguments through a shell, so a {a,b} glob would be brace-expanded
for name in pandit_skin brown_eye beard_strands pandit_hair eyebrow003 eyelashes01; do
  $GT uastc "$tmp/p1.glb" "$tmp/p1.glb" --level 2 --zstd 18 --pattern "$name"
done
$GT etc1s "$tmp/p1.glb" "$tmp/p2.glb" --quality 192
$GT dedup "$tmp/p2.glb" "$OUT/pandit.glb"

# setting.glb (AO atlas + floor contact shadow: smooth single-channel data)
$GT etc1s "$SRC/setting.glb" "$tmp/s1.glb" --quality 192
$GT dedup "$tmp/s1.glb" "$OUT/setting.glb"

rm -rf "$tmp"
ls -la "$OUT"/*.glb
