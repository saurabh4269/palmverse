import bpy, sys, math
from mathutils import Vector
argv=sys.argv[sys.argv.index('--')+1:]
src,out=argv[0],argv[1]
az=float(argv[2]) if len(argv)>2 else 30
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
objs=[o for o in bpy.data.objects if o.type=='MESH']
pts=[o.matrix_world@Vector(c) for o in objs for c in o.bound_box]
mn=Vector([min(p[i] for p in pts) for i in range(3)]); mx=Vector([max(p[i] for p in pts) for i in range(3)])
print('BBOX',tuple(round(x,3) for x in mn),tuple(round(x,3) for x in mx))
c=(mn+mx)/2; size=max(mx-mn)
sc=bpy.context.scene
sc.render.engine='BLENDER_EEVEE' if 'BLENDER_EEVEE' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE_NEXT'
sc.render.resolution_x=1200; sc.render.resolution_y=900
w=bpy.data.worlds.new('w'); sc.world=w; w.use_nodes=True
bg=w.node_tree.nodes['Background']; bg.inputs[0].default_value=(0.55,0.62,0.75,1); bg.inputs[1].default_value=0.8
sun=bpy.data.lights.new('sun','SUN'); sun.energy=3.5; so=bpy.data.objects.new('sun',sun); sc.collection.objects.link(so)
so.rotation_euler=(math.radians(50),0,math.radians(az+60))
cam=bpy.data.cameras.new('cam'); cam.lens=35; co=bpy.data.objects.new('cam',cam); sc.collection.objects.link(co); sc.camera=co
d=size*1.45; a=math.radians(az)
co.location=c+Vector((math.sin(a)*d,-math.cos(a)*d,0))+Vector((0,0,-(mx.z-mn.z)*0.25))
target=c+Vector((0,0,0.02*size))
co.rotation_euler=(target-co.location).to_track_quat('-Z','Y').to_euler()
sc.view_settings.view_transform='AgX' if 'AgX' in [x.identifier for x in sc.view_settings.bl_rna.properties['view_transform'].enum_items] else 'Filmic'
sc.render.filepath=out
bpy.ops.render.render(write_still=True)
