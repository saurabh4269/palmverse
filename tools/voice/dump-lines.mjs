// Prints {"en": [every line Panditji can say], "hi": [...]} from src/content/spoken.ts (bundled with esbuild).
import { build } from 'esbuild';
import path from 'node:path';
import { mkdirSync } from 'node:fs';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const out = path.join(root, '.tmp', 'spoken.mjs');
mkdirSync(path.dirname(out), { recursive: true });
await build({ entryPoints: [path.join(root, 'src/content/spoken.ts')], bundle: true, platform: 'node', format: 'esm', outfile: out, logLevel: 'warning', alias: { '@iwsdk/core': 'three' }, define: { 'import.meta.env.DEV': 'false' } });
const m = await import(out);
process.stdout.write(JSON.stringify({ en: m.allSpokenLines('en'), hi: m.allSpokenLines('hi') }, null, 1));
