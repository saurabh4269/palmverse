/** Share card layout: nothing overflows the card or overlaps, for short and very long content. */
import { CARD_H, CARD_W, layoutCard, MARGIN, textBox, type CardData } from '../src/core/share-layout.js';
import { check, done } from './harness.js';

// fake measure: ~0.55 em per char (Devanagari a little wider)
const measure = (t: string, font: string) => {
  const size = +(font.match(/(\d+)px/)?.[1] ?? 20);
  let w = 0;
  for (const ch of t) w += /[ऀ-ॿ]/.test(ch) ? 0.62 : 0.55;
  return w * size;
};
const base: CardData = {
  title_hi: 'हस्त रेखा', title_en: 'Hast Rekha', side: 'right', element_en: 'Fire', element_hi: 'अग्नि हस्त',
  lines: [
    { name: 'Hridaya', hi: 'हृदय रेखा', short: 'Calm, giving, balanced in affection', color: '#ff7aa2' },
    { name: 'Mastishk', hi: 'मस्तिष्क रेखा', short: 'Imaginative and intuitive thinking', color: '#8fd3ff' },
    { name: 'Jeevan', hi: 'जीवन रेखा', short: 'Warm energy that recharges quickly', color: '#ffb347' },
    { name: 'Bhagya', hi: 'भाग्य रेखा', short: 'A self-directed path', color: '#9dffb0' },
  ],
  quote: 'Energetic, spontaneous, driven',
  date: '18 Nov 2026',
  footer: 'A reading of tradition, for reflection and fun. Not a forecast.',
};
const long: CardData = { ...base, quote: 'A very long tendency phrase that goes on and on about the hand and its many interesting aspects according to tradition', lines: base.lines.map((l) => ({ ...l, short: l.short + ' and a great deal more besides that' })), footer: base.footer + ' Sources: Cheiro, Benham, Brihat Samhita.' };
for (const [name, d] of [['normal', base], ['long', long], ['two lines', { ...base, lines: base.lines.slice(0, 2) }]] as const) {
  const ops = layoutCard(d, measure);
  const boxes = ops.filter((o) => o.kind === 'text').map((o) => ({ o, b: textBox(o as Parameters<typeof textBox>[0]) }));
  for (const { o, b } of boxes) {
    const t = o as { text: string };
    check(`${name}: inside card "${t.text.slice(0, 30)}"`, b[0] >= MARGIN - 1 && b[2] <= CARD_W - MARGIN + 1 && b[1] >= MARGIN - 1 && b[3] <= CARD_H - MARGIN + 30, JSON.stringify(b));
  }
  for (let i = 0; i < boxes.length; i++)
    for (let k = i + 1; k < boxes.length; k++) {
      const a = boxes[i].b, b = boxes[k].b;
      const overlap = a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
      check(`${name}: no overlap "${(boxes[i].o as { text: string }).text.slice(0, 16)}" / "${(boxes[k].o as { text: string }).text.slice(0, 16)}"`, !overlap);
    }
  const palm = ops.find((o) => o.kind === 'palm') as { y: number; h: number } | undefined;
  check(`${name}: palm diagram present and clear of text`, !!palm && boxes.every(({ b }) => b[3] <= palm.y + 2 || b[1] >= palm.y + palm.h - 2));
}
done('share-layout');
