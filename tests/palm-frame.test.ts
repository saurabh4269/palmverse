/** Palm frame maths: a synthetic hand with known joints → expected frame, mount centroids, round trips. */
import regions from '../src/data/palm-regions.json';
import { classifyElement, measureOnce, profileFrom, aggregate } from '../src/core/measure.js';
import { facing, isHeldPalm, isReadablePalm, J, type Joints, palmFrame, q, toPalm, type V3 } from '../src/core/palm-frame.js';
import { check, done } from './harness.js';

const near = (a: number, b: number, e = 1e-6) => Math.abs(a - b) < e;
const nearV = (a: V3, b: V3, e = 1e-6) => a.every((x, i) => near(x, b[i], e));

/**
 * A right hand held up in front of the eye (eye at origin, looking −Z), palm facing +Z (toward the eye):
 * fingers point +Y, thumb on the viewer's right (+X), pinky on the left (−X).
 * Palm length 9 cm (wrist → middle knuckle), knuckle row 7 cm wide.
 */
export function syntheticHand(side: 'left' | 'right', opts: { palmW?: number; palmL?: number; fingerL?: number; at?: V3 } = {}): Joints {
  const W = opts.palmW ?? 0.07, L = opts.palmL ?? 0.09, F = opts.fingerL ?? 0.08, at = opts.at ?? [0, -0.2, -0.35];
  const sx = side === 'right' ? 1 : -1; // thumb toward +X for the right hand
  const j: Joints = Array.from({ length: 25 }, () => [0, 0, 0] as V3);
  const P = (x: number, y: number): V3 => [at[0] + sx * x, at[1] + y, at[2]];
  j[J.wrist] = P(0, 0);
  const knuckles: [string, number, number][] = [['index', W / 2, 0.97], ['middle', W / 6, 1.0], ['ring', -W / 6, 0.98], ['pinky', -W / 2, 0.9]];
  const lens: Record<string, number> = { index: 0.92, middle: 1.0, ring: 0.95, pinky: 0.75 };
  for (const [f, x, ky] of knuckles) {
    const base = f === 'middle' ? L : L * ky;
    const fl = F * lens[f];
    j[J[`${f}-finger-metacarpal` as keyof typeof J]] = P(x * 0.6, L * 0.3);
    j[J[`${f}-finger-phalanx-proximal` as keyof typeof J]] = P(f === 'middle' ? 0 : x, base);
    j[J[`${f}-finger-phalanx-intermediate` as keyof typeof J]] = P(x, base + fl * 0.45);
    j[J[`${f}-finger-phalanx-distal` as keyof typeof J]] = P(x, base + fl * 0.75);
    j[J[`${f}-finger-tip` as keyof typeof J]] = P(x, base + fl);
  }
  // re-centre the knuckle row so middle is at x=0 and index/pinky are ±W/2 apart in total
  j[J['index-finger-phalanx-proximal']] = P(W * 0.4, L * 0.97);
  j[J['pinky-finger-phalanx-proximal']] = P(-W * 0.6, L * 0.9);
  j[J['thumb-metacarpal']] = P(0.02, 0.01);
  j[J['thumb-phalanx-proximal']] = P(0.035, 0.03);
  j[J['thumb-phalanx-distal']] = P(0.05, 0.05);
  j[J['thumb-tip']] = P(0.06, 0.07);
  return j;
}

const eye: V3 = [0, 0, 0];
for (const side of ['right', 'left'] as const) {
  const j = syntheticHand(side);
  const f = palmFrame(j, side);
  check(`${side}: palm normal points to the eye`, f.N[2] > 0.99, JSON.stringify(f.N));
  check(`${side}: facing ≈ 1`, facing(f, eye) > 0.9, String(facing(f, eye)));
  check(`${side}: readable`, isReadablePalm(f, eye));
  check(`${side}: length 9 cm`, near(f.length, 0.09, 1e-9));
  check(`${side}: q(0,0) = wrist`, nearV(q(f, 0, 0), j[J.wrist]));
  check(`${side}: q(1,0) = middle knuckle`, nearV(q(f, 1, 0), j[J['middle-finger-phalanx-proximal']]));
  check(`${side}: lift moves along N`, near(q(f, 0.5, 0.1, 0.005)[2] - q(f, 0.5, 0.1)[2], 0.005));
  // mount centroids land where anatomy says: Jupiter toward the index (thumb side), Mercury toward the pinky
  const m = Object.fromEntries((regions as { mounts: { id: string; centroid_ab: [number, number] }[] }).mounts.map((x) => [x.id, q(f, x.centroid_ab[0], x.centroid_ab[1])]));
  const thumbX = side === 'right' ? 1 : -1;
  check(`${side}: Jupiter on the thumb side of Saturn`, (m.jupiter[0] - m.saturn[0]) * thumbX > 0.015);
  check(`${side}: Mercury on the pinky side of Sun`, (m.mercury[0] - m.sun_apollo[0]) * thumbX < -0.01);
  check(`${side}: Venus low on the thumb side`, m.venus[1] < m.jupiter[1] - 0.04 && (m.venus[0] - m.saturn[0]) * thumbX > 0);
  check(`${side}: Moon low on the pinky side`, m.luna_moon[1] < m.mercury[1] - 0.04 && (m.luna_moon[0] - m.saturn[0]) * thumbX < 0);
  // expected world position of a centroid: wrist + a·Ey + b·Ex
  const sat = (regions as { mounts: { id: string; centroid_ab: [number, number] }[] }).mounts.find((x) => x.id === 'saturn')!.centroid_ab;
  const exp: V3 = [j[0][0] + sat[0] * f.Ey[0] + sat[1] * f.Ex[0], j[0][1] + sat[0] * f.Ey[1] + sat[1] * f.Ex[1], j[0][2]];
  check(`${side}: Saturn centroid exact`, nearV(m.saturn, exp, 1e-9));
  // round trip
  for (const [a, b, h] of [[0.3, -0.4, 0.01], [0.9, 0.6, -0.004], [0.5, 0.0, 0]] as const) {
    const [a2, b2, h2] = toPalm(f, q(f, a, b, h));
    check(`${side}: toPalm round trip (${a},${b},${h})`, near(a, a2, 1e-9) && near(b, b2, 1e-9) && near(h, h2, 1e-9));
  }
  // back of the hand toward the eye is not readable
  const back = palmFrame(j, side === 'right' ? 'left' : 'right');
  check(`${side}: back of hand rejected`, !isReadablePalm(back, eye));
}
// too far / too close
check('far palm rejected', !isReadablePalm(palmFrame(syntheticHand('right', { at: [0, -0.2, -0.9] }), 'right'), eye));
check('near palm rejected', !isReadablePalm(palmFrame(syntheticHand('right', { at: [0, -0.02, -0.08] }), 'right'), eye));

// element classification
check('square+short = prithvi', classifyElement(0.7, 0.8) === 'prithvi');
check('square+long = vayu', classifyElement(0.7, 1.0) === 'vayu');
check('long palm+short = agni', classifyElement(0.55, 0.8) === 'agni');
check('long palm+long = jal', classifyElement(0.55, 1.0) === 'jal');
// from joints: a wide palm with short fingers is Earth, a narrow one with long fingers Water
const earth = profileFrom(measureOnce(syntheticHand('right', { palmW: 0.09, palmL: 0.085, fingerL: 0.07 }), 'right'), 'right');
const water = profileFrom(measureOnce(syntheticHand('left', { palmW: 0.055, palmL: 0.095, fingerL: 0.1 }), 'left'), 'left');
check('wide/short hand → prithvi', earth.element === 'prithvi', JSON.stringify(earth));
check('narrow/long hand → jal', water.element === 'jal', JSON.stringify(water));
// aggregate is a median: one wild frame does not change the result
const s = measureOnce(syntheticHand('right'), 'right');
const agg = aggregate([s, s, s, { ...s, palmSquareness: 9 }, s]);
check('median ignores an outlier', near(agg.palmSquareness, s.palmSquareness));
done('palm-frame');

// hysteresis: a palm tilted to ~60° from the eye is not acquired but is kept once held; edge-on is dropped
{
  const j = syntheticHand('right');
  const f = palmFrame(j, 'right');
  const c: V3 = [(j[0][0] + j[9][0]) / 2, (j[0][1] + j[9][1]) / 2, (j[0][2] + j[9][2]) / 2];
  const tilt = (deg: number): V3 => { const r = (deg * Math.PI) / 180, d = 0.35; return [c[0] + d * Math.sin(r), c[1], c[2] + d * Math.cos(r)]; };
  check('tilt 60°: not acquired', !isReadablePalm(f, tilt(60)), String(facing(f, tilt(60))));
  check('tilt 60°: kept when held', isHeldPalm(f, tilt(60)));
  check('tilt 85°: dropped even when held', !isHeldPalm(f, tilt(85)));
  check('back of hand: dropped when held', !isHeldPalm(palmFrame(j, 'left'), tilt(0)));
}
