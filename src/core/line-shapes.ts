/**
 * Layer 2 geometry: the candidate shapes for each major line, in palm-frame
 * (a, b) coordinates. They are variations on the mean heart/head/life
 * centrelines in data/palm-regions.json (399 palms) and stay inside each
 * line's corridor; the end points sit in the corridor's named end anchors
 * (e.g. heart: under Jupiter / between Jupiter and Saturn / under Saturn).
 *
 * A shape is a list of strokes (a fork or a break gives two). Strokes are
 * drawn as glowing ribbons on the real palm and as small diagrams on the
 * choice cards.
 */
import type { LineChoices, LineId } from '../content/types.js';

export type AB = [number, number];
export type Stroke = AB[];

export const LINE_VALUES: Record<LineId, string[]> = {
  heart: ['between', 'jupiter', 'saturn'],
  head: ['straight', 'sloping', 'short', 'forked'],
  join: ['joined', 'separate'],
  life: ['wide', 'hugging', 'forked', 'break'],
  fate: ['wrist', 'moon', 'midpalm', 'none'],
};

/** The order the pandit asks about the lines. */
export const LINE_ORDER: LineId[] = ['heart', 'head', 'join', 'life', 'fate'];

const HEART_BASE: Stroke = [[0.77, 0.8], [0.775, 0.6], [0.78, 0.4], [0.795, 0.25], [0.815, 0.13], [0.85, 0.04], [0.885, -0.05]];
const HEAD_START: Stroke = [[0.76, -0.56], [0.745, -0.38], [0.725, -0.18]];
const LIFE_WIDE: Stroke = [[0.78, -0.52], [0.68, -0.37], [0.56, -0.24], [0.43, -0.14], [0.3, -0.08], [0.17, -0.05], [0.04, -0.05]];

export const SHAPES: Record<LineId, Record<string, Stroke[]>> = {
  heart: {
    between: [[...HEART_BASE, [0.915, -0.14], [0.95, -0.23], [0.985, -0.29]]],
    jupiter: [[...HEART_BASE, [0.905, -0.16], [0.925, -0.3], [0.955, -0.43], [0.99, -0.52]]],
    saturn: [[[0.77, 0.8], [0.775, 0.6], [0.785, 0.4], [0.8, 0.25], [0.825, 0.12], [0.86, 0.03], [0.9, -0.03], [0.935, -0.05]]],
  },
  head: {
    straight: [[...HEAD_START, [0.71, 0.02], [0.695, 0.22], [0.68, 0.42], [0.665, 0.64]]],
    sloping: [[...HEAD_START, [0.69, -0.02], [0.63, 0.16], [0.55, 0.33], [0.45, 0.48], [0.36, 0.58]]],
    short: [[...HEAD_START, [0.705, -0.02], [0.685, 0.12], [0.67, 0.22]]],
    forked: [
      [...HEAD_START, [0.705, 0.0], [0.685, 0.18], [0.67, 0.32], [0.665, 0.52], [0.66, 0.64]],
      [[0.67, 0.32], [0.6, 0.42], [0.5, 0.52], [0.42, 0.58]],
    ],
  },
  join: {
    joined: [
      [[0.8, -0.6], [0.77, -0.52], [0.745, -0.4], [0.73, -0.25]],
      [[0.77, -0.52], [0.7, -0.42], [0.62, -0.33]],
    ],
    separate: [
      [[0.86, -0.56], [0.83, -0.45], [0.8, -0.33], [0.78, -0.2]],
      [[0.74, -0.62], [0.68, -0.48], [0.6, -0.36]],
    ],
  },
  life: {
    wide: [LIFE_WIDE],
    hugging: [[[0.78, -0.52], [0.69, -0.46], [0.58, -0.42], [0.46, -0.39], [0.34, -0.36], [0.22, -0.33], [0.1, -0.29]]],
    forked: [
      [[0.78, -0.52], [0.68, -0.37], [0.56, -0.24], [0.43, -0.15], [0.3, -0.1], [0.17, -0.08], [0.05, -0.08]],
      [[0.3, -0.1], [0.22, 0.02], [0.15, 0.14], [0.1, 0.26]],
    ],
    break: [
      [[0.78, -0.52], [0.68, -0.37], [0.56, -0.24], [0.48, -0.18]],
      [[0.45, -0.12], [0.34, -0.06], [0.2, -0.03], [0.06, -0.03]],
    ],
  },
  fate: {
    wrist: [[[0.03, 0.05], [0.25, 0.05], [0.5, 0.045], [0.72, 0.03], [0.9, 0.0]]],
    moon: [[[0.12, 0.42], [0.28, 0.3], [0.46, 0.18], [0.66, 0.07], [0.9, 0.0]]],
    midpalm: [[[0.48, 0.06], [0.64, 0.045], [0.78, 0.025], [0.9, 0.0]]],
    none: [],
  },
};

/** The tradition's "map": the average shape drawn when the lines first glow, before the user confirms theirs. */
export const TEMPLATE: Required<Omit<LineChoices, 'join'>> = {
  heart: 'between',
  head: 'sloping',
  life: 'wide',
  fate: 'wrist',
};

export function shapeFor(line: LineId, value: string | undefined): Stroke[] {
  if (!value) return [];
  return SHAPES[line][value] ?? [];
}

/** Catmull-Rom resample of a stroke into `n` evenly spaced points (a, b) plus cumulative length 0..1. */
export function smoothStroke(s: Stroke, perSeg = 8): { pts: AB[]; u: number[] } {
  if (s.length < 2) return { pts: s.slice(), u: s.map(() => 0) };
  const pts: AB[] = [];
  const P = (i: number): AB => s[Math.max(0, Math.min(s.length - 1, i))];
  for (let i = 0; i < s.length - 1; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    for (let k = 0; k < perSeg; k++) {
      const t = k / perSeg, t2 = t * t, t3 = t2 * t;
      const f = (c: 0 | 1) =>
        0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3);
      pts.push([f(0), f(1)]);
    }
  }
  pts.push(s[s.length - 1]);
  const u = [0];
  for (let i = 1; i < pts.length; i++) u.push(u[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = u[u.length - 1] || 1;
  return { pts, u: u.map((x) => x / total) };
}
