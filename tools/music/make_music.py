#!/usr/bin/env python3
"""Generate Hast Rekha's background music: one looping instrumental bed per moment.

  python3 tools/music/make_music.py --key-file K            # generate missing raw tracks, then process all
  python3 tools/music/make_music.py --key-file K --only surya,chandra
  python3 tools/music/make_music.py --process-only          # re-run ffmpeg post-processing on cached raws

Source: ElevenLabs Music API (POST /v1/music, force_instrumental). If the account can't use it
(HTTP 4xx), falls back to the sound-effects API (POST /v1/sound-generation, 22 s, looped to ~45 s).
The key is read from --key-file only, inside this process; it is never printed or written anywhere.

Raw API output is cached in artifacts/music-raw/ (git-ignored). Shipped files:
public/audio/music/<id>.mp3 and public/audio/music/manifest.json.

Post-processing (ffmpeg): seamless loop (the last XFADE s are equal-power crossfaded into the head,
so the file's end flows straight into its start; the model's own fade-in/out
at the edges is trimmed off first), high-pass 70 Hz, -4 dB bell at 2 kHz (2 octaves)
to leave room for speech, gentle high-shelf cut, linear gain to TARGET_LUFS, mp3 96 kbps stereo.
No fade-in is baked into the file, since it would dip on every loop; the player should ramp
gain from 0 over ~2 s when starting a track.
"""
import argparse, json, os, re, subprocess, sys, time, urllib.error, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RAW = os.path.join(ROOT, 'artifacts', 'music-raw')
OUT = os.path.join(ROOT, 'public', 'audio', 'music')
API = 'https://api.elevenlabs.io'
TARGET_LUFS = -26.0
XFADE = 4.0
LENGTH_MS = 58000

COMMON = ('Instrumental only, no vocals, no singing, no lyrics, no choir. Calm, sparse, ambient '
          'background bed to sit under spoken narration: soft dynamics, no lead melody in the '
          'midrange, long sustained tones, slow evolution, no drum kit, no build-ups, no big ending. '
          'Indian classical devotional ambient, steady throughout so it loops well.')

TRACKS = {
    'opening': 'Cosmic and divine: planets slowly revolving in deep space, awe and stillness. '
               'Warm tanpura drone in Sa-Pa, shimmering swarmandal glissandi far away, deep singing '
               'bowls, airy pads. Very calm, about 60 BPM feel, no rhythm.',
    'surya': 'The Sun, Surya: radiant, regal, dawn. Morning raga feel like Bhairav or Ahir Bhairav. '
             'Bright tanpura drone, slow sarangi long notes in the low register, gentle swarmandal '
             'sparkles like first light, a temple bell far away.',
    'chandra': 'The Moon, Chandra: cool, tender, night. Night raga feel like Yaman or Bageshri. '
               'Soft low bansuri breaths, slow and distant, tanpura drone, gentle santoor tremolo '
               'very quiet, moonlit stillness.',
    'mangal': 'Mars, Mangal: brave, restrained energy, warrior calm. Low tanpura drone, a soft '
              'steady tabla and dholak hand-drum pulse played very quietly, deep low sitar plucks, '
              'controlled strength, never loud.',
    'budh': 'Mercury, Budh: quick, playful, bright and clever. Light santoor patterns played softly '
            'and sparsely in the upper register, gentle tanpura drone, a light finger-tapped tabla '
            'texture very quiet, curious and nimble but relaxed.',
    'guru': 'Jupiter, Guru: wise, expansive, warm, benevolent teacher. Rich low tanpura drone, '
            'slow deep bansuri long notes, warm harmonium-like pads, singing bowls, spacious and '
            'generous, raga Yaman Kalyan feel.',
    'shukra': 'Venus, Shukra: beauty, romance, grace. Gentle sitar alaap played slowly and softly '
              'with meend slides, tanpura drone, delicate swarmandal shimmer, tender and elegant, '
              'raga Khamaj or Des feel.',
    'shani': 'Saturn, Shani: slow, patient, deep and grave. Very low tanpura drone, deep low '
             'sarangi or esraj long bowed notes, large low singing bowl, very slow, heavy but '
             'peaceful, raga Darbari Kanada feel.',
    'rahu': 'Rahu, the shadow planet: mysterious, smoky, eclipse. Dark low drone, breathy bansuri '
            'fragments far away with lots of reverb, slow bowed metal shimmer, smoky and uncertain, '
            'raga Marwa feel, never scary.',
    'ketu': 'Ketu: detachment, liberation, emptiness. Extremely sparse: a single tanpura drone, an '
            'occasional singing bowl strike that fades for a long time, wide silence and space, '
            'deeply meditative.',
    'life': 'The Life line world: a giant banyan tree over a river at sunrise, growth and flowing '
            'water. Warm tanpura drone, gentle santoor ripples like water, soft bansuri long notes '
            'low and distant, hopeful morning feel, raga Bhairavi feel.',
    'head': 'The Head line world: a night sky full of constellations, clarity and thought. Clear '
            'crystalline swarmandal and soft bell tones, tanpura drone, sparse high glints like '
            'stars, cool and lucid, contemplative.',
    'heart': 'The Heart line world: a lotus pond, love and tenderness. Soft sitar and sarod '
             'played very gently, warm tanpura drone, delicate water shimmer, intimate and loving, '
             'slow, raga Kafi feel.',
    'fate': 'The Fate line world: a long road under a ringed planet, a journey, steady and '
            'purposeful. Tanpura drone, a slow steady soft tabla theka played very quietly like '
            'footsteps, sarangi long notes in the low register, forward motion without hurry.',
}

def call(key, path, body, accept='audio/mpeg'):
    req = urllib.request.Request(API + path, data=json.dumps(body).encode(), method='POST',
                                 headers={'xi-api-key': key, 'Content-Type': 'application/json',
                                          'Accept': accept})
    with urllib.request.urlopen(req, timeout=300) as r:
        return r.read(), dict(r.headers)

def gen_music(key, tid):
    body = {'prompt': TRACKS[tid] + ' ' + COMMON, 'music_length_ms': LENGTH_MS,
            'force_instrumental': True}
    return call(key, '/v1/music?output_format=mp3_44100_128', body)

def gen_sfx(key, tid):
    body = {'text': (TRACKS[tid] + ' Ambient instrumental loop, no vocals.')[:450],
            'duration_seconds': 22, 'prompt_influence': 0.5}
    return call(key, '/v1/sound-generation?output_format=mp3_44100_128', body)

def run(cmd):
    p = subprocess.run(cmd, capture_output=True, text=True)
    if p.returncode:
        sys.exit('ffmpeg failed: ' + p.stderr[-2000:])
    return p.stderr

def duration(path):
    out = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of',
                          'csv=p=0', path], capture_output=True, text=True).stdout
    return float(out.strip())

def lufs(path, pre=''):
    af = (pre + ',' if pre else '') + 'ebur128'
    err = run(['ffmpeg', '-hide_banner', '-nostats', '-i', path, '-af', af, '-f', 'null', '-'])
    m = re.findall(r'I:\s+(-?[\d.]+) LUFS', err)
    return float(m[-1])

EQ = 'highpass=f=70,equalizer=f=2000:width_type=o:width=2:g=-4,highshelf=f=7000:g=-4'

def edges(path):
    """Find where the model's own fade-in ends and fade-out starts (momentary loudness more than
    6 LU under the median), so the loop is cut from the steady body of the track."""
    err = run(['ffmpeg', '-hide_banner', '-nostats', '-i', path, '-af', 'ebur128', '-f', 'null', '-'])
    pts = [(float(t), float(m)) for t, m in re.findall(r't:\s*([\d.]+)\s+TARGET.*?M:\s*(-?[\d.]+)', err)]
    ms = sorted(m for _, m in pts); med = ms[len(ms) // 2]
    loud = [t for t, m in pts if m > med - 6]
    L = duration(path)
    a = min(max(loud[0] - 0.4, 0.0), 6.0) + 0.5    # small margin past the detected point
    b = max(min(loud[-1], L), L - 15.0) - 0.5
    return a, b

def process(tid, src):
    raw = os.path.join(RAW, f'{tid}.mp3')
    A, B = edges(raw)
    trimmed = os.path.join(RAW, f'{tid}.trim.wav')
    run(['ffmpeg', '-y', '-hide_banner', '-i', raw, '-af', f'atrim={A}:{B},asetpts=PTS-STARTPTS', trimmed])
    raw, L = trimmed, duration(trimmed)
    if src == 'elevenlabs-sfx':          # 22 s clip: loop it twice first, then crossfade the seam
        tmp = os.path.join(RAW, f'{tid}.x2.wav')
        run(['ffmpeg', '-y', '-hide_banner', '-i', raw, '-i', raw, '-filter_complex',
             f'[0][1]acrossfade=d={XFADE}:c1=qsin:c2=qsin', tmp])
        raw, L = tmp, duration(tmp)
    C = XFADE
    loop = (f'[0:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,asplit=3[h][b][t];'
            f'[h]atrim=0:{C},asetpts=PTS-STARTPTS,afade=t=in:d={C}:curve=qsin[hi];'
            f'[t]atrim={L - C}:{L},asetpts=PTS-STARTPTS,afade=t=out:d={C}:curve=qsin[to];'
            f'[to][hi]amix=inputs=2:normalize=0[x];'
            f'[b]atrim={C}:{L - C},asetpts=PTS-STARTPTS[mid];'
            f'[x][mid]concat=n=2:v=0:a=1,{EQ}[o]')
    wav = os.path.join(RAW, f'{tid}.loop.wav')
    run(['ffmpeg', '-y', '-hide_banner', '-i', raw, '-filter_complex', loop, '-map', '[o]', wav])
    gain = TARGET_LUFS - lufs(wav)
    out = os.path.join(OUT, f'{tid}.mp3')
    run(['ffmpeg', '-y', '-hide_banner', '-i', wav, '-af', f'volume={gain:.2f}dB,alimiter=limit=0.89:level=0',
         '-c:a', 'libmp3lame', '-b:a', '96k', '-ac', '2', out])
    return out

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--key-file')
    ap.add_argument('--only', default='')
    ap.add_argument('--process-only', action='store_true')
    a = ap.parse_args()
    ids = [i for i in a.only.split(',') if i] or list(TRACKS)
    os.makedirs(RAW, exist_ok=True); os.makedirs(OUT, exist_ok=True)
    mpath = os.path.join(OUT, 'manifest.json')
    manifest = json.load(open(mpath)) if os.path.exists(mpath) else {}
    srcpath = os.path.join(RAW, 'sources.json')
    sources = json.load(open(srcpath)) if os.path.exists(srcpath) else {}
    key = open(a.key_file).read().strip() if a.key_file else None
    use_sfx = False
    for tid in ids:
        raw = os.path.join(RAW, f'{tid}.mp3')
        if not os.path.exists(raw):
            if a.process_only or not key:
                print(f'{tid}: no raw, skipped'); continue
            for attempt in range(6):
                try:
                    t0 = time.time()
                    if not use_sfx:
                        try:
                            data, hdr = gen_music(key, tid); src = 'elevenlabs-music'
                        except urllib.error.HTTPError as e:
                            if 400 <= e.code < 500 and e.code != 429:
                                msg = e.read()[:300].decode(errors='replace')
                                print(f'music API HTTP {e.code}: {msg}; falling back to sound-generation')
                                use_sfx = True
                            else:
                                raise
                    if use_sfx:
                        data, hdr = gen_sfx(key, tid); src = 'elevenlabs-sfx'
                    open(raw, 'wb').write(data)
                    sources[tid] = src
                    json.dump(sources, open(srcpath, 'w'), indent=1)
                    cost = {k: v for k, v in hdr.items() if 'cost' in k.lower() or 'character' in k.lower()}
                    print(f'{tid}: {src} {len(data)//1024} KB in {time.time()-t0:.0f}s {cost}', flush=True)
                    break
                except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as e:
                    code = getattr(e, 'code', '')
                    print(f'{tid}: attempt {attempt+1} failed {code} {e}', flush=True)
                    if code and 400 <= code < 500 and code != 429:
                        sys.exit(1)
                    time.sleep(15)
            else:
                continue
        src = sources.get(tid, 'elevenlabs-music')
        out = process(tid, src)
        d = round(duration(out), 2)
        manifest[tid] = {'f': f'{tid}.mp3', 'd': d, 'src': src, 'prompt': TRACKS[tid] + ' ' + COMMON}
        json.dump(manifest, open(mpath, 'w'), indent=1, ensure_ascii=False)
        print(f'{tid}: {d}s {os.path.getsize(out)//1024} KB {lufs(out):.1f} LUFS', flush=True)

if __name__ == '__main__':
    main()
