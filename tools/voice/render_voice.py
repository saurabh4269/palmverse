#!/usr/bin/env python3
"""
Pre-render every line Panditji speaks with ElevenLabs, then the divine chain.

  node tools/voice/dump-lines.mjs > .tmp/lines.json        # every spoken line (src/content/spoken.ts)
  python3 tools/voice/render_voice.py --key-file K --design           # once: design an original voice
  python3 tools/voice/render_voice.py --key-file K [--lang en|hi] [--limit N]   # render missing clips
  python3 tools/voice/render_voice.py --rechain [--lang en]           # re-run divine.sh on the raw takes (no API)
  python3 tools/voice/render_voice.py --piper <model.onnx> --piper-python <python>   # offline interim voice (Piper)

Each clip records its source (`src`); rendering with a different engine replaces the clips from the other one.

Output: public/voice/<lang>/<hash>.mp3 and public/voice/<lang>/manifest.json
        {"voice": ..., "lines": {"<hash>": {"f": "<hash>.mp3", "d": <speech seconds>}}}
The hash is FNV-1a 32 of the line exactly as the app passes it to say() (src/render/voice-clips.ts).
Raw TTS takes are kept in tools/voice/raw/<lang>/ (git-ignored) so the chain can be re-tuned for free.

The key is read from --key-file only, inside this process; it is never printed or written anywhere.
Voice Design creates a new synthetic voice from a text description; nothing is cloned.
"""
import argparse
import base64
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
API = 'https://api.elevenlabs.io'
VOICE_JSON = os.path.join(HERE, 'voice.json')
VOICE_DIVINE_JSON = os.path.join(HERE, 'voice-divine.json')
# the opening voice (Aakashvani): calmer, ageless, from the sky; a lighter chain (less drone, a little less weight)
DIVINE_DESCRIPTION = (
    'A calm, ageless, otherworldly voice, gentle and serene, softly resonant, like a voice heard from the night sky '
    'over an Indian temple. Neither old nor young, warm, slow, intimate and hushed, perfectly clear diction, '
    'a soft Indian English accent, deeply peaceful, never dramatic or theatrical.'
)
DIVINE_SAMPLE = ('The nine grahas turn around you, as they turn through every old story of India. '
                 'Their names are written on the hills of your palm. Sit, and breathe, and let the reading begin.')
DIVINE_CHAIN_ENV = {'DIVINE_DRONE_DB': '-60', 'DIVINE_SUB': '0.10', 'DIVINE_WHISPER': '0.14', 'DIVINE_FIFTH': '0.06', 'DIVINE_WET': '0.8'}
DESCRIPTION = (
    'An elderly Indian man in his seventies, a gentle and learned scholar of old Sanskrit books. '
    'Deep, warm, slow and calm voice with a soft Indian English accent; unhurried, kind and a little breathy, '
    'as if speaking quietly in a stone temple at dusk. Clear diction, reverent, never dramatic.'
)
SAMPLE = ('Namaste. Come, sit. In India this art is called Hast Rekha, the reading of the lines of the hand. '
          'Today we read your palm as culture and story, not as a forecast. Think of it as a conversation with tradition.')


def fnv1a(s: str) -> str:
    h = 0x811C9DC5
    for b in s.encode('utf-8'):
        h ^= b
        h = (h * 0x01000193) & 0xFFFFFFFF
    return f'{h:08x}'


# Hindi words inside English lines are sent to TTS in Devanagari, so the multilingual model says them
# the Hindi way ("Rekha" as रेखा, not "Reeka"). The caption keeps the roman form. Longest first.
PRON = {
    'Samudrika Shastra': 'सामुद्रिक शास्त्र', 'Hast Rekha': 'हस्त रेखा', 'Hridaya': 'हृदय', 'Mastishk': 'मस्तिष्क', 'Jeevan': 'जीवन',
    'Bhagya': 'भाग्य', 'Rekhas': 'रेखाएँ', 'rekhas': 'रेखाएँ', 'Rekha': 'रेखा', 'Panditji': 'पंडितजी', 'Parvat': 'पर्वत', 'parvat': 'पर्वत',
    'Guru': 'गुरु', 'Shani': 'शनि', 'Surya': 'सूर्य', 'Budh': 'बुध', 'Mangal': 'मंगल', 'Chandra': 'चंद्र', 'Shukra': 'शुक्र',
    'Prithvi': 'पृथ्वी', 'Vayu': 'वायु', 'Agni': 'अग्नि', 'Jal': 'जल', 'Hast': 'हस्त', 'grahas': 'ग्रह', 'graha': 'ग्रह',
    'Aakashvani': 'आकाशवाणी', 'Namaste': 'नमस्ते',
}
PRON_RE = re.compile(r'\b(' + '|'.join(sorted(map(re.escape, PRON), key=len, reverse=True)) + r')\b')


def spoken(text: str, lang: str) -> str:
    """What is sent to TTS. English: the Devanagari glosses are dropped, then the Hindi words go in Devanagari (PRON)."""
    if lang == 'en':
        text = re.sub(r'[ऀ-ॿ]+[,\s]*', '', text)
        text = PRON_RE.sub(lambda m: PRON[m.group(1)], text)
    return re.sub(r'\s+', ' ', text).strip()


def call(key: str, path: str, body: dict | None = None, accept='application/json', method=None) -> bytes:
    req = urllib.request.Request(API + path, data=json.dumps(body).encode() if body is not None else None, method=method or ('POST' if body is not None else 'GET'))
    req.add_header('xi-api-key', key)
    req.add_header('Content-Type', 'application/json')
    req.add_header('Accept', accept)
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=240) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            msg = e.read().decode('utf-8', 'replace')[:400]
            if e.code in (429, 500, 502, 503) and attempt < 3:
                time.sleep(3 * (attempt + 1))
                continue
            raise SystemExit(f'ElevenLabs {path}: HTTP {e.code}: {msg}')
    raise SystemExit('unreachable')


def design(key: str, out_dir: str, description: str = DESCRIPTION, sample: str = SAMPLE, voice_json: str = VOICE_JSON, name: str = 'Panditji (Hast Rekha, designed)') -> None:
    """Voice Design: three previews from the description; keep all three as files, save the first as the voice."""
    DESCRIPTION, SAMPLE, VOICE_JSON = description, sample, voice_json  # noqa: N806
    os.makedirs(out_dir, exist_ok=True)
    body = {'voice_description': DESCRIPTION, 'text': SAMPLE, 'model_id': 'eleven_multilingual_ttv_v2'}
    try:
        res = json.loads(call(key, '/v1/text-to-voice/design', body))
    except SystemExit as e:
        print(f'design endpoint failed ({e}); trying create-previews', file=sys.stderr)
        res = json.loads(call(key, '/v1/text-to-voice/create-previews', {'voice_description': DESCRIPTION, 'text': SAMPLE}))
    previews = res.get('previews') or []
    if not previews:
        raise SystemExit(f'no previews: {str(res)[:300]}')
    for i, p in enumerate(previews):
        with open(os.path.join(out_dir, f'preview-{i}.mp3'), 'wb') as f:
            f.write(base64.b64decode(p['audio_base_64']))
    pick = previews[int(os.environ.get('PICK', '0'))]
    v = json.loads(call(key, '/v1/text-to-voice', {
        'voice_name': name, 'voice_description': DESCRIPTION, 'generated_voice_id': pick['generated_voice_id'],
    }))
    meta = {'voice_id': v['voice_id'], 'name': name, 'description': DESCRIPTION,
            'method': 'ElevenLabs Voice Design (text description, no cloning)', 'created': time.strftime('%Y-%m-%d')}
    with open(VOICE_JSON, 'w') as f:
        json.dump(meta, f, indent=2)
    print(f'designed voice {v["voice_id"]}; previews in {out_dir}')


def duration(path: str) -> float:
    out = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path], capture_output=True, text=True).stdout
    return float(out.strip() or 0)


def chain(raw: str, out: str, env: dict | None = None) -> None:
    wav = raw[:-4] + '.wav'
    subprocess.run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-i', raw, '-ac', '1', '-ar', '44100', wav], check=True)
    subprocess.run([os.path.join(HERE, 'divine.sh'), wav, out], check=True, env={**os.environ, **(env or {})})
    os.remove(wav)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--key-file')
    ap.add_argument('--lang', default='en')
    ap.add_argument('--lines', default=os.path.join(ROOT, '.tmp', 'lines.json'))
    ap.add_argument('--design', action='store_true')
    ap.add_argument('--rechain', action='store_true')
    ap.add_argument('--limit', type=int, default=0)
    ap.add_argument('--only', default='', help='regex: render only lines whose text matches')
    ap.add_argument('--force', action='store_true', help='re-render the matched lines even if a raw take exists')
    ap.add_argument('--model', default='eleven_multilingual_v2')
    ap.add_argument('--piper', help='offline: a Piper .onnx voice (e.g. en_GB-alba-medium.onnx) instead of ElevenLabs')
    ap.add_argument('--piper-python', default='python3', help='a python with piper-tts installed')
    ap.add_argument('--length-scale', default='1.12', help='Piper: >1 speaks slower')
    ap.add_argument('--set', default='pandit', choices=['pandit', 'divine'], help="divine: the opening lines, in the Aakashvani voice (voice-divine.json)")
    a = ap.parse_args()
    key = open(a.key_file).read().strip() if a.key_file else os.environ.get('ELEVENLABS_API_KEY', '').strip()
    engine = f'piper:{os.path.basename(a.piper)[:-5]}' if a.piper else None
    divine = a.set == 'divine'
    raw_dir = os.path.join(HERE, 'raw', a.lang + ('-piper' if a.piper else '') + ('-divine' if divine else ''))
    out_dir = os.path.join(ROOT, 'public', 'voice', a.lang)
    os.makedirs(raw_dir, exist_ok=True)
    os.makedirs(out_dir, exist_ok=True)
    if a.design:
        if divine:
            design(key, os.path.join(HERE, 'raw', 'design-divine'), DIVINE_DESCRIPTION, DIVINE_SAMPLE, VOICE_DIVINE_JSON, 'Aakashvani (Hast Rekha, designed)')
        else:
            design(key, os.path.join(HERE, 'raw', 'design'))
        return
    voice = json.load(open(VOICE_DIVINE_JSON if divine else VOICE_JSON)) if not a.piper else {'name': engine, 'voice_id': engine}
    engine = engine or f'elevenlabs:{voice["voice_id"]}'
    data = json.load(open(a.lines))
    lines = data[('divine_' if divine else '') + a.lang]
    chain_env = DIVINE_CHAIN_ENV if divine else None
    man_path = os.path.join(out_dir, 'manifest.json')
    man = json.load(open(man_path)) if os.path.exists(man_path) else {'lines': {}}
    if not divine:
        man['voice'] = voice['name']
        man['model'] = a.model
    done = 0
    for text in lines:
        h = fnv1a(text)
        raw, out = os.path.join(raw_dir, h + '.mp3'), os.path.join(out_dir, h + '.mp3')
        if a.only and not re.search(a.only, text):
            continue
        stale = h in man['lines'] and man['lines'][h].get('src') not in (None, engine) and not a.rechain
        if a.force and a.only and os.path.exists(raw):
            os.remove(raw)
            stale = True
        if not os.path.exists(raw):
            if a.rechain or not (key or a.piper):
                continue
            if a.limit and done >= a.limit:
                break
            if a.piper:
                wav = raw[:-4] + '.wav'
                subprocess.run([a.piper_python, '-m', 'piper', '-m', a.piper, '-f', wav, '--length-scale', a.length_scale, '--noise-scale', '0.5', '--noise-w-scale', '0.6'], input=spoken(text, a.lang), text=True, check=True, capture_output=True)
                subprocess.run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-i', wav, '-c:a', 'libmp3lame', '-b:a', '128k', raw], check=True)
                os.remove(wav)
                done += 1
                print(f'piper {h}: {text[:60]}', flush=True)
                audio = None
            else:
                audio = call(key, f'/v1/text-to-speech/{voice["voice_id"]}?output_format=mp3_44100_128', {
                'text': spoken(text, a.lang), 'model_id': a.model,
                'voice_settings': {'stability': 0.62, 'similarity_boost': 0.8, 'style': 0.15, 'use_speaker_boost': True, 'speed': 0.92},
                **({'language_code': 'hi'} if a.lang == 'hi' else {}),
            }, accept='audio/mpeg')
            if audio is not None:
                with open(raw, 'wb') as f:
                    f.write(audio)
                done += 1
                print(f'tts {h} {len(text)} chars: {text[:60]}', flush=True)
        if a.rechain or stale or not os.path.exists(out) or h not in man['lines']:
            chain(raw, out, chain_env)
            man['lines'][h] = {'f': h + '.mp3', 'd': round(duration(raw), 2), 'src': engine}
    # drop clips for lines that no longer exist
    keep = {fnv1a(t) for t in data[a.lang] + data.get('divine_' + a.lang, [])}
    for h in list(man['lines']):
        if h not in keep:
            man['lines'].pop(h)
            try:
                os.remove(os.path.join(out_dir, h + '.mp3'))
            except FileNotFoundError:
                pass
    with open(man_path, 'w') as f:
        json.dump(man, f, indent=1, sort_keys=True)
    have = sum(1 for t in lines if fnv1a(t) in man['lines'])
    print(f'{a.lang}: {have}/{len(lines)} lines have clips ({done} new TTS calls)')


if __name__ == '__main__':
    main()
