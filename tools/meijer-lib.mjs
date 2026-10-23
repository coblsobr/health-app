/**
 * The pure half of the Meijer cart filler: read the list the app shares, and
 * choose which search result to add. Tested in meijer.test.mts.
 */

/**
 * The app's "Send to Meijer" text:
 *
 *   MEIJER LIST · 23 items
 *   1 | cherry tomatoes | Tomatoes, red (2 cup)
 *   3 | avocado | Avocados (3)
 *
 * Anything else around it (a chat app's greeting, an email signature) is
 * ignored, so it survives being shared through whatever was handy.
 */
export function parseList(text) {
  const items = [];
  for (const raw of String(text).split(/\r?\n/)) {
    const m = raw.match(/^\s*(\d+)\s*\|\s*([^|]+?)\s*\|\s*(.*?)\s*$/);
    if (!m) continue;
    const qty = Math.max(1, Math.min(6, parseInt(m[1], 10) || 1));
    items.push({ qty, search: m[2].trim(), label: m[3].trim() || m[2].trim() });
  }
  return items;
}

export const hasList = (text) => /MEIJER LIST/.test(String(text)) && parseList(text).length > 0;

/** Words that say how it is cut or sold, not what it is. */
const STOP = new Set([
  'and', 'or', 'of', 'the', 'a', 'oz', 'lb', 'ct', 'count', 'pack', 'each',
  'fresh', 'ground', 'chopped', 'minced', 'sliced', 'diced', 'grated', 'shredded', 'large', 'small',
]);

/** The same food under the shop's name. "Chickpeas" are sold as garbanzo beans. */
const SAME = { chickpea: 'garbanzo', garbanzo: 'garbanzo', scallion: 'green onion', cilantro: 'cilantro', coriander: 'cilantro' };

/** In the results, never what a recipe meant. Baby cornstarch is bath powder. */
const NOT_FOOD = /\b(bath|lotion|shampoo|soap|wipes|diaper|candle|detergent|cleaner|dog|cat|pet|toy|vitamin|supplement)\b/i;
/** A packaged snack is rarely the ingredient. */
const SNACK = /\b(snacks?|chips|crisps|crackers|bars?|cookies?|puffs|kit|seasoning mix)\b/i;

const words = (s) =>
  String(s).toLowerCase().split(/[^a-z]+/)
    .filter((w) => w.length > 1 && !STOP.has(w))
    .map((w) => (w.length > 3 && /(?:oes|ches|shes)$/.test(w) ? w.slice(0, -2) : w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w))
    .flatMap((w) => (SAME[w] ? SAME[w].split(' ') : [w]));

/**
 * Pick the search result to add.
 *
 * Nearly every word searched for must be in the product's name — "yellow
 * onion" should not settle for "Sweet Onion", and "vegan parmesan" must not
 * settle for vegan mozzarella. Then: not sponsored (ads are placed, not
 * matched), earlier in the results, Meijer's own brand, not organic unless
 * asked, and not a snack, a dried spice when "fresh" was asked for, or
 * something that is not food at all. A product remembered from an earlier
 * run wins outright, which is how a wrong pick gets corrected once and stays
 * corrected.
 *
 * Returns null when nothing is close enough: an empty slot in the cart is
 * better than a wrong thing in it.
 */
export function pickProduct(query, results, { remembered = null, storeBrand = true } = {}) {
  const want = [...new Set(words(query))];
  if (!want.length || !results.length) return null;
  const freshWanted = /\bfresh\b/i.test(query);
  const snackWanted = SNACK.test(query);
  let best = null;
  results.forEach((r, i) => {
    if (!r.canAdd && !r.inCart) return;
    if (remembered && r.href === remembered) {
      best = { ...r, score: Infinity };
      return;
    }
    if (NOT_FOOD.test(r.name)) return;
    const have = new Set(words(r.name));
    const hit = want.filter((w) => have.has(w)).length / want.length;
    if (hit < 0.75) return;
    let score = hit * 10;
    if (r.sponsored) score -= 2;
    score -= i * 0.15;
    if (storeBrand && /^meijer\b/i.test(r.name)) score += 0.75;
    if (have.has('organic') && !want.includes('organic')) score -= 0.6;
    if (!snackWanted && SNACK.test(r.name)) score -= 4;
    if (freshWanted && /\b(ground|dried|powder|flakes)\b/i.test(r.name)) score -= 4;
    const extra = [...have].filter((w) => !want.includes(w)).length;
    score -= Math.min(extra, 8) * 0.12;
    if (!best || score > best.score) best = { ...r, score };
  });
  return best;
}
