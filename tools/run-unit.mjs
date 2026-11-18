// Bundles each tests/*.test.ts with esbuild (TS + .js→.ts resolution) and runs it in node.
import { build } from 'esbuild';
import { readdirSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const root = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const out = path.join(root, '.tmp', 'tests');
mkdirSync(out, { recursive: true });
let failed = 0;
for (const f of readdirSync(path.join(root, 'tests')).filter((f) => f.endsWith('.test.ts')).sort()) {
  const outfile = path.join(out, f.replace(/\.ts$/, '.mjs'));
  await build({ entryPoints: [path.join(root, 'tests', f)], bundle: true, platform: 'node', format: 'esm', outfile, logLevel: 'warning', alias: { '@iwsdk/core': 'three' }, define: { 'import.meta.env.DEV': 'false' } });
  try {
    execFileSync(process.execPath, [outfile], { stdio: 'inherit' });
  } catch {
    failed++;
  }
}
console.log(failed ? `\n${failed} test file(s) FAILED` : '\nall unit tests passed');
process.exit(failed ? 1 : 0);
