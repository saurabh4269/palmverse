# banyan.glb build

Source: https://static.poly.pizza/f55c02bf-a771-4962-8f9c-136cb131f636.glb ("Vine Covered Tree" by Zacharylll, CC-BY 3.0, https://poly.pizza/m/dlW4hGKBpiS).

    B=/Applications/Blender.app/Contents/MacOS/Blender
    $B -b --factory-startup -P tools/banyan/build_banyan.py -- source.glb out.glb 1.4 0.4 0.25 48
    npx @gltf-transform/cli@4 dedup out.glb public/models/banyan.glb
    $B -b --factory-startup -P tools/banyan/render_preview.py -- public/models/banyan.glb artifacts/banyan-preview.png 25

The arguments after the paths are: horizontal spread, bark decimation ratio, vine decimation ratio and root count. The random seed is fixed, so rebuilds are repeatable.
