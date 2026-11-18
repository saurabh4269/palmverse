/** Every pre-renderable line is safe, unique and hashed the same way as tools/voice/render_voice.py. */
import { allSpokenLines } from '../src/content/spoken.js';
import { WORLD_NARRATION } from '../src/content/worlds.js';
import { PANDIT } from '../src/content/script.js';
import { isSafeText } from '../src/core/rules.js';
import { fnv1a } from '../src/render/voice-clips.js';
import { HINDI } from '../src/content/hindi.js';
import { check, done } from './harness.js';

const en = allSpokenLines('en');
check('many lines', en.length > 80, String(en.length));
check('unique', new Set(en).size === en.length);
for (const t of en) check(`safe: ${t.slice(0, 40)}`, isSafeText(t), t);
check('greeting listed', PANDIT.greeting.every((g) => en.includes(g)));
check('worlds listed', Object.values(WORLD_NARRATION).every((w) => en.includes(w.intro) && en.includes(w.outro)));
// FNV-1a 32 reference vectors (same as python fnv1a in render_voice.py)
check('fnv1a("") ', fnv1a('') === '811c9dc5', fnv1a(''));
check('fnv1a("hello")', fnv1a('hello') === '4f9f2cab', fnv1a('hello'));
check('fnv1a utf-8 (matches python)', fnv1a('हस्त') === '8fc26356', fnv1a('हस्त'));
const hashes = new Set(en.map(fnv1a));
check('no hash collisions', hashes.size === en.length);
// Hindi: one per English line, in Devanagari, no stale entries
const hi = allSpokenLines('hi');
check('every line has Hindi', hi.length === en.length, `${hi.length}/${en.length} missing: ${en.filter((t) => !HINDI[t]).slice(0, 3).join(' | ')}`);
check('no stale Hindi entries', Object.keys(HINDI).every((k) => en.includes(k)), Object.keys(HINDI).filter((k) => !en.includes(k)).slice(0, 3).join(' | '));
for (const t of hi) check(`Devanagari: ${t.slice(0, 20)}`, /[\u0900-\u097F]/.test(t) && !/[A-Za-z]{3,}/.test(t), t);
check('Hindi hashes unique', new Set(hi.map(fnv1a)).size === hi.length);
done(`spoken (${en.length} lines, ${en.reduce((a, t) => a + t.length, 0)} chars)`);
