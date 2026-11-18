/**
 * Layer 1: what the joints alone can measure, averaged over many frames
 * (bone lengths are estimates, so ratios are noisy: ideas-7-8.md §8.4).
 *
 * Thresholds are population medians/quartiles from palmistry-rules.json
 * (shape_elements, finger_jupiter, finger_index_vs_ring auto_detect notes),
 * measured on 2D photos; finger lengths here are sums of bone segments, which
 * is curl-invariant and close to a straight spread finger.
 */
import type { Element, HandProfile, Side, Tri } from '../content/types.js';
import { J, type Joints, dist, dot, norm, palmFrame, sub, type V3 } from './palm-frame.js';

export const THRESH = {
  squareness: 0.64, // palm width / palm length ≥ → square
  fingerLong: 0.92, // middle finger / palm length ≥ → long
  indexLow: 0.79,
  indexHigh: 0.89,
  ringLow: 0.95, // index/ring < → ring clearly longer
  ringHigh: 1.0, // index/ring > → index clearly longer
  thumbLowDeg: 25,
  thumbHighDeg: 48,
};

export interface RawMeasure {
  palmSquareness: number;
  fingerRatio: number;
  indexRatio: number;
  indexOverRing: number;
  thumbDeg: number;
}

const fingerLen = (j: Joints, f: string): number =>
  dist(j[J[`${f}-finger-phalanx-proximal` as keyof typeof J]], j[J[`${f}-finger-phalanx-intermediate` as keyof typeof J]]) +
  dist(j[J[`${f}-finger-phalanx-intermediate` as keyof typeof J]], j[J[`${f}-finger-phalanx-distal` as keyof typeof J]]) +
  dist(j[J[`${f}-finger-phalanx-distal` as keyof typeof J]], j[J[`${f}-finger-tip` as keyof typeof J]]);

export function measureOnce(j: Joints, side: Side): RawMeasure {
  const f = palmFrame(j, side);
  const middle = fingerLen(j, 'middle');
  const index = fingerLen(j, 'index');
  const ring = fingerLen(j, 'ring');
  // thumb spread: angle between the thumb (proximal → tip) and the index finger
  // (knuckle → tip), both projected onto the palm plane
  const proj = (v: V3): V3 => norm(sub(v, [f.N[0] * dot(v, f.N), f.N[1] * dot(v, f.N), f.N[2] * dot(v, f.N)]));
  const t = proj(sub(j[J['thumb-tip']], j[J['thumb-phalanx-proximal']]));
  const i = proj(f.Ey);
  const thumbDeg = (Math.acos(Math.max(-1, Math.min(1, dot(t, i)))) * 180) / Math.PI;
  return {
    palmSquareness: f.width / f.length,
    fingerRatio: middle / f.length,
    indexRatio: index / f.length,
    indexOverRing: index / (ring || 1),
    thumbDeg,
  };
}

/** Median of each field over the collected frames (robust to a few bad frames). */
export function aggregate(samples: RawMeasure[]): RawMeasure {
  const med = (k: keyof RawMeasure): number => {
    const v = samples.map((s) => s[k]).filter(Number.isFinite).sort((a, b) => a - b);
    return v.length ? v[Math.floor(v.length / 2)] : NaN;
  };
  return {
    palmSquareness: med('palmSquareness'),
    fingerRatio: med('fingerRatio'),
    indexRatio: med('indexRatio'),
    indexOverRing: med('indexOverRing'),
    thumbDeg: med('thumbDeg'),
  };
}

export function classifyElement(palmSquareness: number, fingerRatio: number): Element {
  const square = palmSquareness >= THRESH.squareness;
  const long = fingerRatio >= THRESH.fingerLong;
  if (square) return long ? 'vayu' : 'prithvi';
  return long ? 'jal' : 'agni';
}

const tri = (v: number, lo: number, hi: number): Tri => (v < lo ? 'low' : v > hi ? 'high' : 'mid');

export function profileFrom(m: RawMeasure, side: Side): HandProfile {
  return {
    side,
    palmSquareness: m.palmSquareness,
    fingerRatio: m.fingerRatio,
    element: classifyElement(m.palmSquareness, m.fingerRatio),
    indexLength: tri(m.indexRatio, THRESH.indexLow, THRESH.indexHigh),
    indexVsRing: tri(m.indexOverRing, THRESH.ringLow, THRESH.ringHigh),
    thumbSpread: tri(m.thumbDeg, THRESH.thumbLowDeg, THRESH.thumbHighDeg),
  };
}
