import type { ParsedRecipe } from './import';

/**
 * Find recipes that aren't in your library yet, for free.
 *
 * A search API would be the obvious way and is a recurring bill, which the
 * brief rules out. Food blogs publish RSS, and the same blogs publish
 * schema.org Recipe JSON-LD that `lib/import.ts` already reads exactly. So:
 * read the feed for candidate links, then import one the normal way. No key,
 * no quota, no cost, and the sources are a list you choose rather than a
 * ranking someone else decides.
 *
 * The feed parsing is pure and tested; only `fetchFeed` touches the network.
 */

export type Source = {
  id: string;
  name: string;
  feed: string;
  /** On by default? A short default list beats a wall of switches. */
  standard: boolean;
};

/**
 * Sites that publish both a feed and JSON-LD.
 *
 * **Every one of these was checked against the live site, twice**, not
 * assumed from having a feed. Half the obvious candidates failed:
 *
 *   - 403 to anything that is not a browser: Budget Bytes, Cookie and Kate,
 *     Pinch of Yum, Gimme Some Oven, The Mediterranean Dish, Damn Delicious,
 *     Half Baked Harvest, 101 Cookbooks, and all of Dotdash Meredith
 *     (Allrecipes, Serious Eats, Simply Recipes).
 *   - Smitten Kitchen publishes ingredients but no `recipeInstructions`, so
 *     every import comes back with zero steps.
 *
 * Re-run the probe before adding one. A feed that loads proves nothing about
 * whether the article behind it will.
 */
export const SOURCES: Source[] = [
  { id: 'loveandlemons', name: 'Love & Lemons', feed: 'https://www.loveandlemons.com/feed/', standard: true },
  { id: 'recipetineats', name: 'RecipeTin Eats', feed: 'https://www.recipetineats.com/feed/', standard: true },
  { id: 'wellplated', name: 'Well Plated', feed: 'https://www.wellplated.com/feed/', standard: true },
  { id: 'minimalistbaker', name: 'Minimalist Baker', feed: 'https://minimalistbaker.com/feed/', standard: true },
  { id: 'naturallyella', name: 'Naturally Ella', feed: 'https://naturallyella.com/feed/', standard: false },
  { id: 'skinnytaste', name: 'Skinnytaste', feed: 'https://www.skinnytaste.com/feed/', standard: false },
];

export type FeedItem = { title: string; link: string };

/* ── parsing ────────────────────────────────────────────────── */

function unwrap(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&#8217;|&rsquo;/g, '’')
    .replace(/&#8216;|&lsquo;/g, '‘')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Pull the entries out of an RSS or Atom feed.
 *
 * Regex rather than an XML parser: React Native ships no DOMParser, and a
 * dependency for two tag names is not worth the bundle. Both shapes are
 * handled because Atom puts the link in an attribute, not in the text.
 */
export function parseFeed(xml: string): FeedItem[] {
  const items: FeedItem[] = [];

  // RSS 2.0
  for (const block of xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? []) {
    const title = block.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
    const link =
      block.match(/<link[^>]*>([\s\S]*?)<\/link>/i)?.[1] ??
      block.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i)?.[1];
    if (title && link) items.push({ title: unwrap(title), link: unwrap(link) });
  }

  // Atom
  for (const block of xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) ?? []) {
    const title = block.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
    // Prefer rel="alternate"; a feed also carries rel="edit" and rel="replies".
    const link =
      block.match(/<link[^>]*rel=["']?alternate["']?[^>]*href=["']([^"']+)["']/i)?.[1] ??
      block.match(/<link[^>]*href=["']([^"']+)["']/i)?.[1];
    if (title && link) items.push({ title: unwrap(title), link: unwrap(link) });
  }

  return items.filter((i) => /^https?:\/\//i.test(i.link));
}

/* ── choosing what to try ───────────────────────────────────── */

/** Two URLs are the same recipe if they differ only by tracking or a slash. */
/**
 * The link as it should actually be fetched.
 *
 * Feeds carry campaign parameters, and at least one leaves the merge tag
 * unresolved — Cookie and Kate ships `?adt_ei=*|EMAIL|*`, which is not a valid
 * URL to request. Nothing after the path is ever needed for a recipe page.
 */
export function cleanLink(url: string): string {
  try {
    const u = new URL(url);
    u.search = '';
    u.hash = '';
    return u.toString();
  } catch {
    return url.replace(/[?#].*$/, '');
  }
}

export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = '';
    u.search = '';
    return (u.origin + u.pathname).replace(/\/+$/, '').toLowerCase();
  } catch {
    return url.replace(/[?#].*$/, '').replace(/\/+$/, '').toLowerCase();
  }
}

/**
 * Candidates worth importing: not already in the library, no duplicates, and
 * interleaved across sources so one prolific blog cannot fill the whole list.
 */
export function pickCandidates(
  perSource: FeedItem[][],
  haveUrls: string[],
  limit: number,
  offset = 0
): FeedItem[] {
  const have = new Set(haveUrls.map(normalizeUrl));
  const seen = new Set<string>();
  const out: FeedItem[] = [];

  const queues = perSource.map((items) => {
    const fresh = items.filter((i) => !have.has(normalizeUrl(i.link)));
    // Rotate so repeated searches do not keep offering the same first post.
    return fresh.length ? fresh.slice(offset % fresh.length).concat(fresh.slice(0, offset % fresh.length)) : [];
  });

  for (let round = 0; out.length < limit; round++) {
    let addedThisRound = false;
    for (const q of queues) {
      if (out.length >= limit) break;
      const item = q[round];
      if (!item) continue;
      const key = normalizeUrl(item.link);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(item);
      addedThisRound = true;
    }
    if (!addedThisRound) break;
  }

  return out;
}

/* ── the network side ───────────────────────────────────────── */

/**
 * Required lazily so the pure half of this module — feed parsing, candidate
 * picking — can be tested in node without dragging the importer in with it.
 */
function importer() {
  return (require('./import') as typeof import('./import')).importFromUrl;
}

async function fetchFeed(url: string, signal?: AbortSignal): Promise<FeedItem[]> {
  const res = await fetch(url, { signal, headers: { Accept: 'application/rss+xml, application/xml, text/xml, */*' } });
  if (!res.ok) throw new Error(`${res.status}`);
  return parseFeed(await res.text());
}

export type Found = { recipe: ParsedRecipe; url: string; source: string };

export type DiscoverReport = {
  found: Found[];
  /** Sites that could not be read at all, so the screen can say which. */
  failedSources: string[];
  /** Candidates whose page would not parse. Normal, not an error. */
  skipped: number;
};

/**
 * Read the chosen feeds, then import candidates until `count` succeed.
 *
 * Failures are expected and not fatal — a blog can be down, a post can be a
 * round-up with no recipe markup on it. It moves to the next candidate rather
 * than surfacing an error, and only says something if nothing worked at all.
 */
export async function discover(
  sourceIds: string[],
  count: number,
  haveUrls: string[],
  opts: { offset?: number; signal?: AbortSignal; onProgress?: (done: number, total: number) => void } = {}
): Promise<DiscoverReport> {
  const chosen = SOURCES.filter((s) => sourceIds.includes(s.id));
  if (!chosen.length) return { found: [], failedSources: [], skipped: 0 };

  const failedSources: string[] = [];
  const perSource: FeedItem[][] = [];

  await Promise.all(
    chosen.map(async (s, i) => {
      try {
        perSource[i] = await fetchFeed(s.feed, opts.signal);
      } catch {
        perSource[i] = [];
        failedSources.push(s.name);
      }
    })
  );

  // Try more than asked for: some candidates will not parse.
  const candidates = pickCandidates(perSource, haveUrls, count * 4, opts.offset ?? 0);

  const found: Found[] = [];
  let skipped = 0;
  for (const cand of candidates) {
    if (found.length >= count) break;
    opts.onProgress?.(found.length, count);
    try {
      const recipe = await importer()(cleanLink(cand.link));
      if (!recipe.ingredients.length || !recipe.steps.length) {
        skipped++;
        continue;
      }
      const host = hostOf(cand.link);
      found.push({ recipe, url: cleanLink(cand.link), source: host });
    } catch {
      skipped++;
    }
  }

  return { found, failedSources, skipped };
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
