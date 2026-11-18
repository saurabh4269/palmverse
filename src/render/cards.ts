/**
 * Poke-able canvas cards: the "Continue" style buttons and the line-shape
 * choice cards. Canvas, not UIKit, because the cards carry Devanagari and
 * small palm diagrams.
 *
 * Poke test after ui-text.md (hands-of-a-master): a fingertip that crosses the
 * card plane from the front inside the rectangle presses it; a fingertip
 * resting within ~3 cm in front of it hovers (used to preview a line shape on
 * the real palm). Hidden cards never press (the "hidden elements still take a
 * custom poke" pitfall).
 */
import {
  CanvasTexture,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  Vector3,
} from '@iwsdk/core';
import type { LineId } from '../content/types.js';
import { smoothStroke, type Stroke } from '../core/line-shapes.js';
import { LINE_COLORS } from './palm-overlay.js';
import { FONT_BODY, FONT_DISPLAY } from './text.js';

export class PokeCard {
  readonly mesh: Mesh;
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly tex: CanvasTexture;
  readonly mat: MeshBasicMaterial;
  readonly w: number;
  readonly h: number;
  enabled = false;
  hover = 0; // 0..1 eased
  hovering = false;
  pressedNow = false;
  /** a card only takes input after every fingertip has been clear of it (no carry-over presses) */
  armed = false;
  pressFlash = 0;
  private alpha = 0;
  private alphaTarget = 0;
  private lastDepth = [1, 1];
  private cooldown = 0;
  private readonly tmp = new Vector3();
  private readonly nrm = new Vector3();
  private readonly ax = new Vector3();
  private readonly ay = new Vector3();
  private readonly base = new Vector3();

  constructor(
    readonly id: string,
    w: number,
    h: number,
    px = 512,
  ) {
    this.w = w;
    this.h = h;
    this.canvas = document.createElement('canvas');
    this.canvas.width = px;
    this.canvas.height = Math.round((px * h) / w);
    this.ctx = this.canvas.getContext('2d')!;
    this.tex = new CanvasTexture(this.canvas);
    this.tex.colorSpace = SRGBColorSpace;
    this.tex.minFilter = LinearFilter;
    this.tex.generateMipmaps = false;
    this.mat = new MeshBasicMaterial({ map: this.tex, transparent: true, depthWrite: false, toneMapped: false, opacity: 0 });
    this.mesh = new Mesh(new PlaneGeometry(w, h), this.mat);
    this.mesh.name = `card-${id}`;
    this.mesh.renderOrder = 12;
    this.mesh.visible = false;
  }

  show(on: boolean): void {
    if (on && !this.enabled) this.armed = false;
    this.alphaTarget = on ? 1 : 0;
    this.enabled = on;
    if (on) this.mesh.visible = true;
  }

  /**
   * @returns true on the frame the card is pressed.
   * tips: fingertip world positions (null = hand not tracked)
   */
  update(dt: number, tips: (Vector3 | null)[]): boolean {
    this.alpha += (this.alphaTarget - this.alpha) * (1 - Math.exp(-dt * 9));
    this.mat.opacity = this.alpha;
    this.mesh.visible = this.alpha > 0.01;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.pressFlash = Math.max(0, this.pressFlash - dt * 3);
    let pressed = false;
    let hov = false;
    if (this.enabled && this.alpha > 0.6) {
      this.mesh.updateWorldMatrix(true, false);
      const e = this.mesh.matrixWorld.elements;
      this.base.set(e[12], e[13], e[14]);
      this.ax.set(e[0], e[1], e[2]);
      this.ay.set(e[4], e[5], e[6]);
      this.nrm.set(e[8], e[9], e[10]).normalize();
      const sx = this.ax.length(), sy = this.ay.length();
      this.ax.normalize();
      this.ay.normalize();
      let near = false;
      for (let i = 0; i < tips.length; i++) {
        const t = tips[i];
        if (!t) {
          this.lastDepth[i] = 1;
          continue;
        }
        this.tmp.subVectors(t, this.base);
        const depth = this.tmp.dot(this.nrm);
        const lx = this.tmp.dot(this.ax) / (sx * this.w);
        const ly = this.tmp.dot(this.ay) / (sy * this.h);
        const over = Math.abs(lx) <= 0.55 && Math.abs(ly) <= 0.58;
        if (Math.abs(lx) <= 0.7 && Math.abs(ly) <= 0.7 && depth < 0.05 && depth > -0.05) near = true;
        if (!this.armed) {
          this.lastDepth[i] = depth;
          continue;
        }
        if (over && depth < 0.035 && depth > -0.03) hov = true;
        if (over && this.lastDepth[i] > 0.004 && depth <= 0.004 && depth > -0.03 && this.cooldown <= 0) {
          pressed = true;
          this.cooldown = 0.7;
          this.pressFlash = 1;
        }
        this.lastDepth[i] = depth;
      }
      if (!near) this.armed = true;
    }
    this.hovering = hov;
    this.hover += ((hov ? 1 : 0) - this.hover) * (1 - Math.exp(-dt * 12));
    const s = 1 + this.hover * 0.06 + this.pressFlash * 0.04;
    this.mesh.scale.setScalar(s);
    return pressed;
  }

  /** Press programmatically (dev keys, desktop clicks): same path as a poke. */
  press(): boolean {
    if (!this.enabled || this.cooldown > 0) return false;
    this.cooldown = 0.7;
    this.pressFlash = 1;
    return true;
  }

  /** Card face: parchment with a gold border, optional title. */
  protected paintFrame(selected = false): void {
    const { ctx: g, canvas: c } = this;
    const W = c.width, H = c.height;
    g.clearRect(0, 0, W, H);
    const r = W * 0.06;
    const path = () => {
      g.beginPath();
      g.moveTo(r, 4);
      g.arcTo(W - 4, 4, W - 4, H - 4, r);
      g.arcTo(W - 4, H - 4, 4, H - 4, r);
      g.arcTo(4, H - 4, 4, 4, r);
      g.arcTo(4, 4, W - 4, 4, r);
      g.closePath();
    };
    path();
    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, 'rgba(46,20,10,0.95)');
    grad.addColorStop(1, 'rgba(22,8,5,0.95)');
    g.fillStyle = grad;
    g.fill();
    g.lineWidth = selected ? 12 : 6;
    g.strokeStyle = selected ? '#ffd27a' : 'rgba(226,176,92,0.95)';
    g.stroke();
    g.lineWidth = 2;
    g.strokeStyle = 'rgba(226,176,92,0.45)';
    g.strokeRect(18, 18, W - 36, H - 36);
  }
}

/** A text button, e.g. "Continue ›" with a Hindi sub-label. */
export class TextButton extends PokeCard {
  constructor(id: string, label: string, sub = '', w = 0.16, h = 0.06) {
    super(id, w, h, 512);
    this.setLabel(label, sub);
  }

  setLabel(label: string, sub = ''): void {
    this.paintFrame();
    const g = this.ctx, W = this.canvas.width, H = this.canvas.height;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#fff1d0';
    g.font = `700 ${Math.round(H * (sub ? 0.36 : 0.44))}px ${FONT_BODY}`;
    g.fillText(label, W / 2, sub ? H * 0.4 : H * 0.53);
    if (sub) {
      g.fillStyle = '#f2c46c';
      g.font = `600 ${Math.round(H * 0.24)}px ${FONT_BODY}`;
      g.fillText(sub, W / 2, H * 0.74);
    }
    this.tex.needsUpdate = true;
  }
}

/** Mean landmark outline of a palm in (a, b) (palm-regions.json frame.mean_landmarks_ab), for card diagrams. */
const PALM_OUTLINE: [number, number][] = [
  [0.0, -0.42], [0.18, -0.6], [0.5, -0.66], [0.82, -0.62], [0.97, -0.5], [1.03, -0.3], [1.05, 0.0], [1.03, 0.33], [0.97, 0.66],
  [0.7, 0.78], [0.4, 0.74], [0.12, 0.55], [0.0, 0.3],
];
const FINGERS: { base: [number, number]; len: number }[] = [
  { base: [1.0, -0.37], len: 0.62 },
  { base: [1.06, 0.0], len: 0.7 },
  { base: [1.04, 0.32], len: 0.64 },
  { base: [0.97, 0.63], len: 0.48 },
];

/**
 * The card's palm: a palm-up right hand rendered from the MakeHuman/MPFB human (tools/palm/,
 * public/ui/palm-right.{webp,json}). Its joint pixels map the palm frame (a, b) onto the image:
 * a = 0 at the wrist and 1 at the middle knuckle, b from the index knuckle (−0.37) to the little
 * finger's (+0.63), as in palm-regions.json. Until it loads, cards draw the old sketch.
 */
const PALM_IMG = { img: null as HTMLImageElement | null, w: 512, h: 640, W: [222.3, 537.9], A: [1.5, -280.1], B: [-176, 43.6] };
const waitingCards = new Set<ShapeCard>();
if (typeof Image !== 'undefined') {
  const img = new Image();
  img.onload = () => {
    PALM_IMG.img = img;
    for (const c of waitingCards) c.paint();
    waitingCards.clear();
  };
  img.src = `${import.meta.env.BASE_URL}ui/palm-right.webp`;
  void fetch(`${import.meta.env.BASE_URL}ui/palm-right.json`)
    .then((r) => r.json())
    .then((j: { size: [number, number]; points: Record<string, [number, number]> }) => {
      const p = j.points;
      PALM_IMG.w = j.size[0];
      PALM_IMG.h = j.size[1];
      PALM_IMG.W = p.wrist;
      PALM_IMG.A = [p.middle_mcp[0] - p.wrist[0], p.middle_mcp[1] - p.wrist[1]];
      PALM_IMG.B = [p.pinky_mcp[0] - p.index_mcp[0], p.pinky_mcp[1] - p.index_mcp[1]];
    })
    .catch(() => {});
}

/** A choice card: a small palm diagram with the candidate line and a plain label. */
export class ShapeCard extends PokeCard {
  selected = false;
  constructor(
    id: string,
    readonly line: LineId,
    readonly value: string,
    readonly strokes: Stroke[],
    readonly label: string,
  ) {
    super(id, 0.095, 0.124, 448);
    this.paint();
  }

  paint(): void {
    this.paintFrame(this.selected);
    const g = this.ctx, W = this.canvas.width, H = this.canvas.height;
    // palm-frame (a, b) → canvas: fingers up, thumb side on the right as you see your own right palm
    const cx = W * 0.5, top = H * 0.08, sc = W * 0.36;
    let P = (a: number, b: number): [number, number] => [cx - b * sc, top + (1.75 - a) * sc];
    g.save();
    g.lineJoin = 'round';
    g.lineCap = 'round';
    const im = PALM_IMG.img;
    if (!im) waitingCards.add(this);
    if (im) {
      // the rendered palm, fitted above the label
      const ih = H * 0.74, k = ih / PALM_IMG.h, iw = PALM_IMG.w * k, ix = (W - iw) / 2, iy = H * 0.035;
      g.drawImage(im, ix, iy, iw, ih);
      const { W: O, A, B } = PALM_IMG;
      P = (a, b) => [ix + k * (O[0] + a * A[0] + b * B[0]), iy + k * (O[1] + a * A[1] + b * B[1])];
    } else {
    // fingers
    g.strokeStyle = 'rgba(236,206,160,0.42)';
    g.lineWidth = W * 0.07;
    for (const f of FINGERS) {
      const [x0, y0] = P(f.base[0], f.base[1]);
      const [x1, y1] = P(f.base[0] + f.len, f.base[1] * 1.1);
      g.beginPath();
      g.moveTo(x0, y0);
      g.lineTo(x1, y1);
      g.stroke();
    }
    // thumb
    g.beginPath();
    let [x, y] = P(0.3, -0.62);
    g.moveTo(x, y);
    [x, y] = P(0.85, -1.05);
    g.lineTo(x, y);
    g.lineWidth = W * 0.08;
    g.stroke();
    // palm
    g.beginPath();
    PALM_OUTLINE.forEach(([a, b], i) => {
      const [px, py] = P(a, b);
      if (i) g.lineTo(px, py);
      else g.moveTo(px, py);
    });
    g.closePath();
    g.fillStyle = 'rgba(236,206,160,0.3)';
    g.fill();
    g.strokeStyle = 'rgba(236,206,160,0.5)';
    g.lineWidth = 2;
    g.stroke();
    }
    // candidate line(s)
    const col = LINE_COLORS[this.line];
    if (this.strokes.length === 0) {
      g.setLineDash([6, 10]);
      g.strokeStyle = 'rgba(160,255,190,0.35)';
      g.lineWidth = 4;
      g.beginPath();
      const [ax, ay] = P(0.05, 0.05), [bx, by] = P(0.9, 0.0);
      g.moveTo(ax, ay);
      g.lineTo(bx, by);
      g.stroke();
      g.setLineDash([]);
    }
    for (const s of this.strokes) {
      const { pts } = smoothStroke(s, 6);
      for (const [lw, st] of [[W * 0.075, col + '66'], [W * 0.034, col], [W * 0.012, '#fffbea']] as const) {
        g.beginPath();
        pts.forEach(([a, b], i) => {
          const [px, py] = P(a, b);
          if (i) g.lineTo(px, py);
          else g.moveTo(px, py);
        });
        g.strokeStyle = st;
        g.lineWidth = lw;
        g.stroke();
      }
    }
    g.restore();
    // label
    g.fillStyle = '#fff1d0';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const words = this.label.split(' ');
    const lines: string[] = [];
    let cur = '';
    g.font = `700 ${Math.round(W * 0.098)}px ${FONT_BODY}`;
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w;
      if (g.measureText(next).width > W * 0.84 && cur) {
        lines.push(cur);
        cur = w;
      } else cur = next;
    }
    if (cur) lines.push(cur);
    lines.slice(0, 2).forEach((l, i) => g.fillText(l, W / 2, H * (lines.length > 1 ? 0.82 : 0.87) + i * W * 0.115));
    this.tex.needsUpdate = true;
  }

  setSelected(on: boolean): void {
    if (this.selected === on) return;
    this.selected = on;
    this.paint();
  }
}

/** A floating title plate for a mount: Devanagari name, roman name, planet. */
export class MountPlate {
  readonly card: PokeCard;
  constructor() {
    this.card = new PokeCard('mount-plate', 0.17, 0.062, 640);
  }
  set(nameHi: string, roman: string, planet: string, short: string): void {
    const g = this.card.ctx, W = this.card.canvas.width, H = this.card.canvas.height;
    g.clearRect(0, 0, W, H);
    g.fillStyle = 'rgba(24,9,5,0.82)';
    g.beginPath();
    g.roundRect(4, 4, W - 8, H - 8, 26);
    g.fill();
    g.strokeStyle = 'rgba(232,188,98,0.95)';
    g.lineWidth = 4;
    g.stroke();
    g.textBaseline = 'middle';
    g.textAlign = 'left';
    // every run is measured and shrunk to fit: names and glosses vary a lot in length
    const fit = (text: string, maxW: number, px: number, font: (n: number) => string): void => {
      let n = px;
      g.font = font(n);
      while (n > 10 && g.measureText(text).width > maxW) g.font = font(--n);
    };
    const x0 = W * 0.05, maxW = W * 0.9;
    g.fillStyle = '#ffd57a';
    fit(nameHi, maxW * 0.5, Math.round(H * 0.4), (n) => `${n}px ${FONT_DISPLAY}`);
    g.fillText(nameHi, x0, H * 0.33);
    const hiW = g.measureText(nameHi).width;
    g.fillStyle = '#fff1d0';
    const sub = `${roman} · ${planet}`;
    fit(sub, maxW - hiW - 16, Math.round(H * 0.2), (n) => `600 ${n}px ${FONT_BODY}`);
    g.fillText(sub, x0 + hiW + 16, H * 0.36);
    g.fillStyle = '#f4e3c2';
    fit(short, maxW, Math.round(H * 0.21), (n) => `500 ${n}px ${FONT_BODY}`);
    g.fillText(short, x0, H * 0.74);
    this.card.tex.needsUpdate = true;
  }
}
