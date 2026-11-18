/** One Euro on palm joints: kills millimetre jitter at rest, keeps lag small when the hand moves. */
import { OneEuroFilter3 } from '../src/core/one-euro.js';
import { check, done } from './harness.js';

let seed = 7;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
const dt = 1 / 72;
const out = { x: 0, y: 0, z: 0 };

// 1. hand held still with ±2 mm tracking noise for 3 s
{
  const f = new OneEuroFilter3();
  let rawSq = 0, outSq = 0, n = 0;
  for (let i = 0; i < 216; i++) {
    const nx = rnd() * 0.002, ny = rnd() * 0.002, nz = rnd() * 0.002;
    f.filter(0.1 + nx, 1.0 + ny, -0.4 + nz, dt, out);
    if (i > 36) {
      rawSq += nx * nx + ny * ny + nz * nz;
      outSq += (out.x - 0.1) ** 2 + (out.y - 1.0) ** 2 + (out.z + 0.4) ** 2;
      n++;
    }
  }
  const rawRms = Math.sqrt(rawSq / n), outRms = Math.sqrt(outSq / n);
  check('at rest: jitter cut by at least 3x', outRms < rawRms / 3, `${(rawRms * 1000).toFixed(2)}mm -> ${(outRms * 1000).toFixed(2)}mm`);
}

// 2. hand sweeping at 0.4 m/s: steady-state lag under 1.5 cm
{
  const f = new OneEuroFilter3();
  let lag = 0;
  for (let i = 0; i < 144; i++) {
    const x = 0.4 * i * dt;
    f.filter(x, 1, -0.4, dt, out);
    lag = x - out.x;
  }
  check('moving 0.4 m/s: lag < 15 mm', lag < 0.015, `${(lag * 1000).toFixed(1)}mm`);
}

// 3. reset re-primes to the new position immediately (hand lost and found elsewhere)
{
  const f = new OneEuroFilter3();
  for (let i = 0; i < 20; i++) f.filter(0, 0, 0, dt, out);
  f.reset();
  f.filter(0.5, 0.5, 0.5, dt, out);
  check('reset: first sample passes through', Math.abs(out.x - 0.5) < 1e-9 && Math.abs(out.z - 0.5) < 1e-9);
}

done('one-euro');
