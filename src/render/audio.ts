/**
 * Synthesised sound (nothing to license) and the pandit's voice.
 *  - temple-bell chime (inharmonic partials), soft tick, glow swell, mount "ting"
 *    pitched up a raga-like scale (Bhupali: Sa Re Ga Pa Dha), tanpura-like drone.
 *  - voice: the browser's speechSynthesis, preferring an Indian English voice;
 *    captions always show, so the app works muted or with no voices installed.
 */

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

  constructor() {
    try {
      const pick = () => {
        const vs = speechSynthesis.getVoices();
        this.voice =
          vs.find((v) => /en[-_]IN/i.test(v.lang) && /male|ravi|rishi|prabhat/i.test(v.name)) ??
          vs.find((v) => /en[-_]IN/i.test(v.lang)) ??
          vs.find((v) => /^en/i.test(v.lang)) ??
          null;
      };
      pick();
      speechSynthesis.addEventListener?.('voiceschanged', pick);
    } catch {
      /* no speech synthesis */
    }
  }

  say(text: string): void {
    if (!this.enabled) return;
    try {
      // Speak Devanagari words by their roman form: strip the Devanagari, keep the rest.
      const spoken = text.replace(/[ऀ-ॿ]+[,\s]*/g, '').replace(/\s+/g, ' ').trim();
      const u = new SpeechSynthesisUtterance(spoken);
      if (this.voice) u.voice = this.voice;
      u.lang = this.voice?.lang ?? 'en-IN';
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
    try {
      speechSynthesis.cancel();
    } catch {
      /* ignore */
    }
    this.speaking = false;
  }
}
