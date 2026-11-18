# Pandit character build

`build_pandit.py` builds `public/models/pandit.glb` headless in Blender. The character is a warm elderly scholar-palmist: MakeHuman/MPFB body and face, the MPFB "default" rig, runtime morph targets, and a code-built beard, kurta and shawl. One run takes about 6 seconds.

It is adapted from `projects/chausar/tools/shakuni/`, so the GLB keeps the same conventions as chausar's `src/game/human.ts`: bone names, morph names and mesh naming.

## Files
- `build_pandit.py`: body, face targets, proxies, skin art, rig, expression shape keys, export.
- `costume.py`: beard and moustache (alpha shells plus edge cards that copy the face morphs), kurta and pyjama cut from the body, front placket, and a maroon angavastram shawl.
- `preview_pandit.py`: re-imports the exported GLB and renders review shots into `artifacts/pandit/` (front, three-quarter, face, face front, expression and pose test). It mimics the runtime's material fixes.

## Install (one time, free, no account)
1. **MPFB extension** (GPL tool, CC0 output). Download it from the Blender extensions API:
   ```sh
   curl -sL https://extensions.blender.org/api/v1/extensions/ | python3 -c "import json,sys;[print(e['archive_url'],e['archive_hash']) for e in json.load(sys.stdin)['data'] if e['id']=='mpfb']"
   curl -sL "<archive_url>" -o mpfb.zip && shasum -a 256 mpfb.zip   # must match archive_hash
   /Applications/Blender.app/Contents/MacOS/Blender -b -c extension install-file -r user_default --enable mpfb.zip
   ```
2. **MakeHuman CC0 system assets.** Fetch only the files needed, with ranged reads of the 281 MB zip, using the fetcher shipped in the skills:
   ```sh
   cp skills/quest-hands-first-webxr/scripts/assets/remotezip*.py /tmp/fetch/ && cd /tmp/fetch
   python3 remotezip_fetch.py https://files.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip mhassets \
     'skins/old_african_male/*' 'eyes/high-poly/*' 'eyes/materials/brown*' 'eyebrows/eyebrow003/*' \
     'eyelashes/eyelashes01/*' 'teeth/teeth_base/*' 'tongue/tongue01/*' 'hair/short02/*'
   cp -R mhassets/* "$HOME/Library/Application Support/Blender/5.2/extensions/.user/user_default/mpfb/data/"
   ```
   The destination is MPFB's `LocationService.get_user_data()`. On Linux it is `~/.config/blender/<ver>/extensions/.user/user_default/mpfb/data`.

## Build and preview
From `projects/hast-rekha/`:
```sh
B=/Applications/Blender.app/Contents/MacOS/Blender
$B -b -P tools/pandit/build_pandit.py -- --out public/models/pandit.glb      # [--skin-size 1024] [--no-costume]
$B -b -P tools/pandit/preview_pandit.py -- public/models/pandit.glb artifacts/pandit   # add 'cycles' for Cycles
```
The build log prints `BONE` landmarks (glTF space, metres), a `MESH` line per mesh (tris, morph keys, materials) and the total triangle count.

Tested on Blender 5.2.3. Two fixes were needed against the chausar 4.2 script:
- the material node refs go stale after `nodes.remove()`, so the script re-fetches them by name;
- `--cycles` is an ambiguous Blender CLI flag, so the preview takes `cycles` without dashes.

## What ships
- **Facing and units.** The model faces **+Z** in glTF (−Y in Blender), Y is up, metres, feet at y = 0. The pelvis (`pelvis.L/R` head) is at y = 0.924 and `root` at y = 0.914. The head bone is at y = 1.554 and the eyes at y = 1.593, z = 0.122.
- **Rest pose.** MPFB A-pose. The runtime poses the bones; the GLB has no animations.
- **Compression.** None: no Draco, no meshopt. Textures are JPEG, plus PNG where they need alpha (beard, hair, brows, lashes, eyes). The skin is 2048² and the rest are ≤1024².
- **Mesh names.** `Pandit_Body`, `Pandit_Body.high-poly` (eyes), `Pandit_Body.eyebrow003`, `Pandit_Body.eyelashes01`, `Pandit_Body.teeth_base`, `Pandit_Body.tongue01`, `Pandit_Hair`, `Pandit_Beard`, `Pandit_Kurta` (2 primitives: kurta and pyjama), `Pandit_Shawl`.
- **Morphs.**
  - `blink_L/R`, `squint_L/R`, `brow_up_L/R`, `brow_down_L/R`, `smile`, `sneer`, `mouth_open`, `purse`, `frown` are on `Pandit_Body` and `Pandit_Beard`.
  - The brows carry blink, squint and brow keys; the lashes carry blink and squint.
  - Unlike Shakuni, the beard carries the morphs, so it follows smile and mouth-open.

## Runtime notes (vs chausar `human.ts`)
- **Brows are grey.** `human.ts` tints brow and lash strands near-black (`mix(vec3(0.03,0.025,0.02), strand.rgb, 0.15)`). For this grey-haired character, tint the **brows** to about `vec3(0.16,0.15,0.14)`, mixed 0.35 with the strand, and keep the lashes dark.
- **Hair is the MakeHuman `short02` proxy.** It has a soft alpha. The `/hair/` regex gives it `alphaTest 0.5`, double-sided, which is fine. Try `alphaTest ≈ 0.35` if it looks thin.
- **No turban.** `wearTurban()` returns false, so don't call it.
- **Teeth and tongue exist**, decimated to about 1.4k triangles. `human.ts` hides them, which is fine; the beard covers the mouth.
