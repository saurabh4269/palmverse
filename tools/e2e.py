#!/usr/bin/env python3
"""
Hast Rekha end-to-end test in the IWSDK emulator (IWER), hands only.

The whole reading the way a seated user does it:
  enter XR → poke "Continue" → raise the right palm (open, facing the eye)
  → scan → lines glow → seven mounts light → poke mounts with the LEFT index fingertip
  → poke "Continue" → for each of 5 lines hover a card (preview on the palm) and poke one
  → the reading → the Rekha card → poke "Finish" → farewell.

Prerequisite: `npx iwsdk dev up --ai-mode agent` (port 8087). Never edit src/ during a run.
Usage: python3 tools/e2e.py [--hand right|left] [--jitter MM] [--tour] [--mounts N]
Screenshots: artifacts/e2e-*.png
"""
import argparse
import json
import math
import os
import random
import sys
import time

os.environ.setdefault('XR_LOG_TAG', 'hast')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from xr_e2e_lib import CUR, check, cli, field, finish, logs, mark, pin_page, wait_for  # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument('--hand', default='right', choices=['right', 'left'])
ap.add_argument('--jitter', type=float, default=3.0, help='random fingertip error, mm')
ap.add_argument('--mounts', type=int, default=3, help='mounts to poke')
ap.add_argument('--tour', action='store_true', help='extra screenshots at each moment')
ap.add_argument('--worlds', action='store_true', help='also open the life, head and fate worlds by touch (screenshots)')
args = ap.parse_args()

READ = f'hand-{args.hand}'
POKE = 'hand-left' if args.hand == 'right' else 'hand-right'
SX = 1 if args.hand == 'right' else -1
HEAD = (0.0, 1.2, 0.0)
J = args.jitter / 1000.0
os.makedirs('artifacts', exist_ok=True)


def jit(p):
    return [p[0] + random.uniform(-J, J), p[1] + random.uniform(-J, J), p[2] + random.uniform(-J, J)]


def shot(name):
    cli('browser', 'screenshot', '--output-file', f'artifacts/e2e-{name}.png', check=False)


def head(pitch_deg=-10.0):
    a = math.radians(pitch_deg) / 2
    cli('xr', 'set-transform', payload={'device': 'headset', 'position': dict(zip('xyz', HEAD)),
                                        'orientation': {'x': math.sin(a), 'y': 0, 'z': 0, 'w': math.cos(a)}})


def tip_to(device, p, duration=0.35):
    cli('xr', 'animate-to', payload={'device': device, 'anchor': 'index-tip', 'duration': duration, 'easing': 'minimum-jerk',
                                     'position': {'x': p[0], 'y': p[1], 'z': p[2]}})


def towards_head(p, d):
    v = [HEAD[i] - p[i] for i in range(3)]
    n = math.sqrt(sum(x * x for x in v)) or 1
    return [p[i] + v[i] / n * d for i in range(3)]


def poke(p, device=None, hover=0.0):
    """Approach from 4 cm on the head side, optionally hover, push 1 cm through, back off."""
    device = device or POKE
    tip_to(device, towards_head(p, 0.045), 0.4)
    if hover:
        tip_to(device, towards_head(p, 0.018), 0.25)
        time.sleep(hover)
    tip_to(device, jit(towards_head(p, -0.01)), 0.25)
    time.sleep(0.15)
    tip_to(device, towards_head(p, 0.06), 0.3)


def raise_palm():
    cli('xr', 'set-hand-pose', payload={'device': READ, 'poseId': 'open'})
    cli('xr', 'set-transform', payload={'device': READ, 'anchor': 'wrist',
                                        'position': {'x': 0.03 * SX, 'y': 0.93, 'z': -0.36},
                                        'orientation': {'fingers': [0, 0.85, -0.5], 'palm': 'back'}})


def latest_layout():
    for _, msg in reversed(logs(since=CUR['since'] - 4000)):
        if ' layout phase=' in msg:
            return field(msg, 'layout')
    return None


def park_poker():
    cli('xr', 'set-hand-pose', payload={'device': POKE, 'poseId': 'point'})
    cli('xr', 'set-transform', payload={'device': POKE, 'anchor': 'index-tip',
                                        'position': {'x': -0.22 * SX, 'y': 0.85, 'z': -0.3}})


# ---------------------------------------------------------------- journey
pin_page()
cli('xr', 'enter')
time.sleep(2)
cli('xr', 'set-input-mode', payload={'mode': 'hand'})
head(-10)
park_poker()
cli('xr', 'set-transform', payload={'device': READ, 'position': {'x': 0.25 * SX, 'y': 0.7, 'z': 0.05}})
check('welcome', bool(wait_for(r'phase from=boot to=welcome', 15)))
check('stage anchored', bool(wait_for(r'^ ?anchor ', 10)))
m = wait_for(r'layout phase=welcome .*"next":\[', 12)
btn = field(m, 'layout')['buttons']['next']
time.sleep(0.6)
if args.tour:
    shot('tour-welcome')
mark()
poke(btn)
check('continue poked (welcome)', bool(wait_for(r'press id=next', 6)))
check('raise phase', bool(wait_for(r'phase from=welcome to=raise', 6)))

raise_palm()
head(-28)
m = wait_for(r'palm-up hand=(\w+)', 12)
check('palm detected, correct hand', m.group(1) == args.hand, m.group(1))
m = wait_for(r'profile hand=\w+ element=(\w+)', 15)
check('hand shape measured', m.group(1) in ('prithvi', 'vayu', 'agni', 'jal'), m.group(0))
for line in ('life', 'head', 'heart', 'fate'):
    check(f'line glows: {line}', bool(wait_for(rf'line-glow line={line}', 8)))
time.sleep(0.8)
shot('lines-glow')
for mid in ('jupiter', 'saturn', 'sun_apollo', 'mercury', 'mars_upper', 'luna_moon', 'venus'):
    check(f'mount lit: {mid}', bool(wait_for(rf'mount-lit id={mid}', 15)))
time.sleep(1.0)
shot('mounts-lit')

lay = latest_layout()
check('mount positions logged', bool(lay and lay.get('mounts')))
mounts = {x['id']: x for x in lay['mounts']}
order = ['jupiter', 'venus', 'luna_moon', 'saturn', 'mercury', 'sun_apollo', 'mars_upper'][: args.mounts]
for mid in order:
    p, n = mounts[mid]['p'], mounts[mid]['n']
    above = [p[i] + n[i] * 0.03 for i in range(3)]
    touch = jit([p[i] + n[i] * 0.004 for i in range(3)])
    tip_to(POKE, above, 0.4)
    tip_to(POKE, touch, 0.3)
    m = wait_for(r'mount-poke id=(\w+)', 5)
    check(f'mount poked: {mid}', m.group(1) == mid, m.group(0))
    if mid == order[0]:
        time.sleep(0.4)
        shot('mount-poke')
    tip_to(POKE, above, 0.25)
park_poker()
m = wait_for(r'layout phase=mounts .*"next":\[', 25)
btn = field(m, 'layout')['buttons']['next']
mark()
poke(btn)
check('continue poked (mounts)', bool(wait_for(r'press id=next', 6)))
check('lines phase', bool(wait_for(r'phase from=mounts to=lines', 5)))

head(-30)
for i, line in enumerate(['heart', 'head', 'join', 'life', 'fate']):
    m = wait_for(rf'line-ask line={line} ', 8)
    cards = field(m, 'layout')['cards']
    check(f'{line}: {len(cards)} cards', 2 <= len(cards) <= 4)
    time.sleep(0.9)  # let the cards fade in (they press only above 60 % opacity)
    target = cards[(i + 1) % len(cards)]
    want = target['id'].split('-', 1)[1]
    # hover first: the candidate previews on the real palm
    tip_to(POKE, towards_head(target['p'], 0.05), 0.4)
    tip_to(POKE, towards_head(target['p'], 0.02), 0.25)
    pm = wait_for(rf'line-preview line={line} value=(\w+)', 4)
    check(f'{line}: hover previews {want}', pm.group(1) == want, pm.group(0))
    if line == 'heart':
        time.sleep(0.4)
        shot('line-cards')
    tip_to(POKE, jit(towards_head(target['p'], -0.012)), 0.25)
    pk = wait_for(rf'line-pick line={line} value=(\w+)', 4)
    check(f'{line}: picked {want}', pk.group(1) == want, pk.group(0))
    tip_to(POKE, towards_head(target['p'], 0.08), 0.3)
park_poker()

# ---- explore: the lines glow; touch the heart line with the other hand's fingertip
m = wait_for(r'explore lines=(\S+)', 8)
check('explore: lines glow', 'heart' in m.group(1), m.group(0))
m = wait_for(r'layout phase=explore .*"lines":\[\{', 10)
ls = {x['id']: x for x in field(m, 'layout')['lines']}
p, n = ls['heart']['p'], ls['heart']['n']
mark()
tip_to(POKE, [p[i] + n[i] * 0.05 for i in range(3)], 0.4)
tip_to(POKE, [p[i] + n[i] * 0.02 for i in range(3)], 0.3)
check('heart line: hover', bool(wait_for(r'line-hover line=heart', 4)))
time.sleep(0.3)
shot('line-hover')
tip_to(POKE, jit([p[i] + n[i] * 0.003 for i in range(3)]), 0.25)
check('heart line: touch', bool(wait_for(r'line-touch line=heart', 4)))
m = wait_for(r'line-select line=(\w+) by=(\w+)', 4)
check('heart line: select', m and m.group(1) == 'heart', m.group(0) if m else '')
time.sleep(0.35)
shot('line-select')
tip_to(POKE, [p[i] + n[i] * 0.08 for i in range(3)], 0.3)
# ---- the heart line's world blooms out of the palm; close it with a fist
check('heart world opens', bool(wait_for(r'world-open line=heart', 4)))
time.sleep(1.0)
shot('world-bloom')
m = wait_for(r'gpu world=heart (.*)', 8)
check('world gpu logged', bool(m), m.group(1)[:160] if m else '')
time.sleep(1.0)
shot('world-heart')
head(0)
time.sleep(0.6)
shot('world-heart-ahead')
head(-30)
cli('xr', 'set-hand-pose', payload={'device': POKE, 'poseId': 'fist'})
m = wait_for(r'world-close line=heart reason=(\w+)', 5)
check('fist closes the world', m and m.group(1) == 'fist', m.group(0) if m else '')
time.sleep(0.5)
shot('world-fold')
park_poker()
if args.worlds:
    for wl in ('life', 'head', 'fate'):
        if wl not in ls:
            continue
        time.sleep(2.0)
        p, n = ls[wl]['p'], ls[wl]['n']
        mark()
        tip_to(POKE, [p[i] + n[i] * 0.05 for i in range(3)], 0.4)
        tip_to(POKE, [p[i] + n[i] * 0.02 for i in range(3)], 0.3)
        tip_to(POKE, jit([p[i] + n[i] * 0.003 for i in range(3)]), 0.25)
        m = wait_for(r'line-select line=(\w+)', 5)
        check(f'{wl} line: select', m and m.group(1) == wl, m.group(0) if m else '')
        tip_to(POKE, [p[i] + n[i] * 0.08 for i in range(3)], 0.3)
        park_poker()
        ok = wait_for(rf'world-open line={wl}', 4)
        check(f'{wl} world opens', bool(ok))
        time.sleep(1.1)
        shot(f'world-{wl}-bloom')
        time.sleep(3.0)
        shot(f'world-{wl}')
        head(0)
        time.sleep(0.5)
        shot(f'world-{wl}-ahead')
        head(-30)
        cli('xr', 'set-hand-pose', payload={'device': POKE, 'poseId': 'fist'})
        check(f'{wl} world closes', bool(wait_for(rf'world-close line={wl}', 5)))
        park_poker()
m = wait_for(r'layout phase=explore .*"next":\[', 25)
btn = field(m, 'layout')['buttons']['next']
mark()
poke(btn)
check('continue poked (explore)', bool(wait_for(r'phase from=explore to=reading', 6)))

m = wait_for(r'reading items=(\d+) keys=(\S+)', 8)
check('reading built', int(m.group(1)) >= 6, m.group(0))
dropped = [msg for _, msg in logs(since=CUR['since'] - 20000) if 'reading-dropped' in msg or 'reading-missing' in msg]
check('no reading dropped', not dropped, '; '.join(dropped)[:200])
time.sleep(3)
shot('reading')
m = wait_for(r'layout phase=reading .*"next":\[', 10)
btn = field(m, 'layout')['buttons']['next']
mark()
poke(btn)
check('skip to card', bool(wait_for(r'phase from=reading to=card', 6)))
m = wait_for(r'card lines=(\d+) saved=(\d+) bytes=(\d+)', 6)
check('card rendered + saved', int(m.group(1)) >= 3 and int(m.group(2)) >= 1 and int(m.group(3)) > 10000, m.group(0))
head(-12)
time.sleep(2.5)
shot('card')
m = wait_for(r'layout phase=card .*"finish":\[', 8)
lay = field(m, 'layout')
mark()
poke(lay['buttons']['finish'])
check('finish poked', bool(wait_for(r'press id=finish', 6)))
check('farewell', bool(wait_for(r'phase from=card to=end', 5)))
finish()
