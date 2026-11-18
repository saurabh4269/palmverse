# Model credits

## pandit.glb

The palmist character. It is an original design and does not depict any real person. It is built headless by `tools/pandit/build_pandit.py`; see `tools/pandit/README.md` for how to rebuild it.

| Part | Source | Licence |
|---|---|---|
| Body mesh, face shaping, expression targets, MPFB "default" rig | [MPFB 2](https://static.makehumancommunity.org/mpfb.html) (Blender extension, v2.0.18) | The tool is GPL-3.0. Characters generated with it are **CC0**, as MakeHuman states for its output and base data. |
| Skin texture (`old_african_male`), eyes (`high-poly` + `brown_eye`), eyebrows (`eyebrow003`), eyelashes (`eyelashes01`), teeth (`teeth_base`), tongue (`tongue01`), hair (`short02`) | [MakeHuman system assets](https://static.makehumancommunity.org/assets/assetpacks.html) (`makehuman_system_assets_cc0.zip`) | **CC0** |
| Skin recolour and stubble shading, grey hair recolour, deep-brown iris recolour | Done in code by our build script | Ours (CC0 inputs) |
| Beard and moustache (alpha shells and cards, procedural strand texture), kurta and pyjama, front placket, maroon shawl (procedural cotton and wool textures) | Generated in code by `tools/pandit/costume.py` | Ours |

The pipeline is adapted from the team's earlier character pipeline in the [research kit](https://github.com/saurabh4269/meta-vr-start-2026-kit). No third-party textures beyond the MakeHuman CC0 assets are used.

## banyan.glb

The banyan in the "life line" world. It is adapted from a low-poly tree; the banyan-specific parts are ours.

| Part | Source | Licence |
|---|---|---|
| Trunk, branches, root flare, canopy blobs, small hanging vines | "Vine Covered Tree" by **Zacharylll**, via Poly Pizza: <https://poly.pizza/m/dlW4hGKBpiS> | **CC-BY 3.0** (<https://creativecommons.org/licenses/by/3.0/>) |
| 48 aerial roots (7 prop roots reaching the ground, 41 hanging strands) | Generated in Blender by ray-casting up from under the canopy | Ours |

Changes to the original: we removed the grass base slab and spread the tree 1.4× horizontally so it reads as a wide banyan. We decimated the bark (to 40%) and the vines (to 25%), merged everything into one mesh with three materials (bark, canopy, vines), dropped the unused UVs, set the origin to the base of the trunk, scaled it to 1.0 unit tall and made the vines material double-sided. The model has no textures; the colours come from the original flat material colours.
