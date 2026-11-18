"""
Hast Rekha · an environment map that matches the pavilion (public/env/pavilion.hdr).

Image-based light for the props, Panditji and the overlay should come from the
pavilion itself, not from a generic studio: the dusk dome (same colours as the
dome shader in src/render/dome.ts), its stone band and arches, the warm floor and
durrie bouncing light up, and five diya flames as small hot spots. Rendered with
Cycles as a 512×256 equirectangular HDR from just in front of Panditji
(three.js (0, 0.95, -1.15)), so reflections in his eyes, the brass and the silk
show the lamps where they are.

Equirect convention: the image centre faces three.js +X and +Z is on the right,
which is what three's equirect sampling expects (no runtime rotation offset).

Run from projects/hast-rekha/:
  /Applications/Blender.app/Contents/MacOS/Blender -b -P tools/setting/bake_env.py -- --out public/env/pavilion.hdr
"""
import argparse
import math
import os
import sys

import bpy

ap = argparse.ArgumentParser()
ap.add_argument("--out", default="public/env/pavilion.hdr")
ap.add_argument("--samples", type=int, default=256)
args = ap.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene


def P(x, y, z):
    return (x, -z, y)


def emit_mat(name, color, strength):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    e = nt.nodes.new("ShaderNodeEmission")
    e.inputs["Color"].default_value = (*color, 1)
    e.inputs["Strength"].default_value = strength
    o = nt.nodes.new("ShaderNodeOutputMaterial")
    nt.links.new(e.outputs[0], o.inputs[0])
    return m


def diffuse_mat(name, color, rough=0.8):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rough
    return m


def lin(c):
    return tuple(((v + 0.055) / 1.055) ** 2.4 if v > 0.04045 else v / 12.92 for v in c)


# ── the dome: a sphere whose emission is the dusk gradient + stone band (from dome.ts) ──
bpy.ops.mesh.primitive_uv_sphere_add(segments=64, ring_count=32, radius=3.2, location=P(0, 1.2, 0))
dome = bpy.context.object
dm = bpy.data.materials.new("dome")
dm.use_nodes = True
nt = dm.node_tree
for n in list(nt.nodes):
    nt.nodes.remove(n)
tc = nt.nodes.new("ShaderNodeTexCoord")
sep = nt.nodes.new("ShaderNodeSeparateXYZ")
nt.links.new(tc.outputs["Object"], sep.inputs[0])  # object-space position: z/3.2 = sin(elevation)
ramp = nt.nodes.new("ShaderNodeValToRGB")
cr = ramp.color_ramp
# elevation (object z / radius, −1..1, mapped to 0..1) → colour; the dome shader's sRGB-ish values linearised
stops = [
    (0.0, lin((0.10, 0.06, 0.05))),   # straight down: floor
    (0.40, lin((0.18, 0.09, 0.06))),  # stone
    (0.47, lin((0.35, 0.18, 0.08))),  # warm band at the arch base, lit by the lamps
    (0.50, lin((0.62, 0.34, 0.18))),  # horizon glow
    (0.62, lin((0.36, 0.16, 0.28))),  # mid
    (1.0, lin((0.05, 0.04, 0.13))),   # zenith
]
cr.elements[0].position, cr.elements[0].color = stops[0][0], (*stops[0][1], 1)
cr.elements[1].position, cr.elements[1].color = stops[-1][0], (*stops[-1][1], 1)
for pos, c in stops[1:-1]:
    el = cr.elements.new(pos)
    el.color = (*c, 1)
mapr = nt.nodes.new("ShaderNodeMapRange")
mapr.inputs["From Min"].default_value = -3.2
mapr.inputs["From Max"].default_value = 3.2
nt.links.new(sep.outputs["Z"], mapr.inputs["Value"])
nt.links.new(mapr.outputs["Result"], ramp.inputs["Fac"])
em = nt.nodes.new("ShaderNodeEmission")
em.inputs["Strength"].default_value = 1.0
nt.links.new(ramp.outputs["Color"], em.inputs["Color"])
out = nt.nodes.new("ShaderNodeOutputMaterial")
nt.links.new(em.outputs[0], out.inputs[0])
dome.data.materials.append(dm)
for p in dome.data.polygons:
    p.use_smooth = True

# ── floor, takht, durrie, chowki (same sizes as build_setting.py), lit by the flames ──
wood = diffuse_mat("wood", lin((0.353, 0.18, 0.086)), 0.55)
durrie = diffuse_mat("durrie", lin((0.24, 0.165, 0.32)), 0.95)
floor_m = diffuse_mat("floor", lin((0.16, 0.11, 0.08)), 0.9)
brass = diffuse_mat("brass", lin((0.66, 0.48, 0.18)), 0.35)
cloth = diffuse_mat("kurta", lin((0.85, 0.82, 0.74)), 0.7)


def box(w, h, d, pos, mat):
    bpy.ops.mesh.primitive_cube_add(size=1, location=P(*pos))
    o = bpy.context.object
    o.scale = (w, d, h)
    o.data.materials.append(mat)
    return o


CX, CZ = 0.0, -0.98
box(6, 0.01, 6, (0, -0.005, -1), floor_m)
box(1.2, 0.4, 0.8, (CX, 0.2, CZ - 0.3), wood)
box(1.14, 0.006, 0.74, (CX, 0.403, CZ - 0.32), durrie)
box(0.5, 0.03, 0.22, (CX, 0.6, CZ), wood)
for x in (-0.7, 0.7):
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.014, depth=0.95, location=P(x, 0.5, CZ - 0.35))
    bpy.context.object.data.materials.append(brass)

# ── flames: hot emissive beads + warm point lights at the five diya positions ──
flame = emit_mat("flame", lin((1.0, 0.62, 0.25)), 60.0)
flames = [(-0.17, 0.66, CZ + 0.03), (0.07, 0.67, CZ - 0.02), (0.13, 0.67, CZ + 0.03), (-0.7, 1.04, CZ - 0.35), (0.7, 1.04, CZ - 0.35)]
for f in flames:
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8, radius=0.012, location=P(*f))
    bpy.context.object.data.materials.append(flame)
    bpy.ops.object.light_add(type="POINT", location=P(f[0], f[1] + 0.02, f[2]))
    L = bpy.context.object.data
    L.color = lin((1.0, 0.7, 0.4))
    L.energy = 6.0
    L.shadow_soft_size = 0.02

# ── camera: equirect from just in front of Panditji, centre facing three +X ──
bpy.ops.object.camera_add(location=P(0, 0.95, -1.15))
cam = bpy.context.object
cam.data.type = "PANO"
if hasattr(cam.data, "panorama_type"):
    cam.data.panorama_type = "EQUIRECTANGULAR"
else:
    cam.data.cycles.panorama_type = "EQUIRECTANGULAR"
cam.rotation_euler = (math.radians(90), 0, math.radians(-90))  # forward = Blender +X = three +X
sc.camera = cam

sc.render.engine = "CYCLES"
sc.cycles.device = "CPU"
sc.cycles.samples = args.samples
sc.cycles.use_denoising = True
sc.render.resolution_x = 512
sc.render.resolution_y = 256
sc.render.resolution_percentage = 100
sc.view_settings.view_transform = "Standard"
sc.world = bpy.data.worlds.new("black")
sc.world.color = (0, 0, 0)
sc.render.image_settings.file_format = "HDR"
os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
sc.render.filepath = os.path.abspath(args.out)
bpy.ops.render.render(write_still=True)
print("ENV WRITTEN", args.out, os.path.getsize(args.out) // 1024, "KB")
