/**
 * The palm frame ("joint space") from research/palm-autolabel/README.md §1:
 *
 *   q(a, b) = wrist + a·(middle-knuckle − wrist) + b·(pinky-knuckle − index-knuckle)
 *
 * a = 0 at the wrist, 1 at the middle-finger knuckle; b > 0 toward the little
 * finger, b < 0 toward the thumb, for BOTH hands (Ex flips with the hand).
 * Every mount polygon and line corridor in data/palm-regions.json lives in
 * this frame, so four tracked joints place them on any palm.
 *
 * Pure maths on plain arrays (no three.js) so `node` can unit-test it.
 */

export type V3 = [number, number, number];
export type Side = 'left' | 'right';

/** The 25 WebXR hand joints in XRHand iteration order. */
export const JOINTS = [
  'wrist',
  'thumb-metacarpal', 'thumb-phalanx-proximal', 'thumb-phalanx-distal', 'thumb-tip',
  'index-finger-metacarpal', 'index-finger-phalanx-proximal', 'index-finger-phalanx-intermediate', 'index-finger-phalanx-distal', 'index-finger-tip',
  'middle-finger-metacarpal', 'middle-finger-phalanx-proximal', 'middle-finger-phalanx-intermediate', 'middle-finger-phalanx-distal', 'middle-finger-tip',
  'ring-finger-metacarpal', 'ring-finger-phalanx-proximal', 'ring-finger-phalanx-intermediate', 'ring-finger-phalanx-distal', 'ring-finger-tip',
  'pinky-finger-metacarpal', 'pinky-finger-phalanx-proximal', 'pinky-finger-phalanx-intermediate', 'pinky-finger-phalanx-distal', 'pinky-finger-tip',
] as const;
export type JointName = (typeof JOINTS)[number];
export const J: Record<JointName, number> = Object.fromEntries(JOINTS.map((n, i) => [n, i])) as Record<JointName, number>;

export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const mul = (a: V3, s: number): V3 => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len = (a: V3): number => Math.hypot(a[0], a[1], a[2]);
export const dist = (a: V3, b: V3): number => len(sub(a, b));
export const norm = (a: V3): V3 => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

export interface PalmFrame {
  side: Side;
  O: V3;
  Ey: V3;
  Ex: V3;
  /** unit normal out of the PALM (the side with the lines) */
  N: V3;
  /** palm length |Ey| and width |Ex| in metres */
  length: number;
  width: number;
}

/** Joint positions (world, metres) by index; 25 entries. */
export type Joints = V3[];

export function palmFrame(j: Joints, side: Side): PalmFrame {
  const O = j[J.wrist];
  const Ey = sub(j[J['middle-finger-phalanx-proximal']], O);
  const Ex = sub(j[J['pinky-finger-phalanx-proximal']], j[J['index-finger-phalanx-proximal']]);
  // cross(Ey, Ex) points out of the palm for a right hand and out of the back
  // for a left hand (Ex flips with handedness), so flip it for the left.
  let N = norm(cross(Ey, Ex));
  if (side === 'left') N = mul(N, -1);
  return { side, O, Ey, Ex, N, length: len(Ey), width: len(Ex) };
}

/** World point at palm coordinates (a, b), lifted `lift` metres off the skin along the palm normal. */
export function q(f: PalmFrame, a: number, b: number, lift = 0): V3 {
  return [
    f.O[0] + a * f.Ey[0] + b * f.Ex[0] + lift * f.N[0],
    f.O[1] + a * f.Ey[1] + b * f.Ex[1] + lift * f.N[1],
    f.O[2] + a * f.Ey[2] + b * f.Ex[2] + lift * f.N[2],
  ];
}

/** Inverse of q: project a world point onto the palm plane → (a, b, height above the palm). */
export function toPalm(f: PalmFrame, p: V3): [number, number, number] {
  const d = sub(p, f.O);
  const h = dot(d, f.N);
  const dp = sub(d, mul(f.N, h));
  // solve dp = a·Ey + b·Ex (2×2 normal equations)
  const ee = dot(f.Ey, f.Ey), ex = dot(f.Ey, f.Ex), xx = dot(f.Ex, f.Ex);
  const de = dot(dp, f.Ey), dx = dot(dp, f.Ex);
  const det = ee * xx - ex * ex || 1e-12;
  return [(de * xx - dx * ex) / det, (dx * ee - de * ex) / det, h];
}

/** Palm centre (between the mounts), used for facing and distance tests. */
export function palmCentre(f: PalmFrame): V3 {
  return q(f, 0.55, 0.1);
}

/** cos of the angle between the palm normal and the direction to the eye: 1 = palm faces you squarely. */
export function facing(f: PalmFrame, eye: V3): number {
  return dot(f.N, norm(sub(eye, palmCentre(f))));
}

/** A held-up palm the app can read: facing the eye within ~55°, 18–65 cm away, plausible size. */
export function isReadablePalm(f: PalmFrame, eye: V3): boolean {
  const d = dist(eye, palmCentre(f));
  return facing(f, eye) > 0.57 && d > 0.18 && d < 0.65 && f.length > 0.05 && f.length < 0.14;
}
