#!/usr/bin/env python3
"""Generate two license-free helper assets (we own them; treat as CC0):
 - temple_ir.wav : synthetic stone-hall impulse response (exp-decaying filtered noise, ~3.2 s RT60)
 - tanpura.wav   : 20 s tanpura-style drone (Pa - Sa - Sa - low Sa cycle, plucked strings w/ jivari-like buzz)
Needs numpy + scipy only."""
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, lfilter
sr = 44100
rng = np.random.default_rng(7)

# ---- impulse response (stereo, decorrelated channels) ----
def ir_channel(rt60=3.2, length=3.6):
    n = int(sr*length); t = np.arange(n)/sr
    noise = rng.standard_normal(n)
    env = np.exp(-6.9*t/rt60)                      # -60 dB at rt60
    x = noise*env
    # high frequencies die faster in stone halls: low-pass whose cutoff slides down
    b, a = butter(2, 5500/(sr/2)); hi = lfilter(b, a, x)
    b, a = butter(2, 1200/(sr/2)); lo = lfilter(b, a, x)
    mix = np.exp(-t/0.9)
    x = hi*mix + lo*(1-mix)
    x[0:int(0.012*sr)] *= np.linspace(0, 1, int(0.012*sr))   # tiny pre-delay ramp
    x = np.concatenate([np.zeros(int(0.018*sr)), x])           # 18 ms pre-delay
    return x
ir = np.stack([ir_channel(), ir_channel()], 1)
ir /= np.abs(ir).max()
wavfile.write('temple_ir.wav', sr, (ir*32767*0.9).astype(np.int16))

# ---- tanpura drone ----
Sa = 146.83   # D3 (comfortable under a male/female narrator); change freely
def pluck(f, dur=6.0):
    n = int(sr*dur); t = np.arange(n)/sr
    y = np.zeros(n)
    for h in range(1, 26):                       # many harmonics = tanpura shimmer
        amp = 1.0/h
        # jivari: harmonics swell and fade at slightly different times -> buzzing 'sweep'
        sweep = np.exp(-((t - (0.25 + 0.05*h))**2)/(2*(0.5+0.04*h)**2))
        y += amp*np.sin(2*np.pi*f*h*t + rng.uniform(0, 6.28))*(0.35 + sweep)*np.exp(-t*(0.35+0.02*h))
    y[:int(0.004*sr)] *= np.linspace(0, 1, int(0.004*sr))
    return y/np.abs(y).max()
notes = [Sa*1.5, Sa*2, Sa*2, Sa/1]               # Pa, Sa', Sa', Sa(low)
cycle = 1.5                                      # seconds per string
total = 20.0
out = np.zeros(int(sr*(total+7)))
i = 0; k = 0
while i < int(sr*total):
    p = pluck(notes[k % 4]); out[i:i+len(p)] += p*0.5; i += int(sr*cycle); k += 1
out = out[:int(sr*total)]
fade = int(1.5*sr); out[:fade] *= np.linspace(0, 1, fade); out[-fade:] *= np.linspace(1, 0, fade)   # loop-friendly ends
out /= np.abs(out).max()
wavfile.write('tanpura.wav', sr, (out*32767*0.8).astype(np.int16))
print('ok')
