/**
 * Synthesised sound (nothing to license) and the pandit's voice.
 *  - voice: pre-rendered clips first (src/render/voice-clips.ts), speechSynthesis as the fallback.
 *  - temple-bell chime (inharmonic partials), soft tick, glow swell, mount "ting"
 *    pitched up a raga-like scale (Bhupali: Sa Re Ga Pa Dha), tanpura-like drone.
 *  - voice: the browser's speechSynthesis, preferring an Indian English voice;
 *    captions always show, so the app works muted or with no voices installed.
 */

import { ClipVoice } from './voice-clips.js';

const BHUPALI = [0, 2, 4, 7, 9, 12, 14, 16];

export class Sound {
  ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private drone: { gain: GainNode; oscs: OscillatorNode[] } | null = null;

  unlock(): void {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.7;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      /* no audio */
    }
  }

  private tone(freq: number, dur: number, gain: number, type: OscillatorType = 'sine', delay = 0): void {
    const c = this.ctx, m = this.master;
    if (!c || !m) return;
    const t0 = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(m);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  /** Small brass bell: inharmonic partials with long decay. */
  bell(base = 523, gain = 0.18): void {
    for (const [r, g, d] of [[1, 1, 2.6], [2.76, 0.5, 1.6], [5.4, 0.25, 0.9], [8.9, 0.12, 0.5]] as const) this.tone(base * r, d, gain * g);
  }

  /** Note `i` of the Bhupali scale above Sa = 262 Hz. */
  ting(i: number): void {
    const f = 262 * Math.pow(2, BHUPALI[i % BHUPALI.length] / 12);
    this.tone(f * 2, 1.2, 0.12, 'sine');
    this.tone(f * 4.02, 0.5, 0.04, 'sine');
  }

  tick(): void {
    this.tone(1800, 0.05, 0.06, 'triangle');
  }

  press(): void {
    this.tone(660, 0.12, 0.1, 'triangle');
    this.tone(990, 0.2, 0.06, 'sine', 0.04);
  }

  /** Rising shimmer when the lines first glow. */
  swell(): void {
    for (let i = 0; i < 6; i++) this.tone(262 * Math.pow(2, BHUPALI[i] / 12) * 2, 1.4, 0.05, 'sine', i * 0.16);
  }

  /** Hover over a glowing line: a faint high shimmer, brighter as the finger nears. */
  shimmer(prox = 0.5): void {
    const f = 1760 * (1 + 0.25 * prox);
    this.tone(f, 0.35, 0.025 + 0.03 * prox, 'sine');
    this.tone(f * 1.5, 0.25, 0.015, 'sine', 0.03);
  }

  /** Touching a line: a small bell struck at the contact point, with a soft 80 ms thump under it. */
  touchBell(i = 0): void {
    this.ting(i + 3);
    this.thump(0.12, 0.08);
  }

  /** Low sine thump (the "felt" part of a contact, standing in for haptics). */
  thump(gain = 0.25, dur = 0.12): void {
    const c = this.ctx, m = this.master;
    if (!c || !m) return;
    const t0 = c.currentTime;
    const o = c.createOscillator(), g = c.createGain();
    o.frequency.setValueAtTime(110, t0);
    o.frequency.exponentialRampToValueAtTime(45, t0 + dur);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + 0.05);
    o.connect(g).connect(m);
    o.start(t0);
    o.stop(t0 + dur + 0.1);
  }

  /** Selecting a line: a singing bowl (slightly beating partials, long ring) over a sub drop. */
  bowl(base = 196, gain = 0.16): void {
    for (const [r, g, d] of [[1, 1, 6], [1.006, 0.6, 6], [2.71, 0.45, 3.5], [2.72, 0.3, 3.5], [5.15, 0.15, 1.8]] as const) this.tone(base * r, d, gain * g);
    const c = this.ctx, m = this.master;
    if (!c || !m) return;
    const t0 = c.currentTime;
    const o = c.createOscillator(), g = c.createGain();
    o.frequency.setValueAtTime(90, t0);
    o.frequency.exponentialRampToValueAtTime(32, t0 + 0.9);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.35, t0 + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.1);
    o.connect(g).connect(m);
    o.start(t0);
    o.stop(t0 + 1.2);
  }

  /** A world folding back into the palm: the swell, reversed (falling notes). */
  fold(): void {
    for (let i = 0; i < 5; i++) this.tone(262 * Math.pow(2, BHUPALI[5 - i] / 12) * 2, 1.0, 0.04, 'sine', i * 0.1);
  }

  /**
   * A world's ambience (design pack §3.1): a soft pad in the world's notes, a slow bell, and for
   * the life world flowing water (filtered noise). `null` fades it out. Synthesised, nothing to license.
   */
  // ── music: one looping track per moment (public/audio/music, tools/music/make_music.py) ──
  /** music level relative to the voice: the tracks are mastered at −26 LUFS, the voice at −16 */
  static readonly MUSIC_GAIN = 0.9;
  private musicNow: { id: string; src: AudioBufferSourceNode; gain: GainNode } | null = null;
  private musicWant: string | null = null;
  /** decoded tracks, at most 3 kept (a 50 s stereo track is ~17 MB decoded) */
  private readonly musicCache = new Map<string, Promise<AudioBuffer | null>>();

  private musicBuffer(id: string): Promise<AudioBuffer | null> {
    const c = this.ctx!;
    let p = this.musicCache.get(id);
    if (p) {
      this.musicCache.delete(id);
      this.musicCache.set(id, p); // most recent last
      return p;
    }
    p = fetch(`${import.meta.env.BASE_URL}audio/music/${id}.mp3`)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((b) => c.decodeAudioData(b))
      .catch(() => null);
    this.musicCache.set(id, p);
    while (this.musicCache.size > 3) this.musicCache.delete(this.musicCache.keys().next().value!);
    return p;
  }

  /** Crossfade to track `id` (null: fade the music out). Loops until changed. */
  music(id: string | null, fadeIn = 2.5): void {
    const c = this.ctx;
    if (!c || this.musicWant === id) return;
    this.musicWant = id;
    const old = this.musicNow;
    if (old) {
      this.musicNow = null;
      old.gain.gain.cancelScheduledValues(c.currentTime);
      old.gain.gain.setTargetAtTime(0, c.currentTime, 0.6);
      setTimeout(() => {
        try {
          old.src.stop();
        } catch {
          /* stopped */
        }
      }, 4000);
    }
    if (!id) return;
    void this.musicBuffer(id).then((buf) => {
      if (!buf || this.musicWant !== id || !this.ctx) return;
      const src = c.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const gain = c.createGain();
      gain.gain.value = 0;
      gain.gain.setTargetAtTime(Sound.MUSIC_GAIN, c.currentTime, fadeIn / 3);
      src.connect(gain).connect(c.destination);
      src.start();
      this.musicNow = { id, src, gain };
    });
  }

  get musicId(): string | null {
    return this.musicWant;
  }

  /** Warm a track so it starts on time. */
  prefetchMusic(id: string): void {
    if (this.ctx) void this.musicBuffer(id);
  }

  setWorld(kind: 'heart' | 'life' | 'head' | 'fate' | 'graha' | null): void {
    const c = this.ctx, m = this.master;
    if (!c || !m) return;
    if (this.world) {
      const w = this.world;
      this.world = null;
      clearInterval(w.timer);
      w.gain.gain.cancelScheduledValues(c.currentTime);
      w.gain.gain.setTargetAtTime(0, c.currentTime, 0.4);
      setTimeout(() => w.nodes.forEach((n) => n.stop()), 2500);
    }
    if (!kind) return;
    const P: Record<string, { notes: number[]; bell: number; every: number; water?: boolean }> = {
      heart: { notes: [0, 4, 7], bell: 523, every: 4.5 },
      life: { notes: [0, 7], bell: 392, every: 6, water: true },
      head: { notes: [7, 12, 16], bell: 1047, every: 3.2 },
      fate: { notes: [-12, -5, 0], bell: 262, every: 7 },
      graha: { notes: [0, 7, 12], bell: 659, every: 5.5 },
    };
    const p = P[kind];
    const gain = c.createGain();
    gain.gain.value = 0;
    gain.connect(m);
    gain.gain.setTargetAtTime(0.06, c.currentTime + 0.8, 1.2);
    const nodes: AudioScheduledSourceNode[] = [];
    p.notes.forEach((st, i) => {
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.value = 196 * Math.pow(2, st / 12);
      o.detune.value = (i - 1) * 6;
      const g = c.createGain();
      g.gain.value = 0.35 / p.notes.length;
      // a slow swell on each voice, out of phase, so the pad breathes
      const lfo = c.createOscillator(), lg = c.createGain();
      lfo.frequency.value = 0.07 + i * 0.03;
      lg.gain.value = 0.12 / p.notes.length;
      lfo.connect(lg).connect(g.gain);
      o.connect(g).connect(gain);
      o.start();
      lfo.start();
      nodes.push(o, lfo);
    });
    if (p.water) {
      const len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const n = c.createBufferSource();
      n.buffer = buf;
      n.loop = true;
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 900;
      bp.Q.value = 0.8;
      const lfo = c.createOscillator(), lg = c.createGain();
      lfo.frequency.value = 0.23;
      lg.gain.value = 400;
      lfo.connect(lg).connect(bp.frequency);
      const g = c.createGain();
      g.gain.value = 0.18;
      n.connect(bp).connect(g).connect(gain);
      n.start();
      lfo.start();
      nodes.push(n, lfo);
    }
    const timer = setInterval(() => this.bell(p.bell, 0.05), p.every * 1000);
    this.world = { gain, nodes, timer };
  }

  private world: { gain: GainNode; nodes: AudioScheduledSourceNode[]; timer: ReturnType<typeof setInterval> } | null = null;

  /** Tanpura-like drone (Pa–Sa–Sa–Sa), very soft, while the pavilion is up. */
  setDrone(on: boolean): void {
    const c = this.ctx, m = this.master;
    if (!c || !m) return;
    if (on && !this.drone) {
      const gain = c.createGain();
      gain.gain.value = 0;
      gain.connect(m);
      const oscs = [98, 130.8, 131.2, 65.4].map((f, i) => {
        const o = c.createOscillator();
        o.type = i === 3 ? 'sine' : 'sawtooth';
        o.frequency.value = f;
        const lp = c.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 700;
        const g = c.createGain();
        g.gain.value = i === 3 ? 0.5 : 0.18;
        o.connect(lp).connect(g).connect(gain);
        o.start();
        return o;
      });
      gain.gain.linearRampToValueAtTime(0.05, c.currentTime + 3);
      this.drone = { gain, oscs };
    } else if (!on && this.drone) {
      const d = this.drone;
      this.drone = null;
      d.gain.gain.linearRampToValueAtTime(0, c.currentTime + 1.5);
      setTimeout(() => d.oscs.forEach((o) => o.stop()), 1800);
    }
  }
}

export class Voice {
  enabled = true;
  private voice: SpeechSynthesisVoice | null = null;
  speaking = false;
  private readonly clipsBy = { en: new ClipVoice(`${import.meta.env.BASE_URL}voice/en/`), hi: new ClipVoice(`${import.meta.env.BASE_URL}voice/hi/`) };
  private hiVoice: SpeechSynthesisVoice | null = null;
  /** language of the line being spoken: picks the clip set and the fallback voice */
  lang: 'en' | 'hi' = 'en';
  get clips(): ClipVoice {
    return this.clipsBy[this.lang];
  }
  private sound: Sound | null = null;

  /** Clips play through the effects' AudioContext (unlocked on Enter). */
  attach(sound: Sound): void {
    this.sound = sound;
  }

  constructor() {
    void this.clipsBy.en.load();
    void this.clipsBy.hi.load();
    try {
      const pick = () => {
        const vs = speechSynthesis.getVoices();
        this.voice =
          vs.find((v) => /en[-_]IN/i.test(v.lang) && /male|ravi|rishi|prabhat/i.test(v.name)) ??
          vs.find((v) => /en[-_]IN/i.test(v.lang)) ??
          vs.find((v) => /^en/i.test(v.lang)) ??
          null;
        this.hiVoice = vs.find((v) => /hi[-_]IN/i.test(v.lang)) ?? null;
      };
      pick();
      speechSynthesis.addEventListener?.('voiceschanged', pick);
    } catch {
      /* no speech synthesis */
    }
  }

  /** Speak a line. Returns the clip's duration (seconds) when a pre-rendered clip plays, else null. */
  say(text: string, lang: 'en' | 'hi' = 'en'): number | null {
    if (!this.enabled) return null;
    this.lang = lang;
    const ctx = this.sound?.ctx;
    if (ctx && ctx.state !== 'closed') {
      const d = this.clips.play(ctx, text, () => this.speak(text));
      if (d !== null) return d;
    }
    this.speak(text);
    return null;
  }

  prefetch(texts: string[]): void {
    this.clips.prefetch(this.sound?.ctx ?? null, texts);
  }

  private speak(text: string): void {
    try {
      // Speak Devanagari words by their roman form: strip the Devanagari, keep the rest.
      const hi = this.lang === 'hi';
      const spoken = hi ? text : text.replace(/[ऀ-ॿ]+[,\s]*/g, '').replace(/\s+/g, ' ').trim();
      const u = new SpeechSynthesisUtterance(spoken);
      const v = hi ? this.hiVoice : this.voice;
      if (v) u.voice = v;
      u.lang = v?.lang ?? (hi ? 'hi-IN' : 'en-IN');
      u.rate = 0.93;
      u.pitch = 0.85;
      u.onstart = () => (this.speaking = true);
      u.onend = () => (this.speaking = false);
      speechSynthesis.speak(u);
    } catch {
      /* ignore */
    }
  }

  stop(): void {
    this.clipsBy.en.stop();
    this.clipsBy.hi.stop();
    try {
      speechSynthesis.cancel();
    } catch {
      /* ignore */
    }
    this.speaking = false;
  }
}
