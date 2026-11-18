/**
 * Hast Rekha director: one system, one explicit phase machine
 * (architecture.md). Every frame it reads both hands' 25 joints, builds the
 * palm frame of the reading hand, and feeds four uniforms to the overlay so
 * the lines and mounts stay on the real skin.
 *
 *  welcome → raise → scan → reveal → mounts → lines → explore → reading → card → (other hand | end)
 *  (explore: the chosen lines glow; touch or pinch one and it opens)
 *
 * Dev-only structured logs for the emulator harness:
 *   [hast] #<page>.<seq> <event> key=value … layout={json}
 */
import { CanvasTexture, createSystem, IBLTexture, Group, Matrix4, Mesh, MeshBasicMaterial, PlaneGeometry, Quaternion, SRGBColorSpace, Vector3 } from '@iwsdk/core';
import { ELEMENTS, LINE_OPTIONS, MOUNTS, READINGS } from './content/readings.js';
import { PANDIT } from './content/script.js';
import type { HandProfile, LineChoices, LineId, MountId, Side } from './content/types.js';
import { LINE_ORDER, LINE_VALUES, shapeFor, TEMPLATE } from './core/line-shapes.js';
import { aggregate, measureOnce, profileFrom, type RawMeasure } from './core/measure.js';
import { dist as vdist, isReadablePalm, type Joints, palmFrame, type PalmFrame, q, toPalm, type V3, facing } from './core/palm-frame.js';
import { OneEuroFilter3 } from './core/one-euro.js';
import { LineToucher, nearestLine, type LineHit, type TouchEvent, type TouchLine } from './core/line-touch.js';
import { buildReading, type ReadingItem, type RulesJson, todaysMountIndex } from './core/rules.js';
import { load as loadSave, otherHand, save as storeSave, type SaveData } from './core/save.js';
import regionsJson from './data/palm-regions.json';
import rulesJson from './data/palmistry-rules.json';
import { Sound, Voice } from './render/audio.js';
import { MountPlate, ShapeCard, TextButton } from './render/cards.js';
import { Setting } from './render/dome.js';
import { LINE_COLORS, MOUNT_ORDER, PalmOverlay } from './render/palm-overlay.js';
import { Pandit } from './render/pandit.js';
import { renderShareCard } from './render/share-card.js';
import { gpuStats } from './render/gpu-stats.js';
import { WorldPortal, type WorldId } from './render/worlds.js';
import { WORLD_NARRATION } from './content/worlds.js';
import { FONT_BODY, Label, loadFonts } from './render/text.js';
import { Hint, Subtitles } from './render/ui.js';

type Phase = 'boot' | 'welcome' | 'raise' | 'scan' | 'reveal' | 'mounts' | 'lines' | 'explore' | 'reading' | 'card' | 'end';

const TAG = '[hast]';
const PAGE = Math.random().toString(36).slice(2, 7);
let SEQ = 0;
const RULES = rulesJson as unknown as RulesJson;
const REGIONS = regionsJson as unknown as { mounts: { id: string; centroid_ab: [number, number] }[] };
const MOUNT_CENTROIDS = MOUNT_ORDER.map((id) => REGIONS.mounts.find((m) => m.id === id)!.centroid_ab);
const MOUNT_TEXT = MOUNT_ORDER.map((id) => MOUNTS.find((m) => m.id === id)!);
const SCAN_SAMPLES = 45;
const POKE_RADIUS = 0.017; // m, on the palm plane
const POKE_DWELL = 0.25; // s
const PINCH_ON = 0.018; // m, thumb tip to index tip
type TouchId = 'heart' | 'head' | 'life' | 'fate';
const TOUCH_IDS: TouchId[] = ['life', 'head', 'heart', 'fate'];
/** Lines that open a world (any other line would just flare and be read aloud). */
const WORLDS_ON = new Set<TouchId>(['heart', 'life', 'head', 'fate']);
const FIST_REACH = 0.115; // m, longest fingertip-to-wrist distance below which a hand counts as a fist

function log(event: string, kv: Record<string, unknown> = {}, layout?: unknown): void {
  if (!import.meta.env.DEV) return;
  const parts = Object.entries(kv).map(([k, v]) => `${k}=${typeof v === 'number' ? +v.toFixed(3) : v}`);
  console.info(`${TAG} #${PAGE}.${++SEQ} ${event}${parts.length ? ' ' + parts.join(' ') : ''}${layout !== undefined ? ' layout=' + JSON.stringify(layout) : ''}`);
}
const r3 = (v: { x: number; y: number; z: number } | V3): number[] =>
  Array.isArray(v) ? v.map((x) => +x.toFixed(3)) : [+v.x.toFixed(3), +v.y.toFixed(3), +v.z.toFixed(3)];

class HandRead {
  tracked = false;
  joints: Joints = Array.from({ length: 25 }, () => [0, 0, 0] as V3);
  smooth: Joints = Array.from({ length: 25 }, () => [0, 0, 0] as V3);
  frame: PalmFrame | null = null;
  readonly tip = new Vector3();
  readonly buf = new Float32Array(25 * 16);
  lostT = 0;
  primed = false;
  /** One Euro per joint: steady at rest (registration on skin), little lag when the hand moves */
  readonly filters = Array.from({ length: 25 }, () => new OneEuroFilter3());
  readonly fOut = { x: 0, y: 0, z: 0 };
  constructor(readonly side: Side) {}
}

export class HastRekhaSystem extends createSystem({}) {
  private phase: Phase = 'boot';
  private phaseT = 0;
  private time = 0;
  private stage = new Group();
  private overlay!: PalmOverlay;
  private setting!: Setting;
  private pandit = new Pandit();
  private subs!: Subtitles;
  private hint!: Hint;
  private sound = new Sound();
  private voice = new Voice();
  private hands: Record<Side, HandRead> = { left: new HandRead('left'), right: new HandRead('right') };
  private readSide: Side | null = null;
  private readyT = 0;
  private samples: RawMeasure[] = [];
  private profile: HandProfile | null = null;
  private choices: LineChoices = {};
  private lineIdx = 0;
  private cards: ShapeCard[] = [];
  private previewValue: string | null = null;
  private btnNext!: TextButton;
  private btnOther!: TextButton;
  private btnFinish!: TextButton;
  private intro!: Label;
  private plate = new MountPlate();
  private mountSeq = -1;
  private mountHeard = new Set<number>();
  private pokeIdx = -1;
  private pokeT = 0;
  private talkUntil = 0;
  private reading: ReadingItem[] = [];
  private readingSchedule: { at: number; key: string }[] = [];
  private cardMesh: Mesh | null = null;
  private cardT = 0;
  private readonly cardFrom = new Vector3();
  private readonly cardTo = new Vector3();
  private saveData: SaveData = loadSave();
  private headWorld = new Vector3();
  private headLocal = new Vector3();
  private stageInv = new Matrix4();
  private H = 1.2;
  private anchored = false;
  private immersive = false;
  private lastLayoutLog = 0;
  private tmpV = new Vector3();
  private tmpQ = new Quaternion();
  private tipsArr: (Vector3 | null)[] = [null, null];
  private keys = new Set<string>();
  private retrySaid = false;
  private lostSaid = 0;
  private readCount = 0;
  // explore: touch a glowing line
  private toucher = new LineToucher<TouchId>();
  private touchEvents: TouchEvent<TouchId>[] = [];
  private touchLines: TouchLine<TouchId>[] = [];
  private tipHit: LineHit<TouchId> = { id: 'heart', dist: 0, h: 0, u: 0 };
  private pinchHit: LineHit<TouchId> = { id: 'heart', dist: 0, h: 0, u: 0 };
  private linesHeard = new Set<TouchId>();
  private exploreMoreSaid = false;
  private shimmerT = 0;
  private portal = new WorldPortal();
  private worldLine: TouchId | null = null;
  private worldT = 0;
  private worldSaid = false;
  private worldGpuLogged = false;
  private fistT = 0;
  private readonly palmPt = new Vector3();
  private maskHands: (Joints | null)[] = [null, null];

  init(): void {
    void loadFonts();
    // Fixed foveation: three defaults to 1.0 (maximum), which visibly softens the periphery where
    // the captions and line cards sit (~20° off centre). 0.5 keeps them crisp; the scene is light
    // (≈75 draw calls), so the GPU can afford it. Verify on device (docs/TESTING.md).
    this.renderer.xr.setFoveation(0.5);
    this.stage.name = 'hast-stage';
    this.world.createTransformEntity(this.stage, { persistent: true });

    this.setting = new Setting(new Vector3(0, 0, -0.98));
    this.stage.add(this.setting.group);
    this.stage.add(this.pandit.group);
    this.pandit.group.position.set(0, 0, -1.45);
    void this.pandit.load();
    void this.setting.loadBaked();
    // image-based light from the pavilion itself (tools/setting/bake_env.py), not a studio:
    // the lamps and the dusk dome show in the brass, the silk and Panditji's eyes
    const root = this.world.activeLevel.value;
    root.addComponent(IBLTexture, { src: `${import.meta.env.BASE_URL}env/pavilion.hdr`, intensity: 1.5 });

    this.overlay = new PalmOverlay(MOUNT_CENTROIDS, MOUNT_TEXT.map((m) => m.sigil));
    // overlay vertices are computed in world space by its shader: keep it at the scene root
    this.world.createTransformEntity(this.overlay.group, { persistent: true });
    // the portal world is centred on the head in world space, like the overlay
    this.world.createTransformEntity(this.portal.group, { persistent: true });

    this.subs = new Subtitles(this.stage, new Vector3(0, 0.96, -0.92));
    this.hint = new Hint(this.stage);

    this.intro = new Label(0.3, 1.25, { size: 50, padding: 40, lineHeight: 1.3, weight: 600, font: FONT_BODY }, 768);
    this.intro.mesh.name = 'intro-card';
    this.stage.add(this.intro.mesh);
    this.intro.opacity = 0;

    this.btnNext = new TextButton('next', 'Continue ›', 'आगे बढ़ें');
    this.btnOther = new TextButton('other', 'Read my other hand', 'दूसरा हाथ', 0.2, 0.06);
    this.btnFinish = new TextButton('finish', 'Finish', 'समाप्त', 0.13, 0.06);
    for (const b of [this.btnNext, this.btnOther, this.btnFinish, this.plate.card]) this.stage.add(b.mesh);

    window.addEventListener('keydown', (e) => this.keys.add(e.key.toLowerCase()));
    const unlock = () => this.sound.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);

    if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).hast = this;
    log('boot', { mounts: MOUNT_ORDER.length, readings: READINGS.length });
    this.placeStageDesktop();
  }

  // ───────────────────────── frame ─────────────────────────

  update(dt: number): void {
    dt = Math.min(dt, 0.05);
    this.time += dt;
    this.phaseT += dt;
    const presenting = !!this.renderer.xr.isPresenting;
    if (presenting !== this.immersive) {
      this.immersive = presenting;
      log('xr', { presenting });
      if (presenting) {
        this.sound.unlock();
        this.anchored = false;
        this.logXRRender();
        this.go('welcome');
      } else {
        this.voice.stop();
        this.sound.setDrone(false);
        this.go('boot');
      }
    }
    (this.immersive ? this.player.head : this.camera).getWorldPosition(this.headWorld);
    if (this.immersive && !this.anchored && this.phaseT > 0.4) this.anchorStage();
    this.stage.updateMatrixWorld(true);
    this.stageInv.copy(this.stage.matrixWorld).invert();
    this.headLocal.copy(this.headWorld).applyMatrix4(this.stageInv);

    this.readHands(dt);
    this.updatePhase(dt);
    this.updateOverlay(dt);

    this.setting.update(dt, this.headLocal);
    this.pandit.talking = this.time < this.talkUntil;
    this.pandit.fadeTarget = this.setting.appearTarget;
    this.pandit.gesture =
      this.phase === 'welcome' && this.phaseT < 4 ? 'namaste' : this.phase === 'end' && this.phaseT < 5 ? 'namaste' : this.pandit.talking && this.phase !== 'raise' && this.phase !== 'lines' ? 'explain' : 'rest';
    this.pandit.update(dt);
    this.pandit.bakeShadowIfReady(this.renderer);
    this.subs.update(dt, this.immersive ? this.player.head : this.camera);
    this.hint.update(dt, this.headLocal);
    this.faceHead(this.intro.mesh);
    this.updateButtons(dt);
    this.keys.clear();

    if (import.meta.env.DEV && this.time - this.lastLayoutLog > 2 && this.immersive) {
      this.lastLayoutLog = this.time;
      this.logLayout();
    }
  }

  /**
   * What the XR compositor actually got: layer type (projection layer = WebXR Layers + MSAA render
   * target; XRWebGLLayer = the browser's own antialias), multiview, foveation and resolution.
   * Logged (dev) once per session so the emulator and the headset can be compared (docs/TESTING.md).
   */
  private logXRRender(): void {
    const xr = this.renderer.xr as typeof this.renderer.xr & { isMultiview?: boolean };
    const layer = xr.getBaseLayer() as (XRWebGLLayer & XRProjectionLayer) | null;
    const gl = this.renderer.getContext();
    log('xr-render', {
      layer: !layer ? 'none' : 'textureWidth' in layer ? 'XRProjectionLayer' : 'XRWebGLLayer',
      antialias: (layer as XRWebGLLayer | null)?.antialias ?? 'n/a',
      ctxAntialias: gl.getContextAttributes()?.antialias,
      samplesMax: (gl as WebGL2RenderingContext).getParameter?.((gl as WebGL2RenderingContext).MAX_SAMPLES),
      multiview: !!xr.isMultiview,
      foveation: xr.getFoveation(),
      fixedFoveation: (layer as XRProjectionLayer | null)?.fixedFoveation ?? 'n/a',
      size: layer ? `${layer.textureWidth ?? layer.framebufferWidth}x${layer.textureHeight ?? layer.framebufferHeight}` : 'n/a',
    });
  }

  // ───────────────────────── stage ─────────────────────────

  private placeStageDesktop(): void {
    this.stage.position.set(0, 0, 0);
    this.stage.rotation.set(0, 0, 0);
    this.H = 1.2;
  }

  /** Put the pavilion in front of the seated user: origin under the head, −Z = where they face. */
  private anchorStage(): void {
    this.player.head.getWorldQuaternion(this.tmpQ);
    const fwd = this.tmpV.set(0, 0, -1).applyQuaternion(this.tmpQ);
    const yaw = Math.atan2(-fwd.x, -fwd.z);
    this.stage.position.set(this.headWorld.x, 0, this.headWorld.z);
    this.stage.rotation.set(0, yaw, 0);
    this.H = Math.max(0.9, Math.min(1.5, this.headWorld.y));
    this.anchored = true;
    // the IBL is in world space: turn it with the stage so the lamps stay where they are drawn
    const root = this.world.activeLevel.value;
    if (root.hasComponent(IBLTexture)) {
      root.getVectorView(IBLTexture, 'rotation')[1] = yaw;
      root.setValue(IBLTexture, '_needsUpdate', true);
    }
    this.layoutUI();
    log('anchor', { H: this.H, yaw }, { head: r3(this.headWorld) });
  }

  private layoutUI(): void {
    const H = this.H;
    this.pandit.group.position.set(0, 0, -1.45);
    this.subs.group.position.set(0, H - 0.1, -0.95); // above the pandit's head, never over his face
    this.intro.mesh.position.set(-0.36, H - 0.08, -0.78);
    this.btnNext.mesh.position.set(0.2, H - 0.36, -0.46);
    this.btnOther.mesh.position.set(-0.14, H - 0.4, -0.46);
    this.btnFinish.mesh.position.set(0.14, H - 0.4, -0.46);
    for (const b of [this.btnNext, this.btnOther, this.btnFinish]) this.tiltToHead(b.mesh);
  }

  private tiltToHead(o: Mesh): void {
    o.lookAt(this.tmpV.copy(this.headLocal.lengthSq() > 0 ? this.headLocal : new Vector3(0, this.H, 0)).applyMatrix4(this.stage.matrixWorld));
  }

  private faceHead(o: Mesh): void {
    if (!o.visible) return;
    o.lookAt(this.headWorld);
  }

  // ───────────────────────── hands ─────────────────────────

  private readHands(dt: number): void {
    const session = this.renderer.xr.getSession();
    const frame = this.xrFrame as (XRFrame & { fillPoses?: (s: XRSpace[], b: XRSpace, o: Float32Array) => boolean }) | undefined;
    const ref = this.renderer.xr.getReferenceSpace();
    const seen: Record<Side, boolean> = { left: false, right: false };
    if (session && frame && ref && frame.fillPoses) {
      this.player.updateWorldMatrix(true, false);
      const pm = this.player.matrixWorld;
      for (const src of session.inputSources) {
        if (!src.hand || (src.handedness !== 'left' && src.handedness !== 'right')) continue;
        const h = this.hands[src.handedness];
        const spaces = Array.from(src.hand.values());
        if (!frame.fillPoses(spaces, ref, h.buf)) continue;
        if (!h.primed) for (const f of h.filters) f.reset();
        for (let i = 0; i < 25; i++) {
          this.tmpV.set(h.buf[i * 16 + 12], h.buf[i * 16 + 13], h.buf[i * 16 + 14]).applyMatrix4(pm);
          const j = h.joints[i], s = h.smooth[i];
          j[0] = this.tmpV.x; j[1] = this.tmpV.y; j[2] = this.tmpV.z;
          h.filters[i].filter(j[0], j[1], j[2], dt, h.fOut);
          s[0] = h.fOut.x; s[1] = h.fOut.y; s[2] = h.fOut.z;
        }
        h.primed = true;
        const tip = h.joints[9];
        h.tip.set(tip[0], tip[1], tip[2]);
        h.frame = palmFrame(h.smooth, h.side);
        seen[h.side] = true;
      }
    }
    for (const side of ['left', 'right'] as Side[]) {
      const h = this.hands[side];
      if (seen[side]) {
        h.tracked = true;
        h.lostT = 0;
      } else {
        h.lostT += dt;
        if (h.lostT > 0.15) {
          h.tracked = false;
          h.primed = false;
        }
      }
    }
    this.tipsArr[0] = this.hands.left.tracked ? this.hands.left.tip : null;
    this.tipsArr[1] = this.hands.right.tracked ? this.hands.right.tip : null;
  }

  private eye(): V3 {
    return [this.headWorld.x, this.headWorld.y, this.headWorld.z];
  }

  /** The reading hand's frame if it is up and facing the eye. */
  private readable(side: Side | null): PalmFrame | null {
    if (!side) return null;
    const h = this.hands[side];
    if (!h.tracked || !h.frame) return null;
    return isReadablePalm(h.frame, this.eye()) ? h.frame : null;
  }

  // ───────────────────────── speech ─────────────────────────

  private say(text: string): number {
    const dur = this.subs.say(text, 'pandit');
    this.voice.say(text);
    this.talkUntil = Math.max(this.talkUntil, this.time) + dur;
    log('say', { dur }, { text });
    return dur;
  }

  private talkLeft(): number {
    return Math.max(0, this.talkUntil - this.time);
  }

  // ───────────────────────── phases ─────────────────────────

  private go(p: Phase): void {
    log('phase', { from: this.phase, to: p });
    this.phase = p;
    this.phaseT = 0;
    this.enter(p);
  }

  private enter(p: Phase): void {
    const today = MOUNT_TEXT[todaysMountIndex(new Date())];
    switch (p) {
      case 'boot':
        this.closeWorld('exit');
        this.setting.appearTarget = 0;
        this.setting.dome.opacityTarget = 0;
        this.overlay.presenceTarget = 0;
        this.hideCards();
        break;
      case 'welcome': {
        this.readSide = null;
        this.choices = {};
        this.profile = null;
        this.mountHeard.clear();
        this.setting.appearTarget = 1;
        this.setting.dome.opacityTarget = 0.96;
        this.sound.setDrone(true);
        this.sound.bell(392);
        this.intro.setText(`हस्त रेखा  ·  Hast Rekha\n${PANDIT.disclaimer}\n${PANDIT.privacy}`);
        const returning = this.saveData.readings.length > 0;
        for (const l of PANDIT.greeting) this.say(l);
        this.say(PANDIT.todaysMount.replace('{mount}', `${today.name_roman} (${today.name_hi}), ${today.short.toLowerCase()}`));
        log('welcome', { returning: returning ? 1 : 0, today: today.id });
        break;
      }
      case 'raise':
        // the user may have sat down or turned since the session began: re-seat the pavilion
        if (this.immersive && (Math.abs(this.headWorld.y - this.H) > 0.08 || Math.hypot(this.headWorld.x - this.stage.position.x, this.headWorld.z - this.stage.position.z) > 0.25)) this.anchorStage();
        this.intro.opacity = 0;
        this.setting.dome.opacityTarget = 0.6; // let the room (and your real hand) in
        this.say(this.readCount > 0 ? PANDIT.otherHand.split('?')[0] + '? Hold it up, palm toward you.' : PANDIT.raisePalm);
        this.hint.show('Hold up your palm, facing you  ✋', new Vector3(0, this.H - 0.32, -0.45), 0);
        this.retrySaid = false;
        this.readyT = 0;
        break;
      case 'scan':
        this.hint.hide();
        this.samples = [];
        this.say(PANDIT.scanning);
        this.sound.tick();
        break;
      case 'reveal': {
        this.sound.swell();
        this.say(PANDIT.linesAppear);
        const el = ELEMENTS.find((e) => e.id === this.profile!.element)!;
        this.say(PANDIT.elementIntro.replace('{element_en}', el.name_en).replace('{element_hi}', `${el.name_hi}, ${el.name_roman}`));
        const r = READINGS.find((x) => x.key === `element:${el.id}`);
        if (r) this.say(r.text);
        break;
      }
      case 'mounts':
        this.mountSeq = 0;
        this.say(PANDIT.mountsIntro);
        // the busiest moment (overlay + sigils + plate + Panditji talking): a headset has no 'g' key
        if (import.meta.env.DEV) setTimeout(() => log('gpu', { ...gpuStats(this.scene, this.renderer) }), 1500);
        break;
      case 'lines':
        this.lineIdx = 0;
        this.overlay.sigils.glowTarget.fill(0.25);
        this.say(PANDIT.linesIntro);
        this.showLineCards();
        break;
      case 'explore':
        this.hideCards();
        this.enterExplore();
        break;
      case 'reading':
        this.hideCards();
        this.hint.hide();
        this.closeWorld('continue');
        for (const id of TOUCH_IDS) this.overlay.lines.get(id)!.breathTarget = 0;
        this.startReading();
        break;
      case 'card':
        this.makeCard();
        break;
      case 'end':
        this.say(PANDIT.farewell);
        this.setting.dome.opacityTarget = 0;
        this.overlay.presenceTarget = 0;
        this.sound.setDrone(false);
        break;
    }
  }

  private updatePhase(dt: number): void {
    const t = this.phaseT;
    const nextPressed = this.keys.has('n');
    if (import.meta.env.DEV && this.keys.has('g')) log('gpu', { ...gpuStats(this.scene, this.renderer) });
    switch (this.phase) {
      case 'welcome':
        this.intro.opacity = Math.min(1, t / 1.2);
        this.btnNext.show(t > 2.5);
        if ((t > 3 && this.talkLeft() <= 0) || nextPressed || this.pressed === 'next') this.go('raise');
        break;
      case 'raise': {
        let side: Side | null = null;
        for (const s of ['right', 'left'] as Side[]) {
          if (this.readable(s)) {
            side = s;
            break;
          }
        }
        if (side) {
          this.readyT += dt;
          if (this.readyT > 0.6) {
            this.readSide = side;
            log('palm-up', { hand: side });
            this.go('scan');
          }
        } else this.readyT = Math.max(0, this.readyT - dt);
        if (t > 14 && !this.retrySaid) {
          this.retrySaid = true;
          this.say(PANDIT.raiseRetry);
        }
        break;
      }
      case 'scan': {
        const f = this.readable(this.readSide);
        if (f) this.samples.push(measureOnce(this.hands[this.readSide!].smooth, this.readSide!));
        this.overlay.sheen.opacityTarget = 1;
        this.overlay.sheen.sweep = -0.1 + ((this.samples.length / SCAN_SAMPLES) * 1.3) % 1.3;
        if (this.samples.length >= SCAN_SAMPLES || (nextPressed && this.samples.length > 3)) {
          const m = aggregate(this.samples);
          this.profile = profileFrom(m, this.readSide!);
          log('profile', { hand: this.readSide, element: this.profile.element, square: m.palmSquareness, finger: m.fingerRatio, index: m.indexRatio, ir: m.indexOverRing, thumb: m.thumbDeg, sp: this.profile.thumbSpread, il: this.profile.indexLength, ivr: this.profile.indexVsRing });
          this.overlay.sheen.opacityTarget = 0.35;
          this.go('reveal');
        }
        break;
      }
      case 'reveal': {
        // the tradition's map draws on, one line at a time
        const order: [LineId, string][] = [['life', TEMPLATE.life], ['head', TEMPLATE.head], ['heart', TEMPLATE.heart], ['fate', TEMPLATE.fate]];
        order.forEach(([id, v], i) => {
          if (t > 0.3 + i * 0.9 && this.overlay.lines.get(id)!.key !== `${id}:${v}`) {
            this.overlay.showLine(id, shapeFor(id, v), `${id}:${v}`);
            this.sound.ting(i);
            log('line-glow', { line: id, shape: v });
          }
        });
        if (t > 6.5 || (nextPressed && t > 0.5)) this.go('mounts');
        break;
      }
      case 'mounts':
        this.updateMounts(dt, nextPressed);
        break;
      case 'lines':
        this.updateLines(nextPressed);
        break;
      case 'explore':
        this.updateExplore(dt, nextPressed);
        break;
      case 'reading':
        this.updateReading(nextPressed);
        break;
      case 'card':
        if (this.pressed === 'other' || this.keys.has('o')) {
          this.readCount++;
          this.removeCard();
          this.readSide = null;
          this.choices = {};
          this.overlay.hideAllLines();
          this.overlay.sigils.glowTarget.fill(0);
          this.go('raise');
        } else if (this.pressed === 'finish' || nextPressed) {
          this.go('end');
        }
        break;
      case 'end':
        if (t > 8) this.btnNext.show(true);
        if (this.pressed === 'next' || (nextPressed && t > 1)) {
          this.removeCard();
          this.overlay.hideAllLines();
          this.go('welcome');
        }
        break;
    }
    this.pressed = null;
  }

  // ───────────────────────── mounts ─────────────────────────

  private updateMounts(dt: number, next: boolean): void {
    const t = this.phaseT;
    // light them one by one
    const step = 0.75;
    const lit = Math.min(7, Math.floor((t - 0.4) / step) + 1);
    if (t > 0.4 && this.mountSeq < lit && this.mountSeq < 7) {
      const i = this.mountSeq;
      this.overlay.sigils.glowTarget[i] = 1;
      this.overlay.sigils.pulse[i] = 1;
      this.sound.ting(i);
      const m = MOUNT_TEXT[i];
      this.plate.set(m.name_hi, m.name_roman, m.planet, m.short);
      log('mount-lit', { id: m.id, i });
      this.mountSeq++;
      if (this.mountSeq === 7) {
        this.say(PANDIT.mountsPoke);
        for (const l of ['life', 'head', 'heart', 'fate'] as LineId[]) this.overlay.dimLine(l, 0.55);
      }
    }
    const pokeLive = this.mountSeq >= 7;
    this.btnNext.show(pokeLive && (this.mountHeard.size >= 1 || t > 7 + 14));
    // poke with the other hand's fingertip
    const f = this.readable(this.readSide);
    let cand = -1;
    if (pokeLive && f) {
      const other = this.hands[this.readSide === 'left' ? 'right' : 'left'];
      if (other.tracked) {
        const [a, b, h] = toPalm(f, [other.tip.x, other.tip.y, other.tip.z]);
        if (h > -0.02 && h < 0.03) {
          let best = POKE_RADIUS;
          MOUNT_CENTROIDS.forEach((c, i) => {
            const d = vdist(q(f, a, b), q(f, c[0], c[1]));
            if (d < best) {
              best = d;
              cand = i;
            }
          });
        }
      }
    }
    if (next && pokeLive) {
      // dev key: "poke" the next unheard mount
      cand = [0, 1, 2, 3, 4, 5, 6].find((i) => !this.mountHeard.has(i)) ?? -1;
      this.pokeT = POKE_DWELL;
      if (cand < 0) {
        this.go('lines');
        return;
      }
    }
    if (cand !== this.pokeIdx) {
      this.pokeIdx = cand;
      this.pokeT = 0;
    } else if (cand >= 0) this.pokeT += dt;
    for (let i = 0; i < 7; i++) {
      if (!pokeLive) break;
      this.overlay.sigils.glowTarget[i] = i === cand ? 1.4 : this.mountHeard.has(i) ? 1 : 0.7;
    }
    if (cand >= 0 && this.pokeT >= POKE_DWELL && (this.pokeT - dt < POKE_DWELL || next)) {
      const m = MOUNT_TEXT[cand];
      this.overlay.sigils.pulse[cand] = 1;
      this.sound.ting(cand + 2);
      this.plate.set(m.name_hi, m.name_roman, m.planet, m.short);
      this.subs.clear();
      this.voice.stop();
      this.talkUntil = this.time;
      this.say(m.text);
      this.mountHeard.add(cand);
      this.saveData.mountsHeard = Array.from(new Set([...this.saveData.mountsHeard, m.id]));
      log('mount-poke', { id: m.id, heard: this.mountHeard.size });
      if (this.mountHeard.size === 7) this.say(PANDIT.mountsDone);
    }
    if (this.pressed === 'next' || (this.mountHeard.size === 7 && this.talkLeft() <= 0)) this.go('lines');
  }

  // ───────────────────────── lines (Layer 2) ─────────────────────────

  private hideCards(): void {
    for (const c of this.cards) {
      c.show(false);
      const m = c.mesh;
      setTimeout(() => m.removeFromParent(), 400);
    }
    this.cards = [];
    this.previewValue = null;
  }

  private showLineCards(): void {
    this.hideCards();
    const line = LINE_ORDER[this.lineIdx];
    this.say(PANDIT.linePrompt[line]);
    const values = LINE_VALUES[line];
    const n = values.length, gap = 0.106;
    values.forEach((v, i) => {
      const label = LINE_OPTIONS.find((o) => o.line === line && o.value === v)?.label ?? v;
      const c = new ShapeCard(`${line}-${v}`, line, v, shapeFor(line, v), label);
      c.mesh.position.set((i - (n - 1) / 2) * gap, this.H - 0.47, -0.4);
      this.stage.add(c.mesh);
      this.tiltToHead(c.mesh as Mesh);
      c.show(true);
      this.cards.push(c);
    });
    // show the template for this line meanwhile, others dim
    for (const id of ['life', 'head', 'heart', 'fate', 'join'] as LineId[]) this.overlay.dimLine(id, this.choices[id as keyof LineChoices] ? 0.5 : 0.22);
    this.previewValue = null;
    this.previewLine(line, values[0], false);
    // the default preview is silent; clear it so hovering card 0 still ticks and confirms
    this.previewValue = null;
    log('line-ask', { line, values: values.join(',') }, { cards: this.cards.map((c) => ({ id: c.id, p: r3(c.mesh.getWorldPosition(new Vector3())) })) });
  }

  private previewLine(line: LineId, value: string, logIt = true): void {
    if (this.previewValue === value) return;
    this.previewValue = value;
    this.overlay.showLine(line, shapeFor(line, value), `${line}:${value}:preview`);
    this.overlay.dimLine(line, 1);
    if (logIt) {
      this.sound.tick();
      log('line-preview', { line, value }, { tips: this.tipsArr.map((t) => (t ? r3(t) : null)) });
    }
  }

  private updateLines(next: boolean): void {
    const line = LINE_ORDER[this.lineIdx];
    let chosen: string | null = null;
    for (const c of this.cards) {
      if (c.hovering) this.previewLine(line, c.value);
      if (c.pressedNow) chosen = c.value;
    }
    const digit = ['1', '2', '3', '4'].find((k) => this.keys.has(k));
    if (digit) chosen = LINE_VALUES[line][+digit - 1] ?? null;
    if (next) chosen = LINE_VALUES[line][0];
    if (!chosen) return;
    (this.choices as Record<string, string>)[line] = chosen;
    this.sound.press();
    this.overlay.showLine(line, shapeFor(line, chosen), `${line}:${chosen}`, false);
    this.overlay.dimLine(line, 0.6);
    const opt = LINE_OPTIONS.find((o) => o.line === line && o.value === chosen);
    log('line-pick', { line, value: chosen });
    this.subs.clear();
    this.voice.stop();
    this.talkUntil = this.time;
    this.say(`${['Good.', 'I see.', 'Ah.', 'Yes.', 'Hmm, good.'][this.lineIdx % 5]} ${opt?.label ?? ''}.`);
    this.lineIdx++;
    if (this.lineIdx >= LINE_ORDER.length) this.go('explore');
    else this.showLineCards();
  }

  // ───────────────────────── explore: touch a glowing line ─────────────────────────

  private enterExplore(): void {
    this.toucher.reset();
    this.linesHeard.clear();
    this.exploreMoreSaid = false;
    this.touchLines = [];
    for (const id of TOUCH_IDS) {
      const v = this.choices[id];
      const r = this.overlay.lines.get(id)!;
      if (!v || shapeFor(id, v).length === 0) {
        this.overlay.dimLine(id, 0);
        continue;
      }
      this.overlay.showLine(id, shapeFor(id, v), `${id}:${v}`, false);
      this.overlay.dimLine(id, 1);
      r.breathTarget = 1;
      this.touchLines.push({ id, strokes: r.smooth });
    }
    this.overlay.dimLine('join', 0.35);
    this.overlay.sigils.glowTarget.fill(0.12);
    this.sound.swell();
    this.say(PANDIT.explore);
    this.hint.show('Touch or pinch a glowing line  ✨', new Vector3(0, this.H - 0.32, -0.45), 0);
    log('explore', { lines: this.touchLines.map((l) => l.id).join(',') });
  }

  /** Thumb tip to index tip, on the toucher hand. */
  private pinching(h: HandRead): boolean {
    return h.tracked && vdist(h.joints[4], h.joints[9]) < PINCH_ON;
  }

  private updateExplore(dt: number, next: boolean): void {
    const t = this.phaseT;
    const f = this.readable(this.readSide);
    const other = this.hands[this.readSide === 'left' ? 'right' : 'left'];
    let tip: LineHit<TouchId> | null = null, pinch: LineHit<TouchId> | null = null;
    if (f && other.tracked && this.touchLines.length) {
      tip = nearestLine(f, other.joints[9], this.touchLines, this.tipHit);
      if (this.pinching(other)) {
        const a = other.joints[4], b = other.joints[9];
        pinch = nearestLine(f, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], this.touchLines, this.pinchHit);
      }
    }
    if (this.worldLine) {
      this.updateWorld(dt, f);
      tip = pinch = null;
    }
    this.toucher.step(dt, tip, pinch, this.touchEvents);
    // dev keys: 1..4 select life/head/heart/fate
    const k = ['1', '2', '3', '4'].findIndex((d) => this.keys.has(d));
    if (k >= 0 && this.touchLines.some((l) => l.id === TOUCH_IDS[k])) this.touchEvents.push({ kind: 'select', id: TOUCH_IDS[k], u: 0.5, by: 'touch' });
    for (const e of this.touchEvents) {
      const r = this.overlay.lines.get(e.id)!;
      switch (e.kind) {
        case 'hover':
          r.hoverTarget = 1;
          this.sound.shimmer(0.3);
          this.shimmerT = 0;
          log('line-hover', { line: e.id });
          break;
        case 'unhover':
          r.hoverTarget = 0;
          break;
        case 'touch':
          r.ripple(e.u);
          this.sound.touchBell(TOUCH_IDS.indexOf(e.id));
          log('line-touch', { line: e.id, u: e.u });
          break;
        case 'select':
          r.flash = 1;
          r.ripple(e.u);
          this.sound.bowl();
          log('line-select', { line: e.id, by: e.by });
          this.openLine(e.id);
          break;
      }
    }
    // the hovered line answers the finger's distance; a faint shimmer repeats while hovering
    if (this.toucher.hover) {
      this.overlay.lines.get(this.toucher.hover)!.hoverTarget = 0.5 + 0.5 * this.toucher.proximity;
      this.shimmerT += dt;
      if (this.shimmerT > 0.45) {
        this.shimmerT = 0;
        this.sound.shimmer(this.toucher.proximity);
      }
    }
    if (this.linesHeard.size > 0 && !this.exploreMoreSaid && !this.worldLine && !this.portal.isOpen && this.talkLeft() <= 0) {
      this.exploreMoreSaid = true;
      this.say(PANDIT.exploreMore);
    }
    this.btnNext.show(!this.worldLine && (this.linesHeard.size > 0 || t > 20 || this.touchLines.length === 0));
    if (this.pressed === 'next' || next) this.go('reading');
  }

  /** A line was selected: its world blooms out of the palm and Panditji tells it from inside. */
  private openLine(id: TouchId): void {
    if (this.worldLine || this.portal.isOpen) return;
    this.subs.clear();
    this.voice.stop();
    this.talkUntil = this.time;
    this.linesHeard.add(id);
    this.exploreMoreSaid = false;
    this.hint.hide();
    const f = this.readable(this.readSide);
    if (!WORLDS_ON.has(id) || !f) {
      const item = this.lineItem(id);
      if (item) this.say(item.text);
      return;
    }
    const c = q(f, 0.55, 0.1, 0.01);
    this.palmPt.set(c[0], c[1], c[2]);
    this.portal.open(id as WorldId, this.palmPt, this.headWorld);
    this.worldLine = id;
    this.worldT = 0;
    this.worldSaid = false;
    this.worldGpuLogged = false;
    this.fistT = 0;
    // the lamps go out while you are inside; Panditji's voice comes from within the world
    this.setting.appearTarget = 0;
    for (const l of TOUCH_IDS) this.overlay.lines.get(l)!.breathTarget = l === id ? 1 : 0.2;
    log('world-open', { line: id });
  }

  private lineItem(id: TouchId) {
    return buildReading(RULES, READINGS, this.profile!, this.choices).find((r) => r.key === `${id}:${this.choices[id]}`);
  }

  /** Longest fingertip-to-wrist reach of a hand: small only when every finger is curled (a fist, not a point). */
  private reach(h: HandRead): number {
    const w = h.joints[0];
    return Math.max(vdist(h.joints[9], w), vdist(h.joints[14], w), vdist(h.joints[19], w), vdist(h.joints[24], w));
  }

  private updateWorld(dt: number, f: PalmFrame | null): void {
    const id = this.worldLine!;
    this.worldT += dt;
    if (!this.worldSaid && this.worldT > 1.4) {
      // the voice begins once the world has started to surround you (design pack §2.4)
      this.worldSaid = true;
      const n = WORLD_NARRATION[id as WorldId];
      this.say(n.intro);
      const item = this.lineItem(id);
      if (item) this.say(item.text);
      this.say(n.outro);
    }
    if (import.meta.env.DEV && !this.worldGpuLogged && this.worldT > 4) {
      this.worldGpuLogged = true;
      log('gpu', { world: id, ...gpuStats(this.scene, this.renderer) });
    }
    // close: either hand made into a fist (held briefly), the dev key x, or the telling is over
    const fist = (['left', 'right'] as Side[]).some((s) => this.hands[s].tracked && this.reach(this.hands[s]) < FIST_REACH);
    this.fistT = fist && this.worldT > 1.0 ? this.fistT + dt : 0;
    if (this.fistT > 0.25) this.closeWorld('fist');
    else if (this.keys.has('x')) this.closeWorld('key');
    else if (this.worldSaid && this.talkLeft() <= 0 && this.worldT > 6) this.closeWorld('told');
    if (f) {
      const c = q(f, 0.55, 0.1, 0.01);
      this.palmPt.set(c[0], c[1], c[2]);
    }
  }

  private closeWorld(reason: string): void {
    const id = this.worldLine;
    if (!id) return;
    this.worldLine = null;
    this.portal.close();
    this.sound.fold();
    this.setting.appearTarget = 1;
    if (reason !== 'told') {
      this.subs.clear();
      this.voice.stop();
      this.talkUntil = this.time;
    }
    // the lines relight in order as the world folds back in
    TOUCH_IDS.forEach((l, i) => {
      const r = this.overlay.lines.get(l)!;
      r.breathTarget = 1;
      setTimeout(() => (r.flash = 0.6), 700 + i * 150);
    });
    log('world-close', { line: id, reason });
  }

  // ───────────────────────── reading ─────────────────────────

  private startReading(): void {
    this.reading = buildReading(RULES, READINGS, this.profile!, this.choices, (m) => log(m));
    this.say(PANDIT.readingIntro);
    this.readingSchedule = [];
    let at = this.talkLeft();
    for (const it of this.reading.slice(1)) {
      // a line already told inside its own world is not repeated
      if (this.linesHeard.has(it.key.split(':')[0] as TouchId)) continue;
      // element was already read during the reveal
      this.readingSchedule.push({ at, key: it.key });
      at += this.say(it.text);
    }
    const other = otherHand(this.saveData, this.profile!.side);
    if (other) {
      const diffs: string[] = [];
      if (other.profile.element !== this.profile!.element) diffs.push(`a ${ELEMENTS.find((e) => e.id === other.profile.element)?.name_en} ${other.profile.side} hand and a ${ELEMENTS.find((e) => e.id === this.profile!.element)?.name_en} ${this.profile!.side} hand`);
      for (const k of ['heart', 'head', 'life'] as const) if (other.choices[k] && other.choices[k] !== this.choices[k]) diffs.push(`your ${k} lines take different shapes`);
      if (diffs.length) this.say(PANDIT.compare.replace('{diff}', diffs.slice(0, 2).join(', and ')));
      log('compare', { other: other.profile.side, diffs: diffs.length });
    }
    this.say(PANDIT.readingOutro);
    log('reading', { items: this.reading.length, keys: this.reading.map((r) => r.key).join(',') });
  }

  private updateReading(next: boolean): void {
    const t = this.phaseT;
    // highlight the line being read
    let current: string | null = null;
    for (const s of this.readingSchedule) if (t >= s.at) current = s.key;
    for (const id of ['life', 'head', 'heart', 'fate', 'join'] as LineId[]) {
      const v = this.choices[id as keyof LineChoices];
      if (!v) continue;
      this.overlay.dimLine(id, current?.startsWith(id + ':') ? 1 : 0.4);
    }
    this.btnNext.show(t > 4);
    if (this.talkLeft() <= 0 || this.pressed === 'next' || next) {
      if (this.talkLeft() > 0) {
        this.subs.clear();
        this.voice.stop();
        this.talkUntil = this.time;
      }
      this.go('card');
    }
  }

  // ───────────────────────── card ─────────────────────────

  private makeCard(): void {
    const p = this.profile!;
    const el = ELEMENTS.find((e) => e.id === p.element)!;
    const byKey = (k: string) => this.reading.find((r) => r.key === k);
    const lines = (['heart', 'head', 'life', 'fate'] as LineId[])
      .map((id) => {
        const r = byKey(`${id}:${this.choices[id as keyof LineChoices]}`);
        const names: Record<string, [string, string]> = { heart: ['Hridaya', 'हृदय रेखा'], head: ['Mastishk', 'मस्तिष्क रेखा'], life: ['Jeevan', 'जीवन रेखा'], fate: ['Bhagya', 'भाग्य रेखा'] };
        return r ? { name: names[id][0], hi: names[id][1], short: r.short, color: LINE_COLORS[id] } : null;
      })
      .filter((x): x is NonNullable<typeof x> => !!x);
    const elR = byKey(`element:${p.element}`);
    const canvas = renderShareCard(
      {
        title_hi: 'हस्त रेखा',
        title_en: 'Hast Rekha',
        side: p.side,
        element_en: el.name_en,
        element_hi: el.name_hi,
        lines,
        quote: elR?.short ?? 'The hand that writes the story is yours.',
        date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
        footer: 'A reading of tradition, for reflection and fun. Not a forecast.',
      },
      this.choices,
    );
    const tex = new CanvasTexture(canvas);
    tex.colorSpace = SRGBColorSpace;
    const mesh = new Mesh(new PlaneGeometry(0.24, 0.3), new MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false }));
    mesh.name = 'share-card';
    // it rises from the pandit's side of the table and settles left of centre, so his face stays in view
    this.cardFrom.set(0, this.H - 0.3, -0.85);
    this.cardTo.set(-0.19, this.H - 0.2, -0.52);
    this.cardT = 0;
    mesh.position.copy(this.cardFrom);
    mesh.scale.setScalar(0.35);
    mesh.renderOrder = 11;
    this.stage.add(mesh);
    mesh.lookAt(this.headWorld);
    this.cardMesh = mesh;
    let dataUrl: string | undefined;
    try {
      const small = document.createElement('canvas');
      small.width = 540;
      small.height = 675;
      small.getContext('2d')!.drawImage(canvas, 0, 0, 540, 675);
      dataUrl = small.toDataURL('image/jpeg', 0.82);
    } catch {
      dataUrl = undefined;
    }
    this.saveData.readings.push({ at: Date.now(), profile: p, choices: { ...this.choices }, card: dataUrl });
    storeSave(this.saveData);
    window.dispatchEvent(new CustomEvent('hast-saved'));
    this.sound.bell(523, 0.2);
    this.say('Here is your Rekha card. It is saved on this headset only. After you leave, you can download it from this page.');
    log('card', { lines: lines.length, saved: this.saveData.readings.length, bytes: dataUrl?.length ?? 0 }, { card: r3(mesh.getWorldPosition(new Vector3())) });
  }

  private removeCard(): void {
    if (!this.cardMesh) return;
    this.cardMesh.removeFromParent();
    (this.cardMesh.material as MeshBasicMaterial).map?.dispose();
    this.cardMesh = null;
  }

  // ───────────────────────── overlay ─────────────────────────

  private updateOverlay(dt: number): void {
    const f = this.readable(this.readSide);
    const show = !!f && ['scan', 'reveal', 'mounts', 'lines', 'explore', 'reading', 'card'].includes(this.phase);
    if (f) this.overlay.setFrame(f);
    this.overlay.presenceTarget = show ? 1 : 0;
    this.overlay.update(dt, this.time);
    this.maskHands[0] = this.hands.left.tracked ? this.hands.left.joints : null;
    this.maskHands[1] = this.hands.right.tracked ? this.hands.right.joints : null;
    this.portal.update(dt, this.worldLine && f ? this.palmPt : null, this.maskHands);
    // the mount name plate floats just above the fingertips of the reading hand
    if (f && this.phase === 'mounts') {
      const p = q(f, 1.85, 0.1, 0.03);
      this.plate.card.mesh.position.set(p[0], p[1], p[2]).applyMatrix4(this.stageInv);
      this.plate.card.mesh.lookAt(this.headWorld);
      this.plate.card.show(this.mountSeq > 0);
    } else this.plate.card.show(false);
    // tracking lost mid-reading: a gentle line, once per loss
    if (this.readSide && ['mounts', 'lines'].includes(this.phase)) {
      const h = this.hands[this.readSide];
      if (!f && h.lostT > 2.5 && this.time - this.lostSaid > 15 && this.phase === 'mounts') {
        this.lostSaid = this.time;
        this.say(PANDIT.trackingLost);
      }
    }
    // pandit looks at your palm when it is up, else at your face
    if (f) {
      const c = q(f, 0.55, 0.1);
      this.pandit.lookAt.set(c[0], c[1], c[2]);
    } else this.pandit.lookAt.copy(this.headWorld);
    if (this.cardMesh) {
      this.cardT = Math.min(1, this.cardT + dt / 1.1);
      const e = 1 - Math.pow(1 - this.cardT, 3);
      this.cardMesh.position.lerpVectors(this.cardFrom, this.cardTo, e);
      this.cardMesh.position.y += Math.sin(e * Math.PI) * 0.06;
      this.cardMesh.scale.setScalar(0.35 + 0.65 * e);
      this.cardMesh.lookAt(this.headWorld);
    }
    const aside = this.readSide && ['scan', 'reveal', 'mounts', 'lines', 'explore', 'reading'].includes(this.phase);
    const onCard = this.phase === 'card';
    const sx = aside ? (this.readSide === 'right' ? -0.3 : 0.3) : onCard ? 0.3 : 0;
    this.tmpV.set(sx, this.H - (aside ? 0.14 : onCard ? 0.18 : 0.1), aside ? -0.82 : onCard ? -0.85 : -0.95);
    this.subs.group.position.lerp(this.tmpV, 1 - Math.exp(-dt * 3));
  }

  // ───────────────────────── buttons ─────────────────────────

  private pressed: string | null = null;

  private updateButtons(dt: number): void {
    if (!['welcome', 'mounts', 'explore', 'reading', 'end'].includes(this.phase)) this.btnNext.show(false);
    this.btnOther.show(this.phase === 'card' && this.phaseT > 2);
    this.btnFinish.show(this.phase === 'card' && this.phaseT > 2);
    for (const b of [this.btnNext, this.btnOther, this.btnFinish]) {
      if (b.update(dt, this.tipsArr)) {
        this.pressed = b.id;
        this.sound.press();
        log('press', { id: b.id });
      }
    }
    this.plate.card.update(dt, []);
    for (const c of this.cards) c.pressedNow = c.update(dt, this.tipsArr);
  }

  /** The sample of a line farthest from every other line (where a test fingertip can't be mistaken). */
  private lonepoint(l: TouchLine<TouchId>): [number, number] {
    let best: [number, number] = l.strokes[0].pts[0], bestD = -1;
    for (const s of l.strokes)
      for (const p of s.pts.slice(2, -2)) {
        let d = Infinity;
        for (const o of this.touchLines) if (o !== l) for (const os of o.strokes) for (const r of os.pts) d = Math.min(d, Math.hypot((p[0] - r[0]) * 0.09, (p[1] - r[1]) * 0.07));
        if (d > bestD) {
          bestD = d;
          best = p;
        }
      }
    return best;
  }

  private logLayout(): void {
    const w = (o: Mesh) => r3(o.getWorldPosition(this.tmpV));
    const f = this.readSide ? this.hands[this.readSide].frame : null;
    log(
      'layout',
      { phase: this.phase, facing: f ? facing(f, this.eye()) : -2 },
      {
        head: r3(this.headWorld),
        buttons: Object.fromEntries([this.btnNext, this.btnOther, this.btnFinish].filter((b) => b.enabled).map((b) => [b.id, w(b.mesh)])),
        cards: this.cards.map((c) => ({ id: c.id, p: w(c.mesh) })),
        mounts: f ? MOUNT_ORDER.map((id, i) => ({ id, p: r3(q(f, MOUNT_CENTROIDS[i][0], MOUNT_CENTROIDS[i][1], 0.004)), n: r3(f.N) })) : [],
        palm: f ? { O: r3(f.O), len: +f.length.toFixed(3), wid: +f.width.toFixed(3) } : null,
        lines: f && this.phase === 'explore' ? this.touchLines.map((l) => { const m = this.lonepoint(l); return { id: l.id, p: r3(q(f, m[0], m[1], 0.004)), n: r3(f.N) }; }) : [],
      },
    );
  }
}

export type { MountId };
