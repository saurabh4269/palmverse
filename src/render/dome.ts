/**
 * The lamp-lit pavilion around the reading: a procedural dome (one draw call,
 * no texture to license) that replaces the walls with a dusk sky seen between
 * carved pillars, and fades out below −15° so your real table, lap and hands
 * stay in passthrough (visual-quality.md §4, "wall-replacing dome").
 * Followed by: a low wooden chowki with diyas in front of Panditji, and a warm
 * flickering lamp light (created once, in the constructor).
 */
import {
  AssetManager,
  BackSide,
  BoxGeometry,
  BufferGeometry,
  Float32BufferAttribute,
  Matrix4,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Group,
  HemisphereLight,
  LatheGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NormalBlending,
  AdditiveBlending,
  PlaneGeometry,
  PointLight,
  ShaderMaterial,
  SphereGeometry,
  Vector2,
  Vector3,
} from '@iwsdk/core';

export class Dome {
  readonly mesh: Mesh;
  readonly mat: ShaderMaterial;
  opacity = 0;
  opacityTarget = 0;

  constructor() {
    this.mat = new ShaderMaterial({
      uniforms: { uOpacity: { value: 0 }, uTime: { value: 0 } },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main(){
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform float uOpacity; uniform float uTime;
        varying vec3 vDir;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        void main(){
          vec3 d = normalize(vDir);
          float el = asin(clamp(d.y, -1.0, 1.0));
          float az = atan(d.x, -d.z); // 0 = straight ahead (-Z)
          // dusk sky: warm amber at the horizon → indigo overhead
          vec3 horizon = vec3(0.62, 0.34, 0.18);
          vec3 mid = vec3(0.36, 0.16, 0.28);
          vec3 top = vec3(0.05, 0.04, 0.13);
          float h = clamp(el / 1.2, 0.0, 1.0);
          vec3 sky = mix(horizon, mid, smoothstep(0.0, 0.25, h));
          sky = mix(sky, top, smoothstep(0.2, 0.85, h));
          // stars
          vec2 g = vec2(az * 60.0, el * 60.0);
          vec2 cell = floor(g);
          float s = hash(cell);
          float tw = 0.6 + 0.4 * sin(uTime * (1.0 + s * 3.0) + s * 40.0);
          float star = step(0.985, s) * (1.0 - smoothstep(0.0, 0.5, length(fract(g) - 0.5))) * tw * smoothstep(0.08, 0.35, el);
          sky += vec3(1.0, 0.95, 0.85) * star * 0.9;
          // pavilion: 12 pillars with cusped arches, dark carved stone against the sky
          float seg = 3.14159265 * 2.0 / 12.0;
          float f = fract(az / seg + 0.5) - 0.5;           // -0.5..0.5 across one bay
          float pillar = (1.0 - smoothstep(0.44, 0.455, abs(f)));   // 0 on the pillar
          float archTop = 0.62 - 0.18 * (1.0 - pow(abs(f) / 0.42, 2.0)) ;
          float cusp = 0.025 * cos(abs(f) * 30.0);
          float opening = pillar * (1.0 - smoothstep(archTop + cusp - 0.01, archTop + cusp + 0.01, el));
          vec3 stone = vec3(0.18, 0.09, 0.06) + vec3(0.25, 0.12, 0.05) * (1.0 - smoothstep(0.0, 0.6, el)) * 0.6;
          // carved band and a jaali screen in the lower part of every bay
          float band = (1.0 - smoothstep(0.0, 0.012, abs(el - (archTop + 0.06))));
          stone += vec3(0.5, 0.3, 0.1) * band * 0.5;
          vec2 jg = vec2(f * 26.0, el * 26.0);
          float jaali = (1.0 - smoothstep(0.28, 0.32, length(fract(jg) - 0.5))) * step(el, 0.06) * pillar;
          vec3 col = mix(stone, sky, opening);
          col = mix(col, sky * 0.8 + vec3(0.15, 0.06, 0.02), jaali * 0.7);
          // lamp warmth ahead, where Panditji sits
          col += vec3(0.35, 0.16, 0.04) * exp(-pow(az * 1.4, 2.0)) * (1.0 - smoothstep(-0.1, 0.5, el)) * 0.6;
          // fade out below the horizon: the real table and hands stay visible
          float a = smoothstep(-0.30, -0.10, el) * uOpacity;
          gl_FragColor = vec4(col, a);
        }`,
      side: BackSide,
      transparent: true,
      depthWrite: false,
      blending: NormalBlending,
    });
    this.mesh = new Mesh(new SphereGeometry(3.2, 64, 32), this.mat);
    this.mesh.name = 'dome';
    this.mesh.renderOrder = -100;
    this.mesh.frustumCulled = false;
  }

  update(dt: number, t: number, head: Vector3): void {
    this.opacity += (this.opacityTarget - this.opacity) * (1 - Math.exp(-dt * 1.6));
    this.mat.uniforms.uOpacity.value = this.opacity;
    this.mat.uniforms.uTime.value = t;
    this.mesh.position.copy(head);
    this.mesh.visible = this.opacity > 0.005;
  }
}

/** A clay diya: lathe body, wick, and a flickering additive flame billboard. */
function makeDiya(clay: MeshStandardMaterial, flameMat: ShaderMaterial): { group: Group; flame: Mesh } {
  const g = new Group();
  const pts = [new Vector2(0, 0), new Vector2(0.022, 0.002), new Vector2(0.034, 0.012), new Vector2(0.036, 0.02), new Vector2(0.028, 0.017), new Vector2(0, 0.012)];
  const body = new Mesh(new LatheGeometry(pts, 20), clay);
  g.add(body);
  const flame = new Mesh(new PlaneGeometry(0.022, 0.05), flameMat);
  flame.position.set(0.02, 0.042, 0);
  flame.renderOrder = 15;
  g.add(flame);
  return { group: g, flame };
}

/**
 * Merge every static MeshStandardMaterial mesh under `root` into one mesh per material
 * (geometry baked into root space). The setting is ~21 small props; this saves ~16 draw calls.
 */
function mergeStatic(root: Group): void {
  root.updateMatrixWorld(true);
  const inv = new Matrix4().copy(root.matrixWorld).invert();
  const byMat = new Map<MeshStandardMaterial, Mesh[]>();
  root.traverse((o) => {
    const m = o as Mesh;
    if (m.isMesh && m.material instanceof MeshStandardMaterial) {
      const list = byMat.get(m.material) ?? [];
      list.push(m);
      byMat.set(m.material, list);
    }
  });
  const rel = new Matrix4();
  for (const [mat, meshes] of byMat) {
    if (meshes.length < 2) continue;
    const pos: number[] = [], nrm: number[] = [], uv: number[] = [], idx: number[] = [];
    for (const m of meshes) {
      const g = m.geometry.clone();
      rel.multiplyMatrices(inv, m.matrixWorld);
      g.applyMatrix4(rel);
      const base = pos.length / 3;
      const P = g.getAttribute('position'), N = g.getAttribute('normal'), U = g.getAttribute('uv');
      for (let i = 0; i < P.count; i++) {
        pos.push(P.getX(i), P.getY(i), P.getZ(i));
        nrm.push(N.getX(i), N.getY(i), N.getZ(i));
        uv.push(U ? U.getX(i) : 0, U ? U.getY(i) : 0);
      }
      const I = g.getIndex();
      if (I) for (let i = 0; i < I.count; i++) idx.push(base + I.getX(i));
      else for (let i = 0; i < P.count; i++) idx.push(base + i);
      g.dispose();
      m.geometry.dispose();
      m.removeFromParent();
    }
    const merged = new BufferGeometry();
    merged.setAttribute('position', new Float32BufferAttribute(pos, 3));
    merged.setAttribute('normal', new Float32BufferAttribute(nrm, 3));
    merged.setAttribute('uv', new Float32BufferAttribute(uv, 2));
    merged.setIndex(idx);
    const mesh = new Mesh(merged, mat);
    mesh.name = `setting-merged-${meshes[0].name || 'props'}`;
    root.add(mesh);
  }
}

export class Setting {
  readonly group = new Group();
  readonly dome = new Dome();
  readonly lamp: PointLight;
  private flames: Mesh[] = [];
  private readonly flameMat: ShaderMaterial;
  private t = 0;
  appear = 0;
  appearTarget = 0;
  baked: Group | null = null;

  /** chowki: the low table in front of Panditji, at his side of the room (stage-local). */
  constructor(chowkiPos: Vector3) {
    this.group.name = 'setting';
    const wood = new MeshStandardMaterial({ color: new Color('#5a2e16'), roughness: 0.55, metalness: 0.0 });
    const brass = new MeshStandardMaterial({ color: new Color('#a87a2e'), roughness: 0.35, metalness: 0.85 });
    const clay = new MeshStandardMaterial({ color: new Color('#9a4a24'), roughness: 0.8 });
    const cloth = new MeshStandardMaterial({ color: new Color('#7a1f1a'), roughness: 0.9 });
    const durrieMat = new MeshStandardMaterial({ color: new Color('#3d2a52'), roughness: 0.95 });
    this.flameMat = new ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 } },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main(){
          vUv = uv;
          // cylindrical billboard: face the camera around the local Y axis
          vec4 c = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          vec3 scl = vec3(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz), 1.0);
          gl_Position = projectionMatrix * (c + vec4(position.xy * scl.xy, 0.0, 0.0));
        }`,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform float uTime; uniform float uOpacity; varying vec2 vUv;
        void main(){
          vec2 p = vUv - vec2(0.5, 0.18);
          float sway = sin(uTime * 7.0 + vUv.y * 4.0) * 0.04 * vUv.y;
          p.x += sway;
          float r = length(vec2(p.x * 2.6, p.y * (p.y > 0.0 ? 1.0 : 2.6)));
          float f = (1.0 - smoothstep(0.05, 0.5, r));
          vec3 c = mix(vec3(1.0, 0.45, 0.08), vec3(1.0, 0.95, 0.75), (1.0 - smoothstep(0.0, 0.25, r)));
          float a = f * uOpacity;
          gl_FragColor = vec4(c * a, a);
        }`,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    // chowki
    // a low takht (wooden platform) Panditji sits on, and his chowki on top of it
    const takht = new Mesh(new BoxGeometry(1.2, 0.4, 0.8), wood);
    takht.position.set(chowkiPos.x, 0.2, chowkiPos.z - 0.3);
    this.group.add(takht);
    const durrie = new Mesh(new BoxGeometry(1.14, 0.006, 0.74), durrieMat);
    durrie.position.set(chowkiPos.x, 0.403, chowkiPos.z - 0.32);
    this.group.add(durrie);
    const chowki = new Group();
    chowki.position.copy(chowkiPos);
    chowki.position.y += 0.4;
    const top = new Mesh(new BoxGeometry(0.5, 0.03, 0.22), wood);
    top.position.y = 0.2;
    chowki.add(top);
    for (const [x, z] of [[-0.22, -0.09], [0.22, -0.09], [-0.22, 0.09], [0.22, 0.09]]) {
      const leg = new Mesh(new CylinderGeometry(0.018, 0.014, 0.19, 10), wood);
      leg.position.set(x, 0.095, z);
      chowki.add(leg);
    }
    const runner = new Mesh(new BoxGeometry(0.4, 0.004, 0.16), cloth);
    runner.position.y = 0.217;
    chowki.add(runner);
    const plate = new Mesh(new CylinderGeometry(0.09, 0.08, 0.01, 32), brass);
    plate.position.set(0.1, 0.222, 0.0);
    chowki.add(plate);
    for (const [x, z] of [[-0.17, 0.03], [0.07, -0.02], [0.13, 0.03]]) {
      const d = makeDiya(clay, this.flameMat);
      d.group.position.set(x, x > 0 ? 0.228 : 0.218, z);
      chowki.add(d.group);
      this.flames.push(d.flame);
    }
    this.group.add(chowki);
    // two floor diyas at the pavilion edge
    for (const x of [-0.7, 0.7]) {
      const stand = new Group();
      const foot = new Mesh(new CylinderGeometry(0.07, 0.09, 0.03, 20), brass);
      foot.position.y = 0.015;
      const pole = new Mesh(new CylinderGeometry(0.012, 0.016, 0.95, 10), brass);
      pole.position.y = 0.5;
      const dish = new Mesh(new CylinderGeometry(0.06, 0.02, 0.03, 20), brass);
      dish.position.y = 0.98;
      stand.add(foot, pole, dish);
      stand.position.set(chowkiPos.x + x, 0, chowkiPos.z - 0.35);
      this.group.add(stand);
      const d = makeDiya(clay, this.flameMat);
      d.group.position.set(chowkiPos.x + x, 0.995, chowkiPos.z - 0.35);
      this.group.add(d.group);
      this.flames.push(d.flame);
    }
    // lights, created once (adding lights later recompiles every shader)
    this.lamp = new PointLight(new Color('#ffb25c'), 0, 3.5, 1.6);
    this.lamp.position.set(chowkiPos.x, 0.95, chowkiPos.z + 0.1);
    this.group.add(this.lamp);
    const hemi = new HemisphereLight(new Color('#ffd9b0'), new Color('#3a1c10'), 0.9);
    this.group.add(hemi);
    const key = new DirectionalLight(new Color('#ffe7c8'), 1.1);
    key.position.set(0.6, 1.8, 0.8);
    this.group.add(key);
    mergeStatic(this.group); // before the dome (a ShaderMaterial) so it is untouched
    this.group.add(this.dome.mesh);
  }

  /**
   * Swap the procedural props for the Blender-baked set (tools/setting/build_setting.py):
   * same geometry, bevelled, with baked AO on UV1 and a floor contact shadow cut from the
   * real footprints. Until it arrives (or if it fails) the procedural props stay.
   */
  async loadBaked(): Promise<void> {
    try {
      const gltf = await AssetManager.loadGLTF(`${import.meta.env.BASE_URL}models/setting.glb`, 'setting-baked');
      const scene = gltf.scene;
      scene.name = 'setting-baked';
      scene.traverse((o) => {
        const m = o as Mesh;
        if (!m.isMesh) return;
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        if (m.name.startsWith('Setting_FloorShadow') || mats.some((x) => x.name === 'floor_shadow')) {
          const src = mats[0] as MeshStandardMaterial;
          // unlit black with the baked occlusion as alpha: grounds the takht on the real floor
          m.material = new MeshBasicMaterial({ color: 0x000000, map: src.map, transparent: true, depthWrite: false, opacity: 0.9 });
          m.renderOrder = 1;
        } else {
          for (const x of mats as MeshStandardMaterial[]) {
            x.aoMapIntensity = 1;
          }
        }
      });
      for (const o of [...this.group.children]) if (o.name.startsWith('setting-merged-')) o.removeFromParent();
      this.group.add(scene);
      this.baked = scene;
      if (import.meta.env.DEV) console.info('[hast] baked setting loaded');
    } catch (e) {
      console.warn('[hast] baked setting failed; keeping procedural props', e);
    }
  }

  update(dt: number, head: Vector3): void {
    this.t += dt;
    this.appear += (this.appearTarget - this.appear) * (1 - Math.exp(-dt * 1.5));
    const flick = 0.85 + 0.1 * Math.sin(this.t * 11.3) + 0.05 * Math.sin(this.t * 23.7 + 1.3);
    this.lamp.intensity = 2.2 * flick * this.appear;
    this.flameMat.uniforms.uTime.value = this.t;
    this.flameMat.uniforms.uOpacity.value = this.appear;
    this.dome.update(dt, this.t, head);
  }
}

export { MeshBasicMaterial };
