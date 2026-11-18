# Model credits

## pandit.glb

The palmist character. It is an original design and does not depict any real person. It is built headless by `tools/pandit/build_pandit.py`; see `tools/pandit/README.md` for how to rebuild it.

| Part | Source | Licence |
|---|---|---|
| Body mesh, face shaping, expression targets, MPFB "default" rig | [MPFB 2](https://static.makehumancommunity.org/mpfb.html) (Blender extension, v2.0.18) | The tool is GPL-3.0. Characters generated with it are **CC0**, as MakeHuman states for its output and base data. |
| Skin texture (`old_african_male`), eyes (`high-poly` + `brown_eye`), eyebrows (`eyebrow003`), eyelashes (`eyelashes01`), teeth (`teeth_base`), tongue (`tongue01`), hair (`short02`) | [MakeHuman system assets](https://static.makehumancommunity.org/assets/assetpacks.html) (`makehuman_system_assets_cc0.zip`) | **CC0** |
| Skin recolour and stubble shading, grey hair recolour, deep-brown iris recolour | Done in code by our build script | Ours (CC0 inputs) |
| Beard and moustache (alpha shells and cards, procedural strand texture), kurta and pyjama, front placket, maroon shawl (procedural cotton and wool textures) | Generated in code by `tools/pandit/costume.py` | Ours |

The pipeline is adapted from `projects/chausar/tools/shakuni/` in this repository. No third-party textures beyond the MakeHuman CC0 assets are used.
