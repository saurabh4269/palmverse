# Architecture

Palmverse is a single-page WebXR app. It requests an `immersive-ar` session (passthrough) with hand tracking through Meta's IWSDK 1.1.0, which wraps three.js (as `super-three` 0.185.0) in an entity-component-system world. `iwsdk.config.json` is the project authority: it sets the XR mode, features and emulator profile; `vite.config.ts` only wires the plugins.

## Runtime data flow

1. **Input.** Every frame the director reads the 25 WebXR hand joints of both hands plus the headset pose.
2. **Smoothing.** Each joint passes through a One Euro filter (`src/core/one-euro.ts`): steady when the hand is at rest, low lag when it moves.
3. **Palm frame.** `src/core/palm-frame.ts` builds an orthonormal frame from four joints (wrist, middle knuckle, index and pinky knuckles). Palm coordinates `q(a, b)` are defined relative to that frame, so anything drawn in them stretches and turns with the hand. The same module decides whether the palm is "readable": facing the eyes, 18 to 65 cm away, held for about 0.6 s, with hysteresis on the angle (picked up at about 55 degrees, kept until about 78).
4. **Layer 1, measurement.** `src/core/measure.ts` takes the median of 45 frames of hand shape (palm squareness, finger length against palm, index against ring, thumb set) and maps it to the tradition's four elements.
5. **Layer 2, user-confirmed line shapes.** `src/core/line-shapes.ts` holds 2 to 4 candidate shapes per line, built from the mean centrelines of 399 palms and kept inside each line's corridor. The user picks the one closest to their own palm; nothing claims to detect creases.
6. **Rules and safety.** `src/core/rules.ts` resolves each element, mount and line choice to exactly one cited rule in `src/data/palmistry-rules.json` and drops any reading that is unresolved, marked "omit", or matches the banned-claims pattern.
7. **Presentation.** Panditji (`src/render/pandit.ts`, `human.ts`) is animated procedurally: breath, blinks, gaze at the raised palm, jaw while speaking, a namaste. Speech plays pre-rendered clips through Web Audio (`src/render/voice-clips.ts`) and falls back to `speechSynthesis` for any line without a clip. Sound effects are synthesised (`src/render/audio.ts`).
8. **Rendering on the palm.** `src/render/palm-overlay.ts` draws lines, mounts and their sigils in a shader that receives the palm frame as four uniforms each frame.
9. **Worlds.** `src/render/worlds.ts` builds the portal, the four line worlds (lotus pond, banyan by a river, constellation, Shani's ringed planet) and the nine graha skies. When a world is open, the hands are rendered as a mask back into passthrough so the real palm stays visible.

## Phase machine

`src/director.ts` is one IWSDK system with an explicit phase machine:

```
welcome → raise → scan → reveal → mounts → lines → explore → reading → card → (other hand | end)
```

In `explore`, the chosen lines glow; touching or pinching one (`src/core/line-touch.ts`: hover, then touch or pinch, with dwell and grace periods) opens its world, and a closed fist folds it back. In dev builds the director emits structured `[hast]` log lines that the emulator end-to-end test reads.

## Module map

| Path | Role |
|---|---|
| `src/index.ts` | Entry: bundles fonts, creates the IWSDK world, registers the director |
| `src/director.ts` | Phase machine; joins input, core logic and rendering |
| `src/page.ts` | The 2D page: framing text, Enter button, saved Rekha cards with downloads |
| `src/assets.ts`, `src/components.ts` | IWSDK asset and component modules referenced by `iwsdk.config.json` |
| `src/core/palm-frame.ts` | Palm frame from 4 joints, palm coordinates, readable-palm test |
| `src/core/one-euro.ts` | One Euro filter for 3D points |
| `src/core/measure.ts` | Hand shape to element and finger tendencies (median of 45 frames) |
| `src/core/line-shapes.ts` | Candidate line shapes in palm coordinates (from 399-palm mean centrelines) |
| `src/core/line-touch.ts` | Fingertip-to-line distance in palm space; hover, touch, pinch, dwell, grace |
| `src/core/rules.ts` | Reading builder, rule resolution, banned-claims filter |
| `src/core/save.ts` | Versioned `localStorage` of past readings (`hast-rekha/v1`, up to 12) |
| `src/core/share-layout.ts` | Layout maths for the Rekha card |
| `src/core/lang.ts` | English or Hindi, remembered in this browser |
| `src/content/script.ts` | Panditji's script by phase |
| `src/content/readings.ts` | Element, mount and line readings, each pointing at one rule |
| `src/content/worlds.ts` | What Panditji says inside each world |
| `src/content/spoken.ts` | Every spoken line, the source for the voice clips |
| `src/content/hindi.ts` | Hindi for every line |
| `src/data/palmistry-rules.json` | 63 features and 212 cited rules |
| `src/data/palm-regions.json` | Mount polygons and line corridors in palm coordinates |
| `src/render/palm-overlay.ts` | Line and mount shaders in palm coordinates |
| `src/render/pandit.ts`, `human.ts` | Panditji: GLB loading and procedural animation |
| `src/render/dome.ts`, `contact-shadow.ts` | The pavilion and its grounding |
| `src/render/worlds.ts` | Portal, line worlds, graha skies, rising graha orbs, hand mask |
| `src/render/cards.ts`, `ui.ts`, `text.ts` | Choice cards, buttons, subtitles, Devanagari canvas text |
| `src/render/share-card.ts` | Draws the Rekha card |
| `src/render/audio.ts` | Synthesised sound effects and music playback |
| `src/render/voice-clips.ts` | Pre-rendered voice playback and the speech fallback |
| `src/render/gpu-stats.ts` | Draw call and texture counters for the dev logs |

## Offline tools (not shipped)

| Path | Produces |
|---|---|
| `tools/pandit/` | `public/models/pandit.glb`: MakeHuman / MPFB in headless Blender, costume in code, AO bake |
| `tools/setting/` | `public/models/setting.glb` and `public/env/pavilion.hdr` |
| `tools/banyan/` | `public/models/banyan.glb` from the CC-BY tree plus generated aerial roots |
| `tools/palm/` | The palm image on the choice cards |
| `tools/textures/compress.sh` | KTX2 (Basis Universal) compression |
| `tools/voice/` | Voice Design, text to speech, the ffmpeg "divine" chain, `public/voice/<lang>/` |
| `tools/music/` | The 14 music loops in `public/audio/music/` |
| `tools/quest-debug.mjs` | Dev-only relay from a Quest on Wi-Fi to the dev server (logs, fps, draw calls) |
| `tools/e2e.py`, `xr_e2e_lib.py`, `shots.py` | Emulator end-to-end test and close-up stills |
| `tools/run-unit.mjs` | Bundles each `tests/*.test.ts` with esbuild and runs it in Node |

## Performance notes

KTX2 textures, one merged mesh per prop, baked ambient occlusion and a baked environment light keep the pavilion cheap. On a Quest 3 in Quest Browser 156 the app ran at a median of 74 fps with a median of 36 draw calls over about 8 minutes of logged play; short dips happen the first time a world loads. See [TESTING.md](TESTING.md) for the method and the emulator numbers.
