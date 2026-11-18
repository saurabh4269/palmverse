/**
 * Curated reading library for Hast Rekha. Every sentence points at one rule
 * in src/data/palmistry-rules.json (feature + attribute + value, verbatim).
 *
 * Voice: Panditji, warm and respectful. Always "the tradition reads…",
 * never a forecast. Wording is our own paraphrase of Cheiro (1916),
 * Benham (1900), Brihat Samhita ch. 68 and modern Indian guides.
 *
 * Note for readers: heart and head lines and the planetary mounts reached
 * Indian practice through Cheiro and Benham in the 20th century; the
 * classical Samudrika texts read auspicious marks and a few lines instead.
 */
import type { ElementText, LineOptionText, MountText, ReadingText } from './types.js';

export const READINGS: ReadingText[] = [
  // ── Hand shape (elements) ──────────────────────────────────────────────
  {
    key: 'element:prithvi',
    rule: { feature: 'shape_elements', attribute: 'palm_shape_x_finger_length', value: 'square palm + short fingers = EARTH (Prithvi)' },
    title: 'Earth hand · Prithvi',
    text: 'A square palm with shorter fingers: the tradition calls this a Prithvi hand, the hand of the earth. It is read as practical, steady and dependable, someone who likes to build things that last.',
    short: 'Grounded, practical, quietly dependable',
  },
  {
    key: 'element:vayu',
    rule: { feature: 'shape_elements', attribute: 'palm_shape_x_finger_length', value: 'square palm + long fingers = AIR (Vayu)' },
    title: 'Air hand · Vayu',
    text: 'A square palm with long fingers: this is the Vayu hand, the hand of air. The tradition reads it as curious and talkative, a mind that enjoys ideas, conversation and good company.',
    short: 'Curious, sociable, alive with ideas',
  },
  {
    key: 'element:agni',
    rule: { feature: 'shape_elements', attribute: 'palm_shape_x_finger_length', value: 'rectangular palm + short fingers = FIRE (Agni)' },
    title: 'Fire hand · Agni',
    text: 'A longer palm with shorter fingers: the tradition names this an Agni hand, the hand of fire. It is read as warm, quick and spirited, someone who starts things with real enthusiasm.',
    short: 'Energetic, spontaneous, full of spark',
  },
  {
    key: 'element:jal',
    rule: { feature: 'shape_elements', attribute: 'palm_shape_x_finger_length', value: 'rectangular palm + long fingers = WATER (Jal)' },
    title: 'Water hand · Jal',
    text: 'A longer palm with long, graceful fingers: this is the Jal hand, the hand of water. The tradition reads it as sensitive and intuitive, with a feeling for art, music and mood.',
    short: 'Sensitive, intuitive, artistic',
  },

  // ── Fingers and thumb ──────────────────────────────────────────────────
  {
    key: 'index:low',
    rule: { feature: 'finger_jupiter', attribute: 'length_vs_population', value: 'short' },
    title: 'Index finger · modest',
    text: 'Your index finger, the finger of Guru, sits on the modest side. Old books read this as someone happy to let others take the stage, who leads by example rather than by command.',
    short: 'Leads quietly, by example',
  },
  {
    key: 'index:high',
    rule: { feature: 'finger_jupiter', attribute: 'length_vs_population', value: 'long' },
    title: 'Index finger · long',
    text: 'A long index finger, the finger of Guru. Cheiro wrote that it shows a love of leading and organising. The tradition sees someone who enjoys taking charge when the moment asks.',
    short: 'A natural organiser who enjoys leading',
  },
  {
    key: 'ring:low',
    rule: { feature: 'finger_index_vs_ring', attribute: 'ratio', value: 'index / ring < p25' },
    title: 'Ring finger · the longer',
    text: 'Your ring finger, the finger of Surya, is clearly longer than the index. Modern teachers link this to boldness and a taste for colour, play and a little showmanship.',
    short: 'Bold, playful, a touch of the showman',
  },
  {
    key: 'ring:high',
    rule: { feature: 'finger_index_vs_ring', attribute: 'ratio', value: 'index / ring > p75' },
    title: 'Index finger · the longer',
    text: 'Your index finger stands taller than the ring finger. Modern teachers read this as self-assurance and a liking for structure, someone who prefers to plan before leaping.',
    short: 'Self-assured, likes a good plan',
  },
  {
    key: 'thumb:low',
    rule: { feature: 'thumb', attribute: 'flexibility', value: 'firm, stiff' },
    title: 'Thumb · held close',
    text: 'Your thumb stays close and firm. The tradition reads a firm thumb as steady resolve and self-control, someone who keeps their word and does not bend easily with every breeze.',
    short: 'Steady resolve, keeps their word',
  },
  {
    key: 'thumb:high',
    rule: { feature: 'finger_spacing', attribute: 'gap', value: 'wide thumb-index' },
    title: 'Thumb · wide open',
    text: 'Your thumb opens wide from the index finger. Cheiro read a wide gap here as independence of spirit and courage, a person who likes to choose their own road.',
    short: 'Independent spirit, chooses their own road',
  },

  // ── Heart line (Hridaya Rekha) ────────────────────────────────────────
  {
    key: 'heart:jupiter',
    rule: { feature: 'heart', attribute: 'end', value: 'ends at the centre of Jupiter' },
    title: 'Heart line · rises to Guru',
    text: 'Your Hridaya Rekha curves up under the index finger, toward Guru Parvat. Cheiro counted this among the finest endings: loyal and warm in affection, with high ideals for the people you care for.',
    short: 'Loyal, warm-hearted, high ideals in affection',
  },
  {
    key: 'heart:between',
    rule: { feature: 'heart', attribute: 'end', value: 'ends between Jupiter and Saturn' },
    title: 'Heart line · ends between',
    text: 'Your Hridaya Rekha ends between the index and middle fingers. Palmists take this as calm and giving in affection, with a balanced, generous way of caring.',
    short: 'Calm, giving, balanced in affection',
  },
  {
    key: 'heart:saturn',
    rule: { feature: 'heart', attribute: 'end', value: 'ends on/under Saturn' },
    title: 'Heart line · ends at Shani',
    text: 'Your Hridaya Rekha ends under the middle finger, near Shani Parvat. Old books read it as practical and self-contained in affection: you show care through deeds more than words.',
    short: 'Shows care through deeds, not speeches',
  },

  // ── Head line (Mastishk Rekha) ────────────────────────────────────────
  {
    key: 'head:straight',
    rule: { feature: 'head', attribute: 'slope', value: 'straight across' },
    title: 'Head line · straight',
    text: 'Your Mastishk Rekha runs straight across the palm. Cheiro read this as a clear, practical mind that likes facts, order and a sensible plan.',
    short: 'Clear, practical, orderly thinker',
  },
  {
    key: 'head:sloping',
    rule: { feature: 'head', attribute: 'slope', value: 'sloping toward the Moon mount' },
    title: 'Head line · sloping',
    text: 'Your Mastishk Rekha slopes gently down toward Chandra Parvat, the mount of the moon. That is the mark of an imaginative mind, at home with stories, art and intuition.',
    short: 'Imaginative, creative, intuitive mind',
  },
  {
    key: 'head:short',
    rule: { feature: 'head', attribute: 'length', value: 'short' },
    title: 'Head line · short',
    text: 'Your Mastishk Rekha is short and to the point. Modern Indian teachers read this as a mind that decides quickly and directly, without too much circling around.',
    short: 'Direct, quick to decide',
  },
  {
    key: 'head:forked',
    rule: { feature: 'head', attribute: 'slope', value: 'fork: one branch straight, one sloping' },
    title: 'Head line · forked',
    text: 'Your Mastishk Rekha splits in two, one branch straight and one sloping. Teachers call this the writer\'s fork: a mind that holds both the practical and the imaginative.',
    short: 'Both practical and imaginative',
  },

  // ── Where head and life lines begin ────────────────────────────────────
  {
    key: 'join:joined',
    rule: { feature: 'head', attribute: 'start', value: 'joined to the life line' },
    title: 'Head & life · joined',
    text: 'Your head and life lines begin together. Cheiro read this as a careful, thoughtful temperament, one that likes to look before it leaps.',
    short: 'Careful, thoughtful, looks before leaping',
  },
  {
    key: 'join:separate',
    rule: { feature: 'head', attribute: 'start', value: 'separate from the life line (open)' },
    title: 'Head & life · apart',
    text: 'Your head and life lines start with a little gap between them. Cheiro read this as independence and quick action, a person who trusts their own judgement early on.',
    short: 'Independent, quick to act',
  },

  // ── Life line (Jeevan Rekha): vitality and chapters only ──────────────
  {
    key: 'life:wide',
    rule: { feature: 'life', attribute: 'curvature', value: 'wide semicircle into the palm (broad Venus mount)' },
    title: 'Life line · wide curve',
    text: 'Your Jeevan Rekha sweeps in a wide curve around Shukra Parvat. The tradition reads this as warmth and plenty of energy, someone who enjoys people and throws themselves into things.',
    short: 'Warm, energetic, enjoys people',
  },
  {
    key: 'life:hugging',
    rule: { feature: 'life', attribute: 'curvature', value: 'hugging the thumb (narrow Venus mount)' },
    title: 'Life line · close curve',
    text: 'Your Jeevan Rekha curves close to the thumb. Teachers take this as a reserved, gentle energy: someone who recharges in quiet and chooses where to spend their spark.',
    short: 'Gentle energy, recharges in quiet',
  },
  {
    key: 'life:forked',
    rule: { feature: 'life', attribute: 'end', value: 'fork toward the Moon mount' },
    title: 'Life line · forked end',
    text: 'Your Jeevan Rekha splits near the wrist, one branch reaching toward Chandra Parvat. Old books link this to a love of travel, new places and change of scene.',
    short: 'Loves travel, new places and change',
  },
  {
    key: 'life:break',
    rule: { feature: 'life', attribute: 'continuity', value: 'break or island' },
    title: 'Life line · a turning',
    text: 'Your Jeevan Rekha shows a gap or a small loop. The tradition treats a break as a symbol of change and fresh starts, never as something to fear.',
    short: 'Turning points, fresh chapters',
  },

  // ── Bhagya Rekha (line of direction) ──────────────────────────────────
  {
    key: 'fate:none',
    rule: { feature: 'fate', attribute: 'presence', value: 'absent' },
    title: 'Bhagya Rekha · open',
    text: 'No clear Bhagya Rekha rises up your palm. Cheiro noted that many capable people have none: the tradition reads it as a self-directed path, drawn as you go rather than set in advance.',
    short: 'Self-directed, draws their own map',
  },
  {
    key: 'fate:wrist',
    rule: { feature: 'fate', attribute: 'start', value: 'straight from the wrist' },
    title: 'Bhagya Rekha · from wrist',
    text: 'Your Bhagya Rekha rises straight from the wrist. The tradition links this to a strong sense of direction, a mind that knows what draws it.',
    short: 'Found their direction early',
  },
  {
    key: 'fate:moon',
    rule: { feature: 'fate', attribute: 'start', value: 'from the Moon mount' },
    title: 'Bhagya Rekha · from Moon',
    text: 'Your Bhagya Rekha begins on Chandra Parvat, the moon side of the palm. Cheiro linked this to a sociable, varied temperament that draws on the people around it.',
    short: 'A varied path, helped by many hands',
  },
  {
    key: 'fate:midpalm',
    rule: { feature: 'fate', attribute: 'start', value: 'from mid-palm' },
    title: 'Bhagya Rekha · mid-palm',
    text: 'Your Bhagya Rekha begins in the middle of the palm. Here the tradition sees a direction that grows clearer with experience: a late bloomer, as gardeners say, often the sweetest.',
    short: 'Finds their direction with experience',
  },
];

export const MOUNTS: MountText[] = [
  {
    id: 'jupiter',
    planet: 'Jupiter',
    name_hi: 'गुरु पर्वत',
    name_roman: 'Guru Parvat',
    sigil: 'गु',
    text: 'Guru Parvat, the mount of Jupiter, below the index finger. The tradition links it to ambition, teaching and leadership. Cheiro said it shines brightest when paired with a clear head line.',
    short: 'Ambition and leadership',
    rule: { feature: 'jupiter', attribute: 'development', value: 'well developed' },
  },
  {
    id: 'saturn',
    planet: 'Saturn',
    name_hi: 'शनि पर्वत',
    name_roman: 'Shani Parvat',
    sigil: 'श',
    text: 'Shani Parvat, the mount of Saturn, below the middle finger. The tradition gives it focus, patience and a love of serious study: the quiet scholar\'s corner of the hand.',
    short: 'Focus, patience and study',
    rule: { feature: 'saturn', attribute: 'development', value: 'well developed' },
  },
  {
    id: 'sun_apollo',
    planet: 'Sun',
    name_hi: 'सूर्य पर्वत',
    name_roman: 'Surya Parvat',
    sigil: 'सू',
    text: 'Surya Parvat, the mount of the Sun, below the ring finger. Old books tie it to creativity, charm and a love of beauty. Cheiro called it a good mount in every hand.',
    short: 'Creativity, charm and a love of beauty',
    rule: { feature: 'sun_apollo', attribute: 'development', value: 'well developed' },
  },
  {
    id: 'mercury',
    planet: 'Mercury',
    name_hi: 'बुध पर्वत',
    name_roman: 'Budh Parvat',
    sigil: 'बु',
    text: 'Budh Parvat, the mount of Mercury, below the little finger. Its gifts are quick wit, good conversation and a nose for business. Budh is the messenger, after all.',
    short: 'Wit, speech and business sense',
    rule: { feature: 'mercury', attribute: 'development', value: 'well developed with a good head line' },
  },
  {
    id: 'mars_upper',
    planet: 'Mars',
    name_hi: 'मंगल पर्वत (ऊपरी)',
    name_roman: 'Mangal Parvat (upper)',
    sigil: 'मं',
    text: 'Mangal Parvat, the mount of Mars, on the outer edge below Budh. Many teachers split Mangal into an upper and a lower mount. This upper one is read as composure: standing calm and steady under pressure.',
    short: 'Composure and steady courage',
    rule: { feature: 'mars_upper', attribute: 'development', value: 'large' },
  },
  {
    id: 'luna_moon',
    planet: 'Moon',
    name_hi: 'चंद्र पर्वत',
    name_roman: 'Chandra Parvat',
    sigil: 'चं',
    text: 'Chandra Parvat, the mount of the Moon, at the lower outer edge of the palm. Here live imagination, poetry and inventiveness: the dreamer\'s country.',
    short: 'Imagination and inventiveness',
    rule: { feature: 'luna_moon', attribute: 'development', value: 'well developed' },
  },
  {
    id: 'venus',
    planet: 'Venus',
    name_hi: 'शुक्र पर्वत',
    name_roman: 'Shukra Parvat',
    sigil: 'शु',
    text: 'Shukra Parvat, the mount of Venus, the soft pad at the base of the thumb. Old books fill it with warmth, friendship and a love of music, art and beautiful things.',
    short: 'Warmth, friendship and love of beauty',
    rule: { feature: 'venus', attribute: 'development', value: 'well formed, not too large' },
  },
];

export const ELEMENTS: ElementText[] = [
  {
    id: 'prithvi',
    name_en: 'Earth',
    name_hi: 'पृथ्वी हस्त',
    name_roman: 'Prithvi Hast',
    rule: { feature: 'shape_elements', attribute: 'palm_shape_x_finger_length', value: 'square palm + short fingers = EARTH (Prithvi)' },
  },
  {
    id: 'vayu',
    name_en: 'Air',
    name_hi: 'वायु हस्त',
    name_roman: 'Vayu Hast',
    rule: { feature: 'shape_elements', attribute: 'palm_shape_x_finger_length', value: 'square palm + long fingers = AIR (Vayu)' },
  },
  {
    id: 'agni',
    name_en: 'Fire',
    name_hi: 'अग्नि हस्त',
    name_roman: 'Agni Hast',
    rule: { feature: 'shape_elements', attribute: 'palm_shape_x_finger_length', value: 'rectangular palm + short fingers = FIRE (Agni)' },
  },
  {
    id: 'jal',
    name_en: 'Water',
    name_hi: 'जल हस्त',
    name_roman: 'Jal Hast',
    rule: { feature: 'shape_elements', attribute: 'palm_shape_x_finger_length', value: 'rectangular palm + long fingers = WATER (Jal)' },
  },
];

/** What the user SEES on their own palm, per candidate shape. ≤ 26 chars. */
export const LINE_OPTIONS: LineOptionText[] = [
  { line: 'heart', value: 'jupiter', label: 'Curves up to index finger' },
  { line: 'heart', value: 'between', label: 'Ends by index-middle gap' },
  { line: 'heart', value: 'saturn', label: 'Ends under middle finger' },

  { line: 'head', value: 'straight', label: 'Runs straight across' },
  { line: 'head', value: 'sloping', label: 'Slopes down toward wrist' },
  { line: 'head', value: 'short', label: 'Short, stops mid-palm' },
  { line: 'head', value: 'forked', label: 'Splits in two at the end' },

  { line: 'join', value: 'joined', label: 'Starts joined to life line' },
  { line: 'join', value: 'separate', label: 'Small gap at the start' },

  { line: 'life', value: 'wide', label: 'Wide curve into the palm' },
  { line: 'life', value: 'hugging', label: 'Hugs close to the thumb' },
  { line: 'life', value: 'forked', label: 'Splits in two near wrist' },
  { line: 'life', value: 'break', label: 'Has a gap or small loop' },

  { line: 'fate', value: 'none', label: 'No clear centre line' },
  { line: 'fate', value: 'wrist', label: 'Rises straight from wrist' },
  { line: 'fate', value: 'moon', label: 'Starts at outer palm edge' },
  { line: 'fate', value: 'midpalm', label: 'Starts in the mid-palm' },
];
