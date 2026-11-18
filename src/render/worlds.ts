/**
 * "Its own world": touching a line opens a portal that blooms out of the palm
 * and grows into a world around the seated user, then folds back into the palm.
 *
 * WebXR translation of the design pack's two-stage portal (§2.4, §3):
 *  - an orb of light swells at the touched palm (the "bubble"),
 *  - an inside-out sky sphere around the head dissolves open from the palm's
 *    direction (a noisy gold rim runs across the room), so passthrough stays
 *    visible past the edge until the world closes over it,
 *  - outside the opened part, a faint gold veil tints the real room (the
 *    "real room answers" beat, §6) — in WebXR that is just a premultiplied
 *    gold layer at low alpha, nothing to do with the camera feed,
 *  - the user's own hands are punched through to passthrough (spheres on the
 *    25 joints written with alpha 0), so the real hand stays visible inside,
 *  - one hero object, one particle system and a title per world.
 *
 * Cost per open world: about 7 draw calls (sky, hero ×1–2, motes, hand mask,
 * orb, title), no textures but the title canvas, all unlit. The sky is drawn
 * with depthTest off after the opaque pavilion, so it covers it for free.
 *
 * Worlds (palettes: two per world, core / halo, from the design pack §3.1):
 *   heart — lotuses opening on a dusk ocean      #FF5C8A / #3FD0D4
 *   life  — a banyan of light over a river        #2FBF71 / #FFD27A
 *   head  — a constellation joining in a night sky #DDE6FF / #4B4FD8
 *   fate  — a ringed planet and a path of light    #9FB7FF / #1B2A49 + gold
 */
import {
  BackSide,
  BufferAttribute,
  BufferGeometry,
  Color,
  CustomBlending,
  DoubleSide,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  NoBlending,
  OneFactor,
  OneMinusSrcAlphaFactor,
  PlaneGeometry,
  Points,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
} from '@iwsdk/core';
import type { Joints } from '../core/palm-frame.js';
import { FONT_DISPLAY, Label } from './text.js';

/** the four line worlds, and 'graha': a mount's planet in its own sky */
export type WorldId = 'heart' | 'life' | 'head' | 'fate' | 'graha';
export const WORLD_IDS: WorldId[] = ['heart', 'life', 'head', 'fate'];
const KIND: Record<WorldId, number> = { heart: 0, life: 1, head: 2, fate: 3, graha: 4 };

export const WORLD_PALETTE: Record<WorldId, { core: string; halo: string }> = {
  graha: { core: '#F5B700', halo: '#0B0820' },
  heart: { core: '#FF5C8A', halo: '#3FD0D4' },
  life: { core: '#2FBF71', halo: '#FFD27A' },
  head: { core: '#DDE6FF', halo: '#4B4FD8' },
  fate: { core: '#9FB7FF', halo: '#1B2A49' },
};

export const WORLD_TITLE: Record<WorldId, [string, string]> = {
  graha: ['ग्रह', 'Graha'],
  heart: ['हृदय रेखा', 'Hridaya · the heart line'],
  life: ['जीवन रेखा', 'Jeevan · the life line'],
  head: ['मस्तिष्क रेखा', 'Mastishk · the head line'],
  fate: ['भाग्य रेखा', 'Bhagya · the fate line'],
};

const SKY_R = 3.2;
const BLOOM = 2.1; // s, palm → all around
const FOLD = 1.1; // s
const REVEAL_MAX = Math.PI + 0.45;

function premul(m: ShaderMaterial, depthTest = false): ShaderMaterial {
  m.transparent = true;
  m.depthWrite = false;
  m.depthTest = depthTest;
  m.blending = CustomBlending;
  m.blendSrc = OneFactor;
  m.blendDst = OneMinusSrcAlphaFactor;
  m.blendSrcAlpha = OneFactor;
  m.blendDstAlpha = OneMinusSrcAlphaFactor;
  return m;
}

const NOISE_GLSL = /* glsl */ `
  float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float noise(vec3 x){
    vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p){ return 0.5 * noise(p) + 0.25 * noise(p * 2.03) + 0.125 * noise(p * 4.01); }
`;

/** The inside-out world sphere with the dissolving portal edge. */
function skyMaterial(): ShaderMaterial {
  return premul(
    new ShaderMaterial({
      side: BackSide,
      uniforms: {
        uCenter: { value: new Vector3() },
        uOrigin: { value: new Vector3(0, 0, -1) },
        uFwd: { value: new Vector3(0, 0, -1) },
        uReveal: { value: 0 },
        uTint: { value: 0 },
        uTime: { value: 0 },
        uKind: { value: 0 },
        uCore: { value: new Color() },
        uHalo: { value: new Color() },
      },
      // the low-frequency nebula is evaluated per vertex (64×40 sphere) and interpolated: the sky
      // covers the whole view, so per-pixel noise there is the costliest thing in a world on Quest
      vertexShader: /* glsl */ `
        uniform vec3 uCenter; uniform float uTime; uniform int uKind;
        varying vec3 vPos; varying float vNeb;
        ${NOISE_GLSL}
        void main(){
          vec4 w = modelMatrix * vec4(position, 1.0); vPos = w.xyz;
          vec3 d = normalize(w.xyz - uCenter);
          vNeb = uKind == 1 ? fbm(d * 3.0 + uTime * 0.02) : uKind == 2 ? fbm(d * 2.5 + vec3(0.0, uTime * 0.01, 0.0)) : uKind == 3 ? fbm(d * 2.0 + 3.0) : uKind == 4 ? fbm(d * 2.2 + 7.0) : 0.0;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform vec3 uCenter; uniform vec3 uOrigin; uniform vec3 uFwd; uniform float uReveal; uniform float uTint; uniform float uTime;
        uniform int uKind; uniform vec3 uCore; uniform vec3 uHalo;
        varying vec3 vPos; varying float vNeb;
        ${NOISE_GLSL}
        float stars(vec3 d, float dens, float keep){
          vec3 p = d * dens; vec3 i = floor(p); float h = hash(i);
          vec3 c = i + 0.5 + (vec3(hash(i + 1.7), hash(i + 3.1), hash(i + 5.3)) - 0.5) * 0.6;
          float r = length(p - c);
          return smoothstep(0.16, 0.0, r) * step(keep, h) * (0.65 + 0.35 * sin(uTime * 2.3 + h * 60.0));
        }
        void main(){
          vec3 d = normalize(vPos - uCenter);
          vec3 up = vec3(0.0, 1.0, 0.0);
          vec3 fw = normalize(vec3(uFwd.x, 0.0, uFwd.z));
          vec3 rt = normalize(cross(fw, up));
          float y = d.y;
          vec3 col;
          if (uKind == 0) {
            // heart: lotuses on a dusk ocean — rose horizon, indigo zenith, a pearl moon
            vec3 moon = normalize(fw * 0.85 + up * 0.32 + rt * 0.25);
            col = mix(mix(vec3(0.95, 0.6, 0.55) * 0.55 + uCore * 0.08, vec3(0.26, 0.12, 0.3), smoothstep(0.0, 0.3, y)), vec3(0.02, 0.03, 0.1), smoothstep(0.3, 0.85, y));
            float md = dot(d, moon);
            col += vec3(1.0, 0.92, 0.95) * smoothstep(0.9975, 0.999, md) + vec3(1.0, 0.7, 0.8) * pow(max(md, 0.0), 60.0) * 0.35;
            col += stars(d, 70.0, 0.86) * smoothstep(0.15, 0.5, y) * 0.9;
            if (y < 0.0) {
              vec3 p = d * (1.15 / max(-y, 0.015));
              float dd = length(p.xz - (fw.xz * 2.0));
              float rip = 0.5 + 0.5 * sin(dd * 7.0 - uTime * 1.3);
              vec3 water = mix(vec3(0.01, 0.07, 0.1), uHalo * 0.45, rip * 0.35 * exp(-dd * 0.25));
              // the moon's path on the water
              float path = exp(-pow(dot(normalize(vec3(p.x, 0.0, p.z)), rt) * 9.0, 2.0)) * step(0.0, dot(p.xz, fw.xz));
              water += vec3(1.0, 0.75, 0.85) * path * (0.25 + 0.2 * sin(dd * 14.0 - uTime * 2.0)) * 0.6;
              col = mix(water, vec3(0.95, 0.6, 0.55) * 0.5, exp(y * 25.0));
            }
          } else if (uKind == 1) {
            // life: dawn over a river of light — gold horizon, soft green above, the sun low ahead
            vec3 sun = normalize(fw + up * 0.08);
            col = mix(uHalo * 0.8, vec3(0.1, 0.32, 0.22), smoothstep(0.0, 0.55, y));
            col = mix(col, vec3(0.03, 0.1, 0.09), smoothstep(0.55, 1.0, y));
            float sd = dot(d, sun);
            col += uHalo * pow(max(sd, 0.0), 24.0) * 0.8 + vec3(1.0, 0.95, 0.8) * smoothstep(0.996, 0.998, sd);
            col += vec3(0.6, 0.9, 0.6) * vNeb * 0.08 * smoothstep(0.1, 0.6, y);
            if (y < 0.0) {
              vec3 p = d * (1.15 / max(-y, 0.015));
              float z = dot(p.xz, fw.xz), x = dot(p.xz, rt.xz);
              float cx = sin(z * 0.7 + 0.6) * 0.7;
              float band = exp(-pow((x - cx) * 2.6, 2.0));
              float flow = 0.55 + 0.45 * sin(z * 5.0 - uTime * 2.4 + x * 2.0);
              vec3 ground = vec3(0.02, 0.07, 0.04) + uCore * 0.08 * noise(p * 1.5);
              col = ground + uHalo * band * flow * 1.1 * exp(-abs(z) * 0.08) + uCore * band * 0.25;
              col = mix(col, uHalo * 0.6, exp(y * 30.0));
            }
          } else if (uKind == 2) {
            // head: a night sky all around, a milky band, dense stars
            float neb = vNeb;
            float band = exp(-pow(dot(d, normalize(up + rt * 0.6)) * 3.0, 2.0));
            col = vec3(0.005, 0.006, 0.025) + uHalo * (0.12 * neb + 0.22 * band * neb);
            col += uCore * (stars(d, 90.0, 0.84) * 0.9 + stars(d, 45.0, 0.93) * 0.8);
          } else if (uKind == 4) {
            // graha: deep space tinted with the planet's gem colour, its light glowing from ahead
            float neb = vNeb;
            col = uHalo * (0.6 + 0.6 * neb) + uCore * pow(neb, 2.5) * 0.25;
            col += vec3(0.9, 0.92, 1.0) * stars(d, 85.0, 0.85) * 0.8;
            col += uCore * (pow(max(dot(d, normalize(fw + up * 0.06)), 0.0), 7.0) * 0.45 + pow(max(dot(d, normalize(fw + up * 0.06)), 0.0), 60.0) * 0.6);
          } else {
            // fate: deep space, a nebula, and a path of light crossing toward the ringed planet
            float neb = vNeb;
            col = uHalo * (0.35 + 0.5 * neb) + vec3(0.25, 0.15, 0.4) * pow(neb, 3.0) * 0.6;
            col += uCore * stars(d, 80.0, 0.86) * 0.9;
            vec3 n = normalize(cross(fw, normalize(up * 0.55 + rt)));
            float pd = dot(d, n);
            float along = atan(dot(d, fw), dot(d, cross(n, fw)));
            float path = exp(-pow(pd / 0.022, 2.0));
            float pulses = 0.55 + 0.45 * sin(along * 24.0 - uTime * 3.0);
            col += vec3(1.0, 0.82, 0.45) * path * pulses * 1.2 + vec3(1.0, 0.7, 0.35) * exp(-pow(pd / 0.08, 2.0)) * 0.18;
          }
          // the portal: a dissolving rim that sweeps out from the palm's direction
          float ang = acos(clamp(dot(d, uOrigin), -1.0, 1.0));
          // the dissolve noise only matters near the rim: skip it elsewhere (and once the world is fully open)
          float n = abs(ang - uReveal) < 0.4 ? (fbm(d * 7.0 + uTime * 0.15) - 0.5) * 0.5 : 0.0;
          float e = ang + n - uReveal;
          float m = 1.0 - smoothstep(-0.06, 0.0, e);
          float rim = exp(-pow(e * 14.0, 2.0)) * step(0.02, uReveal);
          vec3 gold = vec3(1.0, 0.78, 0.38);
          float veil = uTint * 0.14 * (1.0 - m);
          vec3 c = col * m + gold * (rim * 1.4 + veil) + uCore * rim * 0.4;
          float a = clamp(m + rim * 0.9 + veil, 0.0, 1.0);
          gl_FragColor = vec4(c, a);
        }`,
    }),
  );
}

/** Glow material for hero meshes: unlit colour × alpha, premultiplied, growth-masked. */
function heroMaterial(vertex: string, fragment: string, uniforms: Record<string, { value: unknown }>): ShaderMaterial {
  const m = premul(new ShaderMaterial({ side: DoubleSide, uniforms: { uGrow: { value: 0 }, uTime: { value: 0 }, uOpacity: { value: 0 }, uCore: { value: new Color() }, uHalo: { value: new Color() }, ...uniforms }, vertexShader: vertex, fragmentShader: fragment }));
  return m;
}

/** Concatenate simple indexed geometries that carry the same attributes. */
function merge(parts: BufferGeometry[]): BufferGeometry {
  const out = new BufferGeometry();
  const names = Object.keys(parts[0].attributes);
  for (const name of names) {
    const size = parts[0].getAttribute(name).itemSize;
    const total = parts.reduce((s, g) => s + g.getAttribute(name).count * size, 0);
    const arr = new Float32Array(total);
    let o = 0;
    for (const g of parts) {
      const a = g.getAttribute(name).array as ArrayLike<number>;
      arr.set(a as Float32Array, o);
      o += a.length;
    }
    out.setAttribute(name, new BufferAttribute(arr, size));
  }
  const idx: number[] = [];
  let base = 0;
  for (const g of parts) {
    const ix = g.getIndex();
    const n = g.getAttribute('position').count;
    if (ix) for (let i = 0; i < ix.count; i++) idx.push(ix.getX(i) + base);
    else for (let i = 0; i < n; i++) idx.push(i + base);
    base += n;
  }
  out.setIndex(idx);
  return out;
}

// ─────────────────────────── heroes ───────────────────────────

/** Seven lotuses floating on the ocean; petals open in the vertex shader. */
function lotusHero(): Mesh {
  const pos: number[] = [], seat: number[] = [], pet: number[] = [], idx: number[] = [];
  const lotuses: [number, number, number, number][] = [
    // (right, forward, scale, delay)
    [0, 1.5, 1.3, 0],
    [-0.65, 1.2, 0.85, 0.35],
    [0.7, 1.25, 0.9, 0.5],
    [-1.25, 0.55, 0.7, 0.8],
    [1.3, 0.65, 0.75, 0.95],
    [-0.45, 2.3, 0.8, 0.6],
    [0.6, 2.4, 0.75, 0.7],
  ];
  const SEG = 5;
  for (const [x, z, s, delay] of lotuses) {
    for (let ring = 0; ring < 3; ring++) {
      const n = 8;
      for (let k = 0; k < n; k++) {
        const theta = ((k + ring * 0.5) / n) * Math.PI * 2;
        const base = pos.length / 3;
        for (let j = 0; j <= SEG; j++)
          for (const side of [-1, 1]) {
            pos.push(side, j / SEG, 0); // local: across, along
            seat.push(x, z, s);
            pet.push(theta, ring, delay);
          }
        for (let j = 0; j < SEG; j++) {
          const a = base + j * 2;
          idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
      }
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('seat', new BufferAttribute(new Float32Array(seat), 3));
  g.setAttribute('pet', new BufferAttribute(new Float32Array(pet), 3));
  g.setIndex(idx);
  const mat = heroMaterial(
    /* glsl */ `
      uniform float uGrow; uniform float uTime; uniform vec3 uBase; uniform vec3 uFwd; uniform vec3 uRight;
      attribute vec3 seat; attribute vec3 pet;
      varying float vAlong; varying float vAcross; varying float vRing; varying float vOpen;
      void main(){
        float open = smoothstep(0.0, 1.0, clamp(uGrow * 1.4 - pet.z, 0.0, 1.0));
        float ring = pet.y;
        float s = seat.z * 0.16 * (1.0 - ring * 0.18);
        float tilt = mix(0.12, 1.25 - ring * 0.38, open);
        vec3 up = vec3(0.0, 1.0, 0.0);
        vec3 r = cos(pet.x) * uRight + sin(pet.x) * uFwd;
        vec3 t = cross(up, r);
        float along = position.y, across = position.x * sin(3.14159 * min(along * 1.15, 1.0)) * 0.42;
        vec3 dir = normalize(r * sin(tilt) + up * cos(tilt));
        vec3 bob = up * sin(uTime * 0.8 + seat.x * 3.0) * 0.012;
        vec3 p = uBase + uRight * seat.x + uFwd * seat.y + bob + (dir * along + t * across) * s + up * along * along * s * 0.25 * open;
        vAlong = along; vAcross = position.x; vRing = ring; vOpen = open;
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    /* glsl */ `
      precision highp float;
      uniform float uOpacity; uniform vec3 uCore;
      varying float vAlong; varying float vAcross; varying float vRing; varying float vOpen;
      void main(){
        vec3 c = mix(vec3(1.0, 0.93, 0.9), uCore, smoothstep(0.2, 1.0, vAlong) * (0.6 + 0.15 * vRing));
        float vein = exp(-vAcross * vAcross * 30.0) * 0.25;
        float edge = smoothstep(0.75, 1.0, abs(vAcross)) * 0.4;
        c = c * (0.75 + vein) + vec3(1.0, 0.85, 0.9) * edge;
        float a = (0.82 + 0.18 * vOpen) * uOpacity;
        gl_FragColor = vec4(c * a, a);
      }`,
    { uBase: { value: new Vector3() }, uFwd: { value: new Vector3() }, uRight: { value: new Vector3() } },
  );
  const m = new Mesh(g, mat);
  return m;
}

/** A banyan of light: trunk, branches and aerial roots as tubes; grows from the ground up. */
function banyanHero(): Mesh {
  const parts: BufferGeometry[] = [];
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const tube = (a: Vector3, b: Vector3, ra: number, rb: number, g0: number, g1: number) => {
    const RAD = 5, LEN = 4;
    const pos: number[] = [], grow: number[] = [], nrm: number[] = [], idx: number[] = [];
    const dir = b.clone().sub(a);
    const t = dir.clone().normalize();
    const u = Math.abs(t.y) < 0.9 ? new Vector3(0, 1, 0).cross(t).normalize() : new Vector3(1, 0, 0).cross(t).normalize();
    const v = t.clone().cross(u);
    for (let i = 0; i <= LEN; i++) {
      const f = i / LEN;
      const c = a.clone().addScaledVector(dir, f);
      const r = ra + (rb - ra) * f;
      for (let k = 0; k < RAD; k++) {
        const ang = (k / RAD) * Math.PI * 2;
        const n = u.clone().multiplyScalar(Math.cos(ang)).addScaledVector(v, Math.sin(ang));
        pos.push(c.x + n.x * r, c.y + n.y * r, c.z + n.z * r);
        nrm.push(n.x, n.y, n.z);
        grow.push(g0 + (g1 - g0) * f);
      }
    }
    for (let i = 0; i < LEN; i++)
      for (let k = 0; k < RAD; k++) {
        const a0 = i * RAD + k, a1 = i * RAD + ((k + 1) % RAD), b0 = a0 + RAD, b1 = a1 + RAD;
        idx.push(a0, b0, a1, a1, b0, b1);
      }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
    g.setAttribute('normal', new BufferAttribute(new Float32Array(nrm), 3));
    g.setAttribute('grow', new BufferAttribute(new Float32Array(grow), 1));
    g.setIndex(idx);
    parts.push(g);
  };
  // local frame: x = right, y = up (0 = ground, 1.15 m below the eye), z = forward
  // a bent limb: three sub-segments that droop and wander a little, tapering
  const limb = (a: Vector3, d: Vector3, len: number, r0: number, r1: number, g0: number, g1: number, droop: number): Vector3 => {
    let p = a.clone(), dir = d.clone();
    const n = 3;
    for (let i = 0; i < n; i++) {
      dir = dir.clone().add(new Vector3((rnd() - 0.5) * 0.35, -droop * (i + 1) * 0.12, (rnd() - 0.5) * 0.35)).normalize();
      const q = p.clone().addScaledVector(dir, len / n);
      tube(p, q, r0 + ((r1 - r0) * i) / n, r0 + ((r1 - r0) * (i + 1)) / n, g0 + ((g1 - g0) * i) / n, g0 + ((g1 - g0) * (i + 1)) / n);
      p = q;
    }
    return p;
  };
  const branch = (a: Vector3, d: Vector3, len: number, r: number, depth: number, g0: number) => {
    const g1 = g0 + 0.16;
    const b = limb(a, d, len, r, r * 0.66, g0, g1, depth * 0.25);
    if (depth >= 4) return;
    const kids = depth <= 1 ? 3 : 2;
    for (let i = 0; i < kids; i++) {
      const yaw = Math.atan2(d.z, d.x) + (i - (kids - 1) / 2) * 0.9 + (rnd() - 0.5) * 0.5;
      const nd = new Vector3(Math.cos(yaw), 0.35 - depth * 0.12 + rnd() * 0.15, Math.sin(yaw)).normalize();
      branch(b, nd, len * (0.7 + rnd() * 0.15), r * 0.64, depth + 1, g1);
    }
    // aerial roots hang from the spreading branches to the ground: the banyan's signature
    if (depth >= 1 && rnd() > 0.3) tube(b, new Vector3(b.x + (rnd() - 0.5) * 0.05, 0, b.z + (rnd() - 0.5) * 0.05), 0.005, 0.012, g1, Math.min(1, g1 + 0.35));
  };
  // three stems twisting into one trunk
  const crown = new Vector3(0, 0.95, 0);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    limb(new Vector3(Math.cos(a) * 0.09, 0, Math.sin(a) * 0.09), crown.clone().sub(new Vector3(Math.cos(a) * 0.09, 0, Math.sin(a) * 0.09)).normalize(), 0.95, 0.07, 0.05, 0, 0.16, 0);
  }
  for (let i = 0; i < 6; i++) {
    const yaw = (i / 6) * Math.PI * 2 + rnd() * 0.4;
    branch(crown, new Vector3(Math.cos(yaw), 0.75, Math.sin(yaw)).normalize(), 0.5, 0.05, 1, 0.16);
  }
  // surface roots running toward the viewer: the life line itself
  for (let i = 0; i < 7; i++) {
    const yaw = Math.PI * 1.5 + (i - 3) * 0.32;
    limb(new Vector3(0, 0.03, 0), new Vector3(Math.cos(yaw), -0.02, Math.sin(yaw)).normalize(), 0.9 + rnd() * 0.8, 0.035, 0.006, 0.0, 0.3, -0.05);
  }
  const g = merge(parts);
  const mat = heroMaterial(
    /* glsl */ `
      uniform float uGrow; uniform vec3 uBase; uniform vec3 uFwd; uniform vec3 uRight;
      attribute float grow;
      varying float vG; varying vec3 vN; varying vec3 vW;
      void main(){
        vec3 p = uBase + uRight * position.x + vec3(0.0, position.y, 0.0) + uFwd * position.z;
        vG = grow; vN = normalize(uRight * normal.x + vec3(0.0, normal.y, 0.0) + uFwd * normal.z); vW = p;
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    /* glsl */ `
      precision highp float;
      uniform float uGrow; uniform float uOpacity; uniform float uTime; uniform vec3 uCore; uniform vec3 uHalo;
      varying float vG; varying vec3 vN; varying vec3 vW;
      void main(){
        if (vG > uGrow) discard;
        float tip = exp(-pow((uGrow - vG) * 18.0, 2.0));
        float rim = 1.0 - abs(dot(normalize(cameraPosition - vW), vN));
        float sap = 0.5 + 0.5 * sin(vG * 40.0 - uTime * 3.0);
        vec3 bark = mix(vec3(0.09, 0.06, 0.035), uCore * 0.35, 0.3);
        vec3 c = bark + uHalo * (rim * rim * 1.1 + sap * 0.12 * rim) + uCore * rim * 0.25 + vec3(1.0, 0.95, 0.75) * tip * 1.5;
        float a = uOpacity;
        gl_FragColor = vec4(c * a, a);
      }`,
    { uBase: { value: new Vector3() }, uFwd: { value: new Vector3() }, uRight: { value: new Vector3() } },
  );
  return new Mesh(g, mat);
}

/** Constellation: bright nodes joined one segment at a time (billboard quads, one draw). */
function constellationHero(): Mesh {
  // a mind-like figure: a loose ring of stars with a few chords across it, ~2.4 m ahead
  const nodes: [number, number][] = [];
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2 + Math.sin(i * 2.3) * 0.18;
    nodes.push([Math.cos(a) * (0.9 + 0.12 * Math.sin(i * 1.7)), Math.sin(a) * (0.62 + 0.1 * Math.cos(i * 2.1))]);
  }
  nodes.push([-0.25, 0.1], [0.2, -0.05], [0.05, 0.3]);
  const edges: [number, number][] = [];
  for (let i = 0; i < 11; i++) edges.push([i, (i + 1) % 11]);
  edges.push([2, 11], [11, 12], [12, 7], [11, 13], [13, 4], [12, 9]);
  const P: number[] = [], A: number[] = [], B: number[] = [], S: number[] = [], O: number[] = [], idx: number[] = [];
  const quad = (a: [number, number], b: [number, number], order: number, kind: number) => {
    const base = P.length / 3;
    for (const [s, t] of [[-1, 0], [1, 0], [-1, 1], [1, 1]]) {
      P.push(s, t, kind);
      A.push(a[0], a[1]);
      B.push(b[0], b[1]);
      S.push(s);
      O.push(order);
    }
    idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
  };
  edges.forEach(([i, j], k) => quad(nodes[i], nodes[j], k / edges.length, 0));
  nodes.forEach((n, k) => quad(n, n, k / nodes.length, 1));
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(P), 3));
  g.setAttribute('pa', new BufferAttribute(new Float32Array(A), 2));
  g.setAttribute('pb', new BufferAttribute(new Float32Array(B), 2));
  g.setAttribute('ord', new BufferAttribute(new Float32Array(O), 1));
  g.setIndex(idx);
  const mat = heroMaterial(
    /* glsl */ `
      uniform float uGrow; uniform vec3 uBase; uniform vec3 uFwd; uniform vec3 uRight;
      attribute vec2 pa; attribute vec2 pb; attribute float ord;
      varying vec2 vQ; varying float vKind; varying float vShow; varying float vOrd;
      vec3 W(vec2 p){ return uBase + uRight * p.x * 1.3 + vec3(0.0, p.y * 1.1 + 0.35, 0.0) + uFwd * (0.15 * p.x * p.x); }
      void main(){
        vKind = position.z; vOrd = ord;
        float show = clamp((uGrow * 1.25 - ord) * 5.0, 0.0, 1.0);
        vShow = show;
        vec3 a = W(pa), b = W(pb);
        vec3 toCam = normalize(cameraPosition - a);
        vec3 p;
        if (position.z < 0.5) {
          vec3 e = mix(a, b, position.y * show);
          vec3 side = normalize(cross(b - a, toCam));
          p = e + side * position.x * 0.006;
          vQ = vec2(position.x, position.y);
        } else {
          vec3 r = normalize(cross(vec3(0.0, 1.0, 0.0), toCam)), u = cross(toCam, r);
          p = a + (r * position.x + u * (position.y * 2.0 - 1.0)) * 0.07 * show;
          vQ = vec2(position.x, position.y * 2.0 - 1.0);
        }
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    /* glsl */ `
      precision highp float;
      uniform float uOpacity; uniform float uTime; uniform vec3 uCore; uniform vec3 uHalo;
      varying vec2 vQ; varying float vKind; varying float vShow; varying float vOrd;
      void main(){
        float a; vec3 c;
        if (vKind < 0.5) {
          float k = exp(-vQ.x * vQ.x * 3.0);
          a = k * 0.85 * vShow; c = mix(uHalo, uCore, k);
        } else {
          float r = length(vQ);
          float core = exp(-r * r * 40.0), halo = exp(-r * r * 5.0) * 0.5;
          float tw = 0.8 + 0.2 * sin(uTime * 3.0 + vOrd * 40.0);
          a = clamp((core + halo) * tw, 0.0, 1.0); c = uCore * (1.0 + core) + uHalo * halo;
        }
        a *= uOpacity;
        gl_FragColor = vec4(c * a, a);
      }`,
    { uBase: { value: new Vector3() }, uFwd: { value: new Vector3() }, uRight: { value: new Vector3() } },
  );
  return new Mesh(g, mat);
}

/** A ringed planet (Shani) above the path of light: banded sphere + ring, one geometry. */
function saturnHero(): Mesh {
  const sph = new SphereGeometry(0.42, 40, 24);
  const sp = sph.getAttribute('position');
  const kindS = new Float32Array(sp.count);
  sph.setAttribute('kind', new BufferAttribute(kindS, 1));
  const ringPos: number[] = [], ringIdx: number[] = [], ringKind: number[] = [], ringN: number[] = [];
  const RS = 96;
  for (let i = 0; i <= RS; i++) {
    const a = (i / RS) * Math.PI * 2;
    for (const r of [0.58, 1.0]) {
      ringPos.push(Math.cos(a) * r, 0, Math.sin(a) * r);
      ringN.push(0, 1, 0);
      ringKind.push(r === 0.58 ? 1 : 2);
    }
    if (i < RS) {
      const b = i * 2;
      ringIdx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
    }
  }
  const ring = new BufferGeometry();
  ring.setAttribute('position', new BufferAttribute(new Float32Array(ringPos), 3));
  ring.setAttribute('normal', new BufferAttribute(new Float32Array(ringN), 3));
  ring.setAttribute('kind', new BufferAttribute(new Float32Array(ringKind), 1));
  ring.setIndex(ringIdx);
  const s2 = new BufferGeometry();
  s2.setAttribute('position', sph.getAttribute('position'));
  s2.setAttribute('normal', sph.getAttribute('normal'));
  s2.setAttribute('kind', sph.getAttribute('kind'));
  s2.setIndex(sph.getIndex());
  const g = merge([s2, ring]);
  const mat = heroMaterial(
    /* glsl */ `
      uniform float uGrow; uniform float uTime; uniform vec3 uBase; uniform vec3 uFwd; uniform vec3 uRight;
      attribute float kind;
      varying float vKind; varying vec3 vN; varying vec3 vL; varying vec3 vW;
      void main(){
        float s = smoothstep(0.0, 1.0, uGrow);
        // tilt the ring 22° toward the viewer, spin slowly
        float c = cos(0.38), sn = sin(0.38), sp = uTime * 0.05;
        vec3 q = position;
        q = vec3(q.x * cos(sp) - q.z * sin(sp), q.y, q.x * sin(sp) + q.z * cos(sp));
        q = vec3(q.x, q.y * c - q.z * sn, q.y * sn + q.z * c);
        vec3 n = normal;
        n = vec3(n.x * cos(sp) - n.z * sin(sp), n.y, n.x * sin(sp) + n.z * cos(sp));
        n = vec3(n.x, n.y * c - n.z * sn, n.y * sn + n.z * c);
        vec3 p = uBase + (uRight * q.x + vec3(0.0, q.y, 0.0) - uFwd * q.z) * s;
        vKind = kind; vN = normalize(uRight * n.x + vec3(0.0, n.y, 0.0) - uFwd * n.z); vL = q; vW = p;
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    /* glsl */ `
      precision highp float;
      uniform float uOpacity; uniform float uTime; uniform vec3 uCore; uniform vec3 uHalo; uniform float uRing; uniform float uSun;
      varying float vKind; varying vec3 vN; varying vec3 vL; varying vec3 vW;
      void main(){
        vec3 sunDir = normalize(vec3(0.4, 0.5, 0.3));
        float a = uOpacity; vec3 c;
        if (vKind < 0.5) {
          float lat = vL.y / 0.42;
          float bands = 0.5 + 0.5 * sin(lat * 18.0 + sin(lat * 5.0) * 1.5);
          vec3 base = mix(uCore * 0.8, vec3(0.95, 0.85, 0.65), bands * 0.45);
          float lit = 0.25 + 0.75 * max(dot(vN, sunDir), 0.0);
          float rim = pow(1.0 - abs(dot(normalize(cameraPosition - vW), vN)), 3.0);
          c = base * lit + vec3(1.0, 0.85, 0.5) * rim * 0.9;
          // Surya shines by its own light
          if (uSun > 0.5) c = mix(vec3(1.0, 0.95, 0.7), uCore, 0.25 + 0.5 * rim + 0.08 * sin(vL.x * 60.0 + uTime) * sin(vL.y * 55.0 - uTime * 0.7)) * 1.25 + uCore * rim * 1.2;
        } else {
          if (uRing < 0.5) discard;
          float r = length(vL.xz);
          float t = (r - 0.58) / 0.42;
          float gaps = 0.55 + 0.45 * sin(t * 50.0) * sin(t * 13.0 + 1.0);
          float cassini = smoothstep(0.02, 0.05, abs(t - 0.62));
          float fall = smoothstep(0.0, 0.08, t) * smoothstep(1.0, 0.85, t);
          c = vec3(1.0, 0.82, 0.5) * (0.7 + 0.3 * gaps);
          a *= fall * cassini * (0.55 + 0.35 * gaps);
        }
        gl_FragColor = vec4(c * a, a);
      }`,
    { uBase: { value: new Vector3() }, uFwd: { value: new Vector3() }, uRight: { value: new Vector3() }, uRing: { value: 1 }, uSun: { value: 0 } },
  );
  return new Mesh(g, mat);
}

// ─────────────────────────── motes ───────────────────────────

/** One particle system shared by every world; its motion changes with the world. */
function motes(count = 600): Points {
  const pos = new Float32Array(count * 3), seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    // a shell around the head, 0.7–2.8 m
    const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, r = 0.7 + Math.pow(Math.random(), 0.6) * 2.1;
    const s = Math.sqrt(1 - u * u);
    pos.set([Math.cos(th) * s * r, u * r * 0.7, Math.sin(th) * s * r], i * 3);
    seed[i] = Math.random();
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setAttribute('seed', new BufferAttribute(seed, 1));
  const mat = premul(
    new ShaderMaterial({
      uniforms: { uCenter: { value: new Vector3() }, uHero: { value: new Vector3() }, uTime: { value: 0 }, uKind: { value: 0 }, uOpacity: { value: 0 }, uCore: { value: new Color() }, uHalo: { value: new Color() } },
      vertexShader: /* glsl */ `
        uniform vec3 uCenter; uniform vec3 uHero; uniform float uTime; uniform int uKind; uniform vec3 uCore; uniform vec3 uHalo;
        attribute float seed;
        varying vec3 vCol; varying float vA; varying float vPetal;
        void main(){
          vec3 p = position; float t = uTime; float tw = 0.6 + 0.4 * sin(t * (2.0 + seed * 3.0) + seed * 50.0);
          vPetal = 0.0;
          if (uKind == 0) {          // heart: rose petals drifting down, teal sparks
            p.y = mod(p.y - t * (0.05 + seed * 0.05) + 2.0, 3.2) - 1.6;
            p.x += sin(t * 0.7 + seed * 20.0) * 0.12;
            vCol = seed > 0.55 ? mix(uCore, vec3(1.0, 0.85, 0.9), 0.45) : uHalo; vPetal = seed > 0.55 ? 1.0 : 0.0;
          } else if (uKind == 1) {
            if (seed < 0.6) {        // life: a canopy of glowing leaves over the banyan
              vec3 dir = normalize(position);
              float s2 = seed / 0.6;
              p = (uHero - uCenter) + vec3(dir.x * 1.25, 1.2 + abs(dir.y) * 0.45 - s2 * 0.2, dir.z * 1.25) + vec3(sin(t + seed * 30.0), 0.0, cos(t * 0.8 + seed * 20.0)) * 0.015;
              vCol = mix(uCore * 1.2, uHalo, s2 * s2); vPetal = 2.0;
            } else {                 // and fireflies wandering low
              p.y = -0.9 + mod(p.y + 2.0, 1.6) * 0.8 + sin(t * 0.9 + seed * 30.0) * 0.08;
              p.xz += vec2(sin(t * 0.4 + seed * 17.0), cos(t * 0.33 + seed * 11.0)) * 0.18;
              vCol = mix(uHalo, vec3(0.75, 1.0, 0.55), seed); tw = pow(max(sin(t * 1.6 + seed * 40.0), 0.0), 3.0);
            }
          } else if (uKind == 2) {   // head: still, twinkling star dust
            vCol = mix(uCore, uHalo * 1.5, seed * 0.5);
          } else {                   // fate: gold motes orbiting slowly
            float a = t * (0.04 + seed * 0.04);
            p.xz = mat2(cos(a), -sin(a), sin(a), cos(a)) * p.xz;
            vCol = mix(vec3(1.0, 0.8, 0.45), uCore, seed * 0.6);
          }
          vec4 mv = viewMatrix * vec4(uCenter + p, 1.0);
          vA = tw;
          gl_PointSize = clamp((vPetal > 1.5 ? 0.05 : vPetal > 0.5 ? 0.03 : 0.014) * projectionMatrix[1][1] * 500.0 / -mv.z, 1.0, 28.0);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform float uOpacity; varying vec3 vCol; varying float vA; varying float vPetal;
        void main(){
          vec2 c = gl_PointCoord * 2.0 - 1.0;
          float m = vPetal > 1.5 ? exp(-dot(c, c) * 2.2) * 0.55 : vPetal > 0.5 ? smoothstep(1.0, 0.6, length(c * vec2(1.0, 1.8))) * 0.8 : exp(-dot(c, c) * 3.0);
          float a = clamp(m * vA * uOpacity, 0.0, 1.0);
          gl_FragColor = vec4(vCol * a, a);
        }`,
    }),
  );
  const p = new Points(g, mat);
  return p;
}

/** The orb that swells over the palm before the world opens (and takes it back at the end). */
function orb(): Mesh {
  const mat = premul(
    new ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 }, uCore: { value: new Color() } },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main(){
          vUv = uv * 2.0 - 1.0;
          // billboard: the quad always faces the eye
          vec3 c = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          float s = length(modelMatrix[0].xyz);
          vec3 toCam = normalize(cameraPosition - c);
          vec3 r = normalize(cross(vec3(0.0, 1.0, 0.0), toCam)), u = cross(toCam, r);
          gl_Position = projectionMatrix * viewMatrix * vec4(c + (r * position.x + u * position.y) * s, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform float uTime; uniform float uOpacity; uniform vec3 uCore;
        varying vec2 vUv;
        ${NOISE_GLSL}
        void main(){
          float r = length(vUv);
          float swirl = fbm(vec3(vUv * 3.0, uTime * 0.6) + vec3(atan(vUv.y, vUv.x), 0.0, 0.0));
          float core = exp(-r * r * 14.0);
          float body = smoothstep(1.0, 0.55, r) * (0.35 + 0.65 * swirl);
          float rim = exp(-pow((r - 0.8) * 9.0, 2.0)) * 0.8;
          vec3 c = vec3(1.0, 0.95, 0.85) * core * 1.5 + uCore * body * 0.8 + vec3(1.0, 0.8, 0.45) * rim;
          float a = clamp(core + body * 0.7 + rim, 0.0, 1.0) * uOpacity;
          gl_FragColor = vec4(c * uOpacity, a);
        }`,
    }),
  );
  const m = new Mesh(new PlaneGeometry(1, 1), mat);
  return m;
}

// ─────────────────────────── the portal ───────────────────────────

/** Joint radii for the hand mask (wrist, then thumb ×4, then 4 fingers ×5). */
const JOINT_R = [0.03, 0.022, 0.016, 0.013, 0.011, ...[0, 1, 2, 3].flatMap(() => [0.022, 0.014, 0.012, 0.011, 0.01])];
/** Extra palm fill spheres: midpoints of (a, b) joint pairs. */
const PALM_FILL: [number, number, number][] = [
  [5, 6, 0.022], [10, 11, 0.022], [15, 16, 0.022], [20, 21, 0.02], [0, 10, 0.028], [0, 15, 0.026], [0, 5, 0.026], [0, 20, 0.024], [1, 5, 0.022],
];
const MASK_PER_HAND = 25 + PALM_FILL.length;

export type PortalState = 'closed' | 'bloom' | 'open' | 'fold';

export class WorldPortal {
  readonly group = new Group();
  state: PortalState = 'closed';
  world: WorldId = 'heart';
  /** 0..1 how much of the world surrounds the user (1 = fully inside) */
  surround = 0;
  private t = 0;
  private time = 0;
  private readonly sky: Mesh;
  private readonly skyMat: ShaderMaterial;
  private readonly heroes = new Map<WorldId, Mesh>();
  private readonly motes: Points;
  private readonly orb: Mesh;
  private readonly mask: InstancedMesh;
  private readonly title: Label;
  private readonly center = new Vector3();
  private readonly origin = new Vector3();
  private readonly palm = new Vector3();
  private readonly fwd = new Vector3();
  private readonly right = new Vector3();
  private readonly tmpM = new Matrix4();
  private readonly tmpV = new Vector3();
  private readonly up = new Vector3(0, 1, 0);
  private reveal = 0;
  private grow = 0;

  constructor() {
    this.group.name = 'world-portal';
    this.skyMat = skyMaterial();
    this.sky = new Mesh(new SphereGeometry(SKY_R, 64, 40), this.skyMat);
    this.sky.name = 'world-sky';
    this.motes = motes();
    this.motes.name = 'world-motes';
    this.orb = orb();
    this.orb.name = 'world-orb';
    // the hand mask writes alpha 0 (passthrough) where the hands are, after the world and before the overlay
    const maskMat = new MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, blending: NoBlending, depthTest: false, depthWrite: false });
    this.mask = new InstancedMesh(new SphereGeometry(1, 10, 8), maskMat, MASK_PER_HAND * 2);
    this.mask.name = 'world-hand-mask';
    this.mask.count = 0;
    this.title = new Label(0.62, 3.6, { font: FONT_DISPLAY, size: 92, color: '#fff1d0', background: null, border: null, padding: 10, lineHeight: 1.15, shadow: true }, 1024);
    this.title.mesh.name = 'world-title';
    this.title.opacity = 0;
    for (const [o, order] of [[this.sky, 5], [this.motes, 7], [this.mask, 8], [this.orb, 9], [this.title.mesh, 10]] as const) {
      o.renderOrder = order;
      o.frustumCulled = false;
      this.group.add(o);
    }
    this.group.visible = false;
  }

  private hero(id: WorldId): Mesh {
    let h = this.heroes.get(id);
    if (!h) {
      h = id === 'heart' ? lotusHero() : id === 'life' ? banyanHero() : id === 'head' ? constellationHero() : saturnHero(); // fate and graha: a planet
      h.name = `world-hero-${id}`;
      h.renderOrder = 6;
      h.frustumCulled = false;
      this.heroes.set(id, h);
      this.group.add(h);
    }
    return h;
  }

  get isOpen(): boolean {
    return this.state !== 'closed';
  }

  /** Bloom the world out of the palm point `palm`, around the eye at `head`. */
  open(id: WorldId, palm: Vector3, head: Vector3, graha?: { color: string; title: [string, string]; ring: boolean; sun: boolean }): void {
    this.world = id;
    this.state = 'bloom';
    this.t = 0;
    this.reveal = 0;
    this.grow = 0;
    this.center.copy(head);
    this.palm.copy(palm);
    this.origin.copy(palm).sub(head).normalize();
    this.fwd.set(this.origin.x, 0, this.origin.z);
    if (this.fwd.lengthSq() < 1e-4) this.fwd.set(0, 0, -1);
    this.fwd.normalize();
    this.right.crossVectors(this.fwd, this.up).normalize();
    this.sky.position.copy(head);
    this.sky.updateMatrixWorld();
    const pal = graha ? { core: graha.color, halo: WORLD_PALETTE.graha.halo } : WORLD_PALETTE[id];
    const u = this.skyMat.uniforms;
    u.uCenter.value.copy(head);
    u.uOrigin.value.copy(this.origin);
    u.uFwd.value.copy(this.fwd);
    u.uKind.value = KIND[id];
    (u.uCore.value as Color).set(pal.core);
    (u.uHalo.value as Color).set(pal.halo);
    const mu = (this.motes.material as ShaderMaterial).uniforms;
    mu.uCenter.value.copy(head);
    mu.uKind.value = KIND[id];
    mu.uHero.value.copy(head).addScaledVector(this.fwd, 2.3).addScaledVector(this.up, -1.15);
    (mu.uCore.value as Color).set(pal.core);
    (mu.uHalo.value as Color).set(pal.halo);
    ((this.orb.material as ShaderMaterial).uniforms.uCore.value as Color).set(pal.core);
    for (const [wid, h] of this.heroes) h.visible = wid === id;
    const h = this.hero(id);
    h.visible = true;
    const hu = (h.material as ShaderMaterial).uniforms;
    (hu.uCore.value as Color).set(pal.core);
    (hu.uHalo.value as Color).set(pal.halo);
    // where the hero stands: ahead (the palm's direction), sized for a seated user
    const eyeToFloor = 1.15;
    const base = hu.uBase.value as Vector3;
    if (id === 'heart') base.copy(head).addScaledVector(this.up, -eyeToFloor + 0.05);
    else if (id === 'life') base.copy(head).addScaledVector(this.fwd, 2.3).addScaledVector(this.up, -eyeToFloor);
    else if (id === 'head') base.copy(head).addScaledVector(this.fwd, 2.4).addScaledVector(this.up, -0.1);
    else base.copy(head).addScaledVector(this.fwd, 2.3).addScaledVector(this.right, 0.25).addScaledVector(this.up, 0.3);
    if (hu.uRing) {
      hu.uRing.value = id === 'fate' || graha?.ring ? 1 : 0;
      hu.uSun.value = graha?.sun ? 1 : 0;
    }
    if (id === 'graha') base.copy(head).addScaledVector(this.fwd, 2.2).addScaledVector(this.up, 0.15);
    hu.uFwd.value.copy(this.fwd);
    hu.uRight.value.copy(this.right);
    const [hi, en] = graha?.title ?? WORLD_TITLE[id];
    this.title.setText(`${hi}\n${en}`);
    this.title.mesh.position.copy(head).addScaledVector(this.fwd, 1.25).addScaledVector(this.up, id === 'head' ? 0.98 : 0.5);
    this.title.mesh.lookAt(head);
    this.group.visible = true;
  }

  close(): void {
    if (this.state === 'closed' || this.state === 'fold') return;
    this.state = 'fold';
    this.t = 0;
  }

  /**
   * @param palm  the live palm point the world folds back into (null: keep the last one)
   * @param hands joints of both hands (null entries are untracked) for the passthrough hand mask
   */
  update(dt: number, palm: Vector3 | null, hands: (Joints | null)[]): void {
    this.time += dt;
    if (this.state === 'closed') return;
    this.t += dt;
    if (palm) this.palm.copy(palm);
    const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
    let orbS = 0, orbA = 0, tint = 0, heroA = 0, titleA = 0;
    if (this.state === 'bloom' || this.state === 'open') {
      const t = this.t;
      orbS = 0.11 * ease(t / 0.6);
      orbA = t < 0.6 ? ease(t / 0.4) : 1 - ease((t - 0.6) / 1.0);
      tint = ease(t / 0.6);
      this.reveal = REVEAL_MAX * ease((t - 0.45) / BLOOM);
      this.grow = Math.min(1, Math.max(0, (t - 1.2) / 3.5));
      heroA = ease((t - 0.9) / 1.2);
      titleA = ease((t - 2.2) / 1.0) * (1 - ease((t - 9) / 1.5));
      if (this.state === 'bloom' && t > 0.45 + BLOOM) this.state = 'open';
    } else if (this.state === 'fold') {
      const k = 1 - ease(this.t / FOLD);
      this.reveal = REVEAL_MAX * k;
      heroA = k;
      tint = k;
      orbS = 0.11 * (this.t < FOLD ? 1 : 1 - ease((this.t - FOLD) / 0.4));
      orbA = this.t < FOLD ? ease(this.t / 0.3) : 1 - ease((this.t - FOLD) / 0.4);
      // the world's direction follows the palm as it folds back in
      this.origin.copy(this.palm).sub(this.center).normalize();
      this.skyMat.uniforms.uOrigin.value.copy(this.origin);
      if (this.t > FOLD + 0.45) {
        this.state = 'closed';
        this.group.visible = false;
        this.surround = 0;
        return;
      }
    }
    this.surround = this.reveal / REVEAL_MAX;
    const u = this.skyMat.uniforms;
    u.uReveal.value = this.reveal;
    u.uTint.value = tint;
    u.uTime.value = this.time;
    this.sky.visible = this.reveal > 0.001 || tint > 0.01;
    const mu = (this.motes.material as ShaderMaterial).uniforms;
    mu.uTime.value = this.time;
    mu.uOpacity.value = this.surround;
    this.motes.visible = this.surround > 0.05;
    const h = this.heroes.get(this.world)!;
    const hu = (h.material as ShaderMaterial).uniforms;
    hu.uTime.value = this.time;
    hu.uGrow.value = this.state === 'fold' ? this.grow * heroA : this.grow;
    hu.uOpacity.value = heroA * Math.min(1, this.surround * 1.5);
    h.visible = hu.uOpacity.value > 0.005;
    const ou = (this.orb.material as ShaderMaterial).uniforms;
    ou.uTime.value = this.time;
    ou.uOpacity.value = orbA;
    this.orb.position.copy(this.palm).addScaledVector(this.tmpV.copy(this.center).sub(this.palm).normalize(), 0.04);
    this.orb.scale.setScalar(Math.max(orbS, 1e-4));
    this.orb.visible = orbA > 0.01;
    this.title.opacity = titleA;
    // hand mask: only while the world covers part of the view
    let n = 0;
    if (this.reveal > 0.05) {
      for (const j of hands) {
        if (!j) continue;
        for (let i = 0; i < 25; i++) {
          this.tmpM.makeScale(JOINT_R[i], JOINT_R[i], JOINT_R[i]).setPosition(j[i][0], j[i][1], j[i][2]);
          this.mask.setMatrixAt(n++, this.tmpM);
        }
        for (const [a, b, r] of PALM_FILL) {
          this.tmpM.makeScale(r, r, r).setPosition((j[a][0] + j[b][0]) / 2, (j[a][1] + j[b][1]) / 2, (j[a][2] + j[b][2]) / 2);
          this.mask.setMatrixAt(n++, this.tmpM);
        }
      }
    }
    this.mask.count = n;
    this.mask.instanceMatrix.needsUpdate = n > 0;
    this.mask.visible = n > 0;
  }
}


// ─────────────────────────── grahas over the mounts ───────────────────────────

/** Navagraha colour per mount (gems from the design pack §3.2), and the planet's look. */
export const GRAHA: Record<string, { color: string; look: number }> = {
  jupiter: { color: '#F5B700', look: 0 }, // Guru, yellow sapphire: banded gold
  saturn: { color: '#5B7BD5', look: 1 }, // Shani, blue sapphire: ringed
  sun_apollo: { color: '#E8481C', look: 2 }, // Surya, ruby: corona
  mercury: { color: '#2BB673', look: 0 }, // Budh, emerald
  mars_upper: { color: '#E5533D', look: 0 }, // Mangal, red coral
  luna_moon: { color: '#EAF2FF', look: 3 }, // Chandra, pearl: crescent
  venus: { color: '#FFE3EF', look: 4 }, // Shukra, diamond: sparkling
};

/**
 * The graha of a poked mount rises out of the palm as a small glowing planet
 * (one billboard, the planet shaded in the fragment shader), hovers over the
 * mount while Panditji tells it, then sinks back.
 */
export class GrahaOrb {
  readonly mesh: Mesh;
  private readonly mat: ShaderMaterial;
  private t = 99;
  private time = 0;
  private life = 9;
  readonly base = new Vector3();
  private readonly toEye = new Vector3();

  constructor() {
    this.mat = premul(
      new ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 }, uColor: { value: new Color() }, uLook: { value: 0 } },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main(){
            vUv = uv * 2.0 - 1.0;
            vec3 c = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
            float s = length(modelMatrix[0].xyz);
            vec3 toCam = normalize(cameraPosition - c);
            vec3 r = normalize(cross(vec3(0.0, 1.0, 0.0), toCam)), u = cross(toCam, r);
            gl_Position = projectionMatrix * viewMatrix * vec4(c + (r * position.x + u * position.y) * s, 1.0);
          }`,
        fragmentShader: /* glsl */ `
          precision highp float;
          uniform float uTime; uniform float uOpacity; uniform vec3 uColor; uniform int uLook;
          varying vec2 vUv;
          ${NOISE_GLSL}
          void main(){
            vec2 p = vUv * 1.6;           // planet radius 1 inside a quad of half-size 1.6
            float r = length(p);
            vec3 c = vec3(0.0); float a = 0.0;
            // glow around everything
            float glow = exp(-max(r - 1.0, 0.0) * 4.5) * 0.55;
            c += uColor * glow; a += glow * 0.8;
            if (r < 1.0) {
              vec3 n = vec3(p, sqrt(1.0 - r * r));
              float spin = uTime * 0.4;
              vec3 L = normalize(vec3(-0.5, 0.6, 0.65));
              float lit = 0.3 + 0.7 * max(dot(n, L), 0.0);
              float lat = n.y;
              float lon = atan(n.x, n.z) + spin;
              vec3 base = uColor;
              if (uLook == 0 || uLook == 1) base *= 0.75 + 0.25 * sin(lat * 14.0 + sin(lon * 2.0) * 0.6);
              if (uLook == 3) lit = smoothstep(-0.15, 0.25, dot(n, normalize(vec3(-0.9, 0.2, 0.4))));   // a crescent
              if (uLook == 4) base += vec3(1.0) * pow(noise(vec3(n * 9.0 + uTime)), 8.0) * 3.0;      // diamond sparkle
              float rim = pow(1.0 - n.z, 3.0);
              vec3 s = base * lit + vec3(1.0, 0.95, 0.85) * rim * 0.6;
              if (uLook == 2) s = mix(vec3(1.0, 0.9, 0.55), uColor, r * r) * (1.0 + 0.2 * fbm(vec3(p * 4.0, uTime)));
              c = s; a = 1.0;
            }
            if (uLook == 2) {             // Surya's corona: rays
              float ang = atan(p.y, p.x);
              float rays = pow(0.5 + 0.5 * sin(ang * 12.0 + uTime), 6.0) * exp(-max(r - 1.0, 0.0) * 2.5) * step(1.0, r);
              c += uColor * rays; a += rays * 0.7;
            }
            if (uLook == 1) {             // Shani's ring, tilted, in front of and behind the planet
              vec2 q = vec2(p.x, (p.y + p.x * 0.18) / 0.28);
              float rr = length(q);
              float ring = smoothstep(1.25, 1.3, rr) * smoothstep(1.58, 1.52, rr) * (0.65 + 0.35 * sin(rr * 60.0));
              bool front = q.y < 0.0;
              if (front || r > 1.0) { c = mix(c, vec3(1.0, 0.85, 0.6), ring * 0.85); a = max(a, ring * 0.9); }
            }
            a = clamp(a, 0.0, 1.0) * uOpacity;
            gl_FragColor = vec4(c * uOpacity, a);
          }`,
      }),
    );
    this.mesh = new Mesh(new PlaneGeometry(1, 1), this.mat);
    this.mesh.name = 'graha-orb';
    this.mesh.renderOrder = 24;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  /** Raise the graha of mount `id` (seconds to stay up: `life`). */
  rise(id: string, life = 9): void {
    const g = GRAHA[id] ?? GRAHA.jupiter;
    (this.mat.uniforms.uColor.value as Color).set(g.color);
    this.mat.uniforms.uLook.value = g.look;
    this.t = 0;
    this.life = life;
  }

  sink(): void {
    if (this.t < this.life) this.t = this.life;
  }

  /** @param base the mount on the skin; @param normal the palm normal; @param eye the head */
  update(dt: number, base: Vector3, normal: Vector3, eye: Vector3, visible: boolean): void {
    this.time += dt;
    this.t += dt;
    const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
    const up = ease(this.t / 0.9), down = ease((this.t - this.life) / 0.7);
    const k = up * (1 - down);
    this.mesh.visible = visible && k > 0.005;
    if (!this.mesh.visible) return;
    this.toEye.copy(eye).sub(base).normalize();
    this.mesh.position.copy(base).addScaledVector(normal, 0.012 + 0.05 * k).addScaledVector(this.toEye, 0.01);
    this.mesh.position.y += Math.sin(this.time * 1.6) * 0.003 * k;
    this.mesh.scale.setScalar(0.026 * (0.3 + 0.7 * k) * 1.6 * 2);
    this.mat.uniforms.uTime.value = this.time;
    this.mat.uniforms.uOpacity.value = k;
  }
}
