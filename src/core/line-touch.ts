/**
 * Touching a glowing line on the palm, with no physics (design pack §1.3):
 * the other hand's fingertip is projected into palm (a, b) space once, then
 * compared with each line's polyline. Distances are in metres on the skin.
 *
 * LineToucher adds the feel: hover (finger near), touch (on the skin), and
 * select (a short dwell while touching, or a pinch near the line), with
 * hysteresis so a finger on the edge doesn't flicker, and a grace period so
 * a one-frame tracking drop doesn't cancel a hover.
 * Pure: node tests drive it with synthetic frames.
 */
import type { PalmFrame, V3 } from './palm-frame.js';
import type { AB } from './line-shapes.js';

export interface TouchLine<Id extends string = string> {
  id: Id;
  /** resampled polylines in (a, b), with the cumulative length 0..1 of each point */
  strokes: { pts: AB[]; u: number[] }[];
}

export interface LineHit<Id extends string = string> {
  id: Id;
  /** lateral distance on the palm plane, metres */
  dist: number;
  /** height of the fingertip above the skin, metres (negative: through it) */
  h: number;
  /** where along the line, 0..1 */
  u: number;
}

/**
 * Nearest line to world point `p`. Works directly in world space so the palm's
 * non-uniform (length × width) scale is honoured. No allocation besides the result.
 */
export function nearestLine<Id extends string>(f: PalmFrame, p: V3, lines: readonly TouchLine<Id>[], out?: LineHit<Id>): LineHit<Id> | null {
  const dx = p[0] - f.O[0], dy = p[1] - f.O[1], dz = p[2] - f.O[2];
  const h = dx * f.N[0] + dy * f.N[1] + dz * f.N[2];
  // the fingertip dropped onto the palm plane
  const px = dx - h * f.N[0], py = dy - h * f.N[1], pz = dz - h * f.N[2];
  let best = Infinity, bestId: Id | null = null, bestU = 0;
  for (const line of lines) {
    for (const s of line.strokes) {
      const pts = s.pts;
      for (let i = 0; i < pts.length - 1; i++) {
        // segment endpoints relative to O (on the plane)
        const ax = pts[i][0] * f.Ey[0] + pts[i][1] * f.Ex[0], ay = pts[i][0] * f.Ey[1] + pts[i][1] * f.Ex[1], az = pts[i][0] * f.Ey[2] + pts[i][1] * f.Ex[2];
        const bx = pts[i + 1][0] * f.Ey[0] + pts[i + 1][1] * f.Ex[0], by = pts[i + 1][0] * f.Ey[1] + pts[i + 1][1] * f.Ex[1], bz = pts[i + 1][0] * f.Ey[2] + pts[i + 1][1] * f.Ex[2];
        const sx = bx - ax, sy = by - ay, sz = bz - az;
        const ss = sx * sx + sy * sy + sz * sz || 1e-12;
        let t = ((px - ax) * sx + (py - ay) * sy + (pz - az) * sz) / ss;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const ex = px - ax - t * sx, ey = py - ay - t * sy, ez = pz - az - t * sz;
        const d = Math.sqrt(ex * ex + ey * ey + ez * ez);
        if (d < best) {
          best = d;
          bestId = line.id;
          bestU = s.u[i] + (s.u[i + 1] - s.u[i]) * t;
        }
      }
    }
  }
  if (bestId === null) return null;
  const r = out ?? ({} as LineHit<Id>);
  r.id = bestId;
  r.dist = best;
  r.h = h;
  r.u = bestU;
  return r;
}

export const TOUCH = {
  /** hover: fingertip within this height above the skin … */
  hoverH: 0.035,
  /** … and this close to the line on the palm (enter / leave, hysteresis) */
  hoverIn: 0.011,
  hoverOut: 0.017,
  /** touching the skin: height band (tracking puts the tip a little "through" the palm) */
  touchH: 0.012,
  touchBelow: -0.03,
  /** touch held this long selects (kills accidental brushes) */
  dwell: 0.25,
  /** another line must be this much nearer than the hovered one to take the hover over (lines run close near the wrist) */
  switchMargin: 0.004,
  /** keep a hover alive this long after the finger leaves or tracking drops */
  grace: 0.2,
  /** a pinch this close to a line (pinch point to line, metres) selects it */
  pinchNear: 0.025,
};

export type TouchEvent<Id extends string> =
  | { kind: 'hover'; id: Id }
  | { kind: 'unhover'; id: Id }
  | { kind: 'touch'; id: Id; u: number }
  | { kind: 'select'; id: Id; u: number; by: 'touch' | 'pinch' };

/** Hover → touch → select state with hysteresis, dwell and a grace period. */
export class LineToucher<Id extends string = string> {
  hover: Id | null = null;
  /** 0..1 proximity of the hovering finger (1 = on the line) */
  proximity = 0;
  u = 0;
  touching = false;
  private touchT = 0;
  private selected = false;
  private lostT = 0;
  private wasPinching = false;

  reset(): void {
    this.hover = null;
    this.proximity = 0;
    this.touching = false;
    this.touchT = 0;
    this.selected = false;
    this.lostT = 0;
    this.wasPinching = false;
  }

  /**
   * One frame. `tip` is the toucher's fingertip hit (null if not tracked / no lines);
   * `pinch` is the hit of the pinch point when that hand is pinching (null otherwise).
   * `cur` is the fingertip's hit against the hovered line only (null if nothing is hovered):
   * the hovered line keeps the hover unless another is clearly nearer, and a pinch opens the
   * hovered line, the one lit up, never whatever is nearest the thumb–index midpoint.
   */
  step(dt: number, tip: LineHit<Id> | null, pinch: LineHit<Id> | null, events: TouchEvent<Id>[], cur: LineHit<Id> | null = null): void {
    events.length = 0;
    if (cur && cur.id !== this.hover) cur = null;
    // pinch: select on the rising edge; the hovered line wins
    const pinching = !!pinch;
    if (pinch && !this.wasPinching && this.hover && cur && cur.dist < TOUCH.pinchNear && Math.abs(cur.h) < 0.05) {
      events.push({ kind: 'select', id: this.hover, u: cur.u, by: 'pinch' });
      this.selected = true;
    } else if (pinch && !this.wasPinching && pinch.dist < TOUCH.pinchNear && Math.abs(pinch.h) < 0.05) {
      if (this.hover !== pinch.id) {
        if (this.hover) events.push({ kind: 'unhover', id: this.hover });
        this.hover = pinch.id;
        events.push({ kind: 'hover', id: pinch.id });
      }
      events.push({ kind: 'select', id: pinch.id, u: pinch.u, by: 'pinch' });
      this.selected = true;
    }
    this.wasPinching = pinching;

    const inBand = !!tip && tip.h < TOUCH.hoverH && tip.h > TOUCH.touchBelow;
    // hysteresis between lines: stay on the hovered one unless another is nearer by switchMargin
    if (inBand && cur && tip!.id !== this.hover && cur.dist < TOUCH.hoverOut && tip!.dist + TOUCH.switchMargin > cur.dist) tip = cur;
    const keep = inBand && tip!.id === this.hover && tip!.dist < TOUCH.hoverOut;
    const enter = inBand && tip!.dist < TOUCH.hoverIn;
    if (keep || (enter && tip!.id === this.hover)) {
      this.lostT = 0;
    } else if (enter) {
      if (this.hover) events.push({ kind: 'unhover', id: this.hover });
      this.hover = tip!.id;
      this.lostT = 0;
      this.touchT = 0;
      this.touching = false;
      this.selected = false;
      events.push({ kind: 'hover', id: tip!.id });
    } else if (this.hover) {
      this.lostT += dt;
      this.touching = false;
      this.touchT = 0;
      if (this.lostT > TOUCH.grace) {
        events.push({ kind: 'unhover', id: this.hover });
        this.hover = null;
        this.selected = false;
        this.proximity = 0;
      }
      return;
    }
    if (!this.hover || !tip || tip.id !== this.hover) return;
    this.u = tip.u;
    this.proximity = Math.max(0, Math.min(1, 1 - Math.max(0, tip.h) / TOUCH.hoverH)) * Math.max(0, 1 - tip.dist / TOUCH.hoverOut);
    const onSkin = tip.h < TOUCH.touchH && tip.dist < TOUCH.hoverIn * 1.3;
    if (onSkin && !this.touching) {
      this.touching = true;
      this.touchT = 0;
      events.push({ kind: 'touch', id: tip.id, u: tip.u });
    } else if (!onSkin) {
      this.touching = false;
      this.touchT = 0;
      this.selected = false;
    }
    if (this.touching) {
      this.touchT += dt;
      if (!this.selected && this.touchT >= TOUCH.dwell) {
        this.selected = true;
        events.push({ kind: 'select', id: tip.id, u: tip.u, by: 'touch' });
      }
    }
  }
}
