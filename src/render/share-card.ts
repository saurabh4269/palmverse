/**
 * Paints the share card (layout in core/share-layout.ts) on an aged-paper
 * canvas: grain, foxed edges, a double gold rule, and the user's chosen line
 * shapes drawn as a palm diagram. No photo of the palm exists or is used.
 */
import type { LineChoices, LineId } from '../content/types.js';
import { shapeFor, smoothStroke } from '../core/line-shapes.js';
import { CARD_H, CARD_W, type CardData, layoutCard } from '../core/share-layout.js';
import { LINE_COLORS } from './palm-overlay.js';

const OUTLINE: [number, number][] = [
  [0.0, -0.42], [0.18, -0.6], [0.5, -0.66], [0.82, -0.62], [0.97, -0.5], [1.03, -0.3], [1.05, 0.0], [1.03, 0.33], [0.97, 0.66],
  [0.7, 0.78], [0.4, 0.74], [0.12, 0.55], [0.0, 0.3],
];
const FINGERS: { base: [number, number]; len: number }[] = [
  { base: [1.0, -0.37], len: 0.62 },
  { base: [1.06, 0.0], len: 0.7 },
  { base: [1.04, 0.32], len: 0.64 },
  { base: [0.97, 0.63], len: 0.48 },
];

function paper(g: CanvasRenderingContext2D): void {
  const W = CARD_W, H = CARD_H;
  const base = g.createRadialGradient(W / 2, H * 0.45, 100, W / 2, H / 2, H * 0.75);
  base.addColorStop(0, '#f6e7c4');
  base.addColorStop(0.7, '#ecd39f');
  base.addColorStop(1, '#c99b5e');
  g.fillStyle = base;
  g.fillRect(0, 0, W, H);
  // grain + foxing (deterministic pseudo-random)
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = `rgba(110,70,30,${0.03 + rnd() * 0.05})`;
    g.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 2, 1 + rnd() * 2);
  }
  for (let i = 0; i < 18; i++) {
    const x = rnd() * W, y = rnd() * H, r = 10 + rnd() * 40;
    const f = g.createRadialGradient(x, y, 0, x, y, r);
    f.addColorStop(0, 'rgba(150,90,40,0.10)');
    f.addColorStop(1, 'rgba(150,90,40,0)');
    g.fillStyle = f;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  g.strokeStyle = '#a4702c';
  g.lineWidth = 6;
  g.strokeRect(36, 36, W - 72, H - 72);
  g.lineWidth = 2;
  g.strokeRect(50, 50, W - 100, H - 100);
  // corner lotuses
  for (const [cx, cy] of [[50, 50], [W - 50, 50], [50, H - 50], [W - 50, H - 50]]) {
    g.fillStyle = '#a4702c';
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      g.beginPath();
      g.ellipse(cx + Math.cos(a) * 14, cy + Math.sin(a) * 14, 9, 4, a, 0, Math.PI * 2);
      g.fill();
    }
  }
}

function palmDiagram(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, choices: LineChoices, mirror: boolean): void {
  const sc = Math.min(w / 2.1, h / 1.85);
  const cx = x + w / 2, top = y + 4;
  const P = (a: number, b: number): [number, number] => [cx + (mirror ? b : -b) * sc, top + (1.78 - a) * sc];
  g.save();
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.strokeStyle = 'rgba(122,60,20,0.75)';
  g.fillStyle = 'rgba(255,240,210,0.55)';
  g.lineWidth = 3;
  for (const f of FINGERS) {
    const [x0, y0] = P(f.base[0], f.base[1]);
    const [x1, y1] = P(f.base[0] + f.len, f.base[1] * 1.12);
    g.lineWidth = sc * 0.2;
    g.strokeStyle = 'rgba(122,60,20,0.18)';
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
    g.stroke();
  }
  g.beginPath();
  let [px, py] = P(0.3, -0.62);
  g.moveTo(px, py);
  [px, py] = P(0.85, -1.05);
  g.lineTo(px, py);
  g.stroke();
  g.beginPath();
  OUTLINE.forEach(([a, b], i) => {
    const [qx, qy] = P(a, b);
    if (i) g.lineTo(qx, qy);
    else g.moveTo(qx, qy);
  });
  g.closePath();
  g.fill();
  g.lineWidth = 3;
  g.strokeStyle = 'rgba(122,60,20,0.7)';
  g.stroke();
  const draw = (id: LineId, v: string | undefined) => {
    for (const s of shapeFor(id, v)) {
      const { pts } = smoothStroke(s, 6);
      for (const [lw, col] of [[10, LINE_COLORS[id] + 'aa'], [3.5, '#5a1e08']] as const) {
        g.beginPath();
        pts.forEach(([a, b], i) => {
          const [qx, qy] = P(a, b);
          if (i) g.lineTo(qx, qy);
          else g.moveTo(qx, qy);
        });
        g.strokeStyle = col;
        g.lineWidth = lw;
        g.stroke();
      }
    }
  };
  draw('life', choices.life);
  draw('head', choices.head);
  draw('heart', choices.heart);
  draw('fate', choices.fate);
  g.restore();
}

export function renderShareCard(d: CardData, choices: LineChoices): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = CARD_W;
  c.height = CARD_H;
  const g = c.getContext('2d')!;
  paper(g);
  const measure = (t: string, font: string) => {
    g.font = font;
    return g.measureText(t).width;
  };
  for (const op of layoutCard(d, measure)) {
    if (op.kind === 'text') {
      g.font = op.font;
      g.fillStyle = op.color;
      g.textAlign = op.align;
      g.textBaseline = 'alphabetic';
      g.fillText(op.text, op.x, op.y);
    } else if (op.kind === 'dot') {
      g.beginPath();
      g.arc(op.x, op.y, op.r, 0, Math.PI * 2);
      g.fillStyle = op.color;
      g.fill();
      g.strokeStyle = 'rgba(90,30,8,0.6)';
      g.lineWidth = 2;
      g.stroke();
    } else {
      palmDiagram(g, op.x, op.y, op.w, op.h, choices, d.side === 'left');
    }
  }
  return c;
}
