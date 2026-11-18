#!/usr/bin/env python3
"""Close-up stills of the palm overlay, for visual review and trailer framing (emulator, hands only).
Prerequisite: dev server up (port 8087). Usage: python3 tools/shots.py [prefix] -> artifacts/shot-<prefix>-*.png"""
import math, os, sys, time
os.environ.setdefault('XR_LOG_TAG', 'hast')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from xr_e2e_lib import cli, key, pin_page, wait_for  # noqa: E402

P = sys.argv[1] if len(sys.argv) > 1 else 'x'
HEAD = (0.0, 1.2, 0.0)
PALM = (0.03, 1.0, -0.40)
os.makedirs('artifacts', exist_ok=True)


def head(pitch_deg, pos=HEAD):
    a = math.radians(pitch_deg) / 2
    cli('xr', 'set-transform', payload={'device': 'headset', 'position': dict(zip('xyz', pos)),
                                        'orientation': {'x': math.sin(a), 'y': 0, 'z': 0, 'w': math.cos(a)}})


def shot(n):
    cli('browser', 'screenshot', '--output-file', f'artifacts/shot-{P}-{n}.png', check=False)


pin_page()
cli('xr', 'enter'); time.sleep(2)
cli('xr', 'set-input-mode', payload={'mode': 'hand'})
head(-10)
cli('xr', 'set-hand-pose', payload={'device': 'hand-left', 'poseId': 'point'})
cli('xr', 'set-transform', payload={'device': 'hand-left', 'anchor': 'index-tip', 'position': {'x': -0.22, 'y': 0.85, 'z': -0.3}})
cli('xr', 'set-transform', payload={'device': 'hand-right', 'position': {'x': 0.25, 'y': 0.7, 'z': 0.05}})
wait_for(r'phase from=boot to=welcome', 15)
time.sleep(2.5)
shot('welcome')
key('n')
wait_for(r'phase from=welcome to=raise', 6)
cli('xr', 'set-hand-pose', payload={'device': 'hand-right', 'poseId': 'open'})
cli('xr', 'set-transform', payload={'device': 'hand-right', 'anchor': 'wrist',
                                    'position': {'x': 0.03, 'y': 0.93, 'z': -0.36},
                                    'orientation': {'fingers': [0, 0.85, -0.5], 'palm': 'back'}})
head(-27)
wait_for(r'line-glow line=heart', 15)
time.sleep(0.5)
shot('lines-drawing')
wait_for(r'line-glow line=fate', 15)
time.sleep(1.2)
shot('lines')
wait_for(r'mount-lit id=venus', 25)
time.sleep(1.0)
shot('mounts')
head(-30, (0.02, 1.13, -0.2))
time.sleep(0.4)
shot('closeup')
head(-10)
time.sleep(0.4)
shot('wide')
