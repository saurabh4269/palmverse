#!/usr/bin/env bash
# The "divine" post chain for Panditji's voice (design pack §4.3), adapted from
# research/hast-rekha-audio/divine.sh to an ffmpeg without librubberband:
# pitch layers use asetrate + atempo (same length, slightly grainier; they sit at low gain).
#
#   tools/voice/divine.sh in.wav out.mp3
#
# Strength knobs (environment variables; defaults are the design pack's, a touch gentler):
#   DIVINE_SUB=0.26      octave-down "voice of the mountain" layer gain (0 = off)
#   DIVINE_WHISPER=0.08  octave-up breathy halo gain
#   DIVINE_FIFTH=0.10    fifth-up choir pad gain
#   DIVINE_WET=0.70      temple reverb (synthetic stone hall, 3.2 s) wet level
#   DIVINE_DRONE_DB=-24  tanpura bed under the voice, dB (-60 = off)
# Needs tools/voice/assets/{temple_ir,tanpura}.wav: run `python3 tools/voice/gen_assets.py` in that folder (numpy, scipy).
set -euo pipefail
IN="$1"; OUT="$2"
SUB="${DIVINE_SUB:-0.26}"; WH="${DIVINE_WHISPER:-0.08}"; FI="${DIVINE_FIFTH:-0.10}"; WET="${DIVINE_WET:-0.70}"; DRONE="${DIVINE_DRONE_DB:--24}"
A="$(cd "$(dirname "$0")" && pwd)/assets"
ffmpeg -y -hide_banner -loglevel error \
  -i "$IN" -i "$A/temple_ir.wav" -stream_loop -1 -i "$A/tanpura.wav" \
  -filter_complex "
  [0:a]aformat=channel_layouts=mono,aresample=44100,highpass=f=90,acompressor=threshold=-20dB:ratio=3:attack=5:release=120,asplit=4[m][s][w1][w2];
  [m]equalizer=f=220:t=h:w=200:g=2,equalizer=f=4500:t=q:w=1.5:g=1.5[main];
  [s]asetrate=22050,atempo=2.0,aresample=44100,lowpass=f=900,volume=${SUB}[sub];
  [w1]asetrate=88200,atempo=0.5,aresample=44100,highpass=f=1500,adelay=28,volume=${WH}[whisper];
  [w2]asetrate=66075,atempo=0.66741,aresample=44100,lowpass=f=3500,adelay=45,volume=${FI}[fifth];
  [main][sub][whisper][fifth]amix=inputs=4:normalize=0:duration=first,chorus=0.6:0.9:55|70:0.4|0.32:0.25|0.4:2|1.3,pan=stereo|c0=c0|c1=c0[voice];
  [voice]asplit=2[dry][toverb];
  [toverb][1:a]afir=dry=0:wet=1:gtype=peak:irgain=1,volume=0.9[wet];
  [dry][wet]amix=inputs=2:weights=1 ${WET}:normalize=0,apad=pad_dur=2.5[vmix];
  [2:a]volume=${DRONE}dB,aresample=44100,pan=stereo|c0=c0|c1=c0[drone];
  [vmix][drone]amix=inputs=2:duration=first:normalize=0,afade=t=in:d=0.15,loudnorm=I=-16:TP=-1.5:LRA=7,alimiter=limit=0.95[out]
  " -map "[out]" -ar 44100 -ac 2 -c:a libmp3lame -b:a 112k "$OUT"
