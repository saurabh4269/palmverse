/**
 * Dev-only: estimate GPU texture memory for everything in the scene, by format.
 * renderer.info only counts textures; this walks materials and sizes each texture
 * (RGBA8 = 4 B/px, ETC1S/UASTC → ETC2/ASTC on Quest = 1 B/px, BC7 on desktop = 1 B/px),
 * with mip chains at 4/3.
 */
import type { Object3D, Texture, WebGLRenderer } from '@iwsdk/core';

export interface GpuStats {
  calls: number;
  triangles: number;
  textures: number;
  texMB: number;
  compressed: number;
}

export function gpuStats(scene: Object3D, renderer: WebGLRenderer): GpuStats {
  const seen = new Set<Texture>();
  const sources = new Set<unknown>(); // three uploads one GPU texture per Source (clones share it)
  let bytes = 0, compressed = 0;
  scene.traverse((o) => {
    const mats = (o as unknown as { material?: unknown }).material;
    if (!mats) return;
    for (const m of Array.isArray(mats) ? mats : [mats]) {
      for (const v of Object.values(m as Record<string, unknown>)) {
        const t = v as Texture | null;
        if (!t || !(t as { isTexture?: boolean }).isTexture || seen.has(t)) continue;
        seen.add(t);
        if (sources.has(t.source)) continue;
        sources.add(t.source);
        const img = t.image as { width?: number; height?: number } | undefined;
        const w = img?.width ?? 0, h = img?.height ?? 0;
        const isC = (t as { isCompressedTexture?: boolean }).isCompressedTexture === true;
        if (isC) compressed++;
        const mip = t.generateMipmaps || isC ? 4 / 3 : 1;
        bytes += w * h * (isC ? 1 : 4) * mip;
      }
    }
  });
  const info = renderer.info;
  return { calls: info.render.calls, triangles: info.render.triangles, textures: sources.size, texMB: +(bytes / 1048576).toFixed(1), compressed };
}
