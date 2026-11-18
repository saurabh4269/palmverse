import bpy, bmesh, sys, math, random
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree
argv=sys.argv[sys.argv.index('--')+1:]
src,out=argv[0],argv[1]
SPREAD=float(argv[2]) if len(argv)>2 else 1.4
random.seed(7)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
meshes=[o for o in bpy.data.objects if o.type=='MESH']
for o in bpy.data.objects: o.select_set(o.type=='MESH')
bpy.context.view_layer.objects.active=meshes[0]
bpy.ops.object.join()
ob=bpy.context.view_layer.objects.active
bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
for o in list(bpy.data.objects):
    if o!=ob: bpy.data.objects.remove(o)
me=ob.data
matnames=[m.name for m in me.materials]
BARK=matnames.index('mat20'); CAN=matnames.index('mat10'); VINE=matnames.index('mat9')
bm=bmesh.new(); bm.from_mesh(me)
bm.verts.ensure_lookup_table()
# remove ground slab: vine-coloured faces lying entirely in the slab's z band
z0=min(v.co.z for v in bm.verts)
slab=[f for f in bm.faces if f.material_index==VINE and all(v.co.z<=z0+0.0805 for v in f.verts)]
print('slab faces',len(slab))
bmesh.ops.delete(bm,geom=slab,context='FACES')
loose=[v for v in bm.verts if not v.link_faces]
bmesh.ops.delete(bm,geom=loose,context='VERTS')
bmesh.ops.remove_doubles(bm,verts=bm.verts,dist=1e-5)
zmin=min(v.co.z for v in bm.verts)
# trunk centre from bark faces near the ground
pts=[f.calc_center_median() for f in bm.faces if f.material_index==BARK and f.calc_center_median().z<zmin+0.12]
cx=sum(p.x for p in pts)/len(pts); cy=sum(p.y for p in pts)/len(pts)
for v in bm.verts:
    v.co=Vector((cx+(v.co.x-cx)*SPREAD, cy+(v.co.y-cy)*SPREAD, v.co.z))
bmesh.ops.translate(bm,verts=bm.verts,vec=Vector((-cx,-cy,-zmin)))
bm.to_mesh(me); bm.free()
# decimate per material by separating
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.separate(type='MATERIAL'); bpy.ops.object.mode_set(mode='OBJECT')
parts=[o for o in bpy.data.objects if o.type=='MESH']
ratios={'mat20':float(argv[3]) if len(argv)>3 else 0.4,'mat9':float(argv[4]) if len(argv)>4 else 0.25,'mat10':1.0}
for o in parts:
    nm=[m.name for i,m in enumerate(o.data.materials) if any(p.material_index==i for p in o.data.polygons)][0]
    o['mat']=nm
    r=ratios[nm]
    if r<1:
        md=o.modifiers.new('d','DECIMATE'); md.ratio=r; md.use_collapse_triangulate=True
        bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier='d')
# aerial roots: raycast up from ground under the canopy
deps=bpy.context.evaluated_depsgraph_get()
allbm=bmesh.new()
for o in parts: allbm.from_mesh(o.data)
bvh=BVHTree.FromBMesh(allbm)
H=max(v.co.z for v in allbm.verts)
R=max(max(abs(v.co.x),abs(v.co.y)) for v in allbm.verts)
bark=[o for o in parts if o['mat']=='mat20'][0]
rbm=bmesh.new()
mi=list(bark.data.materials).index(bpy.data.materials['mat20'])
def tube(top,bottom,r0,r1,segs,sides=5,wob=0.01):
    rings=[]
    for i in range(segs+1):
        t=i/segs
        p=top.lerp(bottom,t)+Vector((random.uniform(-wob,wob),random.uniform(-wob,wob),0))*math.sin(t*math.pi)
        r=r0+(r1-r0)*t**2
        ring=[]
        for k in range(sides):
            a=2*math.pi*k/sides+i*0.4
            ring.append(rbm.verts.new(p+Vector((math.cos(a)*r,math.sin(a)*r,0))))
        rings.append(ring)
    for i in range(segs):
        for k in range(sides):
            f=rbm.faces.new((rings[i][k],rings[i][(k+1)%sides],rings[i+1][(k+1)%sides],rings[i+1][k])); f.material_index=mi
made=0; tries=0
NR=int(argv[5]) if len(argv)>5 else 34
while made<NR and tries<4000:
    tries+=1
    ang=random.uniform(0,2*math.pi); rad=R*math.sqrt(random.uniform(0.04,0.85))
    o=Vector((math.cos(ang)*rad,math.sin(ang)*rad,0.0))
    if rad<(0.3 if made<7 else 0.12)*R: continue
    hit=bvh.ray_cast(o+Vector((0,0,0.001)),Vector((0,0,1)))
    if hit[0] is None or hit[0].z<0.25*H: continue
    top=hit[0]+Vector((0,0,0.01*H))
    full=made<7
    endz=0.0 if full else top.z*random.uniform(0.25,0.65)
    bottom=Vector((top.x,top.y,endz))
    th=H*random.uniform(0.0035,0.0055) if full else H*random.uniform(0.0018,0.003)
    tube(top,bottom,th,th*(2.4 if full else 0.4),6 if full else 4,sides=6 if full else 3,wob=(0.02 if full else 0.008)*H)
    made+=1
print('roots',made)
rme=bpy.data.meshes.new('roots'); rbm.to_mesh(rme); rbm.free()
for m in bark.data.materials: rme.materials.append(m)
ro=bpy.data.objects.new('roots',rme); bpy.context.scene.collection.objects.link(ro)
# join all into one object
for o in bpy.data.objects: o.select_set(o.type=='MESH')
bpy.context.view_layer.objects.active=bark
bpy.ops.object.join()
ob=bpy.context.view_layer.objects.active
# remove unused material slots
bpy.ops.object.material_slot_remove_unused()
# normalise height to 1.0, origin at base
zs=[v.co.z for v in ob.data.vertices]; h=max(zs)-min(zs)
ob.data.transform(Matrix.Scale(1.0/h,4))
ob.name='banyan'; ob.data.name='banyan'
for m in ob.data.materials:
    m.use_backface_culling = (m.name!='mat9')
ren={'mat20':'bark','mat10':'canopy','mat9':'vines'}
for m in ob.data.materials: m.name=ren.get(m.name,m.name)
# shade flat (low-poly look)
for p in ob.data.polygons: p.use_smooth=False
tris=sum(len(p.vertices)-2 for p in ob.data.polygons)
print('TRIS',tris,[m.name for m in ob.data.materials])
bpy.ops.export_scene.gltf(filepath=out,export_format='GLB',use_selection=False,export_apply=True,export_normals=True,export_texcoords=False,export_yup=True,export_materials='EXPORT')
