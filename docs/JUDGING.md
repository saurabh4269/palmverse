# Judging self-assessment: Hast Rekha

How the build meets the Meta VR Start Developer Competition 2026 rules and its four judging criteria, each worth 25%.

- **Sources:** the kit's mirrored [rules](https://github.com/saurabh4269/meta-vr-start-2026-kit/blob/main/resources/devpost/rules.md) (§6 judging criteria), [judging page](https://github.com/saurabh4269/meta-vr-start-2026-kit/blob/main/resources/devpost/details_judging.md) and [special awards](https://github.com/saurabh4269/meta-vr-start-2026-kit/blob/main/resources/devpost/details_special-awards.md).
- **Evidence:** "E2E" means the emulator run in [TESTING.md](TESTING.md). ⚠ marks anything not yet verified on a physical Quest, which so far is everything that depends on the device.

## Entry choices
- **Track: Entertainment.** It is a piece of cultural storytelling: a character tells you what a tradition says about your own hand.
- **Division: New Experience.** It was conceived and built inside the competition window, starting from the official IWSDK starter.
- **Special awards to name:**
  - **Boldest Original Concept.** Your real palm is the canvas. The lines and mounts are drawn on your own skin and follow it as you turn your hand. On a flat screen, or in VR without passthrough, there is no palm to read. A search of the 2026 gallery found no palmistry entry, and no MR palm reader was found on Quest ([idea-ranking.md](https://github.com/saurabh4269/meta-vr-start-2026-kit/blob/main/research/idea-ranking.md)).
  - **Best First Five Minutes.** The payoff arrives early. About 2 seconds after you raise your palm (0.6 s to confirm it, then 45 tracked frames to measure it), lines draw themselves on your hand with a rising chime. The only interactions are holding up a palm and poking with a fingertip. Each is taught by Panditji's spoken line plus one world-anchored hint ("Hold up your palm, facing you ✋"), not a wall of text.

## Hard requirements (pass/fail)
| Requirement | Status | Evidence |
|---|---|---|
| Hands-first, completes without a controller | ✅ emulator | E2E plays the whole reading with emulated hands only (`set-input-mode hand`): Continue poke, palm up, scan, mounts poked by the other hand's fingertip, five line choices by poke, skip to card, Finish. `iwsdk.config.json` turns on `handTracking`. There is no controller code path. |
| Quest 3 / 3S at 60 fps or more | ✅ design / ⚠ device | Overlay: one ribbon mesh per visible line, one mesh for all seven mount sigils, one sheen quad. All placement happens in the vertex shader from four uniforms (`src/render/palm-overlay.ts`). The dome is one draw. No shadows, no post-processing, no physics. Textures are KTX2 (Basis Universal: UASTC for the face, eyes and strand cut-outs, ETC1S for AO and cloth), transcoded by a locally served Basis transcoder. Estimated texture memory went from 40 MB to 21 MB. Measured in the emulator at the mounts phase (dev `gpu` log): **76 draw calls, about 110k triangles**. The props are one Blender-baked mesh with one material each (5 draws), and AO and contact shadows are baked, never computed per frame. Fixed foveation is 0.5, with 4× MSAA on Quest's projection layer (docs/TESTING.md §4). **Frame rate not yet measured on a device.** |
| English | ✅ | All speech and captions are in English. Devanagari appears as titles and names (हस्त रेखा, गुरु पर्वत) next to their romanised and English forms. |
| No logos, brands or identifiable people | ✅ | Panditji is an original character generated from MakeHuman parameters, not a likeness. The pavilion, cards and sigils are procedural. |
| Original, not a wrapper | ✅ | No external service. The palm frame, measurement, rule engine, shaders and sound all run locally. |
| Hosted URL, works logged out | ⚠ to do | `vercel.json` is ready. Deploying needs the user's approval. See [SUBMISSION.md](SUBMISSION.md#pre-submission-checklist). |
| Public video under 3 minutes | ⚠ to do | Shot list in [SUBMISSION.md](SUBMISSION.md#trailer-shot-list-under-3-minutes). It must be filmed on a Quest. |

## Guidelines
| Guideline | How |
|---|---|
| Seated, 2 ft radius | At session start the pavilion is anchored to your head (`anchorStage()` in `src/director.ts`): the origin goes under your head, facing where you look, and eye height is clamped to 0.9 to 1.5 m. It re-seats when you raise your palm if you have moved more than 25 cm or changed height by more than 8 cm. Buttons and cards sit 0.40 to 0.46 m in front of you, and your palm is held 18 to 65 cm from your eyes. No locomotion. |
| Easy in and out | One Enter button. A full reading is about 5 minutes, and **Continue ›** appears when each step's talking is done. Readings are saved automatically. |
| Satisfying within 10 minutes | Lines glow on your palm within the first minute. A complete reading with a card takes about 5 minutes. |

## Criterion 1: Innovation & Creativity
- **The real palm is the canvas.** The overlay lives in palm coordinates, `q(a,b) = wrist + a·(middle knuckle − wrist) + b·(pinky knuckle − index knuckle)`, and is rebuilt from the live joints every frame. So the lines and mounts stretch, tilt and turn with your actual hand (`src/core/palm-frame.ts`, `src/render/palm-overlay.ts`).
- **A real tradition, handled with care.**
  - The 63-feature rulebook ([palmistry-rulebook.md](https://github.com/saurabh4269/meta-vr-start-2026-kit/blob/main/research/palmistry-rulebook.md), `data/palmistry-rules.json`) is built from Cheiro (1916), Benham (1900), Varahamihira's Brihat Samhita ch. 68 and modern Indian guides, with a citation for every rule.
  - Every reading in `src/content/readings.ts` points at exactly one rule (feature, attribute, value), and a test checks that every pointer resolves.
- **Honest framing as part of the design.** Panditji says up front that this is culture and story. In the outro he explains the Barnum effect. He also notes that heart and head lines and planetary mounts reached Indian practice through Western 20th-century authors.
- **You read your own palm.** Rather than fake detection, the app asks you to look at your own hand and pick the closest shape. The candidate glows on your palm while you hover over its card, so comparing your real crease with the drawn line is the game.
- **Touch a line, enter its world** (18 Nov). In the explore phase your chosen lines breathe with light. Touching or pinching one blooms a portal out of your palm that grows into a world around you, and Panditji tells that line's reading from inside it. Each world is in the design pack's palette ([research/hast-rekha-magic-design.md §3](https://github.com/saurabh4269/meta-vr-start-2026-kit/blob/main/research/hast-rekha-magic-design.md)): **heart**, lotuses opening on a dusk ocean; **life**, a banyan of light with aerial roots over a river of light; **head**, a constellation joining star by star; **fate**, Shani's ringed planet above a path of light. Touch a mount and its **graha's sky** opens: the planet in its Navagraha gem colour. A fist folds the world back into the palm.
- **Prior art and how we differ.** The 2025 Meta Horizon Start winner *Magic Wonders* (Devpost: [magic-wonders](https://devpost.com/software/magic-wonders)) set the bar for "hand gestures that feel like magic": glowing strokes with a white-hot core and a coloured halo, and a real room that reacts. We studied its stills for the glow language only ([research/hast-rekha/reference/magic-wonders](https://github.com/saurabh4269/meta-vr-start-2026-kit/blob/main/research/hast-rekha/reference/magic-wonders/README.md), internal, not shipped) and copied none of its art. The differences:
  - their magic is a spell you draw in the air with a wand on a phone; ours is written on **your own palm**, in passthrough, and the "spell" is touching a line of your hand;
  - the theme is a living cultural tradition (Samudrika Shastra, the Navagraha) told by a character, with every reading cited and safety-filtered, rather than a fantasy duel;
  - the "room answers" beat is a gold veil over the real room as a world opens, and the world dissolves open from the palm's direction while your real hands stay visible inside.
- **Two hands, two stories.** Reading your other hand triggers a comparison with the saved first hand ("the left shows what you were given, the right what you built from it"). There is also a daily "today's mount" line in the greeting, which is the same for everyone on a given date (`todaysMountIndex`).

## Criterion 2: Experience Design
- **Passthrough is the point.** The dome fades out below −15° so your table, lap and hands stay real (`src/render/dome.ts`). Dome opacity drops from 0.96 to 0.6 when you raise your palm "to let the room (and your real hand) in". Turn passthrough off and there is nothing to read.
- **Three gestures only** (the design pack's vocabulary: show palm, touch or pinch, close fist):
  - **Palm up:** facing the eye within about 55°, 18 to 65 cm away, held for 0.6 s (`isReadablePalm`).
  - **Close a fist** (either hand, every fingertip within 11.5 cm of the wrist, for 0.25 s): the open world folds back into the palm. Pointing doesn't count, because the index stays out.
  - **Touch or pinch a glowing line** (`src/core/line-touch.ts`, no physics): the fingertip is projected into palm space and compared with each line's polyline. Hover within 3.5 cm of the skin and 1.1 cm of the line (it leaves at 1.7 cm: hysteresis); touch within 1.2 cm of the skin; select after a 250 ms dwell, or on a pinch (which opens the hovered line). A 200 ms grace period keeps the hover through a dropped tracking frame. Where a line runs past a mount, whichever is nearer the fingertip wins.
  - **Feedback without haptics** (design pack §5): hover brightens and widens the line, with a soft shimmer that rises as the finger nears. Touch sends a ripple both ways along the line, with a bell and a low 80 ms thump. Select flares the line and plays a singing bowl over a sub drop. Embers rise off every glowing line.
  - **Fingertip poke.**
    - Mounts: the other hand's index tip within 1.7 cm of a mount centre, between 2 cm below and 3 cm above the palm plane, for 0.25 s.
    - Cards and buttons: hover within about 3.5 cm, press when the tip crosses the plane moving forward, with a cooldown, and a card only takes input after every fingertip has been clear of it (`src/render/cards.ts`).
- **Onboarding by voice and one hint.** Each step has one short spoken line. Captions always show, so it works muted. If you haven't raised your palm after 14 s, a gentle retry line plays. If tracking drops for 2.5 s during the mounts, Panditji asks for your hand again (at most once every 15 s).
- **Comfort and legibility** (`src/render/ui.ts`): body text in Mukta, a humanist sans. Subtitles sit about 1 m away and about 18° below gaze, lazy-follow and are never head-locked, with at most 2 lines of about 32 characters per page. Glyph height is about 1.4 to 1.6° at the viewing distance. The subtitles slide aside to the side opposite your reading hand while it is up, so they don't cover your palm.
- **FoV.** Everything you need is straight ahead and below eye level, where you are already looking at your palm: the cards are about 0.47 m below eye height and 0.4 m forward, and the buttons are 0.36 to 0.40 m below and 0.46 m forward. Nothing needs a sideways head turn. ⚠ Not checked against the narrower Meta VR Glasses view, or for how far people actually tilt their heads on a device.
- **Something to keep.** The Rekha card (1080×1350, `src/render/share-card.ts`) shows your element, your chosen line shapes on a palm diagram, a one-line summary and "Not a forecast." It is stored locally and downloadable from the 2D page.

## Criterion 3: Technical Implementation
- **Hand tracking:**
  - Reads 25 joints per hand each frame with `XRFrame.fillPoses`, then runs each joint through a One Euro filter (Casiez et al., CHI 2012): strong smoothing while the palm is still, so the overlay sits steady on the skin, and little lag when it moves (`tests/one-euro.test.ts`: jitter cut by at least 3×, lag under 15 mm at 0.4 m/s). The poking fingertip stays unfiltered for responsiveness.
  - The palm frame comes from 4 joints, with handedness-corrected normals. A palm counts as readable based on facing, distance and plausible size.
  - Tracking-loss grace period is 150 ms (`src/director.ts`, `readHands`).
- **Layer 1, measured from joints only** (`src/core/measure.ts`):
  - Palm squareness, finger-to-palm ratio, index length, index/ring ratio and thumb spread angle (projected onto the palm plane). Each is a median over 45 frames, so one bad frame cannot flip it.
  - Finger lengths are sums of bone segments, which doesn't change when fingers curl.
  - Thresholds are population medians and quartiles from the rulebook's notes.
- **Layer 2, line shapes confirmed by you** (`src/core/line-shapes.ts`):
  - 2 to 4 candidates per line, written in palm coordinates.
  - They vary the mean heart, head and life centrelines of 399 palms, produced by the offline pipeline in [research/palm-autolabel](https://github.com/saurabh4269/meta-vr-start-2026-kit/blob/main/research/palm-autolabel/README.md), and stay inside each line's corridor.
  - Endings fall in named anchor regions, for example a heart line ending under Jupiter, between Jupiter and Saturn, or under Saturn.
- **Safety enforced in code, not left to content** (`src/core/rules.ts`). A reading is dropped if:
  - its rule doesn't resolve;
  - the rulebook marks that value "do not use" or "omit";
  - its text matches the banned-claims pattern (death, lifespan, illness, insanity, fertility, divorce, accident, money loss, "you will", "predict", …).
- **Overlay rendering:**
  - Static geometry in (a, b) coordinates; the vertex shader maps it into the world.
  - Premultiplied "glow over passthrough" blending, so dark parts stay see-through on Quest.
  - Double-sided materials, because winding flips with stroke direction and handedness.
  - A soft dark ink bed under each ribbon for contrast on bright skin.
  - An ink-drawing reveal animation, and Devanagari mount sigils in one atlas, drawn in one call.
- **Character:** Panditji is MakeHuman/MPFB, built headless in Blender by script (`tools/pandit/`). It is animated procedurally (`src/render/human.ts`, `pandit.ts`):
  - seated pose, breathing and blinks;
  - head and eyes on your palm while it is up, otherwise on your face;
  - jaw moves while he talks;
  - namaste and explaining gestures.
- **Text:** Canvas2D text so the browser shapes Devanagari, which uikit/troika cannot do (`src/render/text.ts`). Card text is measured and shrunk to fit.
- **Tests:** palm-frame 41 checks, rules 2,581 checks (including 4,000 fuzzed profile and choice combinations), share-layout 283 checks, and a 44-check emulator E2E. See [TESTING.md](TESTING.md).
- ⚠ **Gaps relative to the rubric:**
  - **No MRUK, planes, anchors or depth occlusion.** The stage is anchored to your head pose, not to a detected table. That was a deliberate choice: the content is your palm, which needs no room understanding. Judges who weight scene understanding will see this gap.
  - **No gaze interactions.** Gaze input is a Unity/Unreal Interaction SDK feature.

- **After the first headset session (18 Nov evening), from the player's notes:**
  - **A divine opening, then straight to your palm.** The nine grahas revolve around you while a second, calmer voice (Aakashvani) speaks two lines. Panditji then greets you in one line, and a palm held up early goes straight to the reading. The old welcome ran four lines, about 52 s.
  - **The mounts lesson happens inside each planet's world.** Poke a mount and the room gives way to that graha's sky, with its own music. Panditji tells the mount from inside, and the world closes by itself. Poke another mount to switch worlds.
  - **Line picking that does what you see.** The hovered line is lit, the others step back, and its name is shown. A pinch opens the hovered line, not whichever line is nearest the pinch midpoint. Another line has to be 4 mm nearer before it takes over. A select made while the last world is still folding away is queued, not dropped.
  - **The palm stays put on device.** It is acquired at 55° and kept down to about 78° (hysteresis), so tilting it to poke no longer blinks the overlay or brings the "I cannot see your hand" line.
  - **Music per moment:** 14 instrumental loops (the opening, one per graha, one per line world), mixed 10 dB under the voice.
  - **Hindi words said the Hindi way in English lines** (Rekha, Hridaya, Parvat…): they are voiced from Devanagari, and the captions stay roman.
  - **Natural palms on the line cards** (rendered from the MakeHuman human), and a **real banyan model** in the life world.

## Criterion 4: Polish & Presentation
- **Lighting and materials (visual pass, 18 Nov):**
  - the takht, chowki, diyas and brass lamp stands are rebuilt in Blender at their exact runtime sizes, bevelled, with **baked ambient occlusion** and a **floor contact shadow cut from their real footprints** (`tools/setting/build_setting.py`). The platform stands on your real floor instead of floating over passthrough;
  - Panditji has **rest-pose baked AO** (costume folds, ears, fingers, under the beard), plus a **runtime contact shadow from his actual seated pose**: an orthographic depth render looking up from under the seat, blurred once into a decal (`src/render/contact-shadow.ts`);
  - **image-based light baked from the pavilion itself** (`tools/setting/bake_env.py` → `public/env/pavilion.hdr`): the dusk dome, the warm bounce off the takht, and the five diya flames, so brass and silk reflect the lamps that are actually there;
  - physical materials: skin with a low warm sheen (a cheap stand-in for subsurface warmth), cotton with a light sheen, the shawl as silk, real metal brass, satin lacquered wood;
  - KTX2 textures (sharper at a quarter of the GPU memory) with a local transcoder.
- **Art direction:**
  - a lamp-lit pavilion: a procedural dome with a dusk sky between carved pillars;
  - a low chowki with diyas and a flickering warm light;
  - lacquer and parchment cards with gilded corners;
  - Rozha One for display, Tiro Devanagari Hindi for sigils, and Mukta for body text;
  - a line colour code shared by the overlay, the choice cards and the share card.
- **Sound** (`src/render/audio.ts`), all synthesised:
  - a temple-bell chime, a soft tanpura-like drone, and a rising swell when the lines first glow;
  - mount "tings" that climb the Bhupali scale (Sa Re Ga Pa Dha);
  - tick and press sounds.
  - Voice is browser speech synthesis, preferring an Indian English voice. Devanagari is stripped before speaking.
- **Portal worlds** (`src/render/worlds.ts`), each about 7 draw calls on top of the scene, all unlit and procedural, with no textures except the title canvas:
  - an orb swells at the palm, then an inside-out sky sphere around the head dissolves open from the palm's direction (an angular mask with fbm noise and a gold rim);
  - outside the opened part, a 14 % gold veil tints the real room. In WebXR that is a premultiplied layer, not a camera effect;
  - **the hands stay real:** 50 instanced spheres on the joints write alpha 0 after the world, so passthrough shows through exactly where your hands are, and the palm lines draw on top;
  - per world: one hero mesh (lotus petals that open in the vertex shader; a generated banyan of tubes that grows from the ground; constellation quads drawn edge by edge; a banded ringed planet), one shared 600-point particle system whose motion changes per world (falling petals, fireflies and a leaf canopy, star dust, orbiting motes), and a Devanagari title;
  - the sky is drawn with depth test off, after the opaque pavilion, so it covers the pavilion with no extra pass. The low-frequency nebula is computed per vertex, and the rim noise only near the rim.
  - Measured in the emulator inside a world: 72 draw calls, 68.5k triangles and 22.6 MB of textures, against 80 calls and 110k triangles at the busiest pavilion moment.
- **Divine voice, pre-rendered** (`tools/voice/`, `src/render/voice-clips.ts`): an original voice made with ElevenLabs Voice Design (described in text, nothing cloned), rendered per line, then our ffmpeg chain from the design pack §4.3: low-octave weight, octave-up whisper, fifth pad, chorus, a synthetic stone-temple impulse response, and a synthetic tanpura bed at −16 LUFS. All 96 lines are listed by `src/content/spoken.ts` and found at runtime by an FNV-1a hash. Clips play back to back through Web Audio, captions take each clip's real length, each world's lines are prefetched when explore starts, and any line without a clip falls back to speech synthesis. No key or API call is in the app.
- **Hindi** (`src/content/hindi.ts`): all 96 lines, as captions and voice. Each Hindi line maps 1:1 to a vetted English line (the safety filter is English-only, so a test checks coverage, and that the Hindi is Devanagari only).
- **Submission materials:** see [SUBMISSION.md](SUBMISSION.md).

## Decisions and rationale
- **Physics: none.** This is an overlay and character experience. Nothing falls, collides or is thrown. Motion is tweens, springs and shaders. `iwsdk.config.json` has `physics: false`, `grabbing: false` and `locomotion: false`.
- **Engine: IWSDK / WebXR, not Unity or Godot:**
  - IWSDK has an emulator (IWER) driven from a CLI. That made a scripted, hands-only, end-to-end test of the whole reading possible, plus close-up stills, all without a headset.
  - Judges get an instant URL with no APK sideload or release channel.
  - Godot has no comparable emulator path for scripted hand input.
  - Unity is not installed on the build machine.
  - The cost: no Passthrough Camera API on the web (see Layer 3) and no Interaction SDK gaze.
- **Layers:**
  - **Layer 1 (ships):** hand-tracking-only measurement of shape, fingers and thumb.
  - **Layer 2 (ships):** line shapes you confirm by comparing your palm with glowing candidates.
  - **Layer 3 (what's next):** a camera crease scan. Real creases would be read from the passthrough cameras, then traced and classified inside the same corridors.
    - **Evidence it is feasible offline:** the kit's [`scripts/palm/`](https://github.com/saurabh4269/meta-vr-start-2026-kit/tree/main/scripts/palm) pipeline and its write-up in [research/palm-autolabel](https://github.com/saurabh4269/meta-vr-start-2026-kit/blob/main/research/palm-autolabel/README.md).
      - It runs MediaPipe, palm rectification, CLAHE plus Frangi ridges, and a minimum-cost path per line corridor, cross-checked against palm-line-reader.
      - On 300 photos, 148 passed the quality gate. Agreement on heart, head and life was 0.92, 0.95 and 0.80.
      - There is no human ground truth, and end classes are unreliable.
    - **The open question** is whether a web page on Quest can get passthrough camera frames at all. Unity has the Passthrough Camera API; WebXR raw camera access was reported as unsupported in Quest Browser in early 2026 ([ideas-7-8.md §8.4](https://github.com/saurabh4269/meta-vr-start-2026-kit/blob/main/research/ideas-7-8.md)).
    - `public/probe.html` is a small, standalone page that tests two routes on the headset: WebXR `camera-access` (`XRView.camera` and `getCameraImage`) and `getUserMedia`. It reports the resolution and shows a preview so creases can be judged by eye. ⚠ **It has not been run on a Quest, so the answer is unknown.**
- **Fingertip tracing is not implemented.** The research plan had a "trace your line with a fingertip" mode. The shipped Layer 2 uses pick-the-closest-shape cards instead: a poke is more robust than tracing a few millimetres above your own skin with jittery tracking, and the result maps directly onto rulebook values. 
- **No LLM.** The reading comes from a fixed, cited, safety-filtered library. There is no network dependency, no prompt that could drift into prediction, and nothing leaves the device.

## Known limitations and risks
- ⚠ **Overlay registration on a real palm is unverified.** The palm frame is a plane through four joints. Real palms are curved, and Quest joint positions are estimates. The lines could sit a few millimetres off the actual creases, or float at some hand angles. Mount centroids are population averages, not fitted to the person.
- ⚠ **Palm-up tracking stability is unverified.** Quest hand tracking is tuned for common poses. A palm held up facing the eyes, possibly with the other hand's fingertip touching it (the mount poke), may cause occlusion and jitter. The two-hand poke is the riskiest interaction.
- ⚠ **Thresholds come from 2D photos.** The element, finger and thumb thresholds are medians from photo datasets, not Quest joint data. On real hands the class distribution may be skewed, for example most people coming out "Fire".
- ⚠ **The first lines are a template.** The reveal draws the tradition's typical shape, not your creases. Panditji says "as the tradition draws them", and you then pick your own. The trailer and text must not imply detection.
- ⚠ **Legibility on real skin.** The ink bed and thicker core were tuned in the emulator against a rendered hand. Real skin under room light, especially bright or very dark skin, is untested.
- ⚠ **Frame rate:** not measured on a device. Inside a world the sky shader covers the whole view; the levers, if it is GPU-bound: drop the rim fbm to one octave, lower the star density, or fall back to foveation 0.75 (docs/TESTING.md §4).
- ⚠ **Fist and pinch on a real hand are unverified.** The fist threshold (11.5 cm, every fingertip) and the pinch threshold (1.8 cm, thumb to index) are emulator values. If a world fails to close, it still closes by itself when Panditji finishes.
- ⚠ **The gold veil and the hand mask assume `alpha-blend` passthrough** (immersive-ar on Quest Browser). On an opaque display the mask would show black hand shapes.
- ⚠ **Voice:** lines without a pre-rendered clip use `speechSynthesis`, whose voices in Quest Browser are unknown. Captions are always on.
- ⚠ **The Hindi translations were written by Claude (AI)** and have not yet been reviewed by a native speaker.
- **Dev keys** (`n`, `1`–`4`, `o`) also work in production builds. That is harmless on a headset with no keyboard.
