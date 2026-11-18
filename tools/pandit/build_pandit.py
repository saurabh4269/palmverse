"""
Build the Pandit: a realistic, rigged elderly scholar-palmist from MakeHuman/MPFB (CC0 output)
→ public/models/pandit.glb

Adapted from projects/chausar/tools/shakuni/build_shakuni.py (+ costume.py) — same pipeline,
same MPFB "default" rig, same runtime morph names and mesh naming, so chausar's
src/game/human.ts conventions apply unchanged. See tools/pandit/README.md.

Run (Blender 4.2+ / 5.x with the MPFB extension and the MakeHuman CC0 system assets installed):
    Blender -b -P tools/pandit/build_pandit.py -- --out public/models/pandit.glb [--preview artifacts/pandit/build.png]

Character brief (original design, no real person's likeness): a warm, dignified Indian
scholar-palmist in his late sixties — kind eyes with laugh lines, softly greying short beard and
moustache, short grey hair, off-white handloom kurta and pyjama, a deep maroon shawl with a muted
saffron border draped over the left shoulder.

What the script produces:
- body: MPFB basemesh with macro + face targets baked in; helper geometry removed; skin hidden
  under the kurta removed (fewer triangles, no poke-through)
- eyes (high-poly), eyebrows, eyelashes, teeth, tongue (MakeHuman CC0 proxies), short hair proxy recoloured grey
- rig: MPFB "default"
- runtime shape keys on body + lashes + brows:
  blink_L/R, squint_L/R, brow_up_L/R, brow_down_L/R, smile, sneer, mouth_open, purse, frown
- costume (tools/pandit/costume.py): beard + moustache cards, kurta + pyjama, shawl
"""
import bpy, bmesh, sys, os, math, argparse
import numpy as np
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
ap = argparse.ArgumentParser()
ap.add_argument("--out", required=True)
ap.add_argument("--preview", default=None)
ap.add_argument("--no-costume", action="store_true")
ap.add_argument("--no-ao", action="store_true", help="skip the rest-pose AO bake (faster iteration)")
ap.add_argument("--skin-size", type=int, default=2048)
args = ap.parse_args(argv)

PKG = "bl_ext.user_default.mpfb"
import importlib
HumanService = importlib.import_module(PKG + ".services.humanservice").HumanService
TargetService = importlib.import_module(PKG + ".services.targetservice").TargetService
LocationService = importlib.import_module(PKG + ".services.locationservice").LocationService
Mhclo = importlib.import_module(PKG + ".entities.clothes.mhclo").Mhclo

bpy.ops.wm.read_factory_settings(use_empty=True)
DATA = LocationService.get_user_data()

# ── 1. body ───────────────────────────────────────────────────────────────
# MakeHuman age: 0.5 = 25 y, 1.0 = 90 y  →  0.83 ≈ 68 y
macro = TargetService.get_default_macro_info_dict()
macro.update({"gender": 1.0, "age": 0.83, "muscle": 0.36, "weight": 0.57,
              "height": 0.45, "proportions": 0.6})
macro["race"] = {"asian": 0.2, "caucasian": 0.55, "african": 0.25}
basemesh = HumanService.create_human(macro_detail_dict=macro, feet_on_ground=True, scale=0.1)
basemesh.name = "Pandit_Body"

FACE = {
    # soft, round, kind; gentle age
    "l-cheek-volume-incr": 0.15, "r-cheek-volume-incr": 0.15,
    "l-cheek-trans-down": 0.25, "r-cheek-trans-down": 0.25,
    "nose-volume-incr": 0.3, "nose-point-width-incr": 0.35, "nose-flaring-incr": 0.25,
    "nose-scale-vert-incr": 0.15, "nose-curve-convex": 0.15,
    "eyebrows-trans-up": 0.1,
    "l-eye-eyefold-angle-down": 0.2, "r-eye-eyefold-angle-down": 0.2,
    "l-eye-corner2-down": 0.25, "r-eye-corner2-down": 0.25,
    "l-eye-bag-incr": 0.5, "r-eye-bag-incr": 0.5,
    "l-eye-height2-decr": 0.1, "r-eye-height2-decr": 0.1,
    "mouth-angles-up": 0.5, "mouth-laugh-lines-in": 0.6, "mouth-dimples-in": 0.15,
    "mouth-upperlip-volume-decr": 0.15,
    "chin-width-incr": 0.2, "chin-prominent-decr": 0.1,
    "head-age-incr": 0.5, "head-oval": 0.3,
    "neck-double-incr": 0.25,
    "forehead-scale-vert-incr": 0.2,
}
for name, w in FACE.items():
    p = TargetService.target_full_path(name)
    if p: TargetService.load_target(basemesh, p, weight=w, name=name)
    else: print("WARN missing target", name)
# a resting warmth baked into the neutral face: inner brows softly raised, a hint of smile
_units = os.path.join(LocationService.get_mpfb_data("targets"), "expression", "units", "caucasian")
for unit, w in (("eyebrows-left-inner-up", 0.3), ("eyebrows-right-inner-up", 0.3), ("mouth-corner-puller", 0.12)):
    TargetService.load_target(basemesh, os.path.join(_units, unit + ".target.gz"), weight=w, name="rest_" + unit)
TargetService.bake_targets(basemesh)

# ── 2. body parts (fit to the baked shape) ────────────────────────────────
def add(rel, kind):
    path = os.path.join(DATA, rel)
    return HumanService.add_mhclo_asset(path, basemesh, asset_type=kind, subdiv_levels=0, material_type="GAMEENGINE")

eyes = add("eyes/high-poly/high-poly.mhclo", "Eyes")
if eyes is not None:
    _eimg = bpy.data.images.load(os.path.join(DATA, "eyes/materials/brown_eye.png"))
    for _slot in eyes.material_slots:
        for _n in (_slot.material.node_tree.nodes if _slot.material and _slot.material.use_nodes else []):
            if _n.type == "TEX_IMAGE": _n.image = _eimg
    if _eimg.size[0] > 0:
        _px = np.array(_eimg.pixels[:], np.float32).reshape(_eimg.size[1], _eimg.size[0], 4)
        _sat = _px[..., :3].max(-1) - _px[..., :3].min(-1)
        _iris = np.clip((_sat - 0.08) / 0.12, 0, 1)[..., None]
        _lum = _px[..., :3].mean(-1, keepdims=True)
        _m = float((_lum[..., 0] * _iris[..., 0]).sum() / max(1.0, _iris.sum()))
        _px[..., :3] = _px[..., :3] * (1 - _iris) + (_lum / max(_m, 1e-3) * np.array([0.26, 0.15, 0.075], np.float32)) * _iris  # deep brown
        _eimg.pixels = _px.ravel(); _eimg.pack()
BROWS_REL = "eyebrows/eyebrow003/eyebrow003.mhclo"
LASH_REL = "eyelashes/eyelashes01/eyelashes01.mhclo"
brows = add(BROWS_REL, "Eyebrows")
lashes = add(LASH_REL, "Eyelashes")
teeth = add("teeth/teeth_base/teeth_base.mhclo", "Teeth")
tongue = add("tongue/tongue01/tongue01.mhclo", "Tongue")
hair = add("hair/short02/short02.mhclo", "Hair")
HumanService.set_character_skin(os.path.join(DATA, "skins/old_african_male/old_african_male.mhmat"),
                                basemesh, skin_type="GAMEENGINE")

# ── 3. rig ────────────────────────────────────────────────────────────────
rig = HumanService.add_builtin_rig(basemesh, "default", import_weights=True)
rig.name = "Pandit_Rig"

# ── 3b. skin art: warm brown complexion, grey stubble under the beard, soft lips ───
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import costume


def first_image(obj):
    for slot in obj.material_slots:
        if not slot.material or not slot.material.use_nodes: continue
        for n in slot.material.node_tree.nodes:
            if n.type == "TEX_IMAGE" and n.image and n.image.size[0] > 0: return slot.material, n
    return None, None


def region_mask(obj, pred, W, H, blur):
    """Rasterise UV triangles of faces whose vertices all satisfy pred(index, groups) → blurred 0..1 mask."""
    me = obj.data; uv = me.uv_layers.active.data
    names = {g.index: g.name for g in obj.vertex_groups}
    ok = [pred(v.index, {names[g.group]: g.weight for g in v.groups}) for v in me.vertices]
    m = np.zeros((H, W), np.float32)
    for poly in me.polygons:
        if not all(ok[vi] for vi in poly.vertices): continue
        pts = [uv[li].uv for li in poly.loop_indices]
        for k in range(1, len(pts) - 1):
            tri = np.array([pts[0], pts[k], pts[k + 1]], np.float32) * [W, H]
            x0, y0 = np.floor(tri.min(0)).astype(int); x1, y1 = np.ceil(tri.max(0)).astype(int)
            x0, y0, x1, y1 = max(x0, 0), max(y0, 0), min(x1, W - 1), min(y1, H - 1)
            if x1 < x0 or y1 < y0: continue
            yy, xx = np.mgrid[y0:y1 + 1, x0:x1 + 1].astype(np.float32) + 0.5
            (ax, ay), (bx, by), (cx, cy) = tri
            d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
            if abs(d) < 1e-9: continue
            l1 = ((by - cy) * (xx - cx) + (cx - bx) * (yy - cy)) / d
            l2 = ((cy - ay) * (xx - cx) + (ax - cx) * (yy - cy)) / d
            inside = (l1 >= -0.01) & (l2 >= -0.01) & (1 - l1 - l2 >= -0.01)
            m[y0:y1 + 1, x0:x1 + 1][inside] = 1.0
    for _ in range(3):
        for ax_ in (0, 1):
            pad = [(blur + 1, blur), (0, 0)] if ax_ == 0 else [(0, 0), (blur + 1, blur)]
            c = np.cumsum(np.pad(m, pad, mode="edge"), axis=ax_)
            m = (np.take(c, range(2 * blur + 1, c.shape[ax_]), axis=ax_) - np.take(c, range(0, c.shape[ax_] - 2 * blur - 1), axis=ax_)) / (2 * blur + 1)
    return m


def tint(px, mask, rgb, strength):
    a = np.clip(mask * strength, 0, 1)[..., None]
    px[..., :3] = px[..., :3] * (1 - a) + np.array(rgb, np.float32) * a


costume.use_rig(rig)
LM = costume.face_landmarks(basemesh, rig)
if os.environ.get("PANDIT_PROBE"):
    import collections
    gs = costume.groups_of(basemesh)
    acc = collections.defaultdict(list)
    for i, g in enumerate(gs):
        d = costume.dominant(g)
        if d.startswith(("oris", "levator", "risorius", "special", "jaw", "mental")): acc[d].append(LM["co"][i])
    for k, v in sorted(acc.items()):
        c = sum(v, Vector()) / len(v); print("GRP", k, len(v), round(c.x, 3), round(c.y, 3), round(c.z, 3))
    print("LM nose", LM["nose"], "chin", LM["chin"], "mouth_z", LM["mouth_z"])
    sys.exit(0)
mat, tex_node = first_image(basemesh)
if tex_node is not None:
    img = tex_node.image
    S = args.skin_size
    if img.size[0] != S:
        img.scale(S, S)
    W, H = img.size
    px = np.array(img.pixels[:], dtype=np.float32).reshape(H, W, 4)
    # natural warm South-Asian brown: normalise the source's mean, then map to a target tone
    lum = px[..., :3].mean(-1, keepdims=True)
    px[..., :3] = px[..., :3] * 0.75 + lum * 0.25
    mean = px[..., :3].reshape(-1, 3).mean(0)
    target = np.array([0.40, 0.265, 0.185], np.float32)  # sRGB-ish mid brown
    px[..., :3] = np.clip(px[..., :3] * (target / np.maximum(mean, 1e-3)), 0, 1)
    b = max(3, W // 512)
    co = LM["co"]
    beard_pred = lambda i, g: costume.in_beard_zone(co[i], LM, margin=-0.004)
    stub = region_mask(basemesh, beard_pred, W, H, b * 3)
    noise = np.random.default_rng(7).random((H, W)).astype(np.float32)
    tint(px, stub * (0.6 + 0.4 * noise), (0.30, 0.27, 0.25), 0.5)
    w = lambda g, *names: max((g.get(n, 0) for n in names), default=0)
    lids = region_mask(basemesh, lambda i, g: w(g, "orbicularis03.L", "orbicularis03.R", "orbicularis04.L", "orbicularis04.R") > 0.35, W, H, b * 2)
    tint(px, lids, (0.2, 0.12, 0.09), 0.25)  # slightly deeper lids — reads as age, not makeup
    new = bpy.data.images.new("pandit_skin", W, H, alpha=False)
    new.pixels = px.ravel()
    new.file_format = "JPEG"
    new.pack()
    tex_node.image = new
    for n in mat.node_tree.nodes:
        if n.type == "BSDF_PRINCIPLED":
            n.inputs["Roughness"].default_value = 0.6
            if "Specular IOR Level" in n.inputs: n.inputs["Specular IOR Level"].default_value = 0.35
    print("SKIN painted", W, H, int(stub.sum()))
else:
    print("WARN skin image not found")

# grey hair: recolour the proxy's own diffuse to salt-and-pepper grey (keeps its alpha), one clean material
if hair is not None:
    hair.name = "Pandit_Hair"
    src = bpy.data.images.load(os.path.join(DATA, "hair/short02/short02_diffuse.png"))
    if src.size[0] > 1024: src.scale(1024, 1024)
    W, H = src.size
    px = np.array(src.pixels[:], dtype=np.float32).reshape(H, W, 4)
    solid = px[..., 3] > 0.5
    lum = px[..., :3].mean(-1)
    lo, hi = np.percentile(lum[solid], 2), np.percentile(lum[solid], 98)
    lum = np.clip((lum - lo) / max(1e-3, hi - lo), 0, 1)
    rng = np.random.default_rng(5)
    streak = np.repeat(rng.random((1, W)), H, 0) > 0.8  # some darker strands
    g = 0.22 + 0.33 * lum - 0.12 * streak
    px[..., 0] = g; px[..., 1] = g * 0.98; px[..., 2] = g * 0.95
    new = bpy.data.images.new("pandit_hair", W, H, alpha=True)
    new.pixels = px.ravel(); new.file_format = "PNG"; new.pack()
    bpy.data.images.remove(src)
    hm = costume.make_material("hair_grey", image=new, roughness=0.75, alpha_from_image=True)
    hair.data.materials.clear(); hair.data.materials.append(hm)


def simplify_material(mat, keep_alpha, max_size=None):
    """Keep only the base-colour texture; opaque unless keep_alpha (→ JPEG export, no stray maps)."""
    nt = mat.node_tree
    bsdf = next((n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if bsdf is None: return
    base = None
    for l in bsdf.inputs["Base Color"].links:
        n = l.from_node
        while n.type != "TEX_IMAGE" and n.inputs and any(i.links for i in n.inputs):
            n = next(i.links[0].from_node for i in n.inputs if i.links)
        if n.type == "TEX_IMAGE": base = n
    if base is None: return
    if base.outputs["Color"].links and base.outputs["Color"].links[0].to_node != bsdf:
        nt.links.new(base.outputs["Color"], bsdf.inputs["Base Color"])
    bname, bsname = base.name, bsdf.name
    for n in [n for n in nt.nodes if n.type == "TEX_IMAGE" and n.name != bname]:
        nt.nodes.remove(n)
    base, bsdf = nt.nodes[bname], nt.nodes[bsname]  # node refs go stale after removals
    for name in ("Normal", "Specular Tint", "Roughness", "Metallic"):
        for l in list(bsdf.inputs[name].links): nt.links.remove(l)
    if not keep_alpha:
        for l in list(bsdf.inputs["Alpha"].links): nt.links.remove(l)
        bsdf.inputs["Alpha"].default_value = 1.0
    elif not bsdf.inputs["Alpha"].links:
        nt.links.new(base.outputs["Alpha"], bsdf.inputs["Alpha"])
    if max_size and base.image and base.image.size[0] > max_size:
        base.image.scale(max_size, max_size)


simplify_material(basemesh.material_slots[0].material, keep_alpha=False)
for part, alpha, size in ((eyes, True, 512), (brows, True, 256), (lashes, True, 256), (teeth, False, 256), (tongue, False, 128)):
    if part is not None:
        for sl in part.material_slots:
            if sl.material and sl.material.use_nodes: simplify_material(sl.material, alpha, size)
if teeth is not None:  # hidden by the runtime unless the mouth opens wide: 7k → ~1.4k tris
    costume.decimate(teeth, 0.2)

# ── 4. expression shape keys (runtime morph targets) ──────────────────────
EXPR = {
    "blink_L": ("eye-left-closure", 1.0), "blink_R": ("eye-right-closure", 1.0),
    "squint_L": ("eye-left-slit", 1.0), "squint_R": ("eye-right-slit", 1.0),
    "brow_up_L": ("eyebrows-left-up", 1.0), "brow_up_R": ("eyebrows-right-up", 1.0),
    "brow_down_L": ("eyebrows-left-down", 1.0), "brow_down_R": ("eyebrows-right-down", 1.0),
    "smile": ("mouth-corner-puller", 1.0), "sneer": ("mouth-upward-retraction", 1.0),
    "mouth_open": ("mouth-open", 1.0), "purse": ("mouth-pursing", 1.0),
    "frown": ("mouth-depression", 1.0),
}
units = os.path.join(LocationService.get_mpfb_data("targets"), "expression", "units", "caucasian")
if not basemesh.data.shape_keys:
    basemesh.shape_key_add(name="Basis", from_mix=False)
for key, (unit, w) in EXPR.items():
    TargetService.load_target(basemesh, os.path.join(units, unit + ".target.gz"), weight=0.0, name=key)


def interpolate_keys(child, mhclo_file):
    """Copy our expression keys onto a fitted child mesh via MHCLO barycentric mapping."""
    m = Mhclo(); m.load(mhclo_file)
    basis = [v.co.copy() for v in basemesh.data.vertices]
    if not child.data.shape_keys: child.shape_key_add(name="Basis", from_mix=False)
    for key in EXPR:
        src = basemesh.data.shape_keys.key_blocks[key]
        moved = []
        for ci, mp in m.verts.items():
            if ci >= len(child.data.vertices): continue
            (v0, v1, v2), (w0, w1, w2) = mp["verts"], mp["weights"]
            off = (src.data[v0].co - basis[v0]) * w0 + (src.data[v1].co - basis[v1]) * w1 + (src.data[v2].co - basis[v2]) * w2
            if off.length > 1e-5: moved.append((ci, off))
        if not moved: continue
        nk = child.shape_key_add(name=key, from_mix=False); nk.value = 0
        for ci, off in moved: nk.data[ci].co = child.data.shape_keys.key_blocks["Basis"].data[ci].co + off


for child, rel in [(lashes, LASH_REL), (brows, BROWS_REL)]:
    if child: interpolate_keys(child, os.path.join(DATA, rel))

# ── 4b. eyes, lashes, brows, teeth, tongue, hair ride rigidly on the head bone ──
for part in (eyes, lashes, brows, teeth, tongue, hair):
    if part is None: continue
    for g in list(part.vertex_groups): part.vertex_groups.remove(g)
    vg = part.vertex_groups.new(name="head")
    vg.add(range(len(part.data.vertices)), 1.0, "REPLACE")
    for m in list(part.modifiers):
        if m.type not in ("ARMATURE",): part.modifiers.remove(m)
    if not any(m.type == "ARMATURE" for m in part.modifiers):
        mod = part.modifiers.new("Armature", "ARMATURE")
    for m in part.modifiers:
        if m.type == "ARMATURE": m.object = rig

# ── 5. trim helper geometry ───────────────────────────────────────────────
def delete_verts(obj, predicate):
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode="EDIT")
    bm = bmesh.from_edit_mesh(obj.data)
    deform = bm.verts.layers.deform.active
    names = {i: g.name for i, g in enumerate(obj.vertex_groups)}
    kill = [v for v in bm.verts if predicate(v, {names[k]: w for k, w in v[deform].items()} if deform else {})]
    bmesh.ops.delete(bm, geom=kill, context="VERTS")
    bmesh.update_edit_mesh(obj.data)
    bpy.ops.object.mode_set(mode="OBJECT")
    return len(kill)


def is_trash(v, groups):
    return any(n.startswith(("helper-", "joint-")) and w > 0.5 for n, w in groups.items())


print("deleted helpers", delete_verts(basemesh, is_trash), "verts")
for mod in list(basemesh.modifiers):
    if mod.type != "ARMATURE": basemesh.modifiers.remove(mod)

# ── 5b. costume (tools/pandit/costume.py) ──────────────────────────────────
if not args.no_costume:
    LM = costume.face_landmarks(basemesh, rig)  # recompute: indices changed after the trim
    costume.build_beard(basemesh, rig, LM)
    kurta, covered = costume.build_kurta(basemesh, rig)
    costume.build_shawl(basemesh, kurta, rig)
    # remove skin fully hidden under the kurta (keeps shape keys: bmesh delete)
    n = delete_verts(basemesh, lambda v, g: v.index in covered)
    print("deleted covered skin", n, "verts")
    costume.decimate(kurta, 0.55)
    costume.add_placket(kurta, rig)  # after decimation so the buttons stay round

# landmarks for the runtime (glTF space: x, z, -y), metres
for bn in ("root", "pelvis.L", "pelvis.R", "spine03", "neck01", "head", "jaw", "eye.L", "eye.R", "clavicle.R", "upperarm01.R", "lowerarm01.R", "wrist.R", "upperarm01.L", "lowerarm01.L", "wrist.L"):
    if bn in rig.pose.bones:
        h = rig.matrix_world @ rig.pose.bones[bn].head
        print("BONE", bn, round(h.x, 3), round(h.z, 3), round(-h.y, 3))

# ── 5c. bake object transforms into vertices ──────────────────────────────
for o in [o for o in bpy.data.objects if o.type == "MESH"]:
    mw = o.matrix_world.copy()
    if o.parent is not None:
        o.parent = None
    o.matrix_world = mw
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    for m in o.modifiers:
        if m.type == "ARMATURE": m.object = rig

# ── 5d. ambient occlusion, baked in the REST pose (skinned: the bake must not apply the rig) ──
# Darkens costume folds, the neck under the beard, ears, between the fingers and where cloth
# meets skin. A second UV set per object ("AO") carries it; glTF occlusion → three aoMap on uv1.
AO_SIZES = {"Pandit_Body": 1024, "Pandit_Kurta": 1024, "Pandit_Shawl": 512, "Pandit_Beard": 512, "Pandit_Hair": 512}


def bake_ao_rest(sizes, distance=0.06, samples=64):
    import numpy as np
    sc = bpy.context.scene
    prev_engine, prev_pose = sc.render.engine, rig.data.pose_position
    rig.data.pose_position = "REST"
    sc.render.engine = "CYCLES"
    sc.cycles.device = "CPU"
    sc.cycles.samples = samples
    if sc.world is None:
        sc.world = bpy.data.worlds.new("bake")
    sc.world.light_settings.distance = distance
    group = bpy.data.node_groups.get("glTF Material Output")
    if group is None:
        group = bpy.data.node_groups.new("glTF Material Output", "ShaderNodeTree")
        group.interface.new_socket("Occlusion", in_out="INPUT", socket_type="NodeSocketFloat")
    for name, size in sizes.items():
        o = bpy.data.objects.get(name)
        if o is None or not o.material_slots:
            print("AO skip", name)
            continue
        if o.data.shape_keys:
            for kb in o.data.shape_keys.key_blocks:
                kb.value = 0.0
        # the AO layer is created in OBJECT mode so the unwrap writes into it (not into UV0)
        if bpy.context.object and bpy.context.object.mode != "OBJECT":
            bpy.ops.object.mode_set(mode="OBJECT")
        uv = o.data.uv_layers.new(name="AO")
        o.data.uv_layers.active = uv
        bpy.ops.object.select_all(action="DESELECT")
        o.select_set(True)
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="SELECT")
        bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.006)
        bpy.ops.object.mode_set(mode="OBJECT")
        # the placket strip floats 2.5 mm on the kurta and bakes near-black: point its AO UVs at a
        # corner texel forced white after the bake (its own shading comes from the lights)
        n_pl = int(o.get("placket_faces", 0))
        if n_pl:
            for poly in o.data.polygons[-n_pl:]:
                for li in poly.loop_indices:
                    o.data.uv_layers["AO"].data[li].uv = (0.985, 0.985)
        img = bpy.data.images.new(f"{name}_ao", size, size, alpha=False)
        img.colorspace_settings.name = "Non-Color"
        img.generated_color = (1, 1, 1, 1)
        texes = []
        for slot in o.material_slots:
            nt = slot.material.node_tree
            uvn = nt.nodes.new("ShaderNodeUVMap")
            uvn.uv_map = "AO"
            tex = nt.nodes.new("ShaderNodeTexImage")
            tex.image = img
            nt.links.new(uvn.outputs["UV"], tex.inputs["Vector"])
            nt.nodes.active = tex
            texes.append((nt, tex))
        bpy.ops.object.bake(type="AO", margin=6, use_clear=True)
        # take the Monte Carlo grain out (1 px box blur)
        a = np.array(img.pixels[:], dtype=np.float32).reshape(size, size, 4)
        for axis in (0, 1):
            a = (np.roll(a, -1, axis) + a + np.roll(a, 1, axis)) / 3
        if n_pl:
            a[-64:, -64:, :3] = 1.0  # the white corner the placket samples (64 px: survives KTX2 mips)
        img.pixels[:] = a.ravel()
        img.pack()
        for nt, tex in texes:
            out = nt.nodes.new("ShaderNodeGroup")
            out.node_tree = group
            sep = nt.nodes.new("ShaderNodeSeparateColor")
            nt.links.new(tex.outputs["Color"], sep.inputs["Color"])
            nt.links.new(sep.outputs["Red"], out.inputs["Occlusion"])
        o.data.uv_layers.active_index = 0  # UV0 stays the render/skin UV
        print("AO BAKED", name, size, "mean", round(float(a[..., 0].mean()), 3))
    rig.data.pose_position = prev_pose
    sc.render.engine = prev_engine


if not args.no_ao:
    bake_ao_rest(AO_SIZES)

# downscale every other texture to ≤1024 (skin stays at --skin-size)
for im in bpy.data.images:
    if im.name != "pandit_skin" and im.size[0] > 1024:
        f = 1024 / max(im.size)
        im.scale(max(1, int(im.size[0] * f)), max(1, int(im.size[1] * f)))

# ── 6. export ─────────────────────────────────────────────────────────────
for o in bpy.data.objects: o.select_set(o.type in ("MESH", "ARMATURE"))
os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=os.path.abspath(args.out), export_format="GLB", use_selection=True,
                          export_skins=True, export_morph=True, export_morph_normal=False,
                          export_animations=False, export_yup=True, export_image_format="JPEG",
                          export_jpeg_quality=88, export_apply=False)
print("EXPORTED", args.out, os.path.getsize(args.out) // 1024, "KB")
tris = 0
for o in bpy.data.objects:
    if o.type == "MESH":
        t = sum(len(p.vertices) - 2 for p in o.data.polygons); tris += t
        print("MESH", o.name, "verts", len(o.data.vertices), "tris", t, "keys",
              [k.name for k in o.data.shape_keys.key_blocks] if o.data.shape_keys else [],
              "mats", [m.name for m in o.data.materials if m])
print("TRIS total", tris)
