/**
 * Every line Panditji can say, built by the same functions the director uses,
 * so tools/voice/render_voice.py can pre-render each one as an audio clip.
 * Lines that depend on two readings at once (the two-hand comparison) are not
 * listed; they fall back to the browser's speech synthesis.
 */
import { isSafeText } from '../core/rules.js';
import { LINE_ORDER } from '../core/line-shapes.js';
import { ELEMENTS, LINE_OPTIONS, MOUNTS, READINGS } from './readings.js';
import { PANDIT } from './script.js';
import type { ElementText, LineId, MountText } from './types.js';
import { WORLD_NARRATION } from './worlds.js';
import { HINDI } from './hindi.js';

export const todaysMountLine = (m: MountText): string => PANDIT.todaysMount.replace('{mount}', `${m.name_roman} (${m.name_hi}), ${m.short.toLowerCase()}`);
export const elementIntroLine = (el: ElementText): string =>
  PANDIT.elementIntro.replace('an {element_en}', `${/^[aeiou]/i.test(el.name_en) ? 'an' : 'a'} ${el.name_en}`).replace('{element_hi}', `${el.name_hi}, ${el.name_roman}`);
export const otherHandRaiseLine = (): string => PANDIT.otherHand.split('?')[0] + '? Hold it up, palm toward you.';
const ACKS = ['Good.', 'I see.', 'Ah.', 'Yes.', 'Hmm, good.'];
/** Panditji's acknowledgement after the i-th line question is answered. */
export const pickedLine = (i: number, label: string): string => `${ACKS[i % ACKS.length]} ${label}.`;
export const CARD_LINE = 'Here is your Rekha card. It is saved on this headset only. After you leave, you can download it from this page.';

/**
 * The opening: a second, calmer voice from the sky (Aakashvani, आकाशवाणी) while the nine grahas turn
 * around you. Rendered with its own designed voice (tools/voice/render_voice.py --set divine).
 */
export const OPENING: { en: string; hi: string }[] = [
  { en: 'The nine grahas turn around you, as they turn through every old story of India.', hi: 'नौ ग्रह आपके चारों ओर घूम रहे हैं, जैसे वे भारत की हर पुरानी कहानी में घूमते हैं।' },
  { en: 'Their names are written on the hills of your palm. Sit, and let Panditji read them.', hi: 'उनके नाम आपकी हथेली के पर्वतों पर लिखे हैं। बैठिए, पंडितजी उन्हें पढ़ेंगे।' },
];
export const openingLines = (lang: 'en' | 'hi'): string[] => OPENING.map((o) => o[lang]);

export function allSpokenLines(lang: 'en' | 'hi'): string[] {
  if (lang === 'hi') return allSpokenLines('en').map((t) => HINDI[t]).filter((t): t is string => !!t);
  const out: string[] = [];
  const add = (t: string) => {
    if (t && !out.includes(t)) out.push(t);
  };
  PANDIT.greeting.forEach(add);
  add(PANDIT.raisePalm);
  add(otherHandRaiseLine());
  add(PANDIT.raiseRetry);
  add(PANDIT.scanning);
  add(PANDIT.linesAppear);
  ELEMENTS.forEach((e) => add(elementIntroLine(e)));
  add(PANDIT.mountsIntro);
  add(PANDIT.mountsPoke);
  MOUNTS.forEach((m) => add(m.text));
  add(PANDIT.mountsDone);
  add(PANDIT.linesIntro);
  LINE_ORDER.forEach((line: LineId, i) => {
    add(PANDIT.linePrompt[line]);
    LINE_OPTIONS.filter((o) => o.line === line).forEach((o) => add(pickedLine(i, o.label)));
  });
  add(PANDIT.explore);
  add(PANDIT.exploreMore);
  for (const w of Object.values(WORLD_NARRATION)) {
    add(w.intro);
    add(w.outro);
  }
  add(PANDIT.readingIntro);
  READINGS.filter((r) => isSafeText(r.text)).forEach((r) => add(r.text));
  add(PANDIT.readingOutro);
  add(CARD_LINE);
  add(PANDIT.farewell);
  add(PANDIT.trackingLost);
  return out;
}
