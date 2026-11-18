/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { iwsdkDev } from '@iwsdk/vite-plugin-dev';
import { questDebug } from './tools/quest-debug.mjs';
import { defineConfig, type Plugin } from 'vite';

/**
 * Serve the Basis Universal transcoder (KTX2 textures) from IWSDK's vendored copy at /basis/,
 * in dev and in the build, so nothing is fetched from a CDN at runtime (src/index.ts points
 * the KTX2 loader here).
 */
function basisTranscoder(): Plugin {
  const dir = join(__dirname, 'node_modules/@iwsdk/core/dist/vendor/basis');
  const files = readdirSync(dir).filter((f) => f.startsWith('basis_transcoder'));
  return {
    name: 'hast-basis-transcoder',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const m = req.url?.match(/\/basis\/(basis_transcoder\.(js|wasm))(\?.*)?$/);
        if (!m) return next();
        res.setHeader('Content-Type', m[2] === 'wasm' ? 'application/wasm' : 'text/javascript');
        res.end(readFileSync(join(dir, m[1])));
      });
    },
    generateBundle() {
      for (const f of files) this.emitFile({ type: 'asset', fileName: `basis/${f}`, source: readFileSync(join(dir, f)) });
    },
  };
}

export default defineConfig({
  plugins: [iwsdkDev(), questDebug(), basisTranscoder()],
  server: { host: '0.0.0.0', port: Number(process.env.PORT) || 8087, open: false },
  build: {
    outDir: 'dist',
    sourcemap: process.env.NODE_ENV !== 'production',
    target: 'esnext',
    rollupOptions: { input: './index.html' },
  },
  esbuild: { target: 'esnext' },
  // @drawcall/uikitml otherwise pulls a second three/@pmndrs/uikit graph
  // (its own three vs the app's super-three alias). Duplicate Component classes break
  // instanceof checks → "Only pmndrs/uikit components can be added as children".
  resolve: {
    dedupe: [
      'three',
      '@pmndrs/uikit',
      '@pmndrs/uikit-horizon',
      '@pmndrs/uikit-lucide',
    ],
  },
  optimizeDeps: {
    exclude: ['@babylonjs/havok'],
    include: [
      'three',
      '@pmndrs/uikit',
      '@pmndrs/uikit-horizon',
      '@pmndrs/uikit-lucide',
      '@drawcall/uikitml',
    ],
    esbuildOptions: { target: 'esnext' },
  },
  publicDir: 'public',
  base: './',
});
