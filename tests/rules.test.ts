/** Rule engine: every input combination produces only safe, sourced readings. */
import { readFileSync } from 'node:fs';
import { ELEMENTS, LINE_OPTIONS, MOUNTS, READINGS } from '../src/content/readings.js';
import { PANDIT } from '../src/content/script.js';
import type { HandProfile, LineChoices, Tri } from '../src/content/types.js';
import { LINE_VALUES } from '../src/core/line-shapes.js';
import { BANNED, buildReading, isSafeText, resolveRule, type RulesJson, todaysMountIndex } from '../src/core/rules.js';
import { check, done } from './harness.js';

const rules = JSON.parse(readFileSync(process.cwd() + '/src/data/palmistry-rules.json', 'utf8')) as RulesJson;
// In the original monorepo these files were copies of the research kit's data/ folder; here they are the
// canonical copies (source: github.com/saurabh4269/meta-vr-start-2026-kit/tree/main/data). Check they parse.
check('palmistry-rules.json has features and rules', rules.features.length > 0);
const regions = JSON.parse(readFileSync(process.cwd() + '/src/data/palm-regions.json', 'utf8'));
check('palm-regions.json parses', !!regions && typeof regions === 'object');

// the banned pattern itself catches what it must
for (const bad of ['a short life', 'You will marry twice', 'signs of illness', 'risk of divorce', 'Cheiro: insanity', 'fertility', 'early death', 'this predicts wealth', 'bad luck ahead', 'jealous nature'])
  check(`banned catches "${bad}"`, BANNED.test(bad));
for (const ok of ['skill and will-power', 'still waters', 'a steady hand', 'the willing heart'])
  check(`banned allows "${ok}"`, !BANNED.test(ok));

// every authored string is safe
const strings: string[] = [];
for (const r of READINGS) strings.push(r.title, r.text, r.short);
for (const m of MOUNTS) strings.push(m.text, m.short);
for (const o of LINE_OPTIONS) strings.push(o.label);
const walk = (v: unknown) => (typeof v === 'string' ? strings.push(v) : v && typeof v === 'object' ? Object.values(v).forEach(walk) : 0);
walk(PANDIT);
for (const s of strings) check(`safe: ${s.slice(0, 50)}`, isSafeText(s));

// every content rule resolves, and none points at a value the rulebook says to omit
for (const r of [...READINGS, ...MOUNTS, ...ELEMENTS]) {
  const res = resolveRule(rules, r.rule);
  check(`rule resolves: ${'key' in r ? r.key : r.id}`, !!res);
  if (res) check(`rule usable: ${'key' in r ? r.key : r.id}`, !/do not use|\bomit\b/i.test(res.effect), res.effect);
}
// sensitive features never feed a reading through a flagged claim
const flaggedFeatures = rules.features.filter((f) => (f.sensitivity ?? []).some((s) => ['death', 'mental-illness', 'fertility', 'sexuality', 'addiction'].includes(s))).map((f) => f.id);
for (const r of READINGS) if (flaggedFeatures.includes(r.rule.feature)) check(`flagged feature ${r.rule.feature} text safe: ${r.key}`, isSafeText(r.text) && !/length|lifespan|how long/i.test(r.text));

// fuzz: every combination of profile + choices (+ random partial choices)
const tris: Tri[] = ['low', 'mid', 'high'];
let combos = 0, items = 0;
const rnd = (() => { let s = 42; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
const pick = <T,>(a: T[]): T => a[Math.floor(rnd() * a.length)];
for (let n = 0; n < 4000; n++) {
  const p: HandProfile = { side: pick(['left', 'right']), palmSquareness: rnd(), fingerRatio: rnd() * 1.5, element: pick(['prithvi', 'vayu', 'agni', 'jal']), indexLength: pick(tris), indexVsRing: pick(tris), thumbSpread: pick(tris) };
  const c: LineChoices = {};
  for (const [k, vals] of Object.entries(LINE_VALUES)) if (rnd() > 0.1) (c as Record<string, string>)[k] = pick(vals);
  const out = buildReading(rules, READINGS, p, c);
  combos++;
  items += out.length;
  for (const it of out) {
    if (!isSafeText(it.text) || !isSafeText(it.short) || !it.cite) check(`fuzz item safe+cited ${it.key}`, false, it.text);
  }
  // full choices always give a complete reading (element + 5 lines at least)
  if (Object.keys(c).length === 5) check('full reading complete', out.length >= 6 || false, `${out.length}`);
}
check('fuzz ran', combos === 4000, `${combos} combos, ${items} items`);
// a deliberately unsafe reading is dropped
const evil = [{ ...READINGS[0], text: 'Your life line shows an early death.' }];
const prof: HandProfile = { side: 'right', palmSquareness: 0.7, fingerRatio: 0.8, element: READINGS[0].key.split(':')[1] as HandProfile['element'], indexLength: 'mid', indexVsRing: 'mid', thumbSpread: 'mid' };
const logs: string[] = [];
check('unsafe text is dropped', buildReading(rules, evil, prof, {}, (m) => logs.push(m)).length === 0 && logs.some((l) => /banned-claim/.test(l)));
const unresolved = [{ ...READINGS[0], rule: { feature: 'life', attribute: 'length', value: 'nonexistent' } }];
check('unresolved rule is dropped', buildReading(rules, unresolved, prof, {}).length === 0);
// today's mount is stable per day and in range
const d = new Date(2026, 10, 18);
check("today's mount stable", todaysMountIndex(d) === todaysMountIndex(new Date(2026, 10, 18, 23)));
const seen = new Set<number>();
for (let i = 0; i < 60; i++) seen.add(todaysMountIndex(new Date(2026, 0, 1 + i)));
check("today's mount varies across days", seen.size >= 5 && [...seen].every((x) => x >= 0 && x < 7));
done(`rules (${combos} fuzz combos, ${items} items)`);
