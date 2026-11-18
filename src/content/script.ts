/**
 * Panditji's script. A warm, respectful elderly scholar: plain English with
 * Hindi terms, a little gentle humour, never mystical-threatening. Every
 * line frames the reading as culture and story, not forecast or advice.
 * Lines stay short; the subtitle renderer paginates (~32 chars × 2 lines).
 */
import type { PanditScript } from './types.js';

export const PANDIT: PanditScript = {
  greeting: [
    'Namaste! Come, sit. I am Panditji, and I have spent a long, happy time with old books about hands.',
    'In India this art is called हस्त रेखा, Hast Rekha, a branch of Samudrika Shastra, the old study of the body\'s marks.',
    'Today we read your palm as culture and story, not as a forecast. Think of it as a conversation with tradition.',
  ],
  disclaimer: 'A cultural entertainment. Not a forecast. Not advice.',
  privacy: 'I see only the positions of your hand joints. No camera images, and nothing leaves this headset.',
  todaysMount: 'Today the tradition would light your {mount}.',
  raisePalm: 'Hold up either hand, palm toward you, a little below eye level. Many readers begin with the hand you write with.',
  raiseRetry: 'Take your time. Raise your writing hand, palm facing you, fingers gently open.',
  scanning: 'Hold still a moment, please. Let me study the shape of your hand.',
  linesAppear: 'There. Here are the great rekhas as the tradition draws them: Jeevan, Mastishk, Hridaya and Bhagya.',
  elementIntro: 'By its shape, yours is what the tradition calls an {element_en} hand, {element_hi}.',
  mountsIntro: 'Now the parvat, the little hills of the palm. Each one carries the name of a planet: Guru, Shani, Surya and the rest.',
  mountsPoke: 'Touch a mount with a fingertip of your other hand, and I will tell you what the old books say of it.',
  mountsDone: 'Very good. You have met all seven. Some teachers count more, some fewer. Teachers differ here, as they love to.',
  linesIntro: 'Now you show me. Look at your own palm and pick the shape closest to yours. No wrong answers here.',
  linePrompt: {
    heart: 'The Hridaya Rekha runs across the top of the palm, under the fingers. Where does yours end?',
    head: 'The Mastishk Rekha crosses the middle of the palm. Is yours straight, sloping, short, or split in two?',
    join: 'Look at the thumb side, where the head and life lines begin. Do they start together, or with a little gap?',
    life: 'The Jeevan Rekha curves around the base of your thumb. Which shape is closest to yours?',
    fate: 'Now the Bhagya Rekha, rising up the middle toward the middle finger. Can you see one? Many people cannot.',
  },
  readingIntro: 'Let me put it all together, the way my teachers did, as tendencies the tradition sees in a hand like yours.',
  readingOutro: 'A confession: every reading fits almost everyone a little. Scholars call it the Barnum effect. So enjoy it as story and culture.',
  otherHand: 'Shall we read your other hand? Old books say the left shows what you were given, the right what you built from it.',
  compare: 'Your two hands differ here: {diff}. The tradition reads such differences as the journey from the given to the chosen.',
  farewell: 'Thank you for sitting with an old scholar. Whatever your lines say, the hand that writes the story is yours. Namaste!',
  trackingLost: 'I cannot see your hand just now. Please hold it up again, palm toward you.',
  explore: 'Now your lines are written in light. Touch one with a fingertip of your other hand, or pinch near it, and it will open.',
  exploreMore: 'Touch another line if you like. When you are ready, press Continue and I will put it all together.',
};
