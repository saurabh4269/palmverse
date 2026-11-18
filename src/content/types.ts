/**
 * Content model for Hast Rekha. Pure data types: no three.js, no DOM.
 *
 * Every sentence the app shows about a hand is a ReadingText that points at
 * one rule in src/data/palmistry-rules.json (feature id + attribute + value),
 * so each line of the reading can be traced to a source (Cheiro 1916, Benham
 * 1900, Brihat Samhita ch. 68, modern Indian guides). The wording itself is
 * our own paraphrase, written as "the tradition says…", never as prediction.
 */

export type Side = 'left' | 'right';
export type Element = 'prithvi' | 'vayu' | 'agni' | 'jal';
export type Tri = 'low' | 'mid' | 'high';

/** What the joints can measure (Layer 1). */
export interface HandProfile {
  side: Side;
  /** |index knuckle → pinky knuckle| / |wrist → middle knuckle| */
  palmSquareness: number;
  /** |middle knuckle → middle tip| / |wrist → middle knuckle| */
  fingerRatio: number;
  element: Element;
  /** index finger length vs population (rulebook finger_jupiter) */
  indexLength: Tri;
  /** index / ring length: 'low' = ring clearly longer, 'high' = index clearly longer */
  indexVsRing: Tri;
  /** thumb–index spread angle: 'high' = wide (finger_spacing: wide thumb-index) */
  thumbSpread: Tri;
}

/** What the user confirms by picking the closest shape (Layer 2). */
export type HeartEnd = 'jupiter' | 'between' | 'saturn';
export type HeadShape = 'straight' | 'sloping' | 'short' | 'forked';
export type HeadLifeStart = 'joined' | 'separate';
export type LifeShape = 'wide' | 'hugging' | 'forked' | 'break';
export type FateShape = 'none' | 'wrist' | 'moon' | 'midpalm';

export interface LineChoices {
  heart?: HeartEnd;
  head?: HeadShape;
  join?: HeadLifeStart;
  life?: LifeShape;
  fate?: FateShape;
}

export type LineId = 'heart' | 'head' | 'join' | 'life' | 'fate';

/** Pointer into palmistry-rules.json: features[id=feature].attributes[attribute=attribute].values[value=value]. */
export interface RuleRef {
  feature: string;
  attribute: string;
  value: string;
}

/**
 * One reading sentence. key format:
 *   element:<Element>            e.g. element:agni
 *   index:<Tri>                  (low/high only; mid = no sentence)
 *   ring:<Tri>                   index vs ring (low/high only)
 *   thumb:<Tri>                  (high/low only)
 *   heart:<HeartEnd>, head:<HeadShape>, join:<HeadLifeStart>, life:<LifeShape>, fate:<FateShape>
 */
export interface ReadingText {
  key: string;
  rule: RuleRef;
  /** heading on the card, English, ≤ 28 chars, e.g. "Heart line · ends between" */
  title: string;
  /** spoken + subtitled, pandit voice, 1–2 sentences, ≤ 220 chars, starts from the tradition ("The tradition says…", "Cheiro wrote…", "Old texts read this as…") */
  text: string;
  /** for the share card, ≤ 64 chars, a tendency phrase, e.g. "Calm, giving, balanced in affection" */
  short: string;
}

export type MountId = 'jupiter' | 'saturn' | 'sun_apollo' | 'mercury' | 'mars_upper' | 'luna_moon' | 'venus';

export interface MountText {
  id: MountId;
  planet: string; // English planet name
  name_hi: string; // e.g. गुरु पर्वत
  name_roman: string; // e.g. Guru Parvat
  /** the 1–2 Devanagari letters drawn as the mount's sigil, e.g. गु */
  sigil: string;
  /** spoken + subtitled when the mount is touched, ≤ 240 chars */
  text: string;
  /** ≤ 48 chars, e.g. "Ambition and leadership" */
  short: string;
  rule: RuleRef;
}

export interface ElementText {
  id: Element;
  name_en: string; // Earth / Air / Fire / Water
  name_hi: string; // पृथ्वी हस्त …
  name_roman: string; // Prithvi Hast …
  rule: RuleRef;
}

/** A candidate shape the user can pick for a line (Layer 2). Geometry lives in src/core/line-shapes.ts. */
export interface LineOptionText {
  line: LineId;
  value: string; // one of the line's union values
  /** card label, ≤ 26 chars, plain description of what you'd SEE: "Curves up between index and middle" */
  label: string;
}

export interface PanditScript {
  greeting: string[]; // 2–3 short lines; introduces himself, the tradition (Samudrika Shastra), and the framing: culture, not prediction
  disclaimer: string; // one line for the opening card
  privacy: string; // one line: only joint positions, no camera, nothing leaves the device
  todaysMount: string; // template with {mount} e.g. "Today the tradition would light your {mount}."
  raisePalm: string; // "Hold up the hand you write with, palm toward you."
  raiseRetry: string; // if no palm after ~12 s
  scanning: string;
  linesAppear: string; // as lines draw on the palm
  elementIntro: string; // template with {element_en} {element_hi}
  mountsIntro: string;
  mountsPoke: string; // "Touch a mount with your other hand's fingertip."
  mountsDone: string;
  linesIntro: string; // "Now you show me. Look at your own palm and pick the shape closest to yours."
  linePrompt: Record<LineId, string>; // question per line
  readingIntro: string;
  readingOutro: string; // includes a gentle joke about how readings fit everyone (Barnum effect) and the framing
  otherHand: string; // offer: "Shall we read your other hand? Old books say the left shows what you were given, the right what you made of it."
  compare: string; // template {diff}
  farewell: string;
  trackingLost: string; // "I lost sight of your hand. Hold it up again."
}
