# Hast Rekha · हस्त रेखा

Indian palmistry in mixed reality on Meta Quest 3 / 3S. You hold up your real palm, the four great lines and seven mounts glow on your own hand, and Panditji, an elderly scholar sitting across your table, explains what the tradition says about them. Touch one of your glowing lines and it opens its own world around you (lotuses on a dusk ocean for the heart line, a banyan of light for the life line, a constellation for the head line, Shani's ringed planet for the fate line), where Panditji tells you what it means. Close your hand and the world folds back into your palm.

It is a WebXR app built with IWSDK 1.1.0 (TypeScript, three.js). It uses hands only, you stay seated, and a reading takes about five minutes.

> **Status:** everything below has been tested in the IWSDK emulator only. Nothing has run on a physical Quest yet. See [docs/TESTING.md](docs/TESTING.md#device-checklist) for the device checklist.

## How to play
Seated, hands only. No controllers.

1. **Welcome.** Panditji greets you. A card says what this is ("A cultural entertainment. Not a forecast. Not advice.") and what the app can see. Poke **हिन्दी** to hear him in Hindi (or choose on the 2D page). To continue, poke **Continue ›** with a fingertip, or just wait.
2. **Raise your palm.** Hold up either hand (many readers start with the one you write with), palm toward you, a little below eye level. The app waits until the palm faces you, is 18 to 65 cm away and stays put for about 0.6 s.
3. **Scan.** A golden sheen sweeps the palm while the app measures your hand's shape over 45 frames.
4. **Reveal.** The heart, head, life and fate lines draw themselves on your palm one by one, and Panditji names your hand's element (Earth, Air, Fire or Water) from its shape. These first lines are the tradition's typical map, not lines detected on your skin.
5. **Mounts.** The seven parvat light up in turn. Touch one with a fingertip of your **other** hand to hear about it: its graha (planet) rises out of your palm in its Navagraha gem colour while he speaks.
6. **Your lines.** For each of five questions (heart line, head line, where the head and life lines start, life line, fate line), 2 to 4 cards show candidate shapes. Hover a card to preview that shape on your palm, then poke the one closest to what you see.
7. **Explore: touch a line, enter its world.** Your chosen lines now breathe with light and embers. Bring a fingertip of your other hand near one: it brightens and shimmers. Touch it (or pinch near it) and a bell rings, a ripple runs along the line, and an orb swells over your palm. The room turns faintly gold, and the line's world dissolves open around you from your palm's direction, with your real hands still visible inside. Panditji tells that line's reading from within. **Make a fist** to fold the world back into your palm, or let him finish. Touch a mount instead and its graha's sky opens. Poke **Continue ›** when you're done.
8. **Reading.** Panditji puts it all together (lines you already heard in their worlds aren't repeated). The line being discussed brightens.
9. **Rekha card.** A card with your element, your chosen line shapes and a one-line summary is drawn and saved in the browser. Then you can **Read my other hand** (he compares the two) or **Finish**.

After you leave XR, the 2D page lists your saved cards with download links.

## Run it
Needs Node `>=20.19 <21`, `>=22.12 <23` or `>=24` (see `package.json`).

```bash
npm ci
npm run dev        # HTTPS dev server on https://localhost:8087 + the IWSDK emulator (IWER, Meta Quest 3 profile)
npm test           # unit tests: palm-frame maths, rule engine safety fuzz, share-card layout
npx tsc --noEmit   # typecheck
npm run build      # static site in dist/ (vercel.json is included)
```

The emulated end-to-end test drives the whole reading with emulated hands. Start the managed dev server in agent mode first:

```bash
npx @iwsdk/cli dev up --ai-mode agent
npm run test:xr    # python3 tools/e2e.py; screenshots go to artifacts/
python3 tools/shots.py <prefix>   # close-up stills of the palm overlay for visual review
```

In the emulator, the dev build also accepts keys: `n` moves to the next step, `1` to `4` pick a line card (in explore: open the life, head, heart or fate world), `x` closes a world, `l` switches English/Hindi on the welcome card, and `o` reads the other hand. `python3 tools/e2e.py --worlds` also opens the life, head and fate worlds by touch and screenshots them.

Panditji's voice is pre-rendered, so the app makes no API calls: see [tools/voice/README.md](tools/voice/README.md) to render it, and for the knobs that set how "divine" it sounds.

To try it on a Quest, open the dev server's network URL in Meta Quest Browser on the same Wi-Fi and accept the local certificate warning. To share it with judges, deploy `dist/` to an HTTPS host.

## Privacy
- **No camera access.** The app never asks for the camera. It reads only the positions of the 25 WebXR hand joints per hand, plus the headset pose.
- **Nothing is uploaded.** No server, no accounts, no analytics. Hand measurements and readings stay on the device.
- **Stored locally.** Past readings (element, chosen line shapes, a few ratios, and a small JPEG of the drawn card) are kept in this browser's `localStorage` under `hast-rekha/v1`, up to 12 of them. The card is a drawing, never a photo. Clearing site data removes them. See `src/core/save.ts`.
- **Network requests:** none to third parties from the app itself. The three fonts are bundled with the app (via Fontsource). Panditji's voice is a set of pre-rendered audio files served with the app. Lines without a clip use the browser's built-in `speechSynthesis`; whether a system voice runs on the device or in the cloud depends on the browser and was not checked.

## Culture and entertainment, not prediction
Palmistry is a cultural tradition and is widely regarded as pseudoscience. Hast Rekha presents it as heritage and story:
- Every reading is phrased as "the tradition reads…" and each one cites its source rule: Cheiro (1916), Benham (1900), or modern Indian guides. The rulebook also covers Brihat Samhita ch. 68.
- Claims about death, lifespan, illness, insanity, fertility, divorce, money loss and the like are recorded in the rulebook but flagged. The rule engine drops any reading that matches them (`src/core/rules.ts`), and `tests/rules.test.ts` fuzzes 4,000 input combinations through it.
- The disclaimer is on the first card and on the share card. Before signing off, Panditji explains the Barnum effect.
- He also tells you that heart and head lines and planetary mounts came into Indian practice through Cheiro and Benham in the 20th century, and that teachers disagree.

## Credits (summary)
Full list: [public/CREDITS.md](public/CREDITS.md).
- **Panditji:** an original character built headless in Blender from MakeHuman/MPFB (CC0 output and CC0 assets), with a costume generated by code. See [public/models/CREDITS.md](public/models/CREDITS.md).
- **Rulebook:** Cheiro, *Palmistry for All* (1916) and Benham, *The Laws of Scientific Hand Reading* (1900), both public domain in the USA, plus Varahamihira, *Brihat Samhita* ch. 68. All paraphrased.
- **Fonts:** Mukta, Rozha One and Tiro Devanagari Hindi (SIL Open Font License), bundled via the `@fontsource/*` npm packages.
- **Sound:** synthesised in code with Web Audio. Panditji's voice: see [tools/voice/README.md](tools/voice/README.md) and CREDITS (an original designed voice, pre-rendered, through our own temple-reverb and tanpura chain; browser speech synthesis as the fallback).
- **Worlds:** all procedural: shaders and generated geometry, no third-party models or HDRIs.
- **Code:** IWSDK (MIT) and three.js via `super-three` (MIT).

## Folder map
```
src/
  director.ts          the phase machine: welcome → raise → scan → reveal → mounts → lines → explore → reading → card → other hand | end
  core/                pure logic, unit-tested in node
    palm-frame.ts        palm frame from 4 WebXR joints; q(a,b), toPalm, "is this a readable palm?"
    measure.ts           hand shape → element, index/ring/thumb tendencies (median of 45 frames)
    line-shapes.ts       candidate shapes per line in palm coordinates (from 399-palm mean centrelines)
    rules.ts             reading builder; drops unresolved, "omit" and banned-claim readings
    save.ts              versioned localStorage of past readings
    share-layout.ts      share-card layout maths
    one-euro.ts          One Euro filter on every palm joint (steady at rest, low lag in motion)
    line-touch.ts        fingertip-to-line distance in palm space; hover → touch → select with dwell, pinch, grace
    lang.ts              English / Hindi choice (localStorage)
  content/             Panditji's script, reading library, mount and line-option text,
                       worlds.ts (what he says inside each world), spoken.ts (every line, for the voice clips),
                       hindi.ts (Hindi for every line)
  data/                copies of ../../data/palmistry-rules.json and palm-regions.json (a test checks they match)
  render/              palm-overlay shaders, Panditji (pandit.ts + procedural human.ts), dome pavilion,
                       Devanagari canvas text, choice cards and buttons, subtitles, share card, audio,
                       worlds.ts (portal, the four line worlds, graha sky and rising graha orb),
                       voice-clips.ts (pre-rendered voice playback)
  page.ts              the 2D page: framing, Enter button, saved-card gallery
public/
  models/pandit.glb    the character, KTX2 textures (see models/CREDITS.md)
  models/setting.glb   the pavilion props with baked AO and a floor contact shadow (KTX2)
  env/pavilion.hdr     image-based light baked from the pavilion itself
  voice/<lang>/        Panditji's pre-rendered clips + manifest.json (tools/voice)
  probe.html           camera-access feasibility probe for Layer 3 (not part of the app)
assets-src/models/     uncompressed Blender outputs (not deployed); tools/textures/compress.sh → public/models
tests/                 palm-frame, rules, share-layout, line-touch, worlds, spoken-lines unit tests
tools/
  e2e.py, xr_e2e_lib.py   emulator end-to-end test
  shots.py                close-up stills for visual review
  pandit/                 headless Blender + MPFB character build (with rest-pose AO bake)
  setting/                build_setting.py (props + AO + floor shadow), bake_env.py (pavilion HDR)
  textures/compress.sh    KTX2 compression (UASTC face/strands, ETC1S AO/cloth)
  perf-quest.sh           guided frame-rate capture on a connected Quest (docs/TESTING.md §4)
  voice/                  ElevenLabs Voice Design + TTS render, divine.sh post chain, knobs (README.md)
docs/
  JUDGING.md           criteria → features → evidence, decisions, known risks
  TESTING.md           tests, the lesson from invisible ribbons, the device checklist
  SUBMISSION.md        Devpost text, trailer shot list, screenshots, pre-submission checklist
```

Research behind it lives at the repo root: [research/ideas-7-8.md §8](../../research/ideas-7-8.md), [research/palmistry-rulebook.md](../../research/palmistry-rulebook.md), [research/palm-autolabel/](../../research/palm-autolabel/README.md), [research/idea-ranking.md](../../research/idea-ranking.md).
