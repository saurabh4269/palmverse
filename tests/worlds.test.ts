/** World narration stays inside the safety filter, and every touchable line has a world. */
import { WORLD_NARRATION } from '../src/content/worlds.js';
import { PANDIT } from '../src/content/script.js';
import { isSafeText } from '../src/core/rules.js';
import { check, done } from './harness.js';

for (const [id, w] of Object.entries(WORLD_NARRATION)) {
  check(`${id} intro safe`, isSafeText(w.intro), w.intro);
  check(`${id} outro safe`, isSafeText(w.outro), w.outro);
  check(`${id} frames as tradition`, /tradition|old books|old readers/i.test(w.intro + w.outro));
}
check('four line worlds and the graha world', ['heart', 'life', 'head', 'fate', 'graha'].every((k) => k in WORLD_NARRATION));
check('explore lines safe', isSafeText(PANDIT.explore) && isSafeText(PANDIT.exploreMore));
done('worlds');
