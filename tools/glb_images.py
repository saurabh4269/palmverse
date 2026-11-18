#!/usr/bin/env python3
"""Dump the embedded images of a GLB for review: python3 tools/glb_images.py in.glb outdir"""
import json, os, struct, sys
src, out = sys.argv[1], sys.argv[2]
os.makedirs(out, exist_ok=True)
b = open(src, 'rb').read()
jl = struct.unpack_from('<I', b, 12)[0]
js = json.loads(b[20:20 + jl])
binoff = 20 + jl + 8
for i, im in enumerate(js.get('images', [])):
    bv = js['bufferViews'][im['bufferView']]
    data = b[binoff + bv.get('byteOffset', 0): binoff + bv.get('byteOffset', 0) + bv['byteLength']]
    ext = {'image/png': 'png', 'image/jpeg': 'jpg', 'image/ktx2': 'ktx2'}.get(im.get('mimeType'), 'bin')
    name = (im.get('name') or f'img{i}').replace('/', '_')
    open(os.path.join(out, f'{i}-{name}.{ext}'), 'wb').write(data)
    print(i, name, im.get('mimeType'), len(data) // 1024, 'KB')
