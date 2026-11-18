# Hast Rekha demo film v1: audit (18 Nov 2026, 22:50 IST)

**Film:** `hast-rekha-demo.mp4`, 2:24.9, 1920×1080, 30 fps constant, H.264 yuv420p plus AAC 48 kHz. Also `hast-rekha-demo-voice-only.mp4` (the same film without the music bed under the end card), `hast-rekha-demo.srt` and `contact-sheet.png`. Built by `work/build.py` from `work/src30.mp4`, a constant 30 fps H.264 transcode of the variable-frame-rate HEVC original.

## Is it genuine?
- **Every picture beat is real footage** from one continuous session on a physical Meta Quest 3 in Quest Browser (the user's own capture, `1000011032.mp4`). There is no emulator footage, no AI-generated video and no re-rendering.
- **No speed changes.** Everything plays at 1×. Cuts skip time, and the standing strip says "no speed-ups".
- **Edits a viewer should know about** (also stated in the upload text):
  1. The film is reordered. The hook (film 0–8 s) comes from source 259–267 s. The fist-fold beat (Budh's world, source 253–259 s) is placed after the lotus world (source 296–310 s); the explore lead-in starts at source 289 s because 285–288 s shows people at desks, although in the session it came before.
  2. The farewell beat (film 130–136 s) puts audio from source 383.6–389.8 s ("Whatever your lines say… Namaste") over the card picture from source 371–377 s, because the frames under the real line show people clearly.
  3. **Privacy blur.** In the passthrough room shots, a feathered Gaussian blur (sigma 32) covers the upper background to the left and right of Panditji. It also softens some of the app's own subtitle cards on the left. The two card beats are a 1.6× crop of the lower frame, below the band where people sit.
  4. In ducked stretches the narrator speaks over the app audio (−14 dB), and the SRT drops the app words under the narration.
- **Disclosures:** the standing strip on every footage beat; narration line 6; the end card; `UPLOAD.md`. Together they name ElevenLabs as the source of Panditji's voice, the opening voice, the narrator and the music, and give the CC-BY credit for the banyan.

## People, brands and system UI: frames checked
- **Source walkthrough:** contact sheets at one frame per 4 s over all 412.7 s (`work/sheet4_*.png`), then 960 px frames at 18, 36, 44, 126, 150, 166, 285, 336, 358, 364, 368, 372, 378, 384 and 388 s.
  - **People at desks** are visible through passthrough, faintly behind the dome at 33–60, 86–92, 126, 285–290, 336, 356–360 and 364–380 s, and **clearly at 376–390 s**.
  - The source's first 3 s and last ~12 s are excluded: the 2D browser window, the restart, and a system status bar with **app icons at about 404 s**. None of it is used.
- **Final film:** frames checked at 960 px at film seconds 1, 20, 22, 26, 30, 31, 33, 34, 40, 45, 47, 49, 51, 53, 55, 57, 60, 61, 69, 70, 72, 73, 74, 76, 77, 82, 84, 87, 89, 92, 95, 98, 100, 103, 110, 116, 118, 119, 121, 122, 126, 129, 130, 132, 133, 134, 135, 136, 137, 140 and 144, plus the 3 s contact sheet. After the third pass no person was identifiable in those frames. ⚠ Frames between those samples were not each checked; see below.
- **Brands:** none seen. The Quest system UI shows only the hand-tracking ring icons on the virtual hands (part of the OS hand rendering, unbranded). There are no notifications in the used ranges.

## Numbers
- **Length:** 144.9 s (the limit is 179 s).
- **Loudness:** −16.0 LUFS integrated; LRA 3.6 LU (voice-only: −16.0 and 3.6); true-peak limit set at −1.5 dBTP in the loudnorm pass, but the measured true peak is not recorded here. The narration was levelled per line to −17 LUFS before mixing. The app audio already carries Panditji (−16 mastered) and the music beds (−26).
- **Narration:** 6 lines and 33 s in total. The longest sentence is 17 words. ElevenLabs speech-to-text of the narrator take returned the script word for word, including "Hast Rekha".

## What I did NOT verify (I cannot listen)
- **How the mix sounds.** Whether the narrator sits well over the ducked app audio; whether the duck (−14 dB, hard switched with no ramp) sounds abrupt; whether Panditji's lines are clear at every cut; and whether the 0.08 s audio fades at the cuts click.
- **Whether the narrator voice suits the film.** It is the premade "George" voice; the user should pick.
- **Every single frame for people.** I checked samples about every 3–5 s and every beat at full width. Faint shapes behind the dome are hard to judge at 960 px, so the user should scrub beats 3–6 and 9–10 once at full screen.
- **The Hindi in the app's own captions:** it appears alongside English, so no extra English subtitles were added, and the spoken Hindi words are names glossed in the captions.
- **How YouTube or Vimeo re-encodes it.**

## A re-shoot would help with
1. **A take in a room with nobody in it** (or the dome slightly more opaque). This would remove every blur, keep Panditji's subtitle cards sharp and let the farewell use its real picture.
2. **A cleaner fist-fold moment right after a line world** (lotus or banyan), so the "fist folds it back" beat comes from the same world.
3. **A slower, closer look at the glowing lines on the palm** (hold the palm still for about 5 s, 25–35 cm away), the best hook material, which is fleeting in this take.
