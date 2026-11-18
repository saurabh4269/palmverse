# Submission: Hast Rekha

Draft Devpost text, trailer plan and checklist for the Meta VR Start Developer Competition 2026. The deadline is **Thu 19 Nov 2026, 1:30 AM IST** (Wed 18 Nov, 12:00 PM PST).

- **Track:** Entertainment
- **Division:** New Experience
- **Special awards to mention:** Boldest Original Concept, Best First Five Minutes

Before pasting, replace any sentence marked ⚠ with what you actually saw on the headset.

---

## Devpost text

### Tagline
A pandit reads your real palm: the lines glow on your own hand, and touching one opens its world around you.

### Inspiration
In India, *hast rekha*, palm-line reading, is part of Samudrika Shastra, the old study of the body's marks. Most of us have watched a relative or a street-side pandit trace someone's palm with a finger and tell a story. Palm readers exist as phone apps, but they read a photo. We wanted the real moment: you hold up your own hand, and the lines light up on it.

### What it does
- **Panditji**, a warm elderly scholar, sits across your table in a lamp-lit pavilion while your room stays visible around you.
- **Your palm becomes the page.** Hold your palm up and it is measured from hand tracking alone. The four great *rekhas* (Jeevan, Mastishk, Hridaya, Bhagya) draw themselves onto your hand and follow it as you move. Panditji names your hand's element (Earth, Air, Fire or Water) from its shape.
- **Seven mounts, by touch.** The seven *parvat* light up with Devanagari sigils. Touch one with a fingertip of your other hand to hear what the old books say about it.
- **You read your own palm.** For each line, you look at your real palm and poke the card whose shape matches it. The candidate glows on your hand while you hover over its card.
- **Touch a line, enter its world.** Your lines breathe with light and embers. Touch one, or pinch near it: a bell rings, a ripple runs along the line, an orb swells over your palm, the room turns faintly gold, and the line's world dissolves open around you. Lotuses open on a dusk ocean for the heart line, a banyan of light grows over a river for the life line, a constellation joins star by star for the head line, and Shani's ringed planet rises over a path of light for the fate line. Your real hands stay visible inside, and Panditji tells you what the tradition reads in that line. Make a fist and the world folds back into your palm.
- **The grahas.** When you touch a mount, its graha (planet) rises out of your palm in its Navagraha gem colour. In explore, touching a mount opens that graha's sky.
- **A voice from within.** Panditji's lines are pre-rendered in an original designed voice, with temple reverb, a low octave and a tanpura bed, in English or Hindi.
- **A reading, then a card to keep.** Every sentence of the reading is traced to a cited rule from Cheiro (1916), Benham (1900) or modern Indian guides. You leave with a Rekha card, saved in the browser and downloadable afterwards. Read your other hand and he compares the two.
- **Culture, not prediction.** The welcome card says so. Claims about death, illness, fertility and the like are filtered out in code. Before signing off, Panditji explains the Barnum effect.
- **Private by design.** No camera, no upload, no account. The app sees only your hand-joint positions.
- **Hands only, seated, about five minutes.**

### How we built it
- **Stack:** IWSDK 1.1.0 (Meta's WebXR SDK, three.js), TypeScript, an immersive-ar session with hand tracking.
- **Palm frame:** four WebXR joints (wrist, index, middle and pinky knuckles) define a coordinate frame on your palm. The overlay geometry is static in that frame, and a vertex shader places it from four uniforms every frame, so the lines stretch and turn with your hand at almost no CPU cost.
- **Measurement:** over 45 frames, the app takes the median of palm squareness, finger-to-palm ratio, index/ring ratio and thumb spread, using thresholds from population data.
- **Line shapes:** the candidate shapes vary the mean heart, head and life lines of 399 palms. We produced those with an offline computer-vision pipeline (MediaPipe, ridge filtering, corridor path search) that we built while researching the project.
- **Rulebook:** a 63-feature rulebook, cited line by line from public-domain texts, with sensitive claims flagged. A rule engine drops any reading that is unresolved, marked "omit", or matches a banned-claims pattern. It is fuzzed with 4,000 input combinations in unit tests.
- **Panditji:** generated from MakeHuman/MPFB (CC0) in a headless Blender script with a code-built kurta, shawl and beard. He is animated procedurally: breathing, blinks, gaze on your palm, jaw while speaking, namaste.
- **Text:** Devanagari is drawn with Canvas2D so the browser shapes it properly. Sound is synthesised with Web Audio, including bell partials, a tanpura-like drone and mount tones on the Bhupali scale.
- **Touch without physics:** the other hand's fingertip is projected into palm space and compared with each line's polyline, with hysteresis, a 140 ms dwell, pinch-to-select and a grace period for dropped tracking frames. Light and sound stand in for haptics.
- **Portal worlds:** an inside-out sky dissolves open from the palm's direction. Each world is one procedural hero mesh, one particle system and a title, about 7 draw calls. Instanced spheres on the hand joints write alpha 0, so passthrough shows your real hands inside the world.
- **Voice:** ElevenLabs Voice Design (an original voice, not a clone), pre-rendered per line, then an ffmpeg chain (octave layers, chorus, a synthetic stone-temple impulse response, a tanpura bed). No API calls at runtime.
- **Testing:** an emulator end-to-end test plays the whole reading with emulated hands, including touching a line, entering its world and closing it with a fist (56 checks; 65 with every world). About 3,200 unit checks run alongside it.

### Challenges we ran into
- **No creases from hand tracking.** Joints give the hand's geometry but not its lines. Rather than pretend to detect lines, we made reading your own palm the interaction: you compare your crease with glowing candidates and choose.
- **Camera access on the web.** The Passthrough Camera API is available to native apps. Whether a web page on Quest can see the passthrough camera is still an open question. We wrote a probe page to find out (see What's next).
- **Invisible lines behind green tests.** Our first build passed every automated check while the line ribbons were not drawn at all. They were back-face culled, because a ribbon's winding flips with stroke direction and handedness. Since then we review close-up screenshots after every rendering change.
- **Respecting a tradition without endorsing predictions.** We wrote every reading as "the tradition reads…" and enforced safety in code, not only in copy. We also say plainly that heart and head lines and planetary mounts came into Indian practice through 20th-century Western authors.

### Accomplishments that we're proud of
- Lines and mounts that sit on your own hand and move with it, from four joints and a shader.
- A reading where every sentence can be traced to a cited source, and where the harmful parts of palmistry are filtered out in code and covered by tests.
- An original, culturally grounded character made from open CC0 tools.
- A complete, hands-only, five-minute arc with a keepsake at the end.

### What we learned
- Hand tracking is good at a hand's geometry and silent about its skin. Designing around that honestly made the experience better: looking at your own palm is the fun part.
- Automated tests that read logs can prove the flow works but not that anything is visible. They need a visual check too.
- Much of "Indian" palmistry as it is practised today came from Cheiro and Benham, while the classical texts focus on auspicious marks. That is a story worth telling inside the experience.

### What's next
- **Layer 3, a real crease scan.** If Quest Browser exposes the passthrough camera to the web (our `probe.html` checks this), or by building a native version with the Passthrough Camera API, we would capture a still palm, rectify it with the joints, and trace the creases inside the same corridors with our offline pipeline. The confirmation cards would then start from your actual lines.
- Auspicious marks (*shubh chinh*: fish, conch, lotus) from Brihat Samhita, the classical Indian layer.
- Calibrating the hand-shape thresholds on real Quest hand data.

### Built with
IWSDK · WebXR (hand tracking, immersive-ar passthrough) · three.js · TypeScript · Vite · Web Audio API · ElevenLabs Voice Design (pre-rendered) · ffmpeg · Web Speech API (fallback) · Canvas 2D · Blender · MakeHuman / MPFB · Python (IWSDK emulator automation) · MediaPipe and OpenCV/scikit-image (offline research pipeline) · Fontsource-bundled OFL fonts (Mukta, Rozha One, Tiro Devanagari Hindi)

---

## Trailer shot list (under 3 minutes)
Record on a Quest 3 using the headset's own capture, in a well-lit room with a plain table. Use real gameplay only, with no AI-generated video. Target 1:45 to 2:15.

| # | Time | Shot | Notes |
|---|---|---|---|
| 1 | 0:00–0:08 | **Cold open: lines draw onto a real palm.** First-person view: your palm rises into frame and the four lines ink on one by one with the rising chime. | The hook. Get a steady, well-lit take. Hold the palm still and close (25 to 30 cm). |
| 2 | 0:08–0:12 | Title card over the same shot: "हस्त रेखा · Hast Rekha". Subtitle: "Indian palmistry, on your own hand." | Text only. No logos. |
| 3 | 0:12–0:25 | Pull back: Panditji across the table, pavilion dome, room still visible below. He greets you with a namaste. | Show passthrough clearly (your table and lap). |
| 4 | 0:25–0:35 | Disclaimer and privacy card readable on screen: "A cultural entertainment. Not a forecast." / "I see only the positions of your hand joints." | Say it early, so judges know the framing. |
| 5 | 0:35–0:50 | Turn your hand slowly: the lines follow it. Panditji names the element. | Shows the tracking working, not a sticker. |
| 6 | 0:50–1:15 | The seven mounts light up. Your other fingertip touches Guru Parvat; the plate "गुरु पर्वत · Jupiter" appears and the tone plays. Then touch one more mount. | The two-hand moment. Do a few takes, because occlusion may drop tracking. |
| 7 | 1:15–1:25 | Line cards: hover one (the candidate glows on your palm), glance at your real palm, poke the matching card. | Shows "you read your own palm". Keep it short. |
| 8 | 1:25–1:32 | **The lines breathe.** Bring your other fingertip close to the heart line: it brightens and shimmers. Touch it: ripple, bell. | The hero beat starts. Slow, steady hands. |
| 9 | 1:32–1:50 | **The heart world.** Orb over the palm, the room tints gold, the dusk ocean dissolves open from the palm and surrounds you; lotuses open. Panditji's voice from within, caption visible. Show your real hand inside the world. | The money shot. Look at the palm first, then lift your gaze to the moon. |
| 10 | 1:50–1:58 | **Fist.** The world folds back into your palm; the lines relight in order. Touch the life line: the banyan grows out of the ground. | |
| 11 | 1:58–2:04 | Flash cuts: the constellation joining; Shani's ringed planet over the path of light; a mount's graha rising from the palm. | One second each. |
| 12 | 2:04–2:12 | The Rekha card appears. Then the 2D page with the saved card. | |
| 13 | 2:12–2:20 | End card: "हस्त रेखा · Hast Rekha. Hands only · seated · Quest 3 / 3S · in your browser". | |

Don'ts:
- Don't narrate or caption the lines as "detected" or "scanned". The opening lines are the tradition's map, and you then choose your own.
- Don't show the emulator in the trailer.
- Don't show any brand in the room.

## Screenshots (Devpost gallery)
Take them on the headset. The emulator stills in `artifacts/shot-*` are fine for framing reference only.
1. **Hero:** lines glowing on a real palm, close up, with Panditji soft in the background.
2. Mounts lit with Devanagari sigils on the palm, and the mount plate (for example शुक्र पर्वत · Venus) above the fingers.
3. The other hand's fingertip touching a mount.
4. The line-choice cards with one candidate previewed on the palm.
4b. **Inside the heart world**: the dusk ocean and lotuses, with the real hand visible and the lines on it. Also the banyan, the constellation and Shani's planet.
4c. A graha rising from a touched mount.
5. Panditji in the pavilion with the room visible below the dome (shows passthrough).
6. The Rekha card (export the 1080×1350 JPEG from the 2D page gallery).
7. The 2D landing page with the "Culture, not prediction" and "Privacy" box.

## Pre-submission checklist
- [ ] **Hosted HTTPS URL.** `npm run build` and deploy `dist/` (`vercel.json` is ready). ⚠ **Deploying needs the user's approval:** who owns the account, which project name.
- [ ] Open the URL **logged out, in a private window** on the Quest: it loads, Enter appears, and a full reading completes.
- [ ] Open the URL on a desktop browser: the 2D page explains what it is and asks you to open it on a Quest.
- [ ] Run the device checklist in [TESTING.md](TESTING.md#device-checklist), at least rows 1 to 7 and 12. Fix or document anything that fails.
- [ ] Run `/probe.html` on the Quest and record the result in TESTING.md and in "What's next".
- [ ] Measure 72 fps (OVR Metrics) and record it in [JUDGING.md](JUDGING.md).
- [ ] Unit tests and typecheck are green: `npm test`, `npx tsc --noEmit`. The emulator E2E is green: `npm run test:xr`.
- [ ] Trailer under 3 minutes, uploaded **public** on YouTube or Vimeo, with English captions.
- [ ] Screenshots uploaded. No logos or brands in any frame.
- [ ] Devpost text pasted, with Track **Entertainment** and Division **New Experience** selected.
- [ ] [public/CREDITS.md](../public/CREDITS.md) is linked from the description.
- [ ] After submission: no build changes until winners are announced (FAQ).
