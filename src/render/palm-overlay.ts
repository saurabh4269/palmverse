/**
 * Everything drawn ON the real palm. All geometry is static in palm-frame
 * (a, b) coordinates; the vertex shader maps it to the world with four
 * uniforms (O, Ey, Ex, N) that the director updates from the live joints
 * each frame. So the lines and mounts follow and stretch with the hand at
 * zero CPU cost, and the whole overlay is a handful of draw calls:
 *   - one ribbon mesh per visible line (heart, head, life, fate, join),
 *   - one mesh for all seven mount sigils (atlas texture, per-mount glow),
 *   - one palm-sheen quad (scan sweep + soft vignette).
 *
 * Blending is premultiplied "glow over passthrough": rgb is added and alpha
 * = brightness, so on Quest the camera image still shows through dark parts
 * (plain additive blending writes alpha 1 and paints black quads).
 * depthTest is off: the overlay is only shown while the palm faces the eye,
 * so it can't be seen through the back of the hand.
 */
import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  CustomBlending,
  Group,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  OneFactor,
  OneMinusSrcAlphaFactor,
  ShaderMaterial,
  SRGBColorSpace,
  Vector3,
} from '@iwsdk/core';
import type { LineId, MountId } from '../content/types.js';
import { smoothStroke, type Stroke } from '../core/line-shapes.js';
import type { PalmFrame } from '../core/palm-frame.js';
import { FONT_SERIF } from './text.js';

export const LINE_COLORS: Record<LineId, string> = {
  life: '#ffb347', // saffron gold
  heart: '#ff7aa2', // rose
  head: '#8fd3ff', // sky
  fate: '#9dffb0', // leaf
  join: '#ffe08a',
};

export const MOUNT_ORDER: MountId[] = ['jupiter', 'saturn', 'sun_apollo', 'mercury', 'mars_upper', 'luna_moon', 'venus'];

const PALM_UNIFORMS_GLSL = /* glsl */ `
  uniform vec3 uO; uniform vec3 uEy; uniform vec3 uEx; uniform vec3 uN;
  uniform float uLift;
  vec3 palmQ(vec2 ab){ return uO + ab.x * uEy + ab.y * uEx + uN * uLift; }
`;

function glowBlend(m: ShaderMaterial): ShaderMaterial {
  m.transparent = true;
  m.depthWrite = false;
  m.depthTest = false;
  m.blending = CustomBlending;
  m.blendSrc = OneFactor;
  m.blendDst = OneMinusSrcAlphaFactor;
  m.blendSrcAlpha = OneFactor;
  m.blendDstAlpha = OneMinusSrcAlphaFactor;
  return m;
}

export interface PalmUniforms {
  uO: { value: Vector3 };
  uEy: { value: Vector3 };
  uEx: { value: Vector3 };
  uN: { value: Vector3 };
  uLift: { value: number };
}

class Ribbon {
  readonly mesh: Mesh;
  readonly mat: ShaderMaterial;
  progress = 1;
  target = 1;
  opacity = 0;
  opacityTarget = 0;
  key = '';

  constructor(palm: PalmUniforms, color: string) {
    this.mat = glowBlend(
      new ShaderMaterial({
        uniforms: {
          ...palm,
          uColor: { value: new Color(color) },
          uProgress: { value: 1 },
          uOpacity: { value: 0 },
          uWidth: { value: 0.0021 },
          uTime: { value: 0 },
        },
        vertexShader: /* glsl */ `
          ${PALM_UNIFORMS_GLSL}
          uniform float uWidth;
          attribute vec2 ab; attribute vec2 tan; attribute float side; attribute float u;
          varying float vSide; varying float vU;
          void main(){
            vec3 P = palmQ(ab);
            vec3 T = normalize(tan.x * uEy + tan.y * uEx);
            vec3 B = normalize(cross(uN, T));
            // a glow halo 3x the core width
            vec3 pos = P + B * side * uWidth * 3.0;
            vSide = side; vU = u;
            gl_Position = projectionMatrix * viewMatrix * vec4(pos, 1.0);
          }`,
        fragmentShader: /* glsl */ `
          precision highp float;
          uniform vec3 uColor; uniform float uProgress; uniform float uOpacity; uniform float uTime;
          varying float vSide; varying float vU;
          void main(){
            float d = abs(vSide) * 3.0;           // 0 centre .. 3 halo edge, in core half-widths
            float core = smoothstep(1.15, 0.55, d);
            float halo = exp(-d * d * 0.55) * 0.55;
            float shown = smoothstep(uProgress + 0.002, uProgress - 0.02, vU);
            float tip = exp(-pow((vU - uProgress) * 28.0, 2.0)) * step(uProgress, 0.999);
            float shimmer = 0.85 + 0.15 * sin(vU * 40.0 - uTime * 3.0);
            vec3 c = uColor * (halo * shimmer) + vec3(1.0, 0.97, 0.88) * core * 0.9 + vec3(1.0, 0.9, 0.6) * tip * 1.2 * (1.0 - d / 3.0);
            float a = clamp(max(max(c.r, c.g), c.b), 0.0, 1.0) * shown * uOpacity;
            gl_FragColor = vec4(c * shown * uOpacity, a);
          }`,
      }),
    );
    this.mesh = new Mesh(new BufferGeometry(), this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 20;
    this.mesh.matrixAutoUpdate = false;
  }

  setStrokes(strokes: Stroke[], key: string): void {
    this.key = key;
    const ab: number[] = [], tan: number[] = [], side: number[] = [], u: number[] = [], idx: number[] = [];
    let base = 0;
    for (const s of strokes) {
      const { pts, u: us } = smoothStroke(s, 8);
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i], prev = pts[Math.max(0, i - 1)], next = pts[Math.min(pts.length - 1, i + 1)];
        const t: [number, number] = [next[0] - prev[0], next[1] - prev[1]];
        for (const sd of [-1, 1]) {
          ab.push(p[0], p[1]);
          tan.push(t[0], t[1]);
          side.push(sd);
          u.push(us[i]);
        }
        if (i < pts.length - 1) {
          const a = base + i * 2;
          idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
      }
      base += pts.length * 2;
    }
    const g = this.mesh.geometry;
    g.setAttribute('ab', new BufferAttribute(new Float32Array(ab), 2));
    g.setAttribute('tan', new BufferAttribute(new Float32Array(tan), 2));
    g.setAttribute('side', new BufferAttribute(new Float32Array(side), 1));
    g.setAttribute('u', new BufferAttribute(new Float32Array(u), 1));
    // three needs a position attribute for draw-range bookkeeping
    g.setAttribute('position', new BufferAttribute(new Float32Array(ab.length * 1.5), 3));
    g.setIndex(idx);
    this.mesh.visible = strokes.length > 0;
  }

  update(dt: number, t: number, global: number): void {
    const k = 1 - Math.exp(-dt * 6);
    this.opacity += (this.opacityTarget - this.opacity) * k;
    if (this.progress < this.target) this.progress = Math.min(this.target, this.progress + dt / 1.6);
    else this.progress = this.target;
    this.mat.uniforms.uProgress.value = this.progress;
    this.mat.uniforms.uOpacity.value = this.opacity * global;
    this.mat.uniforms.uTime.value = t;
  }
}

/** Seven sigil discs in one draw call: an atlas of gold-ringed Devanagari letters. */
class MountSigils {
  readonly mesh: Mesh;
  readonly mat: ShaderMaterial;
  readonly glow = new Float32Array(7);
  readonly glowTarget = new Float32Array(7);
  readonly pulse = new Float32Array(7);

  constructor(palm: PalmUniforms, centroids: [number, number][], sigils: string[]) {
    const tex = MountSigils.atlas(sigils);
    this.mat = glowBlend(
      new ShaderMaterial({
        uniforms: {
          ...palm,
          uAtlas: { value: tex },
          uGlow: { value: this.glow },
          uPulse: { value: this.pulse },
          uOpacity: { value: 1 },
          uSize: { value: 0.0115 },
        },
        vertexShader: /* glsl */ `
          ${PALM_UNIFORMS_GLSL}
          uniform float uGlow[7]; uniform float uPulse[7]; uniform float uSize;
          attribute vec2 ab; attribute vec2 corner; attribute float mi;
          varying vec2 vUv; varying float vMi; varying float vGlow;
          void main(){
            int i = int(mi + 0.5);
            float g = uGlow[i];
            vec3 up = normalize(uEy);
            vec3 right = normalize(cross(up, uN));
            float s = uSize * (0.8 + 0.2 * min(g, 1.2) + 0.35 * uPulse[i]);
            vec3 pos = palmQ(ab) + (right * corner.x + up * corner.y) * s;
            vUv = corner * 0.5 + 0.5; vMi = mi; vGlow = g;
            gl_Position = projectionMatrix * viewMatrix * vec4(pos, 1.0);
          }`,
        fragmentShader: /* glsl */ `
          precision highp float;
          uniform sampler2D uAtlas; uniform float uOpacity;
          varying vec2 vUv; varying float vMi; varying float vGlow;
          void main(){
            vec2 uv = vec2((vUv.x + floor(vMi + 0.5)) / 7.0, vUv.y);
            vec4 t = texture2D(uAtlas, uv);
            float a = clamp(t.a * vGlow * uOpacity, 0.0, 1.0);
            gl_FragColor = vec4(t.rgb * a * (1.0 + 0.4 * max(vGlow - 1.0, 0.0)), a);
          }`,
      }),
    );
    const ab: number[] = [], corner: number[] = [], mi: number[] = [], idx: number[] = [];
    centroids.forEach((c, i) => {
      for (const [x, y] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        ab.push(c[0], c[1]);
        corner.push(x, y);
        mi.push(i);
      }
      const b = i * 4;
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    });
    const g = new BufferGeometry();
    g.setAttribute('ab', new BufferAttribute(new Float32Array(ab), 2));
    g.setAttribute('corner', new BufferAttribute(new Float32Array(corner), 2));
    g.setAttribute('mi', new BufferAttribute(new Float32Array(mi), 1));
    g.setAttribute('position', new BufferAttribute(new Float32Array(ab.length * 1.5), 3));
    g.setIndex(idx);
    this.mesh = new Mesh(g, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 22;
    this.mesh.matrixAutoUpdate = false;
  }

  static atlas(sigils: string[]): CanvasTexture {
    const S = 256;
    const c = document.createElement('canvas');
    c.width = S * 7;
    c.height = S;
    const g = c.getContext('2d')!;
    sigils.forEach((s, i) => {
      const cx = i * S + S / 2, cy = S / 2;
      const rg = g.createRadialGradient(cx, cy, S * 0.05, cx, cy, S * 0.5);
      rg.addColorStop(0, 'rgba(255,200,110,0.55)');
      rg.addColorStop(0.55, 'rgba(255,150,50,0.22)');
      rg.addColorStop(1, 'rgba(255,120,30,0)');
      g.fillStyle = rg;
      g.fillRect(i * S, 0, S, S);
      g.strokeStyle = 'rgba(255,225,150,0.95)';
      g.lineWidth = 7;
      g.beginPath();
      g.arc(cx, cy, S * 0.4, 0, Math.PI * 2);
      g.stroke();
      g.lineWidth = 2.5;
      g.beginPath();
      g.arc(cx, cy, S * 0.33, 0, Math.PI * 2);
      g.stroke();
      // eight small petals: a lotus-ring motif
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        g.beginPath();
        g.arc(cx + Math.cos(a) * S * 0.445, cy + Math.sin(a) * S * 0.445, 6, 0, Math.PI * 2);
        g.fillStyle = 'rgba(255,230,160,0.9)';
        g.fill();
      }
      g.fillStyle = '#fff3d6';
      g.font = `${Math.round(S * 0.36)}px ${FONT_SERIF}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.shadowColor = 'rgba(255,160,40,0.9)';
      g.shadowBlur = 18;
      g.fillText(s, cx, cy + S * 0.03);
      g.shadowBlur = 0;
    });
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace;
    t.minFilter = LinearMipmapLinearFilter;
    t.magFilter = LinearFilter;
    t.generateMipmaps = true;
    return t;
  }

  update(dt: number): void {
    const k = 1 - Math.exp(-dt * 5);
    for (let i = 0; i < 7; i++) {
      this.glow[i] += (this.glowTarget[i] - this.glow[i]) * k;
      this.pulse[i] = Math.max(0, this.pulse[i] - dt * 1.4);
    }
  }
}

/** A faint golden sheen over the palm with a sweeping scan band. */
class PalmSheen {
  readonly mesh: Mesh;
  readonly mat: ShaderMaterial;
  sweep = -1;
  opacity = 0;
  opacityTarget = 0;

  constructor(palm: PalmUniforms) {
    this.mat = glowBlend(
      new ShaderMaterial({
        uniforms: { ...palm, uSweep: { value: -1 }, uOpacity: { value: 0 } },
        vertexShader: /* glsl */ `
          ${PALM_UNIFORMS_GLSL}
          attribute vec2 ab; varying vec2 vAb;
          void main(){ vAb = ab; gl_Position = projectionMatrix * viewMatrix * vec4(palmQ(ab), 1.0); }`,
        fragmentShader: /* glsl */ `
          precision highp float;
          uniform float uSweep; uniform float uOpacity; varying vec2 vAb;
          void main(){
            // soft palm-shaped mask: an ellipse over the palm in (a,b)
            vec2 p = (vAb - vec2(0.5, 0.1)) / vec2(0.55, 0.72);
            float m = smoothstep(1.0, 0.6, length(p));
            float band = exp(-pow((vAb.x - uSweep) * 14.0, 2.0));
            vec3 c = vec3(1.0, 0.72, 0.32) * (0.06 * m + band * m * 0.55);
            float a = max(max(c.r, c.g), c.b) * uOpacity;
            gl_FragColor = vec4(c * uOpacity, a);
          }`,
      }),
    );
    const ab: number[] = [], idx: number[] = [];
    const NA = 12, NB = 12;
    for (let i = 0; i <= NA; i++)
      for (let j = 0; j <= NB; j++) ab.push(-0.08 + (1.14 * i) / NA, -0.7 + (1.6 * j) / NB);
    for (let i = 0; i < NA; i++)
      for (let j = 0; j < NB; j++) {
        const a = i * (NB + 1) + j;
        idx.push(a, a + NB + 1, a + 1, a + 1, a + NB + 1, a + NB + 2);
      }
    const g = new BufferGeometry();
    g.setAttribute('ab', new BufferAttribute(new Float32Array(ab), 2));
    g.setAttribute('position', new BufferAttribute(new Float32Array(ab.length * 1.5), 3));
    g.setIndex(idx);
    this.mesh = new Mesh(g, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 18;
    this.mesh.matrixAutoUpdate = false;
  }

  update(dt: number, global: number): void {
    this.opacity += (this.opacityTarget - this.opacity) * (1 - Math.exp(-dt * 5));
    this.mat.uniforms.uSweep.value = this.sweep;
    this.mat.uniforms.uOpacity.value = this.opacity * global;
  }
}

export class PalmOverlay {
  readonly group = new Group();
  readonly palm: PalmUniforms = {
    uO: { value: new Vector3() },
    uEy: { value: new Vector3(0, 0.09, 0) },
    uEx: { value: new Vector3(0.07, 0, 0) },
    uN: { value: new Vector3(0, 0, 1) },
    uLift: { value: 0.004 },
  };
  readonly lines = new Map<LineId, Ribbon>();
  readonly sigils: MountSigils;
  readonly sheen: PalmSheen;
  /** 0..1 master fade (palm visible and facing) */
  presence = 0;
  presenceTarget = 0;

  constructor(centroids: [number, number][], sigils: string[]) {
    this.group.name = 'palm-overlay';
    for (const id of ['life', 'heart', 'head', 'fate', 'join'] as LineId[]) {
      const r = new Ribbon(this.palm, LINE_COLORS[id]);
      r.mesh.name = `line-${id}`;
      this.lines.set(id, r);
      this.group.add(r.mesh);
    }
    this.sigils = new MountSigils(this.palm, centroids, sigils);
    this.sigils.mesh.name = 'mount-sigils';
    this.group.add(this.sigils.mesh);
    this.sheen = new PalmSheen(this.palm);
    this.sheen.mesh.name = 'palm-sheen';
    this.group.add(this.sheen.mesh);
  }

  setFrame(f: PalmFrame): void {
    this.palm.uO.value.set(f.O[0], f.O[1], f.O[2]);
    this.palm.uEy.value.set(f.Ey[0], f.Ey[1], f.Ey[2]);
    this.palm.uEx.value.set(f.Ex[0], f.Ex[1], f.Ex[2]);
    this.palm.uN.value.set(f.N[0], f.N[1], f.N[2]);
  }

  /** Show a line's shape; `reveal` replays the ink-drawing animation. */
  showLine(id: LineId, strokes: Stroke[], key: string, reveal = true): void {
    const r = this.lines.get(id)!;
    if (r.key !== key) {
      r.setStrokes(strokes, key);
      if (reveal) r.progress = 0;
    }
    r.target = 1;
    r.opacityTarget = 1;
  }

  dimLine(id: LineId, level: number): void {
    this.lines.get(id)!.opacityTarget = level;
  }

  hideLine(id: LineId): void {
    const r = this.lines.get(id)!;
    r.opacityTarget = 0;
  }

  hideAllLines(): void {
    for (const id of this.lines.keys()) this.hideLine(id);
  }

  update(dt: number, t: number): void {
    this.presence += (this.presenceTarget - this.presence) * (1 - Math.exp(-dt * 8));
    for (const r of this.lines.values()) r.update(dt, t, this.presence);
    this.sigils.mat.uniforms.uOpacity.value = this.presence;
    this.sigils.update(dt);
    this.sheen.update(dt, this.presence);
    this.group.visible = this.presence > 0.01;
  }
}
