"""Run: blender --background --factory-startup --python scripts/create_cat_blink.py
Create a separate Blink GLB and editable blend; never overwrite the source model.
"""
import bpy
import math
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'artifacts/cat-blink'
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=str(ROOT / 'public/models/black-cat/cat_hq2.glb'))
cat = next(o for o in bpy.context.selected_objects if o.type == 'MESH')
bpy.context.view_layer.objects.active = cat
mesh = cat.data
# Blender imports glTF Y-up as Z-up: local front is -Y.
eye_ids = set()
for polygon in mesh.polygons:
    if mesh.materials[polygon.material_index].name in ('eye', 'pupil'):
        eye_ids.update(polygon.vertices)
centers = []
for sign in (-1, 1):
    points = [mesh.vertices[i].co for i in eye_ids if mesh.vertices[i].co.x * sign > 0]
    centers.append(((min(p.x for p in points) + max(p.x for p in points)) / 2,
                    (min(p.z for p in points) + max(p.z for p in points)) / 2))
cat.shape_key_add(name='Basis')
blink = cat.shape_key_add(name='Blink')
def smooth(a, b, x):
    t = min(1, max(0, (x-a)/(b-a)))
    return t*t*(3-2*t)
for vertex in mesh.vertices:
    x, depth, height = vertex.co
    for cx, cy in centers:
        radius = math.sqrt(((x-cx)/0.087)**2 + ((height-cy)/0.087)**2)
        weight = (1-smooth(1.05, 1.85, radius)) * smooth(0.16, 0.235, -depth)
        if weight <= 0:
            continue
        # Move surrounding skin with the eye opening; retain a fine closed crease.
        blink.data[vertex.index].co.z -= (height-cy) * weight * 0.99
        if vertex.index in eye_ids:
            blink.data[vertex.index].co.y += 0.025 * weight
        break
blink.value = 0
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / 'cat_blink.blend'))
bpy.ops.export_scene.gltf(filepath=str(ROOT / 'public/models/black-cat/cat_blink.glb'),
    export_format='GLB', use_selection=True, export_morph=True, export_morph_normal=True,
    export_animations=False)

# Reproducible close-up QA: open / half closed / closed.
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 24
scene.render.resolution_x = 640
scene.render.resolution_y = 640
scene.render.resolution_percentage = 100
scene.world.color = (0.35, 0.35, 0.35)
bpy.ops.object.camera_add(location=(-0.035, -2.25, 0.72))
camera = bpy.context.object
camera.rotation_euler = (Vector((-0.035, -0.1, 0.57))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type = 'ORTHO'
camera.data.ortho_scale = 0.85
scene.camera = camera
for position, energy, size in [((-1,-1.5,2), 100, 2), ((1,0,1.5), 65, 1.5)]:
    bpy.ops.object.light_add(type='AREA', location=position)
    lamp = bpy.context.object
    lamp.data.energy = energy
    lamp.data.shape = 'DISK'
    lamp.data.size = size
    lamp.rotation_euler = (Vector((0,0,0.5))-lamp.location).to_track_quat('-Z','Y').to_euler()
for label, value in [('open',0),('half',0.5),('closed',1)]:
    blink.value = value
    scene.render.filepath = str(OUT / f'{label}.png')
    bpy.ops.render.render(write_still=True)
print('BLINK_EXPORT_OK', centers)
