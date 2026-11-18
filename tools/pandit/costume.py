"""
The Pandit's beard, kurta + pyjama and shawl, built procedurally in Blender and skinned to the MPFB rig.

Adapted from projects/chausar/tools/shakuni/costume.py (helpers, garment-cut-from-body idea).
Everything here is original geometry and texture (no third-party assets):
- beard + moustache: short alpha hair cards lying along the skin of the jaw, chin and upper lip
- kurta + pyjama: offset copy of torso / arms (to mid-forearm) / legs, off-white handloom cotton
- shawl (angavastram): a band round the back of the neck, over both shoulders, hanging down the
  chest to the waist, snapped onto the kurta; deep maroon wool with a muted saffron border
"""
import bpy, bmesh, math, random
import numpy as np
from mathutils import Vector, kdtree, bvhtree

R = random.Random(23)
BONES = set()


def use_rig(rig):
    BONES.clear()
    BONES.update(b.name for b in rig.data.bones)


def groups_of(obj):
    names = {g.index: g.name for g in obj.vertex_groups}
    return [{names[g.group]: g.weight for g in v.groups if not BONES or names[g.group] in BONES} for v in obj.data.vertices]


def dominant(g):
    return max(g.items(), key=lambda kv: kv[1])[0] if g else ""


def new_image(name, arr, alpha=True):
    H, W = arr.shape[:2]
    img = bpy.data.images.new(name, W, H, alpha=alpha)
    img.pixels = arr.astype(np.float32).ravel()
    img.file_format = "PNG" if alpha else "JPEG"
    img.pack()
    return img


def make_material(name, *, color=(1, 1, 1, 1), image=None, metallic=0.0, roughness=0.6, alpha_from_image=False):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    if "Specular IOR Level" in bsdf.inputs:
        bsdf.inputs["Specular IOR Level"].default_value = 0.3
    if image is not None:
        tex = nt.nodes.new("ShaderNodeTexImage")
        tex.image = image
        nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
        if alpha_from_image:
            nt.links.new(tex.outputs["Alpha"], bsdf.inputs["Alpha"])
            if hasattr(m, "blend_method"):
                try: m.blend_method = "CLIP"
                except Exception: pass
    m.use_backface_culling = False
    return m


def mesh_object(name, verts, faces, uvs=None):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], faces)
    if uvs is not None:
        uvl = me.uv_layers.new(name="UVMap")
        for poly in me.polygons:
            for li, vi in zip(poly.loop_indices, poly.vertices):
                uvl.data[li].uv = uvs[vi]
    me.update()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def skin_like(obj, src, rig, fixed_group=None):
    """Bind obj to rig: copy weights from the nearest src vertex, or one fixed bone."""
    mw = src.matrix_world
    if fixed_group:
        vg = obj.vertex_groups.new(name=fixed_group)
        vg.add(range(len(obj.data.vertices)), 1.0, "REPLACE")
    else:
        kd = kdtree.KDTree(len(src.data.vertices))
        for i, v in enumerate(src.data.vertices):
            kd.insert(mw @ v.co, i)
        kd.balance()
        sg = groups_of(src)
        cache = {}
        for v in obj.data.vertices:
            _, i, _ = kd.find(obj.matrix_world @ v.co)
            for name, w in sg[i].items():
                if w < 0.01:
                    continue
                g = cache.get(name) or obj.vertex_groups.get(name) or obj.vertex_groups.new(name=name)
                cache[name] = g
                g.add([v.index], w, "REPLACE")
    mod = obj.modifiers.new("Armature", "ARMATURE")
    mod.object = rig
    obj.parent = rig


def bone_world(rig, name, tail=False):
    b = rig.pose.bones[name]
    return rig.matrix_world @ (b.tail if tail else b.head)


# ── face landmarks (Blender space: -Y is the front, Z up) ──────────────────
def face_landmarks(basemesh, rig):
    mw = basemesh.matrix_world
    gs = groups_of(basemesh)
    co = [mw @ v.co for v in basemesh.data.vertices]
    nrm = [(mw.to_3x3() @ v.normal).normalized() for v in basemesh.data.vertices]
    head = bone_world(rig, "head")
    face = [i for i, g in enumerate(gs) if co[i].z > head.z - 0.06 and (dominant(g) in ("head", "jaw") or any(k.startswith(("oris", "levator", "risorius", "special")) for k in g))]
    nose_i = min(face, key=lambda i: co[i].y)
    nose = co[nose_i]
    front = [i for i in face if abs(co[i].x) < 0.012 and co[i].y < nose.y + 0.07 and co[i].z < nose.z - 0.03]
    chin = min((co[i] for i in front), key=lambda p: p.z)
    eye = bone_world(rig, "eye.L")
    # mouth line from the lip weight groups (upper lip = oris05, lower lip = oris01), fallback: nose − 2.7 cm
    lips = {}
    for i, g in enumerate(gs):
        d = dominant(g)
        if d in ("oris01", "oris05"): lips.setdefault(d, []).append(co[i].z)
    mouth_z = (sum(lips["oris01"]) / len(lips["oris01"]) + sum(lips["oris05"]) / len(lips["oris05"])) / 2 if len(lips) == 2 else nose.z - 0.027
    return {"co": co, "nrm": nrm, "nose": nose, "chin": chin, "mouth_z": mouth_z,
            "ear_y": head.y + 0.005, "eye": eye, "head": head}


def in_beard_zone(p, LM, margin=0.0):
    nose, chin, mz = LM["nose"], LM["chin"], LM["mouth_z"]
    ax = abs(p.x)
    if p.y > LM["ear_y"] - 0.012 - margin:  # not behind the jaw corner / ears
        return False
    if ax > 0.085: return False
    top = nose.z - 0.009 + 0.75 * max(0.0, ax - 0.026)
    top = min(top, nose.z + 0.012)  # sideburns stop below the cheekbone
    if p.z > top + margin: return False
    # under the chin onto the throat, but not the neck sides/back
    if p.z < chin.z - 0.032 - margin: return False
    if p.z < chin.z + 0.01 and p.y > chin.y + 0.07: return False
    # lips (the moustache sits above, the beard below)
    lip_w = 0.024
    if ax < lip_w and mz - 0.009 < p.z < mz + 0.0055: return False
    if ax < lip_w + 0.006 and mz - 0.004 < p.z < mz + 0.003: return False  # mouth corners
    return True


BEARD_COLS = (np.array([0.56, 0.54, 0.51]), np.array([0.40, 0.38, 0.36]), np.array([0.24, 0.22, 0.21]), np.array([0.09, 0.08, 0.075]))
BEARD_P = (0.3, 0.32, 0.22, 0.16)


def _strand(a, col, rng, x0, y0, length, width, drift, H, W, wrap):
    c = BEARD_COLS[rng.choice(4, p=BEARD_P)] * rng.uniform(0.9, 1.08)
    n = max(2, int(length))
    for k in range(n):
        t = k / n
        x = x0 + drift * t * t
        y = y0 + k
        if wrap: yi = int(y) % H
        else:
            yi = int(y)
            if yi >= H: break
        fade = (1 - t) ** 0.6
        xi = int(x)
        for dx in (-1, 0, 1, 2):
            xx = (xi + dx) % W if wrap else xi + dx
            if 0 <= xx < W:
                v = max(0.0, 1 - abs(x - xx) / width) * fade
                if v > a[yi, xx]:
                    a[yi, xx] = v; col[yi, xx] = c


def beard_atlas(S=512, seed=3):
    """One texture for the whole beard. Bottom half (v 0..0.5): a dense field of short downward strands
    for the shells (mapped frontally). Top half (v 0.5..1): strand clumps for the edge cards, root at v=0.5.
    Image rows go bottom-up; strands are drawn with 'down' = decreasing row, i.e. tips at lower v."""
    rng = np.random.default_rng(seed)
    H = S
    a = np.zeros((H, S), np.float32)
    col = np.zeros((H, S, 3), np.float32)
    half = H // 2
    # shells: rows 0..half-1; draw from top (root) downward → flip after
    sa = np.zeros((half, S), np.float32); sc = np.zeros((half, S, 3), np.float32)
    for _ in range(4200):
        _strand(sa, sc, rng, rng.uniform(0, S), rng.uniform(0, half), rng.uniform(8, 22), rng.uniform(0.6, 1.1), rng.uniform(-3, 3), half, S, False)
    a[:half] = sa[::-1]; col[:half] = sc[::-1]
    # cards: rows half..H-1, root at row half (v=0.5) → tip at the top (v=1)
    ca = np.zeros((half, S), np.float32); cc = np.zeros((half, S, 3), np.float32)
    for _ in range(700):
        _strand(ca, cc, rng, rng.uniform(0, S), rng.uniform(0, half * 0.15), rng.uniform(half * 0.4, half * 0.85), rng.uniform(0.7, 1.5), rng.uniform(-10, 10), half, S, False)
    a[half:] = ca; col[half:] = cc
    arr = np.zeros((H, S, 4), np.float32)
    arr[..., :3] = col
    arr[..., 3] = np.clip(a * 1.6, 0, 1)
    return arr


def build_beard(basemesh, rig, LM):
    """Short, neat, greying full beard + moustache: 3 alpha shells over the beard zone (density) plus
    short cards along the jaw/chin (soft silhouette). One material, one texture (beard_atlas)."""
    co, nrm = LM["co"], LM["nrm"]
    nose, mz, chin = LM["nose"], LM["mouth_z"], LM["chin"]
    me = basemesh.data
    ok_n = [not (n.y > 0.35 or n.z > 0.6) for n in nrm]
    near_chin = [max(0.0, 1 - abs(p.x) / 0.05) * (1.0 if p.z < mz - 0.01 else 0.25) for p in co]
    V, F, UV, SRC = [], [], [], []  # SRC: body vertex each beard vertex rides on (for the morphs)
    x0, z0, span = -0.095, chin.z - 0.05, 0.19
    down = Vector((0, 0, -1))
    for L in range(3):
        margin = -0.0035 * L
        zone = [ok_n[i] and in_beard_zone(co[i], LM, margin) for i in range(len(co))]
        remap = {}
        for poly in me.polygons:
            if not all(zone[v] for v in poly.vertices): continue
            idx = []
            for v in poly.vertices:
                if v not in remap:
                    off = 0.0016 * (L + 1) * (1 + 1.2 * near_chin[v])
                    p = co[v] + nrm[v] * off + down * 0.0012 * L * (1 + near_chin[v])
                    remap[v] = len(V)
                    V.append(p); SRC.append(v)
                    ang = math.atan2(p.x, -(p.y - LM["head"].y))  # around the head's vertical axis
                    u = ang * 0.09 / span + 0.5 + 0.11 * L
                    vv = ((p.z - z0) / span + 0.07 * L) * 0.5
                    UV.append((u, min(max(vv, 0.002), 0.498)))
                idx.append(remap[v])
            F.append(tuple(idx))
    nshell = len(F)

    edge = [i for i in range(len(co)) if ok_n[i] and in_beard_zone(co[i], LM, -0.004) and not in_beard_zone(co[i], LM, -0.012)]
    roots = [i for i in edge if co[i].z < mz - 0.004 or (co[i].z < mz + 0.012 and abs(co[i].x) < 0.034)]
    roots += [i for i in range(len(co)) if ok_n[i] and in_beard_zone(co[i], LM) and near_chin[i] > 0.4 and co[i].z < mz - 0.015]

    def card(root, n, d, length, width, seg=2, lift=0.002, src=0):
        wv = d.cross(n).normalized() * width
        p = root + n * 0.002
        base = len(V)
        u0 = R.uniform(0.0, 0.85)
        for k in range(seg + 1):
            t = k / seg
            q = p + d * (length * t) + n * (lift * t)
            V.append(q - wv * 0.5); V.append(q + wv * 0.5); SRC.extend((src, src))
            UV.append((u0, 0.5 + 0.5 * t)); UV.append((u0 + 0.15, 0.5 + 0.5 * t))
        for k in range(seg):
            a = base + 2 * k
            F.append((a, a + 1, a + 3, a + 2))

    for i in (R.choices(roots, k=min(420, 2 * len(roots))) if roots else []):
        n = nrm[i]
        root = co[i] + Vector((R.uniform(-0.002, 0.002), 0, R.uniform(-0.002, 0.002)))
        d = down - n * n.dot(down)
        if d.length < 0.3:
            d = Vector((0, -0.5, -0.5)) - n * n.dot(Vector((0, -0.5, -0.5)))
        d.normalize()
        if root.z > mz:  # moustache edge: out and down over the lip corners
            d = (d + Vector((0.5 if root.x > 0 else -0.5, 0, 0))).normalized()
        card(root, n, d, 0.009 + 0.011 * near_chin[i] + R.random() * 0.003, 0.008, lift=0.0015 + 0.003 * near_chin[i], src=i)
    ob = mesh_object("Pandit_Beard", V, F, UV)
    img = new_image("beard_strands", beard_atlas())
    ob.data.materials.append(make_material("hair_beard", image=img, roughness=0.75, alpha_from_image=True))
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    bpy.ops.object.shade_smooth()
    skin_like(ob, basemesh, rig)
    # the beard follows the face morphs (smile, mouth_open, …): each vertex copies its source body
    # vertex's delta. Every key is added (even empty ones) so the runtime's "has blink_*" test drives it.
    keys = basemesh.data.shape_keys
    if keys:
        basis = keys.key_blocks[0]
        ob.shape_key_add(name="Basis", from_mix=False)
        for kb in keys.key_blocks[1:]:
            if kb.name.startswith("rest_"): continue
            nk = ob.shape_key_add(name=kb.name, from_mix=False); nk.value = 0
            for vi, si in enumerate(SRC):
                dlt = kb.data[si].co - basis.data[si].co
                if dlt.length_squared > 1e-12:
                    nk.data[vi].co = nk.data[vi].co + dlt
    print("BEARD shell faces", nshell, "cards", (len(F) - nshell) // 2)
    return ob


# ── kurta + pyjama ─────────────────────────────────────────────────────────
def cotton_texture(S=512, base=(0.83, 0.78, 0.67), seed=9):
    """Off-white handloom cotton: plain weave, slubs, faint self stripes."""
    rng = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:S, 0:S].astype(np.float32)
    weave = 0.035 * np.sin(xx * 2.1) * np.sin(yy * 2.3)
    slub_r = rng.normal(0, 1, S).astype(np.float32)
    slub = np.convolve(slub_r, np.ones(5) / 5, mode="same")[None, :] * 0.025
    stripe = 0.03 * (np.abs(((xx / S * 8) % 1) - 0.5) < 0.02)
    shade = 1 + weave + slub - stripe
    arr = np.zeros((S, S, 4), np.float32)
    arr[..., :3] = np.array(base, np.float32) * shade[..., None]
    arr[..., 3] = 1
    return np.clip(arr, 0, 1)


KURTA_BONES = ("spine", "clavicle", "shoulder01", "upperarm", "lowerarm01", "pelvis", "root", "breast", "upperleg", "lowerleg")


def build_kurta(basemesh, rig):
    """Offset copy of torso, arms (to mid-forearm) and legs → kurta + pyjama in one material.
    Returns (kurta, covered) where covered = basemesh vertex indices safely hidden under the cloth."""
    gs = groups_of(basemesh)
    keep = set()
    for i, g in enumerate(gs):
        d = dominant(g)
        if d.startswith(KURTA_BONES) and not d.startswith(("foot", "toe", "lowerarm02")):
            keep.add(i)
    # erode 3 rings → skin under the cloth that can be deleted without opening gaps
    bm = bmesh.new(); bm.from_mesh(basemesh.data); bm.verts.ensure_lookup_table()
    inner = set(keep)
    for _ in range(3):
        edge = {v.index for v in bm.verts if v.index in inner and any(e.other_vert(v).index not in inner for e in v.link_edges)}
        inner -= edge
    bm.free()
    covered = inner

    kurta = basemesh.copy()
    kurta.data = basemesh.data.copy()
    kurta.name = "Pandit_Kurta"
    bpy.context.scene.collection.objects.link(kurta)
    if kurta.data.shape_keys:
        kurta.shape_key_clear()
    for m in list(kurta.modifiers):
        if m.type != "ARMATURE":
            kurta.modifiers.remove(m)
    kurta.data.materials.clear()
    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active = kurta
    kurta.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bm = bmesh.from_edit_mesh(kurta.data)
    bm.verts.ensure_lookup_table()
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.index not in keep], context="VERTS")
    bm.normal_update()
    zs = [v.co.z for v in bm.verts]
    for v in bm.verts:
        z = v.co.z
        push = 0.02 if z < 0.95 else (0.016 if z < 1.15 else 0.012)  # loose below the chest
        v.co += v.normal * push
    bmesh.ops.smooth_vert(bm, verts=bm.verts[:], factor=0.6, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    # relax the open edges (neckline, cuffs, ankles) so hems read as straight cut cloth, not a jagged mask
    for _ in range(60):
        new_co = {}
        for v in bm.verts:
            nb = [e.other_vert(v) for e in v.link_edges if e.is_boundary]
            if len(nb) == 2:
                new_co[v] = v.co * 0.4 + (nb[0].co + nb[1].co) * 0.3
        for v, c in new_co.items():
            v.co = c
    bmesh.update_edit_mesh(kurta.data)
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.01)
    bpy.ops.object.mode_set(mode="OBJECT")
    for luv in kurta.data.uv_layers.active.data:
        luv.uv = (luv.uv[0] * 6.0, luv.uv[1] * 6.0)
    bpy.ops.object.shade_smooth()
    kurta.data.materials.append(make_material("cotton_kurta", image=new_image("kurta_cotton", cotton_texture(), alpha=False), roughness=0.85))
    # pyjama below the kurta's knee-length hem: same cloth, a touch cooler and darker
    kurta.data.materials.append(make_material("cotton_pyjama", image=new_image("pyjama_cotton", cotton_texture(S=256, base=(0.72, 0.70, 0.64), seed=12), alpha=False), roughness=0.9))
    hem_z = bone_world(rig, "lowerleg01.L").z + 0.1
    for poly in kurta.data.polygons:
        if poly.center.z < hem_z and abs(poly.center.x) > 0.02:
            poly.material_index = 1
    kurta.parent = rig
    print("KURTA", len(kurta.data.vertices), "verts; covered skin", len(covered))
    return kurta, covered


def add_placket(kurta, rig):
    """Front placket (the kurta's buttoned neck slit): a slightly darker strip with three buttons, in the
    pyjama material (no extra draw call), joined into the kurta mesh."""
    mw = kurta.matrix_world
    vs = [mw @ v.co for v in kurta.data.vertices]
    top = max((p for p in vs if abs(p.x) < 0.012 and p.y < 0), key=lambda p: p.z)
    bvh = bvhtree.BVHTree.FromPolygons(vs, [list(p.vertices) for p in kurta.data.polygons])
    def onfront(x, z, off):
        hit = bvh.ray_cast(Vector((x, -1.0, z)), Vector((0, 1, 0)), 2.0)
        return (hit[0] + hit[1] * off) if hit[0] is not None else None
    V, F, UV = [], [], []
    rows = 12
    for k in range(rows + 1):
        z = top.z - 0.012 - 0.17 * k / rows
        for j, x in enumerate((-0.014, 0.0, 0.014)):
            p = onfront(x, z, 0.0025) or Vector((x, top.y, z))
            V.append(p); UV.append((j * 0.5, k / rows))
    for k in range(rows):
        for j in range(2):
            a = k * 3 + j
            F.append((a, a + 1, a + 4, a + 3))
    for bz in (0.03, 0.08, 0.13):
        c = onfront(0.0, top.z - 0.012 - bz, 0.0045)
        if c is None: continue
        base = len(V)
        for t in range(8):
            ang = 2 * math.pi * t / 8
            V.append(c + Vector((math.cos(ang) * 0.0045, 0.0, math.sin(ang) * 0.0045))); UV.append((0.5, 0.5))
        V.append(c + Vector((0, -0.002, 0))); UV.append((0.5, 0.5))
        for t in range(8):
            F.append((base + t, base + (t + 1) % 8, base + 8))
    ob = mesh_object("Pandit_Placket", V, F, UV)
    ob.data.materials.append(kurta.data.materials[1])
    skin_like(ob, kurta, rig)
    for m in list(ob.modifiers): ob.modifiers.remove(m)
    ob.parent = None
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True); kurta.select_set(True)
    bpy.context.view_layer.objects.active = kurta
    bpy.ops.object.join()
    for poly in kurta.data.polygons[-len(F):]:
        poly.material_index = 1


def decimate(obj, ratio):
    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    mod = obj.modifiers.new("Decimate", "DECIMATE")
    mod.ratio = ratio
    mod.use_collapse_triangulate = False
    while obj.modifiers[0] != mod:
        bpy.ops.object.modifier_move_up(modifier=mod.name)
    bpy.ops.object.modifier_apply(modifier=mod.name)
    print("DECIMATED", obj.name, len(obj.data.polygons), "faces")


# ── shawl ──────────────────────────────────────────────────────────────────
def shawl_texture(W=512, H=256, base=(0.25, 0.035, 0.05), border=(0.58, 0.34, 0.1), seed=4):
    """Maroon wool, fine twill, a muted saffron border band near both long edges (v)."""
    rng = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    v = yy / H
    twill = 0.05 * np.sin((xx + yy) * 1.3) + 0.03 * rng.normal(0, 1, (H, W)).astype(np.float32)
    arr = np.zeros((H, W, 4), np.float32)
    arr[..., :3] = np.array(base) * (1 + twill[..., None])
    band = ((v > 0.03) & (v < 0.065)) | ((v > 0.935) & (v < 0.97))
    pin = (np.abs(v - 0.09) < 0.005) | (np.abs(v - 0.91) < 0.005)
    m = np.clip(band.astype(np.float32) * 0.85 + pin.astype(np.float32) * 0.6, 0, 1)
    arr[..., :3] = arr[..., :3] * (1 - m[..., None]) + np.array(border) * (1 + twill[..., None] * 0.5) * m[..., None]
    arr[..., 3] = 1
    return np.clip(arr, 0, 1)


def build_shawl(basemesh, kurta, rig):
    """Angavastram-style shawl: one long band laid round the back of the neck, over both shoulders and
    hanging down the chest on both sides to the waist. Snapped onto the kurta (nearest surface point)."""
    gs = groups_of(kurta)
    mw = kurta.matrix_world
    torso_bones = ("spine", "clavicle", "shoulder01", "pelvis", "root", "breast", "neck", "upperarm01")
    verts = [mw @ v.co for v in kurta.data.vertices]
    tset = {i for i, g in enumerate(gs) if dominant(g).startswith(torso_bones)}
    polys = [list(p.vertices) for p in kurta.data.polygons if all(i in tset for i in p.vertices)]
    bvh = bvhtree.BVHTree.FromPolygons(verts, polys)
    neck = bone_world(rig, "neck01")
    sh_z = bone_world(rig, "clavicle.L", tail=True).z
    waist_z = bone_world(rig, "pelvis.R").z + 0.06
    chest_y = min(v.y for v in verts if abs(v.z - (sh_z - 0.15)) < 0.02 and abs(v.x) < 0.1)

    def front(x, z):
        hit = bvh.ray_cast(Vector((x, -1.0, z)), Vector((0, 1, 0)), 2.0)[0]
        return hit if hit is not None else Vector((x, chest_y, z))

    # control path: left end at the waist → up the left chest → over the left shoulder → round the
    # back of the neck → over the right shoulder → down the right chest
    half = []
    for t in np.linspace(0, 1, 14):
        z = waist_z + (sh_z - 0.03 - waist_z) * t
        x = 0.085 + 0.01 * t
        half.append(front(x, z))
    half.append(Vector((0.1, neck.y - 0.02, sh_z + 0.005)))
    half.append(Vector((0.095, neck.y + 0.03, sh_z + 0.0)))
    half.append(Vector((0.075, neck.y + 0.07, sh_z - 0.02)))
    half.append(Vector((0.04, neck.y + 0.095, sh_z - 0.035)))
    ctrl = half + [Vector((0, neck.y + 0.105, sh_z - 0.04))] + [Vector((-p.x, p.y, p.z)) for p in reversed(half)]
    # resample evenly
    seg = [(ctrl[i + 1] - ctrl[i]).length for i in range(len(ctrl) - 1)]
    total = sum(seg)
    N = 110
    path = []
    for k in range(N + 1):
        s_ = total * k / N
        i = 0
        while i < len(seg) - 1 and s_ > seg[i]:
            s_ -= seg[i]; i += 1
        path.append(ctrl[i].lerp(ctrl[i + 1], min(1.0, s_ / max(seg[i], 1e-6))))

    def snap(p, off):
        loc, n, _, _ = bvh.find_nearest(p)
        if loc is None: return p, Vector((0, -1, 0))
        if n.dot(p - loc) < 0 and (p - loc).length < 0.02:
            pass
        return loc + n * off, n
    for _ in range(2):
        path = [snap(p, 0.012)[0] for p in path]
        path = [path[0]] + [(path[k - 1] + path[k] * 2 + path[k + 1]) * 0.25 for k in range(1, N)] + [path[N]]
    M, width = 7, 0.115
    grid = []
    for k, p in enumerate(path):
        tng = (path[min(k + 1, N)] - path[max(k - 1, 0)]).normalized()
        _, n = snap(p, 0.0)
        side = tng.cross(n).normalized()
        row = []
        for j in range(M):
            s_ = (j / (M - 1) - 0.5) * width
            q, _ = snap(p + side * s_, 0.011 + 0.004 * abs(s_) / (width / 2))
            row.append(q)
        grid.append(row)
    for _ in range(3):
        grid = [grid[0]] + [[(grid[k - 1][j] + grid[k][j] * 2 + grid[k + 1][j]) * 0.25 for j in range(M)] for k in range(1, N)] + [grid[N]]
        grid = [[row[0]] + [(row[j - 1] + row[j] * 2 + row[j + 1]) * 0.25 for j in range(1, M - 1)] + [row[M - 1]] for row in grid]
    V, F, UV = [], [], []
    L = 0.0
    for k in range(N + 1):
        if k: L += (path[k] - path[k - 1]).length
        for j in range(M):
            V.append(grid[k][j]); UV.append((L * 2.0, j / (M - 1)))
    for k in range(N):
        for j in range(M - 1):
            a = k * M + j
            F.append((a, a + 1, a + M + 1, a + M))
    shawl = mesh_object("Pandit_Shawl", V, F, UV)
    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active = shawl
    shawl.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    # give it a little thickness so the hanging ends don't look paper-thin
    sol = shawl.modifiers.new("Solidify", "SOLIDIFY"); sol.thickness = 0.004; sol.offset = 1.0
    bpy.ops.object.modifier_apply(modifier=sol.name)
    bpy.ops.object.shade_smooth()
    shawl.data.materials.append(make_material("wool_shawl", image=new_image("shawl_wool", shawl_texture(), alpha=False), roughness=0.9))
    skin_like(shawl, kurta, rig)
    print("SHAWL", len(shawl.data.polygons), "faces")
    return shawl
