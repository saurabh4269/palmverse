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
    intro: 'Here your Hridaya Rekha, the heart line, opens into a lotus pond. In the old books it is a line of feeling, and of how a person gives warmth.',
    outro: 'The lotus grows from still water and opens toward the light; the tradition keeps that picture for the heart. Whenever you are ready, close your hand and we step back out.',
  },
  life: {
    intro: 'Your Jeevan Rekha has become a banyan by a river. It speaks of energy and of roots, the way you hold yourself in the world, not of any measure of time.',
    outro: 'A banyan sends new roots down from its branches and keeps growing wider. Old readers loved that picture for this line. Close your fingers when you want to come home.',
  },
  head: {
    intro: 'Look up: your Mastishk Rekha, the head line, is a sky of stars. The tradition reads it as the way a mind likes to travel, joining points of light into a picture.',
    outro: 'Every constellation is a story someone chose to draw between the stars. Make a fist, and the sky folds back into your palm.',
  },
  graha: {
    intro: 'Each mount carries the name of a graha, a planet of the old Indian sky. Here is the one that gives this mount its name.',
    outro: 'The tradition counts nine grahas and gives each a gem and a colour, as you see here. Close your hand to return.',
  },
  fate: {
    intro: 'A road of light: your Bhagya Rekha. Its planet is Shani, the slow and patient one, whom the tradition sees as a teacher of steady effort.',
    outro: 'A path is something you walk, step by step, and that is how the old books speak of this line. Close your hand, and the road rolls back into your palm.',
  },
};
