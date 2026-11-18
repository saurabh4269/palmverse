/**
 * Share-card layout (pure, testable): 1080×1350 portrait, aged paper.
 * Produces draw ops; render/share-card.ts paints them on a canvas. The text
 * measure function is injected so node tests can check that nothing overflows
 * or overlaps with a fake measure.
 */

export const CARD_W = 1080;
export const CARD_H = 1350;
export const MARGIN = 84;

export interface CardData {
  title_hi: string; // हस्त रेखा
  title_en: string; // Hast Rekha
  side: 'left' | 'right';
  element_en: string;
  element_hi: string;
  lines: { name: string; hi: string; short: string; color: string }[];
  quote: string;
  date: string; // e.g. 18 Nov 2026
  footer: string; // framing line
}

export type Measure = (text: string, font: string) => number;

export interface TextOp {
  kind: 'text';
  text: string;
  x: number;
  y: number; // baseline
  size: number;
  font: string; // css font
  color: string;
  align: 'left' | 'center' | 'right';
  width: number;
}
export interface PalmOp {
  kind: 'palm';
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface DotOp {
  kind: 'dot';
  x: number;
  y: number;
  r: number;
  color: string;
}
export type Op = TextOp | PalmOp | DotOp;

export const FONTS = {
  display: `'Rozha One', 'Tiro Devanagari Hindi', Georgia, serif`,
  body: `'Mukta', 'Tiro Devanagari Hindi', system-ui, sans-serif`,
  serif: `'Tiro Devanagari Hindi', Georgia, serif`,
};

function wrap(text: string, font: string, max: number, measure: Measure): string[] {
  const out: string[] = [];
  let cur = '';
  for (const w of text.split(/\s+/)) {
    const next = cur ? `${cur} ${w}` : w;
    if (measure(next, font) > max && cur) {
      out.push(cur);
      cur = w;
    } else cur = next;
  }
  if (cur) out.push(cur);
  return out;
}

/** Shrink `size` until every wrapped line fits `max` and the block fits `maxLines`. */
function fit(text: string, fam: string, weight: string, size: number, max: number, maxLines: number, measure: Measure): { size: number; lines: string[]; font: string } {
  for (let s = size; s >= 18; s -= 2) {
    const font = `${weight} ${s}px ${fam}`;
    const lines = wrap(text, font, max, measure);
    if (lines.length <= maxLines && lines.every((l) => measure(l, font) <= max)) return { size: s, lines, font };
  }
  const font = `${weight} 18px ${fam}`;
  return { size: 18, lines: wrap(text, font, max, measure).slice(0, maxLines), font };
}

export function layoutCard(d: CardData, measure: Measure): Op[] {
  const ops: Op[] = [];
  const W = CARD_W, inner = W - MARGIN * 2;
  const text = (t: string, x: number, y: number, size: number, font: string, color: string, align: TextOp['align'] = 'center') =>
    ops.push({ kind: 'text', text: t, x, y, size, font, color, align, width: measure(t, font) });

  let y = MARGIN + 96;
  const t1 = fit(d.title_hi, FONTS.display, '400', 110, inner, 1, measure);
  text(t1.lines[0], W / 2, y, t1.size, t1.font, '#7a2a0c');
  y += 60;
  const t2 = fit(`${d.title_en.toUpperCase()} · ${d.side === 'right' ? 'RIGHT' : 'LEFT'} HAND`, FONTS.body, '700', 34, inner, 1, measure);
  text(t2.lines[0], W / 2, y, t2.size, t2.font, '#9a5a1c');
  y += 34;

  // palm diagram (painted from the chosen shapes by the renderer)
  const pw = 280, ph = 340;
  ops.push({ kind: 'palm', x: W / 2 - pw / 2, y, w: pw, h: ph });
  y += ph + 24;

  const el = fit(`${d.element_hi} · ${d.element_en} hand`, FONTS.serif, '400', 52, inner, 1, measure);
  text(el.lines[0], W / 2, y + el.size * 0.8, el.size, el.font, '#5a1e08');
  y += el.size + 28;

  // one row per line: colour dot, name, tendency
  for (const l of d.lines.slice(0, 4)) {
    const nameFont = `700 30px ${FONTS.body}`;
    const name = `${l.name} · ${l.hi}`;
    ops.push({ kind: 'dot', x: MARGIN + 14, y: y + 2, r: 11, color: l.color });
    text(name, MARGIN + 40, y + 12, 30, nameFont, '#4a1c08', 'left');
    const s = fit(l.short, FONTS.body, '500', 30, inner - 40, 1, measure);
    text(s.lines[0], MARGIN + 40, y + 46, s.size, s.font, '#5e3a1e', 'left');
    y += 70;
  }

  y += 6;
  const q = fit(`“${d.quote}”`, FONTS.serif, '400', 36, inner - 40, 2, measure);
  q.lines.forEach((l, i) => text(l, W / 2, y + q.size + i * q.size * 1.25, q.size, q.font, '#6a2a0c'));
  y += q.size * 1.25 * q.lines.length + 16;

  const f = fit(`${d.date} · ${d.footer}`, FONTS.body, '600', 24, inner, 2, measure);
  const fy = CARD_H - MARGIN - (f.lines.length - 1) * f.size * 1.3;
  f.lines.forEach((l, i) => text(l, W / 2, fy + i * f.size * 1.3, f.size, f.font, '#8a6a46'));
  return ops;
}

/** Bounding box of a text op (approximate ascent 0.8·size, descent 0.25·size). */
export function textBox(o: TextOp): [number, number, number, number] {
  const x0 = o.align === 'center' ? o.x - o.width / 2 : o.align === 'right' ? o.x - o.width : o.x;
  return [x0, o.y - o.size * 0.8, x0 + o.width, o.y + o.size * 0.25];
}
