/**
 * Rule engine: hand profile (Layer 1) + confirmed line shapes (Layer 2) →
 * a list of reading items, each traced to one rule in palmistry-rules.json.
 *
 * Safety is enforced here, not trusted to the content:
 *  - a reading is dropped if its rule doesn't resolve, if the source value is
 *    one the rulebook marks "do not use"/"omit", or if its text matches the
 *    banned-claims pattern (death, illness, insanity, fertility, divorce …);
 *  - tests/rules.test.ts fuzzes every input combination through this.
 * Pure: the rules JSON and content are passed in, so node can test it.
 */
import type { HandProfile, LineChoices, ReadingText, RuleRef } from '../content/types.js';

export interface RulesJson {
  sources: { id: string; title: string; author: string; year: number }[];
  features: {
    id: string;
    name_en: string;
    name_hi: string;
    name_roman: string;
    sensitivity?: string[];
    attributes?: { attribute: string; values: { value: string; effect: string; cite: { src: string; loc: string } }[] }[];
  }[];
}

/** Claims the app must never make (rulebook "sensitivity" categories + ideas-7-8.md §8.3). */
export const BANNED =
  /\b(death|die[sd]?|dying|dead|lifespan|life\s*span|length of (your )?life|short life|long life|illness|ill|disease|sick(ness)?|cancer|heart (attack|disease|trouble)|insan\w*|madness|mental(ly)? ill|lunatic|suicid\w*|fertil\w*|infertil\w*|barren|pregnan\w*|miscarr\w*|number of children|how many children|divorce\w*|widow\w*|infidel\w*|unfaithful|adulter\w*|jealous\w*|accident\w*|danger\w*|misfortune|bad luck|unlucky|poverty|bankrupt\w*|lose (your )?money|money loss|curse[sd]?|doom\w*|catastroph\w*|tragic|tragedy|you will|will happen|predict\w*|destined|fatal\w*|morbid|addict\w*|murder\w*|violen\w*)\b/i;

export const isSafeText = (t: string): boolean => !BANNED.test(t);

/** Source values the rulebook itself says not to use. */
const UNUSABLE_EFFECT = /do not use|omit\b|\(cheiro: fatal/i;

export interface ResolvedRule {
  featureName: string;
  featureHi: string;
  effect: string;
  cite: string;
}

export function resolveRule(rules: RulesJson, ref: RuleRef): ResolvedRule | null {
  const f = rules.features.find((x) => x.id === ref.feature);
  const attr = f?.attributes?.find((a) => a.attribute === ref.attribute);
  const val = attr?.values.find((v) => v.value === ref.value);
  if (!f || !val) return null;
  const src = rules.sources.find((s) => s.id === val.cite.src);
  const cite = src ? `${src.author.replace(/ \(.*\)$/, '')}, ${src.title} (${src.year}), ${val.cite.loc}` : val.cite.loc;
  return { featureName: f.name_en, featureHi: f.name_hi, effect: val.effect, cite };
}

export interface ReadingItem {
  key: string;
  title: string;
  text: string;
  short: string;
  cite: string;
  hi: string;
}

/** Ordered reading keys for a profile + choices (mid finger values add nothing). */
export function readingKeys(p: HandProfile, c: LineChoices): string[] {
  const keys = [`element:${p.element}`];
  if (c.heart) keys.push(`heart:${c.heart}`);
  if (c.head) keys.push(`head:${c.head}`);
  if (c.join) keys.push(`join:${c.join}`);
  if (c.life) keys.push(`life:${c.life}`);
  if (c.fate) keys.push(`fate:${c.fate}`);
  if (p.thumbSpread !== 'mid') keys.push(`thumb:${p.thumbSpread}`);
  if (p.indexLength !== 'mid') keys.push(`index:${p.indexLength}`);
  if (p.indexVsRing !== 'mid') keys.push(`ring:${p.indexVsRing}`);
  return keys;
}

export function buildReading(
  rules: RulesJson,
  readings: ReadingText[],
  p: HandProfile,
  c: LineChoices,
  log?: (msg: string) => void,
): ReadingItem[] {
  const out: ReadingItem[] = [];
  for (const key of readingKeys(p, c)) {
    const r = readings.find((x) => x.key === key);
    if (!r) {
      log?.(`reading-missing key=${key}`);
      continue;
    }
    const res = resolveRule(rules, r.rule);
    if (!res) {
      log?.(`reading-dropped key=${key} reason=unresolved-rule`);
      continue;
    }
    if (UNUSABLE_EFFECT.test(res.effect) && !/reframe/i.test(res.effect)) {
      log?.(`reading-dropped key=${key} reason=rulebook-says-omit`);
      continue;
    }
    if (!isSafeText(r.text) || !isSafeText(r.short) || !isSafeText(r.title)) {
      log?.(`reading-dropped key=${key} reason=banned-claim`);
      continue;
    }
    out.push({ key, title: r.title, text: r.text, short: r.short, cite: res.cite, hi: res.featureHi });
  }
  return out;
}

/** Deterministic "today's mount" (same for everyone on a given local date). */
export function todaysMountIndex(d: Date, count = 7): number {
  const n = d.getFullYear() * 372 + d.getMonth() * 31 + d.getDate();
  let h = n ^ 0x9e3779b9;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  return ((h ^ (h >>> 16)) >>> 0) % count;
}
