"""
Hast Rekha · the pavilion props as one baked GLB (public/models/setting.glb).

The takht (platform), durrie, chowki (low table) with runner, brass plate and
clay diyas, and the two brass lamp stands, at exactly the sizes and positions
src/render/dome.ts used to build procedurally (stage space, metres; three.js
y-up, -z toward Panditji). Edges are bevelled, and ambient occlusion is baked
with everything present, so contacts (chowki legs on the durrie, diyas on the
runner, the takht's base) come from the real geometry.

Two outputs inside the GLB:
  - Setting_Props: one mesh, one material per surface (wood, brass, clay, cloth,
    durrie), all sharing one AO atlas on UV1 (glTF occlusion → three aoMap).
  - Setting_FloorShadow: a floor-level catcher whose RGBA texture is black with
    alpha = baked occlusion of the floor by the takht and stand feet, i.e. a soft
    contact shadow cut from the props' real footprints (not a blob).

Run from projects/hast-rekha/:
  /Applications/Blender.app/Contents/MacOS/Blender -b -P tools/setting/build_setting.py -- --out public/models/setting.glb
Takes about a minute on CPU (Cycles AO bakes).
"""
import argparse
import math
import os
import sys

import bmesh
import bpy

ap = argparse.ArgumentParser()
ap.add_argument("--out", default="public/models/setting.glb")
ap.add_argument("--ao-size", type=int, default=1024)
ap.add_argument("--floor-size", type=int, default=512)
ap.add_argument("--samples", type=int, default=192)
args = ap.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene


def P(x, y, z):
    """three.js stage space (y up) → Blender (z up); the glTF exporter maps it back."""
    return (x, -z, y)


def srgb(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((v + 0.055) / 1.055) ** 2.4 if v > 0.04045 else v / 12.92 for v in c) + (1.0,)


def material(name, color, rough, metal=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = srgb(color)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    return m


MAT = {
    "wood": material("wood", "#5a2e16", 0.55),
    "brass": material("brass", "#a87a2e", 0.35, 0.85),
    "clay": material("clay", "#9a4a24", 0.8),
    "cloth": material("cloth", "#7a1f1a", 0.9),
    "durrie": material("durrie", "#3d2a52", 0.95),
}
props = []


def finish(o, mat, bevel=0.0, segs=2):
    o.data.materials.append(MAT[mat])
    if bevel:
        mod = o.modifiers.new("bevel", "BEVEL")
        mod.width = bevel
        mod.segments = segs
        mod.limit_method = "ANGLE"
    for p in o.data.polygons:
        p.use_smooth = True
    props.append(o)
    return o


def box(w, h, d, pos, mat, bevel=0.0):
    """w along x, h along y (up), d along z, centred at pos (three space)."""
    bpy.ops.mesh.primitive_cube_add(size=1, location=P(*pos))
    o = bpy.context.object
    o.scale = (w, d, h)
    bpy.ops.object.transform_apply(scale=True)
    return finish(o, mat, bevel)


def cyl(r_top, r_bot, h, pos, mat, verts=24, bevel=0.0):
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r_bot, radius2=r_top, depth=h, location=P(*pos))
    return finish(bpy.context.object, mat, bevel)


def diya(pos):
    """Lathe of the same profile as makeDiya() in dome.ts (radius, height)."""
    prof = [(0.0005, 0), (0.022, 0.002), (0.034, 0.012), (0.036, 0.02), (0.028, 0.017), (0.0005, 0.012)]
    me = bpy.data.meshes.new("diya")
    bm = bmesh.new()
    vs = [bm.verts.new((r, 0, y)) for r, y in prof]
    for a, b in zip(vs, vs[1:]):
        bm.edges.new((a, b))
    bmesh.ops.spin(bm, geom=bm.verts[:] + bm.edges[:], cent=(0, 0, 0), axis=(0, 0, 1), angle=math.tau, steps=24, use_duplicate=False)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new("diya", me)
    sc.collection.objects.link(o)
    o.location = P(*pos)
    return finish(o, "clay")


# ── geometry (mirrors dome.ts Setting; chowkiPos = (0, 0, -0.98)) ─────────
CX, CZ = 0.0, -0.98
box(1.2, 0.4, 0.8, (CX, 0.2, CZ - 0.3), "wood", bevel=0.012)                     # takht
box(1.14, 0.006, 0.74, (CX, 0.403, CZ - 0.32), "durrie", bevel=0.002)            # durrie
CY = 0.4                                                                         # chowki base (on the takht)
box(0.5, 0.03, 0.22, (CX, CY + 0.2, CZ), "wood", bevel=0.005)                    # chowki top
for x, z in [(-0.22, -0.09), (0.22, -0.09), (-0.22, 0.09), (0.22, 0.09)]:
    cyl(0.018, 0.014, 0.19, (CX + x, CY + 0.095, CZ + z), "wood", verts=12)      # legs
box(0.4, 0.004, 0.16, (CX, CY + 0.217, CZ), "cloth")                             # runner
cyl(0.09, 0.08, 0.01, (CX + 0.1, CY + 0.222, CZ), "brass", verts=40, bevel=0.002)  # plate
for x, z in [(-0.17, 0.03), (0.07, -0.02), (0.13, 0.03)]:
    diya((CX + x, CY + (0.228 if x > 0 else 0.218), CZ + z))
for x in (-0.7, 0.7):                                                            # floor lamp stands
    sx, sz = CX + x, CZ - 0.35
    cyl(0.07, 0.09, 0.03, (sx, 0.015, sz), "brass", verts=32, bevel=0.003)
    cyl(0.012, 0.016, 0.95, (sx, 0.5, sz), "brass", verts=12)
    cyl(0.06, 0.02, 0.03, (sx, 0.98, sz), "brass", verts=32)
    diya((sx, 0.995, sz))

# floor catcher, generous around the takht and both stands
FW, FD, FZ = 2.1, 1.5, CZ - 0.33
bpy.ops.mesh.primitive_plane_add(size=1, location=P(CX, 0.0005, FZ))
floor = bpy.context.object
floor.name = "Setting_FloorShadow"
floor.scale = (FW, FD, 1)
bpy.ops.object.transform_apply(scale=True)
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.subdivide(number_cuts=24)  # enough samples for a smooth bake
bpy.ops.object.mode_set(mode="OBJECT")

# ── join props (apply bevels) ────────────────────────────────────────────
bpy.ops.object.select_all(action="DESELECT")
for o in props:
    o.select_set(True)
bpy.context.view_layer.objects.active = props[0]
bpy.ops.object.convert(target="MESH")
bpy.ops.object.join()
P0 = bpy.context.object
P0.name = "Setting_Props"
P0.data.name = "Setting_Props"
# auto-smooth look: split hard edges so boxes stay crisp but bevels shade softly
bpy.ops.object.shade_smooth_by_angle(angle=math.radians(40))
# drop faces that point straight down (bases resting on the floor/takht, undersides the
# seated eye never sees): they would take a third of the AO atlas for nothing
bm = bmesh.new()
bm.from_mesh(P0.data)
bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.normal.z < -0.95], context="FACES")
# the takht top is under the durrie except a 3 cm wooden rim: keep the rim, drop the centre
top = max((f for f in bm.faces if f.normal.z > 0.95 and abs(f.calc_center_median().z - 0.4) < 0.002), key=lambda f: f.calc_area())
res = bmesh.ops.inset_individual(bm, faces=[top], thickness=0.04)
bmesh.ops.delete(bm, geom=[top], context="FACES")
bm.to_mesh(P0.data)
bm.free()

# UV0 (unused by the materials but keeps the exporter happy) and the AO atlas on UV1
# one UV set only, created in OBJECT mode (a layer added inside edit mode is not what the
# unwrap writes to, and the exporter would ship the primitives' overlapping default UVs)
while P0.data.uv_layers:
    P0.data.uv_layers.remove(P0.data.uv_layers[0])
ao_uv = P0.data.uv_layers.new(name="AO")
P0.data.uv_layers.active = ao_uv
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.01)
bpy.ops.uv.pack_islands(margin=0.004)
bpy.ops.object.mode_set(mode="OBJECT")

# ── bakes ────────────────────────────────────────────────────────────────
sc.render.engine = "CYCLES"
sc.cycles.device = "CPU"
sc.cycles.samples = args.samples
sc.world = bpy.data.worlds.new("bake")
sc.render.bake.margin = 8


def blur_image(img, radius):
    """Small separable box blur (numpy) to take the Monte Carlo grain out of a bake."""
    import numpy as np
    w, h = img.size
    a = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)
    for axis in (0, 1):
        acc = np.zeros_like(a)
        for d in range(-radius, radius + 1):
            acc += np.roll(a, d, axis=axis)
        a = acc / (2 * radius + 1)
    img.pixels[:] = a.ravel()


def bake_into(obj, img, distance, uv_name):
    sc.world.light_settings.distance = distance
    nodes = []
    for slot in obj.material_slots:
        nt = slot.material.node_tree
        uvn = nt.nodes.new("ShaderNodeUVMap")
        uvn.uv_map = uv_name
        tex = nt.nodes.new("ShaderNodeTexImage")
        tex.image = img
        nt.links.new(uvn.outputs["UV"], tex.inputs["Vector"])
        nt.nodes.active = tex
        nodes.append((nt, uvn, tex))
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.bake(type="AO", margin=8, use_clear=True)
    return nodes


# 1. props AO (contacts within ~10 cm)
ao = bpy.data.images.new("setting_ao", args.ao_size, args.ao_size, alpha=False)
ao.colorspace_settings.name = "Non-Color"
ao.generated_color = (1, 1, 1, 1)
nodes = bake_into(P0, ao, 0.10, "AO")
blur_image(ao, 2)
ao.pack()
group = bpy.data.node_groups.new("glTF Material Output", "ShaderNodeTree")
group.interface.new_socket("Occlusion", in_out="INPUT", socket_type="NodeSocketFloat")
for nt, uvn, tex in nodes:
    out = nt.nodes.new("ShaderNodeGroup")
    out.node_tree = group
    sep = nt.nodes.new("ShaderNodeSeparateColor")
    nt.links.new(tex.outputs["Color"], sep.inputs["Color"])
    nt.links.new(sep.outputs["Red"], out.inputs["Occlusion"])
print("AO BAKED props", args.ao_size)
# the props use no other texture: make the AO atlas the only UV set (TEXCOORD_0, occlusion texCoord 0),
# so no loader can pair the aoMap with the primitives' overlapping default UVs
for uv in [u for u in P0.data.uv_layers if u.name != "AO"]:
    P0.data.uv_layers.remove(uv)
for nt, uvn, tex in nodes:
    uvn.uv_map = "AO"

# 2. floor contact shadow (wider reach: ~35 cm), from the real footprints
fm = bpy.data.materials.new("floor_shadow")
fm.use_nodes = True
floor.data.materials.append(fm)
fimg = bpy.data.images.new("floor_ao", args.floor_size, args.floor_size, alpha=False)
fimg.colorspace_settings.name = "Non-Color"
# the props have no bottoms (deleted above), so solid stand-ins occlude the floor for this bake only
occ = []
# bottoms 2 mm above the catcher (a catcher inside a solid sees out through its far side)
bpy.ops.mesh.primitive_cube_add(size=1, location=P(CX, 0.2015, CZ - 0.3))
occ.append(bpy.context.object); occ[-1].scale = (1.2, 0.8, 0.397)
for x in (-0.7, 0.7):
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.09, depth=0.028, location=P(CX + x, 0.016, CZ - 0.35))
    occ.append(bpy.context.object)
bake_into(floor, fimg, 0.35, "UVMap")
blur_image(fimg, 3)
for o in occ:
    bpy.data.objects.remove(o, do_unlink=True)
# black RGBA with alpha = occlusion, softened at the plane's border so it never shows an edge
W = H = args.floor_size
px = list(fimg.pixels)
out = bpy.data.images.new("floor_shadow", W, H, alpha=True)
op = [0.0] * (W * H * 4)
for j in range(H):
    v = j / (H - 1)
    for i in range(W):
        u = i / (W - 1)
        edge = min(u, 1 - u, v, 1 - v) / 0.12
        fade = max(0.0, min(1.0, edge)) ** 2
        occ = 1.0 - px[(j * W + i) * 4]
        k = (j * W + i) * 4
        op[k + 3] = max(0.0, min(1.0, occ * 2.2)) ** 1.3 * fade  # near-black at the junction, soft reach
out.pixels[:] = op
out.pack()
nt = fm.node_tree
for n in list(nt.nodes):
    if n.type == "TEX_IMAGE" or n.type == "UVMAP":
        nt.nodes.remove(n)
b = nt.nodes["Principled BSDF"]
b.inputs["Base Color"].default_value = (0, 0, 0, 1)
b.inputs["Roughness"].default_value = 1.0
t = nt.nodes.new("ShaderNodeTexImage")
t.image = out
nt.links.new(t.outputs["Alpha"], b.inputs["Alpha"])
fm.blend_method = "BLEND" if hasattr(fm, "blend_method") else fm.blend_method
print("AO BAKED floor", args.floor_size)

# ── export ───────────────────────────────────────────────────────────────
bpy.ops.object.select_all(action="DESELECT")
P0.select_set(True)
floor.select_set(True)
os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=os.path.abspath(args.out), export_format="GLB", use_selection=True,
                          export_yup=True, export_image_format="AUTO", export_apply=False,
                          export_texcoords=True, export_normals=True)
tris = sum(len(p.vertices) - 2 for p in P0.data.polygons)
print("EXPORTED", args.out, os.path.getsize(args.out) // 1024, "KB", "props tris", tris)
