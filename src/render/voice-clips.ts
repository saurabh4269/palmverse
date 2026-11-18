/**
 * Pre-rendered voice clips (tools/voice/render_voice.py): Panditji's designed
 * voice through the divine chain, one mp3 per line, found by a hash of the
 * line's text. Played through Web Audio in order, back to back; a line with
 * no clip (or a clip that fails to load) falls back to speechSynthesis.
 */
export function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (const b of new TextEncoder().encode(s)) {
    h ^= b;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

interface Manifest {
  voice: string;
  lines: Record<string, { f: string; d: number }>;
}

/** Runtime knob: narration level relative to the effects (1 = as mastered, −16 LUFS). */
export const VOICE_GAIN = 1.0;
/** Pause between consecutive lines, seconds (the clips carry a 2.5 s reverb tail that overlaps it). */
const GAP = 0.35;

export class ClipVoice {
  private man: Manifest | null = null;
  private readonly cache = new Map<string, Promise<AudioBuffer | null>>();
  private playing: AudioBufferSourceNode[] = [];
  private nextAt = 0;
  private gain: GainNode | null = null;
  private epoch = 0;

  constructor(private readonly base: string) {}

  async load(): Promise<void> {
    try {
      const r = await fetch(`${this.base}manifest.json`);
      if (r.ok) this.man = (await r.json()) as Manifest;
    } catch {
      this.man = null;
    }
  }

  get count(): number {
    return this.man ? Object.keys(this.man.lines).length : 0;
  }

  /** Speech length of the clip for `text`, or null if there is none. */
  duration(text: string): number | null {
    return this.man?.lines[fnv1a(text)]?.d ?? null;
  }

  private buffer(ctx: AudioContext, h: string): Promise<AudioBuffer | null> {
    let p = this.cache.get(h);
    if (!p) {
      const f = this.man!.lines[h].f;
      p = fetch(this.base + f)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
        .then((b) => ctx.decodeAudioData(b))
        .catch(() => null);
      this.cache.set(h, p);
    }
    return p;
  }

  prefetch(ctx: AudioContext | null, texts: string[]): void {
    if (!ctx || !this.man) return;
    for (const t of texts) {
      const h = fnv1a(t);
      if (this.man.lines[h]) void this.buffer(ctx, h);
    }
  }

  /**
   * Queue the clip for `text` after whatever is playing. Returns its duration, or null if
   * there is no clip (the caller then uses speech synthesis). `onFail` runs if it can't load.
   */
  play(ctx: AudioContext, text: string, onFail: () => void): number | null {
    const h = fnv1a(text);
    const e = this.man?.lines[h];
    if (!e) return null;
    if (!this.gain) {
      this.gain = ctx.createGain();
      this.gain.gain.value = VOICE_GAIN;
      this.gain.connect(ctx.destination);
    }
    const at = Math.max(ctx.currentTime + 0.05, this.nextAt);
    this.nextAt = at + e.d + GAP;
    const epoch = this.epoch;
    void this.buffer(ctx, h).then((buf) => {
      if (epoch !== this.epoch) return;
      if (!buf) return onFail();
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(this.gain!);
      src.start(Math.max(at, ctx.currentTime));
      src.onended = () => (this.playing = this.playing.filter((s) => s !== src));
      this.playing.push(src);
    });
    return e.d + GAP;
  }

  stop(): void {
    this.epoch++;
    this.nextAt = 0;
    for (const s of this.playing) {
      try {
        s.stop();
      } catch {
        /* already stopped */
      }
    }
    this.playing = [];
  }
}
