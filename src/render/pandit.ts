/**
 * Panditji: the seated scholar across the table. The rigged GLB (built by
 * tools/pandit/build_pandit.py from MakeHuman/MPFB, CC0 output) is driven by
 * render/human.ts: seated cross-legged on his takht, breathing, blinks, head
 * and eyes on your palm (or your face), jaw while he speaks, and a few calm
 * gestures: namaste at the greeting, an open explaining hand while talking,
 * hands resting on the chowki otherwise. If the model fails to load the
 * experience still works (captions + voice).
 */
import { AssetManager, Group, Object3D, Vector3, type WebGLRenderer } from '@iwsdk/core';
import { FootprintShadow } from './contact-shadow.js';
import { type HumanDrive, PanditHuman } from './human.js';

/** pelvis bone height in model space (tools/pandit build output) */
const MODEL_PELVIS_Y = 0.924;
/** takht top above the floor, and the pelvis above the cushion when cross-legged */
const SEAT_Y = 0.41;
const PELVIS_ABOVE_SEAT = 0.1;

export type Gesture = 'rest' | 'namaste' | 'explain' | 'point';

export class Pandit {
  readonly group = new Group();
  loaded = false;
  talking = false;
  /** world-space point to look at */
  readonly lookAt = new Vector3(0, 1.1, 0);
  gesture: Gesture = 'rest';
  /** world-space point the right hand indicates for 'point' */
  readonly pointAt = new Vector3();
  private human: PanditHuman | null = null;
  private model: Object3D | null = null;
  /** his real seated footprint on the durrie, baked once he is posed (render/contact-shadow.ts) */
  readonly shadow = new FootprintShadow(1.1, 1.0);
  private settledT = 0;
  private fade = 0;
  fadeTarget = 0;
  private t = 0;
  private wasTalking = false;
  private readonly drive: HumanDrive = {
    lookAt: new Vector3(),
    rightHand: new Vector3(),
    leftHand: new Vector3(),
    watching: false,
    away: false,
    laugh: 0,
    anger: 0,
    suspicion: 0,
    grip: 0.2,
  };
  private readonly rh = new Vector3();
  private readonly lh = new Vector3();
  private readonly tmp = new Vector3();

  constructor() {
    this.group.name = 'pandit';
    this.shadow.mesh.position.set(0, 0.408, 0.05); // durrie top (takht 0.40 + 6 mm)
    this.group.add(this.shadow.mesh);
  }

  /** Bake the contact shadow once, after he has faded in and the seated IK has settled. */
  bakeShadowIfReady(renderer: WebGLRenderer): void {
    if (this.shadow.baked || !this.model || this.settledT < 0.8) return;
    this.shadow.bake(renderer, this.model);
    if (import.meta.env.DEV) console.info('[hast] contact-shadow baked');
  }

  async load(): Promise<void> {
    try {
      const url = `${import.meta.env.BASE_URL}models/pandit.glb`;
      const gltf = await AssetManager.loadGLTF(url, 'pandit-human');
      const scene = gltf.scene;
      const human = new PanditHuman(scene);
      if (!human.ok) {
        console.warn('[hast] pandit rig missing bones');
        return;
      }
      scene.position.set(0, SEAT_Y + PELVIS_ABOVE_SEAT - MODEL_PELVIS_Y, 0);
      this.group.add(scene);
      this.model = scene;
      human.setFade(0);
      this.human = human;
      this.loaded = true;
      if (import.meta.env.DEV) console.info('[hast] pandit loaded');
    } catch (e) {
      console.warn('[hast] pandit failed to load', e);
    }
  }

  /** Local (group-space) point → world, into `out`. */
  private w(x: number, y: number, z: number, out: Vector3): Vector3 {
    return this.group.localToWorld(out.set(x, y, z));
  }

  update(dt: number): void {
    this.t += dt;
    this.fade += (this.fadeTarget - this.fade) * (1 - Math.exp(-dt * 2));
    const h = this.human;
    if (!h) return;
    h.setFade(this.fade < 0.995 ? this.fade : 1);
    this.settledT = this.fade > 0.98 ? this.settledT + dt : 0;
    this.shadow.mat.opacity = this.fade * 0.9;
    if (this.fade < 0.01) return;
    this.group.updateMatrixWorld(true);
    const t = this.t;
    const pelvisY = SEAT_Y + PELVIS_ABOVE_SEAT;
    if (this.talking && !this.wasTalking) h.talk('…'.repeat(40));
    this.wasTalking = this.talking;
    if (this.talking) h.talk('…'.repeat(20));
    // hand targets in group space (+Z toward the user; his right hand is at −X)
    switch (this.gesture) {
      case 'namaste':
        this.w(-0.015, pelvisY + 0.36, 0.2, this.rh);
        this.w(0.015, pelvisY + 0.36, 0.2, this.lh);
        break;
      case 'explain': {
        const s = Math.sin(t * 1.3), c = Math.sin(t * 0.8 + 1);
        this.w(-0.2 + s * 0.03, pelvisY + 0.24 + c * 0.03, 0.32 + s * 0.02, this.rh);
        this.w(0.16, pelvisY + 0.07, 0.23, this.lh);
        break;
      }
      case 'point':
        this.tmp.copy(this.pointAt);
        this.group.worldToLocal(this.tmp);
        this.tmp.sub(this.w(0, 0, 0, this.rh).set(-0.16, pelvisY + 0.3, 0.1)).normalize().multiplyScalar(0.36);
        this.w(-0.16 + this.tmp.x, pelvisY + 0.3 + this.tmp.y, 0.1 + this.tmp.z, this.rh);
        this.w(0.17, pelvisY + 0.12, 0.26, this.lh);
        break;
      default:
        // resting on the chowki in front of him, a slow breath in the wrists
        this.w(-0.16, pelvisY + 0.07 + Math.sin(t * 1.55) * 0.004, 0.24, this.rh);
        this.w(0.16, pelvisY + 0.07, 0.23, this.lh);
    }
    this.drive.lookAt.copy(this.lookAt);
    this.drive.rightHand.copy(this.rh);
    (this.drive.leftHand as Vector3).copy(this.lh);
    this.drive.watching = this.talking;
    this.drive.laugh = 0;
    h.update(dt, this.drive);
  }
}
