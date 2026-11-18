/**
 * A contact shadow baked once at runtime from a posed subject's real footprint.
 *
 * Panditji's seated pose only exists after the leg IK runs, so it cannot be baked in
 * Blender (that bake is rest-pose). Once he is posed, this renders his body straight
 * up from just under the seat with an orthographic camera into a small depth target (MeshDepthMaterial handles
 * skinning and morphs), then one blur pass turns "height above the seat" into a soft
 * contact darkness: near-black where cloth rests on the durrie, fading over a few cm, and
 * nothing under hands held in the air. The result is the alphaMap of a black decal on the
 * seat. Two tiny render passes, once; no per-frame cost.
 */
import {
  BasicDepthPacking,
  Color,
  DoubleSide,
  LinearFilter,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshDepthMaterial,
  Object3D,
  OrthographicCamera,
  PlaneGeometry,
  ShaderMaterial,
  WebGLRenderer,
  WebGLRenderTarget,
} from '@iwsdk/core';

export class FootprintShadow {
  readonly mesh: Mesh;
  readonly mat: MeshBasicMaterial;
  baked = false;
  private readonly rtDepth: WebGLRenderTarget;
  private readonly rtShadow: WebGLRenderTarget;

  /**
   * @param w footprint width (local x) and @param d depth (local z), metres
   * @param height how far above the surface to look for the subject
   */
  constructor(
    readonly w: number,
    readonly d: number,
    readonly height = 0.9,
    readonly res = 256,
  ) {
    const opts = { minFilter: LinearFilter, magFilter: LinearFilter, generateMipmaps: false, depthBuffer: true };
    this.rtDepth = new WebGLRenderTarget(res, res, opts);
    this.rtShadow = new WebGLRenderTarget(res, res, { ...opts, depthBuffer: false });
    this.mat = new MeshBasicMaterial({ color: 0x000000, alphaMap: this.rtShadow.texture, transparent: true, depthWrite: false, opacity: 0 });
    this.mat.polygonOffset = true;
    this.mat.polygonOffsetFactor = -2;
    this.mat.polygonOffsetUnits = -2;
    const g = new PlaneGeometry(w, d);
    g.rotateX(-Math.PI / 2); // uv v=1 toward local −z, matching the camera's "up" below
    this.mesh = new Mesh(g, this.mat);
    this.mesh.name = 'contact-shadow';
    this.mesh.renderOrder = 2;
    this.mesh.visible = false;
  }

  /**
   * Bake under `subject`. The decal (already parented and placed on the surface) defines the
   * footprint frame: the camera is put `height` above it, looking straight down.
   */
  bake(renderer: WebGLRenderer, subject: Object3D): void {
    const parent = this.mesh.parent;
    if (!parent) return;
    const cam = new OrthographicCamera(-this.w / 2, this.w / 2, this.d / 2, -this.d / 2, 0, this.height + 0.02);
    // looking UP from 2 cm under the seat: the depth is the underside of the cloth, i.e. the
    // real contact (a top-down view would see the top of his legs, ~12 cm up)
    cam.position.copy(this.mesh.position);
    cam.position.y -= 0.02;
    cam.rotation.set(Math.PI / 2, 0, 0); // camera up = local +z
    parent.add(cam);
    parent.updateMatrixWorld(true);

    // 1. depth of the subject seen from above (r = height, alpha = covered)
    const depthMat = new MeshDepthMaterial({ depthPacking: BasicDepthPacking, side: DoubleSide });
    const swapped: [Mesh, Material | Material[]][] = [];
    subject.traverse((o) => {
      const m = o as Mesh;
      if (m.isMesh && m.visible) {
        swapped.push([m, m.material]);
        m.material = depthMat;
      }
    });
    const wasVisible = subject.visible;
    subject.visible = true;
    const xrOn = renderer.xr.enabled;
    const prevRT = renderer.getRenderTarget();
    const prevClear = renderer.getClearColor(new Color());
    const prevAlpha = renderer.getClearAlpha();
    const prevAutoClear = renderer.autoClear;
    try {
      renderer.xr.enabled = false;
      renderer.autoClear = true;
      renderer.setClearColor(0x000000, 0); // coverage lives in alpha: 0 = nothing above
      renderer.setRenderTarget(this.rtDepth);
      renderer.render(subject, cam);

      // 2. height → contact darkness, blurred (one pass, 13×13 taps)
      const quad = new Mesh(
        new PlaneGeometry(2, 2),
        new ShaderMaterial({
          uniforms: { tDepth: { value: this.rtDepth.texture }, uSpan: { value: this.height + 0.02 }, uTexel: { value: 1 / this.res } },
          vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
          fragmentShader: /* glsl */ `
            precision highp float;
            uniform sampler2D tDepth; uniform float uSpan; uniform float uTexel; varying vec2 vUv;
            float contact(vec2 uv){
              vec4 t = texture2D(tDepth, vec2(uv.x, 1.0 - uv.y)); // camera up is +z, the decal's v is −z
              if (t.a < 0.5) return 0.0;                         // nothing above this point
              float h = max((1.0 - t.r) * uSpan - 0.02, 0.0);    // r = 1 − depth from below: metres above
              return exp(-h / 0.045);
            }
            void main(){
              float acc = 0.0, wsum = 0.0;
              for (int j = -6; j <= 6; j++) for (int i = -6; i <= 6; i++) {
                vec2 o = vec2(float(i), float(j)) * 3.0;           // ±18 texels ≈ ±7 cm
                float w = exp(-dot(o, o) / 162.0);               // sigma ≈ 9 texels ≈ 3.6 cm
                acc += contact(vUv + o * uTexel) * w;
                wsum += w;
              }
              // fade the decal border so the footprint never shows a square edge
              vec2 e = min(vUv, 1.0 - vUv) / 0.08;
              float edge = clamp(min(e.x, e.y), 0.0, 1.0);
              gl_FragColor = vec4(vec3(clamp(pow(acc / wsum * 1.6, 0.8), 0.0, 1.0) * edge), 1.0);
            }`,
          depthTest: false,
          depthWrite: false,
        }),
      );
      quad.frustumCulled = false;
      renderer.setRenderTarget(this.rtShadow);
      renderer.render(quad, cam);
      quad.geometry.dispose();
      (quad.material as ShaderMaterial).dispose();
    } finally {
      for (const [m, mat] of swapped) m.material = mat;
      subject.visible = wasVisible;
      depthMat.dispose();
      renderer.setRenderTarget(prevRT);
      renderer.setClearColor(prevClear, prevAlpha);
      renderer.autoClear = prevAutoClear;
      renderer.xr.enabled = xrOn;
      parent.remove(cam);
    }
    if (import.meta.env.DEV) {
      // coarse 16×16 dump of both targets for review in the console
      const px = new Uint8Array(this.res * this.res * 4);
      for (const [name, rt] of [['depth', this.rtDepth], ['shadow', this.rtShadow]] as const) {
        renderer.readRenderTargetPixels(rt, 0, 0, this.res, this.res, px);
        const rows: string[] = [];
        for (let j = 15; j >= 0; j--) {
          let r = '';
          for (let i = 0; i < 16; i++) r += Math.round((px[((j * 16 + 8) * this.res + i * 16 + 8) * 4] / 255) * 9);
          rows.push(r);
        }
        console.info(`[hast] contact-${name} ${rows.join('/')}`);
      }
    }
    this.rtDepth.dispose(); // only the blurred result is kept
    this.baked = true;
    this.mesh.visible = true;
  }
}
