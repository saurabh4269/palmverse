# Testing: Hast Rekha

There are three automated layers: unit tests in node, an emulator end-to-end test, and close-up stills for visual review. None of them replaces a real headset, so the device checklist is at the end.

## 1. Unit tests (`npm test`)
`tools/run-unit.mjs` bundles each `tests/*.test.ts` with esbuild and runs it in node. Rendering is not involved: the logic under test is pure TypeScript over plain arrays.

Latest run (18 Nov 2026, evening):
```
ok   line-touch: 69/69        (includes the 41 palm-frame checks it imports)
ok   one-euro: 3/3
ok   palm-frame: 41/41
ok   rules (4000 fuzz combos, 29982 items): 2583/2583
ok   share-layout: 283/283
ok   spoken (96 lines, 11167 chars): 203/203
ok   worlds: 17/17
```
- `tests/line-touch.test.ts`: the nearest line and the position along it for points on each line; hover at 2.5 cm; touch; no select before the dwell; exactly one select per touch; the grace period keeps a hover through dropped frames; loss unhovers; touching again selects again; a pinch selects once, on its rising edge.
- `tests/worlds.test.ts`: every world's narration passes the safety filter and is framed as tradition.
- `tests/spoken.test.ts`: all 96 spoken lines are unique and safe; the FNV-1a hash matches the Python renderer's reference vectors (including UTF-8 Devanagari); every English line has Hindi, in Devanagari only, with no stale entries.
`npx tsc --noEmit` also passes.

### `tests/one-euro.test.ts` (3 checks)
The joint filter: ±2 mm noise on a still hand is cut by at least 3×; a hand sweeping at 0.4 m/s lags by under 15 mm; after a reset (hand lost, then found elsewhere) the first sample passes straight through.

### `tests/palm-frame.test.ts` (41 checks)
These run on a synthetic hand with known joints (palm 9 cm long, knuckle row 7 cm), for both the right and left hand:
- The palm normal points to the eye, facing ≈ 1, the palm is readable, and the length is exactly 9 cm.
- `q(0,0)` is the wrist, `q(1,0)` the middle knuckle, and `lift` moves along the normal.
- Mount centroids from `palm-regions.json` land where anatomy says:
  - Jupiter is on the thumb side of Saturn, and Mercury on the pinky side of Sun.
  - Venus is low on the thumb side, and the Moon low on the pinky side.
  - The Saturn centroid is exactly `wrist + a·Ey + b·Ex`.
- `toPalm(q(a,b,h))` round-trips at three points.
- With the opposite handedness, the back of the hand is rejected.

Also:
- A palm that is too far away (about 0.9 m) or too close (about 0.1 m) is rejected.
- Element classification covers all four quadrants. Measured from joints, a wide palm with short fingers gives Prithvi and a narrow palm with long fingers gives Jal.
- The median aggregate ignores a single wild frame.

### `tests/rules.test.ts` (2,581 checks)
- The project's copies of `palmistry-rules.json` and `palm-regions.json` are byte-identical to the root `data/` files.
- The banned-claims pattern catches 10 known-bad phrases ("a short life", "You will marry twice", "signs of illness", "risk of divorce", "Cheiro: insanity", "fertility", "early death", "this predicts wealth", "bad luck ahead", "jealous nature"). It also allows 4 near-misses ("skill and will-power", "still waters", …).
- **Every authored string is safe:** reading titles, texts and summaries; mount texts; line-option labels; and every string in Panditji's script.
- Every reading, mount and element rule resolves to a rulebook entry, and none points at a value the rulebook marks "do not use" or "omit".
- Readings on features the rulebook flags as sensitive (death, mental illness, fertility, sexuality, addiction) never mention length, lifespan or "how long".
- **Fuzz:** 4,000 random profiles (side, element, three finger and thumb tendencies), each with random partial line choices, go through `buildReading`. Every item must be safe and cited. Every complete set of choices must give at least 6 items. The current run produced 29,982 items.
- A deliberately unsafe reading ("…an early death") is dropped and logged as `banned-claim`. An unresolvable rule is dropped.
- "Today's mount" is stable within a day and varies across 60 days.

### `tests/share-layout.test.ts` (283 checks)
The share-card layout is tested with normal, very long and two-line content:
- every text box stays inside the card margins;
- no two text boxes overlap;
- the palm diagram is present and clear of all text.

## 2. Emulator end-to-end (`npm run test:xr`, 56 checks; `--worlds`, 65)
`tools/e2e.py` drives IWER (the IWSDK emulator) with the Meta Quest 3 profile in the "sunlit living room". It uses emulated hands only, as a seated user (head at 1.2 m). It reads the app's dev-only `[hast]` console log lines through the IWSDK CLI, and takes world positions of buttons, cards and mounts from the `layout={json}` lines.

```bash
npx @iwsdk/cli dev up --ai-mode agent      # managed dev server on :8087
npm run test:xr                            # = python3 tools/e2e.py
python3 tools/e2e.py --hand left --jitter 5 --mounts 7 --tour
```
Options: `--hand` sets the reading hand; `--jitter` adds random fingertip error in mm (default 3); `--mounts` sets how many mounts to poke (default 3); `--tour` takes extra screenshots.

**The journey and its checks:**
1. Enter XR in hand input mode. The **welcome** phase starts and the **stage is anchored**.
1b. **Poke the language button twice:** it toggles English and Hindi, and Panditji's next line after switching to Hindi is in Devanagari. The run is left in English.
2. **Poke Continue** with the left index fingertip, approaching from the head side. The press registers and the phase goes to **raise**.
3. Raise the right hand in the open pose, palm toward the head. The app reports **palm-up for the correct hand**, then a **hand-shape profile** with a valid element.
4. **Four lines glow** (life, head, heart, fate). **Seven mounts light**, and the mount positions are logged.
5. **Poke mounts** (default Jupiter, Venus, Moon) at 4 mm above the palm, with jitter. Each `mount-poke` must name the intended mount.
6. Poke Continue. The phase goes to **lines**.
7. For each of **heart, head, join, life and fate**:
   - 2 to 4 cards appear;
   - hovering a card **previews** that card's value on the palm;
   - poking it **picks** that value.
7b. **Explore:** the four chosen lines glow.
   - Approach the **heart line** at a logged point (the sample farthest from every other line). It **hovers** at 2 cm, is **touched** at 3 mm, and is **selected** after the dwell.
   - **The heart world opens**, the GPU stats inside it are logged, and screenshots are taken from the palm view and looking ahead. Making the poking hand a **fist closes it**.
   - Touch the **Sun mount**: **its graha world opens** (Surya), and a fist closes it.
   - With `--worlds`, the **life, head and fate** lines are each touched, opened, screenshotted and closed in turn.
   - Poke Continue. The phase goes to **reading**.
8. The **reading is built** with at least 6 items, and **no reading was dropped or missing**.
9. Poke Continue to skip to the card. The **card is rendered and saved**: at least 3 lines, at least 1 saved, and a JPEG over 10 kB.
10. **Poke Finish.** The **farewell** phase starts.

Screenshots go to `artifacts/e2e-*.png`.

Latest runs (18 Nov 2026): `npm run test:xr` **56/56**; `python3 tools/e2e.py --worlds` **65/65**.

## 3. Close-up stills (`tools/shots.py`)
```bash
python3 tools/shots.py <prefix>     # → artifacts/shot-<prefix>-{welcome,lines-drawing,lines,mounts,closeup,wide}.png
```
This walks to the palm-up state with the `n` key, then takes stills:
- while the lines draw;
- with all lines drawn;
- with all mounts lit;
- a close-up with the head moved to about 20 cm from the palm;
- a wide view.

These stills are for visual review and for trailer framing.

### Why a test that only reads logs isn't enough
In the first full build, every E2E check passed: `line-glow line=heart` and the rest were logged on time. But **the line ribbons were invisible.**
- The ribbon and sheen materials were back-face culled. A triangle strip's winding flips with stroke direction and with handedness, so half the lines faced away from the camera.
- The logs proved the state machine ran. They could not prove a single pixel was drawn.
- The fix (commit `ac416c4`):
  - `DoubleSide` on the glow materials;
  - a thicker core with a soft dark "ink bed" for contrast;
  - GLSL `smoothstep` calls whose edges were reversed (that ordering is undefined behaviour) rewritten.
- `tools/shots.py` was added so a person reviews close-up stills after any render change.

**Rule:** after touching `src/render/`, run `shots.py` and look at the pictures. Green E2E is necessary but not sufficient.

## 4. Render quality and performance (visual pass, 18 Nov 2026)

### Numbers from the emulator
Measured with the dev `gpu` log (press `g`, or automatic 1.5 s into the mounts phase; `src/render/gpu-stats.ts`). The figures are the renderer's calls and triangles for the last frame, and texture memory estimated per GPU texture source: RGBA8 = 4 B/px, Basis-transcoded = 1 B/px, mip chains ×4/3. Same moment (`tools/shots.py`, the wide view after the mounts are lit) before and after.

| | Before (`5f7c025`…`ecf9407`) | After (this pass) |
|---|---|---|
| Draw calls | 70 | 76 (baked props are 5 materials plus a floor shadow; plus Panditji's contact decal) |
| Triangles | 105,306 | 109,870 (bevels, diya bowls) |
| GPU textures (unique sources) | 20 | 28 (7 baked AO maps, the floor shadow, the contact-shadow target) |
| Texture memory (estimate) | 40.0 MB, none compressed | **21.1 MB**, 18 compressed (KTX2: UASTC and ETC1S) |
| Download: `pandit.glb` | 3.6 MB (JPEG/PNG) | 6.6 MB (UASTC skin atlas 2.7 MB; everything else ETC1S) |
| Download: new files | none | `setting.glb` 0.23 MB, `env/pavilion.hdr` 0.22 MB, Basis transcoder 0.58 MB |

**Inside a world** (the `gpu world=heart` log, 4 s after it opens): **72 draw calls, 68.5k triangles, 30 GPU textures, 22.6 MB** (the sky covers the pavilion, so the total stays below the 80 calls at the mounts). Each world adds about 7 calls (sky, hero, motes, hand mask, orb, title) and the title canvas.

`npx @iwsdk/cli scene render-stats` samples a different frame and reports about 60 calls and 108k triangles after this pass.

### Anti-aliasing and foveation (checked in code and in the emulator)
- IWSDK creates the renderer with `antialias: true` and `multiviewStereo: true` (`@iwsdk/core/dist/init/world-initializer.js`), and requests the `layers` feature by default.
- **On Quest Browser** (WebXR Layers available), three's `WebXRManager` uses an `XRProjectionLayer`. It renders into its own multiview render target with `samples: attributes.antialias ? 4 : 0`, which is **4× MSAA**. The browser's `XRWebGLLayer` antialias flag does not apply on this path. Without Layers it falls back to `new XRWebGLLayer(session, gl, { antialias: true })`.
- **In the emulator (IWER)**, the dev log at XR start reads: `xr-render layer=XRWebGLLayer antialias=true ctxAntialias=true samplesMax=8 multiview=false foveation=0.5 size=800x800`. That is the fallback path, with AA on.
- **Foveation:** three defaults to `1.0`, the maximum fixed foveation. The captions and line cards sit about 20° off centre, where high FFR softens text, so the app sets `renderer.xr.setFoveation(0.5)` (`director.ts` `init`). The scene is light enough to afford it. Revisit if the device trace shows a GPU-bound frame.
- **On the device**, the same `xr-render` line should read `layer=XRProjectionLayer multiview=true foveation=0.5 fixedFoveation=0.5` with a per-eye texture size. If `layer=XRWebGLLayer` appears instead, Layers were not granted, and MSAA then depends on the browser honouring `antialias`.

### Capturing on the Quest (when it is plugged in)
```bash
adb devices                                   # the Quest must be listed (developer mode, USB debugging allowed)
npx @iwsdk/cli dev up --ai-mode agent         # dev server on :8087 (dev build: the [hast] logs are on)
tools/perf-quest.sh before-ship               # guided: opens Quest Browser, waits, captures, analyses
```
What the script runs, if you prefer to do it by hand:
```bash
adb reverse tcp:8087 tcp:8087
adb shell am start -a android.intent.action.VIEW -d https://localhost:8087/ com.oculus.browser
#   on the headset: Enter → raise the right palm → Continue until the seven mounts are lit
adb logcat -d | grep -E "\[hast\] (xr-render|gpu)"                          # layer, MSAA path, foveation, calls, texture MB
npx metavr perf capture --mode vr --duration 10000 --app com.oculus.browser -o hast-mounts
npx metavr perf analyze-trace hast-mounts --app com.oculus.browser --focus frames --report-out artifacts/perf/frames.md
npx metavr perf analyze-trace hast-mounts --app com.oculus.browser --focus gpu --report-out artifacts/perf/gpu.md
npx metavr perf monitor -- -p com.oculus.browser --duration 60                # optional: CPU- vs GPU-bound verdict
```
Record in the table below: the median and worst frame time, missed frames, CPU- or GPU-bound, and the `xr-render` line. Budget: 13.9 ms at 72 Hz, never below 60 fps. If the frame is GPU-bound, the levers in order are:
1. `setFoveation(0.75)`;
2. drop the skin and silk sheen (`upgradeMaterial` in `src/render/human.ts`);
3. lower the IBL texture size.

| Date | Device | xr-render | Median / worst frame | Bound | Notes |
|---|---|---|---|---|---|
| | | | | | |

## Device checklist
To be done by a person with a Quest 3 or 3S, in Quest Browser, at the hosted HTTPS URL or the dev server's network URL. ⚠ **None of these has been done yet.** Record the results here.

| # | Check | How | Pass if |
|---|---|---|---|
| 1 | **Overlay registration on a real palm** | Raise your palm at about 30 cm. Turn it slowly by ±30°, curl and spread your fingers, and move it closer and further. | The lines sit on the palm, not floating or sliding off the edge. Mount sigils sit roughly on the fleshy pads under each finger, Venus on the thumb base and Moon on the outer heel. Note any steady offset in mm. |
| 2 | **Line and mount legibility on real skin** | Under ordinary room light, and in brighter and dimmer light if possible. Try several skin tones. | All four line colours and the Devanagari sigils are readable on the palm. Glow does not wash out on bright skin or vanish on dark skin. |
| 3 | **Palm-up tracking stability** | Hold the palm up through the scan and the mounts phase, then rest your hand and raise it again. | The palm is accepted within about 1 s. No flicker of the overlay (presence fading in and out). "I cannot see your hand" never plays while the hand is plainly visible. |
| 4 | **Two-hand poke (occlusion)** | In the mounts phase, touch each of the 7 mounts with your other index finger. | Each poke lights the right mount and plays its text within about 0.5 s. The reading hand doesn't lose tracking while the other hand is in front of it. Count misses and wrong mounts. |
| 5 | **Cards and buttons by poke** | Continue, the 5 line questions, Read my other hand, Finish. | Each press works on the first or second try. Hovering previews the shape on your palm. No double presses. |
| 6 | **Text legibility at seated distance** | Read the welcome card, subtitles, mount plate, line cards and the share card while seated. | Everything is readable without leaning in. Subtitles don't cover the palm. |
| 7 | **Frame rate at 72 fps** | `tools/perf-quest.sh` (section 4), plus the OVR Metrics Tool overlay through the whole reading, especially with the pavilion, Panditji and the overlay all visible. | A steady 72 fps, and never below 60. Note the worst phase. |
| 7b | **MSAA and foveation actually in effect** | The `xr-render` log line (section 4). Look at the takht edges and the line cards' borders. | `layer=XRProjectionLayer`, `foveation=0.5`. Edges are not stair-stepped, and the captions at about 20° off centre are crisp. |
| 7c | **Visual pass on real passthrough** | Look at the floor shadow under the takht, Panditji's contact on the durrie, the brass reflections, and the skin and silk sheen. | The takht reads as standing on your real floor, not floating. Brass is warm, not black. Skin is not plasticky or orange. |
| 8 | **Probe page** | Open `/probe.html` on the headset. Press "1 · WebXR camera-access", then "2 · getUserMedia". Hold your palm in front of the preview. | Record: is `camera-access` granted, is `XRView.camera` present and at what size, does `getUserMedia` list a passthrough camera and with what settings, and are the creases sharp at about 30 cm? This decides whether Layer 3 is possible on the web. |
| 9 | **Audio and voice** | With the volume up: the chime on welcome, the swell at reveal, the mount tings, the drone. | Sounds play after the first tap or Enter. Panditji speaks in an English voice, ideally Indian English, and stops when you poke a mount. Note the voice name. |
| 10 | **Hand element sanity** | Five or more people with different hand shapes. | The elements are not all the same. If they are, retune `THRESH` in `src/core/measure.ts` using the logged ratios. |
| 11 | **Save and gallery** | Finish a reading, exit XR, reload the page. | The card appears in "Your Rekha cards" and the download works. Reading the other hand produces the comparison line. |
| 12 | **Logged out / incognito** | Open the hosted URL in a private window on the Quest. | It loads, offers Enter, and the full reading works. |
