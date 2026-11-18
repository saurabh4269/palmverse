"""
Render review shots of the exported pandit.glb (re-imported, so this is what ships):
front, three-quarter, face close-up. Mimics the runtime's material fixes from chausar's human.ts
(brows/lashes: alpha cut-out from texture luminance; eyes: alpha clip; everything else opaque).

    Blender -b -P tools/pandit/preview_pandit.py -- public/models/pandit.glb artifacts/pandit [cycles]
"""
import bpy, sys, os, math
from mathutils import Vector

args = sys.argv[sys.argv.index("--") + 1:]
glb, outdir = args[0], args[1]
cycles = "cycles" in args
BROW_RGB = (0.16, 0.15, 0.14, 1)  # runtime should tint brows grey for this character (see README)
os.makedirs(outdir, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
if cycles:
    sc.render.engine = "CYCLES"; sc.cycles.samples = 48; sc.cycles.device = "CPU"
else:
    engines = [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items]
    sc.render.engine = "BLENDER_EEVEE" if "BLENDER_EEVEE" in engines else "BLENDER_EEVEE_NEXT"
sc.view_settings.view_transform = "AgX" if "AgX" in [i.identifier for i in sc.view_settings.bl_rna.properties["view_transform"].enum_items] else "Filmic"
bpy.ops.import_scene.gltf(filepath=os.path.abspath(glb))

for o in sc.objects:
    if o.type != "MESH": continue
    n = o.name.lower()
    if "teeth" in n or "tongue" in n: o.hide_render = True
    for m in o.data.materials:
        if not m or not m.use_nodes: continue
        nt = m.node_tree
        bsdf = next((x for x in nt.nodes if x.type == "BSDF_PRINCIPLED"), None)
        tex = next((x for x in nt.nodes if x.type == "TEX_IMAGE"), None)
        if bsdf is None: continue
        key = (m.name + " " + o.name).lower()
        if ("brow" in key or "lash" in key) and tex is not None:
            # alpha = smoothstep(.25,.75, 1-lum) * a ; colour near-black
            rgb2bw = nt.nodes.new("ShaderNodeRGBToBW")
            nt.links.new(tex.outputs["Color"], rgb2bw.inputs[0])
            inv = nt.nodes.new("ShaderNodeMath"); inv.operation = "SUBTRACT"; inv.inputs[0].default_value = 1.0
            nt.links.new(rgb2bw.outputs[0], inv.inputs[1])
            mr = nt.nodes.new("ShaderNodeMapRange"); mr.interpolation_type = "SMOOTHSTEP"
            mr.inputs["From Min"].default_value = 0.25; mr.inputs["From Max"].default_value = 0.75
            nt.links.new(inv.outputs[0], mr.inputs["Value"])
            mul = nt.nodes.new("ShaderNodeMath"); mul.operation = "MULTIPLY"
            nt.links.new(mr.outputs["Result"], mul.inputs[0]); nt.links.new(tex.outputs["Alpha"], mul.inputs[1])
            nt.links.new(mul.outputs[0], bsdf.inputs["Alpha"])
            for l in list(bsdf.inputs["Base Color"].links): nt.links.remove(l)
            bsdf.inputs["Base Color"].default_value = BROW_RGB
        elif "high-poly" in key and tex is not None:  # runtime: alphaTest 0.5 (cornea discarded)
            gt = nt.nodes.new("ShaderNodeMath"); gt.operation = "GREATER_THAN"; gt.inputs[1].default_value = 0.5
            nt.links.new(tex.outputs["Alpha"], gt.inputs[0]); nt.links.new(gt.outputs[0], bsdf.inputs["Alpha"])
        elif not any(k in key for k in ("hair", "beard", "high-poly")):
            for l in list(bsdf.inputs["Alpha"].links): nt.links.remove(l)
            bsdf.inputs["Alpha"].default_value = 1.0
        # runtime roughness (human.ts): eyes 0.25, body 0.6; strands matte
        bsdf.inputs["Roughness"].default_value = 0.25 if "high-poly" in key else (0.85 if ("brow" in key or "lash" in key) else bsdf.inputs["Roughness"].default_value)
        for l in list(bsdf.inputs["Roughness"].links): nt.links.remove(l)
        if ("brow" in key or "lash" in key) and "Specular IOR Level" in bsdf.inputs:
            bsdf.inputs["Specular IOR Level"].default_value = 0.1
        if hasattr(m, "surface_render_method"):
            m.surface_render_method = "DITHERED"

arm = next(o for o in sc.objects if o.type == "ARMATURE")
def bw(name):
    b = arm.pose.bones.get(name) or arm.pose.bones.get(name.replace(".", ""))
    return arm.matrix_world @ b.head
head = bw("head")

world = bpy.data.worlds.new("w"); sc.world = world; world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.11, 0.09, 0.08, 1)
world.node_tree.nodes["Background"].inputs[1].default_value = 0.8
for loc, energy, color in [((1.4, -2.0, 2.1), 380, (1, 0.85, 0.68)), ((-2.0, -1.4, 1.6), 140, (0.75, 0.82, 1)), ((0, 2.0, 2.2), 260, (1, 0.9, 0.8))]:
    ld = bpy.data.lights.new("l", "AREA"); ld.energy = energy; ld.color = color; ld.size = 2.0
    lo = bpy.data.objects.new("l", ld); lo.location = Vector(loc)
    lo.rotation_euler = (Vector((0, 0, 1.2)) - lo.location).to_track_quat("-Z", "Y").to_euler()
    sc.collection.objects.link(lo)

cam_data = bpy.data.cameras.new("cam")
cam = bpy.data.objects.new("cam", cam_data); sc.collection.objects.link(cam); sc.camera = cam

def shot(name, target, offset, lens, w, h):
    sc.render.resolution_x, sc.render.resolution_y = w, h
    cam_data.lens = lens
    cam.location = target + offset
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    sc.render.filepath = os.path.abspath(os.path.join(outdir, name))
    bpy.ops.render.render(write_still=True)
    print("SHOT", sc.render.filepath)

# model faces -Y in Blender (= +Z in glTF)
shot("front.png", Vector((0, 0, 0.95)), Vector((0, -4.2, 0.15)), 50, 720, 1080)
shot("three_quarter.png", Vector((0, 0, 1.15)), Vector((1.6, -2.4, 0.25)), 60, 900, 1000)
shot("face.png", head + Vector((0, -0.02, 0.05)), Vector((0.22, -0.62, 0.02)), 85, 900, 900)
shot("face_front.png", head + Vector((0, -0.02, 0.04)), Vector((0.0, -0.65, 0.0)), 85, 900, 900)

# expression + pose check: smile, slight mouth open, left blink; head turned, right forearm raised.
# Everything attached to the head (eyes, hair, beard, brows) must follow.
for o in sc.objects:
    if o.type == "MESH" and o.data.shape_keys:
        kb = o.data.shape_keys.key_blocks
        for k, v in (("smile", 0.8), ("mouth_open", 0.35), ("blink_L", 1.0), ("brow_up_L", 0.5), ("brow_up_R", 0.5)):
            if k in kb: kb[k].value = v
def pb(name):
    return arm.pose.bones.get(name) or arm.pose.bones.get(name.replace(".", ""))
from mathutils import Euler
for n, e in (("head", (0.1, 0.0, 0.35)), ("neck01", (0.0, 0.0, 0.12)), ("jaw", (0.12, 0, 0)), ("lowerarm01.R", (0, 0, -1.2)), ("upperarm01.R", (0.6, 0, 0))):
    b = pb(n)
    if b:
        b.rotation_mode = "XYZ"; b.rotation_euler = Euler(e)
bpy.context.view_layer.update()
head = bw("head")
shot("face_expression_pose.png", head + Vector((0, -0.02, 0.04)), Vector((-0.1, -0.65, 0.0)), 85, 900, 900)
shot("pose_body.png", Vector((0, 0, 1.15)), Vector((0.9, -2.6, 0.25)), 60, 900, 1000)
