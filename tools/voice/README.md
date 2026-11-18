# Panditji's divine voice (pre-rendered)

Every line Panditji speaks is rendered once to an mp3 and shipped in `public/voice/<lang>/`. The app makes no API calls and holds no key; a line without a clip falls back to the browser's `speechSynthesis`.

Pipeline: **ElevenLabs Voice Design** (a new voice from a text description; nothing is cloned) → text-to-speech per line → **`divine.sh`** (temple reverb, octave-down weight, octave-up whisper, fifth pad, chorus, tanpura bed, −16 LUFS) → `public/voice/<lang>/<hash>.mp3` plus `manifest.json`.

```bash
cd projects/hast-rekha
(cd tools/voice/assets && python3 ../gen_assets.py)          # once: synthetic temple IR + tanpura (numpy, scipy)
node tools/voice/dump-lines.mjs > .tmp/lines.json            # every spoken line (src/content/spoken.ts)
python3 tools/voice/render_voice.py --key-file <file> --design   # once: designs the voice → tools/voice/voice.json
python3 tools/voice/render_voice.py --key-file <file>            # renders missing clips (English)
python3 tools/voice/render_voice.py --key-file <file> --lang hi  # Hindi
```

The key is read from a file inside the render process only. Never commit it.

## Knobs: how "divine" it sounds

| What | Where | Default | Effect |
|---|---|---|---|
| Low octave ("voice of the mountain") | `DIVINE_SUB` env var for `divine.sh` | 0.26 | 0 = none, 0.4 = heavy |
| Breathy octave-up halo | `DIVINE_WHISPER` | 0.08 | 0 = none |
| Choir-like fifth | `DIVINE_FIFTH` | 0.10 | 0 = none |
| Temple reverb | `DIVINE_WET` | 0.70 | 0.3 = small room, 1.0 = cathedral |
| Tanpura bed under the voice | `DIVINE_DRONE_DB` | −24 | −60 = off |
| Narration level in the app | `VOICE_GAIN` in `src/render/voice-clips.ts` | 1.0 | relative to the sound effects |
| Gap between lines | `GAP` in `src/render/voice-clips.ts` | 0.35 s | |

After changing a `DIVINE_*` knob, re-run the chain on the stored raw takes with no API calls:
```bash
DIVINE_WET=0.5 DIVINE_SUB=0.15 python3 tools/voice/render_voice.py --rechain
```
Raw takes are kept in `tools/voice/raw/` (git-ignored). If that folder is gone, the clips have to be rendered again.

This ffmpeg build has no `librubberband`, so the pitch layers use `asetrate` + `atempo` instead of the design pack's `rubberband`. They are slightly grainier, but they sit at low gain.
