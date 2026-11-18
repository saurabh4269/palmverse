/**
 * What Panditji says inside each line's world. The middle of every world is
 * the reading item for the user's own line shape (content/readings.ts, via
 * the rule engine and its safety filter); these lines only frame it.
 * Same rules as the rest of the script: "the tradition reads…", no forecast,
 * nothing about health, death, children or fortune (tests/worlds.test.ts runs
 * every line through isSafeText).
 */
import type { WorldId } from '../render/worlds.js';

export const WORLD_NARRATION: Record<WorldId, { intro: string; outro: string }> = {
  heart: {
    intro: 'This is the world of your Hridaya Rekha, the heart line. In the old books it is a line of feeling, and of how a person gives warmth.',
    outro: 'The lotus grows from still water and opens toward the light. The tradition likes that picture for the heart. Close your hand when you are ready, and the world returns to your palm.',
  },
  life: {
    intro: 'This is the world of your Jeevan Rekha. The tradition reads it as a line of energy and of roots, the way you hold yourself in the world, not as any measure of time.',
    outro: 'The banyan sends down new roots from its branches and keeps growing wider. The old readers liked that picture for this line. Close your hand, and the world returns to your palm.',
  },
  head: {
    intro: 'This is the world of your Mastishk Rekha, the head line. The tradition reads it as the way a mind likes to travel, the way stars are joined into a picture.',
    outro: 'Every constellation is a story someone chose to draw between the stars. Close your hand, and the sky returns to your palm.',
  },
  graha: {
    intro: 'Each mount carries the name of a graha, a planet of the old Indian sky. Here is the one that gives this mount its name.',
    outro: 'The tradition counts nine grahas and gives each a gem and a colour, as you see here. Close your hand, and the sky returns to your palm.',
  },
  fate: {
    intro: 'This is the world of your Bhagya Rekha. Its planet is Shani, the slow and patient one, whom the tradition sees as a teacher of steady effort.',
    outro: 'A path of light is something you walk, step by step. That is how the old books speak of this line. Close your hand, and the world returns to your palm.',
  },
};
