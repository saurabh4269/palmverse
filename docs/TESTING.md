# Testing: Hast Rekha

There are three automated layers: unit tests in node, an emulator end-to-end test, and close-up stills for visual review. None of them replaces a real headset, so the device checklist is at the end.

## 1. Unit tests (`npm test`)
`tools/run-unit.mjs` bundles each `tests/*.test.ts` with esbuild and runs it in node. Rendering is not involved: the logic under test is pure TypeScript over plain arrays.

Latest run (18 Nov 2026):
```
ok   one-euro: 3/3
ok   palm-frame: 41/41
ok   rules (4000 fuzz combos, 29982 items): 2581/2581
ok   share-layout: 283/283
```
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

## 2. Emulator end-to-end (`npm run test:xr`, 44 checks)
`tools/e2e.py` drives IWER (the IWSDK emulator) with the Meta Quest 3 profile in the "sunlit living room". It uses emulated hands only, as a seated user (head at 1.2 m). It reads the app's dev-only `[hast]` console log lines through the IWSDK CLI, and takes world positions of buttons, cards and mounts from the `layout={json}` lines.

```bash
npx @iwsdk/cli dev up --ai-mode agent      # managed dev server on :8087
npm run test:xr                            # = python3 tools/e2e.py
python3 tools/e2e.py --hand left --jitter 5 --mounts 7 --tour
```
Options: `--hand` sets the reading hand; `--jitter` adds random fingertip error in mm (default 3); `--mounts` sets how many mounts to poke (default 3); `--tour` takes extra screenshots.

**The journey and its checks:**
1. Enter XR in hand input mode. The **welcome** phase starts and the **stage is anchored**.
2. **Poke Continue** with the left index fingertip, approaching from the head side. The press registers and the phase goes to **raise**.
3. Raise the right hand in the open pose, palm toward the head. The app reports **palm-up for the correct hand**, then a **hand-shape profile** with a valid element.
4. **Four lines glow** (life, head, heart, fate). **Seven mounts light**, and the mount positions are logged.
5. **Poke mounts** (default Jupiter, Venus, Moon) at 4 mm above the palm, with jitter. Each `mount-poke` must name the intended mount.
6. Poke Continue. The phase goes to **lines**.
7. For each of **heart, head, join, life and fate**:
   - 2 to 4 cards appear;
   - hovering a card **previews** that card's value on the palm;
   - poking it **picks** that value.
8. The **reading is built** with at least 6 items, and **no reading was dropped or missing**.
9. Poke Continue to skip to the card. The **card is rendered and saved**: at least 3 lines, at least 1 saved, and a JPEG over 10 kB.
10. **Poke Finish.** The **farewell** phase starts.

Screenshots go to `artifacts/e2e-*.png`.

I did not re-run it for these docs. The emulator was in use by another session. The 44-check run is the one described in commit `a6c2d80`.

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
| 7 | **Frame rate at 72 fps** | OVR Metrics Tool overlay (or `scripts/quest-adb.sh` perf capture) through the whole reading, especially with the pavilion, Panditji and the overlay all visible. | A steady 72 fps, and never below 60. Note the worst phase. |
| 8 | **Probe page** | Open `/probe.html` on the headset. Press "1 · WebXR camera-access", then "2 · getUserMedia". Hold your palm in front of the preview. | Record: is `camera-access` granted, is `XRView.camera` present and at what size, does `getUserMedia` list a passthrough camera and with what settings, and are the creases sharp at about 30 cm? This decides whether Layer 3 is possible on the web. |
| 9 | **Audio and voice** | With the volume up: the chime on welcome, the swell at reveal, the mount tings, the drone. | Sounds play after the first tap or Enter. Panditji speaks in an English voice, ideally Indian English, and stops when you poke a mount. Note the voice name. |
| 10 | **Hand element sanity** | Five or more people with different hand shapes. | The elements are not all the same. If they are, retune `THRESH` in `src/core/measure.ts` using the logged ratios. |
| 11 | **Save and gallery** | Finish a reading, exit XR, reload the page. | The card appears in "Your Rekha cards" and the download works. Reading the other hand produces the comparison line. |
| 12 | **Logged out / incognito** | Open the hosted URL in a private window on the Quest. | It loads, offers Enter, and the full reading works. |
