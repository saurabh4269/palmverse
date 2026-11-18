"""
Render a palm-up right hand (MakeHuman/MPFB, CC0 output) for the line-choice cards.
Blender -b -P tools/palm/render_palm.py -- --out public/ui/palm-right.png --json public/ui/palm-right.json
Outputs an RGBA PNG (transparent bg) with no palm lines, plus pixel coords of joints
projected through the camera.
"""
import bpy, sys, os, json, math, argparse, importlib
import numpy as np
from mathutils import Vector, Matrix
from bpy_extras.object_utils import world_to_camera_view

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--out", required=True)
ap.add_argument("--json", required=True)
ap.add_argument("--w", type=int, default=512)
ap.add_argument("--h", type=int, default=640)
ap.add_argument("--samples", type=int, default=96)
ap.add_argument("--spread", type=float, default=4.0, help="deg between neighbouring fingers")
args = ap.parse_args(argv)

PKG = "bl_ext.user_default.mpfb"
HS = importlib.import_module(PKG + ".services.humanservice").HumanService
TS = importlib.import_module(PKG + ".services.targetservice").TargetService
LS = importlib.import_module(PKG + ".services.locationservice").LocationService
bpy.ops.wm.read_factory_settings(use_empty=True)
DATA = LS.get_user_data()

macro = TS.get_default_macro_info_dict()
macro.update({"gender": 0.62, "age": 0.5, "muscle": 0.5, "weight": 0.5, "proportions": 0.7})
macro["race"] = {"asian": 0.3, "caucasian": 0.5, "african": 0.2}
body = HS.create_human(macro_detail_dict=macro, feet_on_ground=True, scale=0.1)
HS.set_character_skin(os.path.join(DATA, "skins/middleage_african_male/middleage_african_male.mhmat"), body, skin_type="GAMEENGINE")
rig = HS.add_builtin_rig(body, "default", import_weights=True)

# ── keep only the right hand + distal forearm ─────────────────────────────
import bmesh
names = {g.index: g.name for g in body.vertex_groups}
def keep(v):
    s = 0.0
    for g in v.groups:
        n = names[g.group]
        if n.startswith(("helper-", "joint-")) and g.weight > 0.5: return False
        if n.endswith(".R") and n.startswith(("wrist", "finger", "metacarpal", "lowerarm")): s += g.weight
    return s > 0.5
bm = bmesh.new(); bm.from_mesh(body.data); bm.verts.ensure_lookup_table()
kill = [bm.verts[v.index] for v in body.data.vertices if not keep(v)]
bmesh.ops.delete(bm, geom=kill, context="VERTS"); bm.to_mesh(body.data); bm.free()
print("verts kept", len(body.data.vertices))

# ── pose: straight fingers, gently fanned; relaxed thumb ──────────────────
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode="POSE")
pb = rig.pose.bones
A = rig.matrix_world
wrist = pb["wrist.R"]
mc = {2: "metacarpal1.R", 3: "metacarpal2.R", 4: "metacarpal3.R", 5: "metacarpal4.R"}
# hand frame from rest bones
mid_dir = (pb["metacarpal2.R"].tail - pb["metacarpal2.R"].head).normalized()
across = (pb["finger2-1.R"].head - pb["finger5-1.R"].head).normalized()  # pinky -> index
normal = mid_dir.cross(across).normalized()

def aim(bone, d):
    """Rotate pose bone (armature space) so its y axis points along d, keeping roll close."""
    bpy.context.view_layer.update()
    M = bone.matrix.copy()
    cur = (bone.tail - bone.head).normalized()
    q = cur.rotation_difference(d)
    R = q.to_matrix().to_4x4()
    T = Matrix.Translation(bone.head)
    bone.matrix = T @ R @ Matrix.Translation(-bone.head) @ M
    bpy.context.view_layer.update()

spread = math.radians(args.spread)
for i, f in enumerate((2, 3, 4, 5)):
    ang = (1.5 - i) * spread  # index fans toward thumb side
    d = (mid_dir * math.cos(ang) + across * math.sin(ang)).normalized()
    # slight natural flex (fingers relax a touch toward the palm)
    for j in (1, 2, 3):
        flex = math.radians((4, 6, 5)[j - 1]) * j
        dj = (d * math.cos(flex) + normal * math.sin(flex)).normalized()
        aim(pb[f"finger{f}-{j}.R"], dj)
bpy.ops.object.mode_set(mode="OBJECT")
bpy.context.view_layer.update()

# ── subdivide + material tweaks ───────────────────────────────────────────
arm_mod = [m for m in body.modifiers if m.type == "ARMATURE"]
sub = body.modifiers.new("subsurf", "SUBSURF"); sub.levels = 2; sub.render_levels = 2
bpy.ops.object.select_all(action="DESELECT")
for o in list(bpy.data.objects):
    if o not in (body, rig): bpy.data.objects.remove(o)
for slot in body.material_slots:
    mat = slot.material
    if not mat or not mat.use_nodes: continue
    nt = mat.node_tree
    tex = next((n for n in nt.nodes if n.type == "TEX_IMAGE" and n.image), None)
    bsdf = next((n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if tex is not None and tex.image.size[0] > 0:
        img = tex.image; W, H = img.size
        px = np.array(img.pixels[:], np.float32).reshape(H, W, 4)
        lum = px[..., :3].mean(-1, keepdims=True)
        px[..., :3] = px[..., :3] * 0.6 + lum * 0.4
        mean = px[..., :3].reshape(-1, 3).mean(0)
        target = np.array([0.56, 0.38, 0.27], np.float32)  # medium-warm (sRGB)
        px[..., :3] = np.clip(px[..., :3] * (target / np.maximum(mean, 1e-3)), 0, 1)
        # soften baked creases (cards draw the palm lines on top): blend with a box-blurred copy
        r = max(2, W // 300); bl = px[..., :3].copy()
        for _ in range(3):
            for ax_ in (0, 1):
                pad = [(r + 1, r), (0, 0), (0, 0)] if ax_ == 0 else [(0, 0), (r + 1, r), (0, 0)]
                c = np.cumsum(np.pad(bl, pad, mode="edge"), axis=ax_)
                n = c.shape[ax_]
                bl = (np.take(c, range(2 * r + 1, n), axis=ax_) - np.take(c, range(0, n - 2 * r - 1), axis=ax_)) / (2 * r + 1)
        px[..., :3] = px[..., :3] * 0.4 + bl * 0.6
        img.pixels = px.ravel()
    if bsdf is not None:
        for k, v in (("Roughness", 0.55), ("Subsurface Weight", 0.25), ("Subsurface Scale", 0.004),
                     ("Specular IOR Level", 0.35), ("Coat Weight", 0.0)):
            if k in bsdf.inputs and not bsdf.inputs[k].is_linked: bsdf.inputs[k].default_value = v
        if "Subsurface Radius" in bsdf.inputs: bsdf.inputs["Subsurface Radius"].default_value = (1.0, 0.45, 0.25)
        for n in nt.nodes:  # drop any normal/bump map: keeps the palm free of baked creases
            pass

# ── joints (armature space → world) ───────────────────────────────────────
W2 = lambda p: A @ p
dg = bpy.context.evaluated_depsgraph_get()
ev = body.evaluated_get(dg)
me_ev = ev.to_mesh()
# tip = farthest vertex along the finger direction among verts weighted to the distal bone
# (use the non-subdivided posed positions: temporarily disable subsurf)
sub.show_viewport = False; bpy.context.view_layer.update()
dg = bpy.context.evaluated_depsgraph_get(); ev = body.evaluated_get(dg); me_ev = ev.to_mesh()
co = [body.matrix_world @ v.co for v in me_ev.vertices]
def tip(bone):
    gi = body.vertex_groups[bone].index
    b = pb[bone]; d = (W2(b.tail) - W2(b.head)).normalized()
    best = None
    for v in body.data.vertices:
        w = next((g.weight for g in v.groups if g.group == gi), 0)
        if w > 0.5:
            p = co[v.index]; s = d.dot(p)
            if best is None or s > best[0]: best = (s, p)
    return best[1]
J = {
    "wrist": W2(pb["wrist.R"].head),
    "index_mcp": W2(pb["finger2-1.R"].head), "middle_mcp": W2(pb["finger3-1.R"].head),
    "ring_mcp": W2(pb["finger4-1.R"].head), "pinky_mcp": W2(pb["finger5-1.R"].head),
    "thumb_tip": tip("finger1-3.R"), "index_tip": tip("finger2-3.R"), "middle_tip": tip("finger3-3.R"),
    "ring_tip": tip("finger4-3.R"), "pinky_tip": tip("finger5-3.R"),
}
ev.to_mesh_clear()
sub.show_viewport = True

# ── camera: orthographic, looking into the palm, fingers up, thumb on the right ──
up = (J["middle_tip"] - J["wrist"]).normalized()
right = (J["index_mcp"] - J["pinky_mcp"]); right = (right - up * right.dot(up)).normalized()
back = right.cross(up).normalized()  # camera +Z (toward viewer)
# make sure the camera sits on the palm side: palm normal = -normal of dorsum? test with the
# thumb: for a right palm facing the viewer, index->pinky runs right->left, which fixes 'back'.
cam_rot = Matrix((right, up, back)).transposed()
# frame: hand bbox in camera plane
pts = [J[k] for k in J] + co[:0]
allp = co
center0 = J["wrist"]
xs = [(p - center0).dot(right) for p in allp]; ys = [(p - center0).dot(up) for p in allp]
top = max(ys); xmin, xmax = min(xs), max(xs)
aspect = args.h / args.w
margin = 0.06
height = (top + 0.0) * (1 + margin) / 0.86  # wrist sits ~86% down the frame
width = max(height / aspect, (xmax - xmin) * (1 + 2 * margin))
height = width * aspect
cx = (xmin + xmax) / 2
cy = top * (1 + margin * 0.6) - height / 2
cam_center = center0 + right * cx + up * cy
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
bpy.context.scene.collection.objects.link(cam)
cam.data.type = "ORTHO"; cam.data.ortho_scale = max(width, height)
cam.data.sensor_fit = "AUTO"
cam.matrix_world = Matrix.Translation(cam_center + back * 0.5) @ cam_rot.to_4x4()
cam.data.clip_start = 0.01; cam.data.clip_end = 2.0
sc = bpy.context.scene; sc.camera = cam
sc.render.resolution_x, sc.render.resolution_y = args.w, args.h
sc.render.resolution_percentage = 100

# ── lights: warm soft studio ──────────────────────────────────────────────
def area(name, pos, energy, size, color):
    L = bpy.data.lights.new(name, "AREA"); L.energy = energy; L.size = size; L.color = color
    o = bpy.data.objects.new(name, L); sc.collection.objects.link(o)
    o.location = pos
    d = (cam_center - Vector(pos)); o.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
area("key", cam_center + back * 0.6 + up * 0.35 - right * 0.30, 14, 0.5, (1.0, 0.86, 0.70))
area("fill", cam_center + back * 0.6 - up * 0.1 + right * 0.45, 5, 0.8, (0.95, 0.92, 0.9))
area("rim", cam_center - back * 0.3 + up * 0.3 + right * 0.2, 6, 0.4, (1.0, 0.85, 0.7))
world = bpy.data.worlds.new("w"); sc.world = world; world.use_nodes = True
bg = world.node_tree.nodes.get("Background"); bg.inputs[0].default_value = (0.9, 0.82, 0.74, 1); bg.inputs[1].default_value = 0.12

sc.render.engine = "CYCLES"; sc.cycles.samples = args.samples; sc.cycles.use_denoising = True
sc.cycles.device = "CPU"
sc.cycles.use_adaptive_sampling = True
sc.render.film_transparent = True
sc.view_settings.view_transform = "AgX"; sc.view_settings.look = "AgX - Medium High Contrast" if False else "None"
sc.render.image_settings.file_format = "PNG"; sc.render.image_settings.color_mode = "RGBA"
sc.render.filepath = os.path.abspath(args.out)
bpy.ops.render.render(write_still=True)

out = {}
for k, p in J.items():
    c = world_to_camera_view(sc, cam, p)
    out[k] = [round(c.x * args.w, 1), round((1 - c.y) * args.h, 1)]
meta = {"image": os.path.basename(args.out), "size": [args.w, args.h], "space": "pixels, x right, y down", "points": out}
with open(args.json, "w") as f: json.dump(meta, f, indent=2)
print("JSON", json.dumps(out))
