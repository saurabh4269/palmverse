/** Touching glowing lines: nearest-line geometry and the hover → touch → select state machine. */
import { LineToucher, nearestLine, TOUCH, type LineHit, type TouchEvent, type TouchLine } from '../src/core/line-touch.js';
import { shapeFor, smoothStroke, TEMPLATE } from '../src/core/line-shapes.js';
import { palmFrame, q, type V3 } from '../src/core/palm-frame.js';
import { syntheticHand } from './palm-frame.test.js';
import { check, done } from './harness.js';

const f = palmFrame(syntheticHand('right'), 'right');
const lines: TouchLine<'heart' | 'head' | 'life' | 'fate'>[] = (['heart', 'head', 'life', 'fate'] as const).map((id) => ({
  id,
  strokes: shapeFor(id, TEMPLATE[id]).map((s) => smoothStroke(s, 8)),
}));

// a point on each line (its middle sample), lifted a little, is nearest to that line
for (const l of lines) {
  const s = l.strokes[0];
  const mid = s.pts[Math.floor(s.pts.length / 2)];
  const p = q(f, mid[0], mid[1], 0.005);
  const hit = nearestLine(f, p, lines)!;
  check(`nearest ${l.id}`, hit.id === l.id, `${hit.id} d=${hit.dist}`);
  check(`on ${l.id}: dist ~0`, hit.dist < 0.002, String(hit.dist));
  check(`on ${l.id}: height 5 mm`, Math.abs(hit.h - 0.005) < 1e-6, String(hit.h));
  check(`on ${l.id}: u mid`, hit.u > 0.3 && hit.u < 0.7, String(hit.u));
}
// far off the palm: still returns a hit but with a large distance
const far = nearestLine(f, [1, 1, 1] as V3, lines)!;
check('far is far', far.dist > 0.2 || Math.abs(far.h) > 0.2);
check('no lines → null', nearestLine(f, [0, 0, 0], []) === null);

// state machine: approach the heart line, touch, dwell → one select
const heart = lines.find((l) => l.id === 'heart')!.strokes[0];
const mid = heart.pts[Math.floor(heart.pts.length / 2)];
const at = (h: number): LineHit<'heart' | 'head' | 'life' | 'fate'> => nearestLine(f, q(f, mid[0], mid[1], h), lines)!;
const tch = new LineToucher<'heart' | 'head' | 'life' | 'fate'>();
const ev: TouchEvent<'heart' | 'head' | 'life' | 'fate'>[] = [];
const all: string[] = [];
const run = (hit: LineHit<'heart' | 'head' | 'life' | 'fate'> | null, n: number, pinch: LineHit<'heart' | 'head' | 'life' | 'fate'> | null = null) => {
  for (let i = 0; i < n; i++) {
    tch.step(1 / 72, hit, pinch, ev);
    for (const e of ev) all.push(`${e.kind}:${e.id}`);
  }
};
run(at(0.025), 5);
check('hover at 2.5 cm', tch.hover === 'heart' && all.join() === 'hover:heart', all.join());
check('proximity partial', tch.proximity > 0 && tch.proximity < 0.6, String(tch.proximity));
run(at(0.002), 3);
check('touch event', all.includes('touch:heart'));
check('no select before dwell', !all.some((e) => e.startsWith('select')));
run(at(0.002), Math.ceil(TOUCH.dwell * 72) + 2);
check('select after dwell', all.filter((e) => e.startsWith('select')).length === 1, all.join());
run(at(0.002), 40);
check('one select per touch', all.filter((e) => e.startsWith('select')).length === 1);
// one dropped frame keeps the hover (grace)
run(null, 3);
check('grace keeps hover', tch.hover === 'heart');
run(null, Math.ceil(TOUCH.grace * 72) + 2);
check('lost → unhover', tch.hover === null && all.includes('unhover:heart'));
// lift and touch again → a second select
run(at(0.02), 3);
run(at(0.001), Math.ceil(TOUCH.dwell * 72) + 2);
check('re-touch selects again', all.filter((e) => e.startsWith('select')).length === 2, all.join());
// pinch near a line selects on the rising edge only
tch.reset();
all.length = 0;
run(null, 5, at(0.01));
check('pinch selects once', all.filter((e) => e === 'select:heart').length === 1, all.join());
// device bug (18 Nov): hovering one line and pinching opened a neighbour (the pinch midpoint sits
// toward the thumb). The hovered line wins the pinch, and another line takes the hover over only
// when it is nearer by TOUCH.switchMargin.
{
  type L = 'heart' | 'head' | 'life' | 'fate';
  const hit = (id: L, dist: number, h = 0.004, u = 0.5): LineHit<L> => ({ id, dist, h, u });
  const t2 = new LineToucher<L>();
  const ev2: TouchEvent<L>[] = [];
  const got: string[] = [];
  const go = (tip: LineHit<L> | null, cur: LineHit<L> | null, n = 1, pinch: LineHit<L> | null = null) => {
    for (let i = 0; i < n; i++) {
      t2.step(1 / 72, tip, pinch, ev2, cur);
      for (const e of ev2) got.push(`${e.kind}:${e.id}`);
    }
  };
  go(hit('fate', 0.006, 0.02), null, 3);
  check('hover fate', t2.hover === 'fate', got.join());
  // life is 2 mm nearer than fate: not enough to switch
  go(hit('life', 0.005, 0.02), hit('fate', 0.007, 0.02), 10);
  check('hysteresis keeps fate', t2.hover === 'fate', got.join());
  // pinch whose midpoint is nearest life: the hovered fate opens
  go(hit('life', 0.005, 0.02), hit('fate', 0.007, 0.02), 1, hit('life', 0.004, 0.01));
  check('pinch opens the hovered line', got.includes('select:fate') && !got.includes('select:life'), got.join());
  // life clearly nearer (by more than the margin): the hover moves
  go(hit('life', 0.002, 0.02), hit('fate', 0.012, 0.02), 3);
  check('clearly nearer line takes the hover', t2.hover === 'life', got.join());
}
done('line-touch');
