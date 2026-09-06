/**
 * Recipe import from a web page.
 *
 * No AI involved. Nearly every real recipe site publishes schema.org/Recipe as
 * JSON-LD for Google, so that is the primary source and it is exact — the same
 * data the site shows, not a guess. Microdata and OpenGraph are fallbacks.
 *
 * `parseRecipeHtml` is pure so it can be tested against saved pages;
 * `importFromUrl` is the thin fetching wrapper around it.
 */

export type ParsedNutrition = {
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber: number | null;
  sugar: number | null;
  sodium: number | null;
};

export type ParsedRecipe = {
  name: string;
  imageUrl: string | null;
  ingredients: string[];
  steps: string[];
  servings: number | null;
  prepMin: number | null;
  cookMin: number | null;
  tags: string[];
  description: string | null;
  nutrition: ParsedNutrition | null;
  sourceUrl: string;
  /** Which extraction path produced this — surfaced so the user knows how much to trust it. */
  via: 'json-ld' | 'microdata' | 'opengraph';
};

/* ── small helpers ─────────────────────────────────────────── */

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: '\u0027', nbsp: ' ',
  frac12: '½', frac14: '¼', frac34: '¾', frac13: '⅓', frac23: '⅔',
  deg: '°', hellip: '…', mdash: '—', ndash: '–',
  rsquo: '\u2019', lsquo: '\u2018', rdquo: '\u201D', ldquo: '\u201C',
};

/** Decode the handful of entities that actually show up in recipe text. */
export function decodeEntities(s: string): string {
  if (!s) return '';
  return s.replace(/&(#\d+|#x[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, code: string) => {
    if (code[0] === '#') {
      const n = code[1] === 'x' || code[1] === 'X'
        ? parseInt(code.slice(2), 16)
        : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return NAMED_ENTITIES[code] ?? m;
  });
}

/** Strip tags, collapse whitespace, decode entities. */
export function clean(s: unknown): string {
  if (typeof s !== 'string') return '';
  return decodeEntities(s.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

/** "PT1H30M" → 90. Also tolerates bare "30" and "1:30". */
export function isoDurationToMinutes(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.round(v);
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (!s) return null;

  const iso = s.match(/^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i);
  if (iso) {
    const total =
      (parseFloat(iso[1] ?? '0') || 0) * 1440 +
      (parseFloat(iso[2] ?? '0') || 0) * 60 +
      (parseFloat(iso[3] ?? '0') || 0) +
      (parseFloat(iso[4] ?? '0') || 0) / 60;
    return total > 0 ? Math.round(total) : null;
  }

  const hm = s.match(/^(\d+):(\d{2})$/);
  if (hm) return parseInt(hm[1], 10) * 60 + parseInt(hm[2], 10);

  const bare = s.match(/^(\d+(?:\.\d+)?)$/);
  if (bare) return Math.round(parseFloat(bare[1]));

  return null;
}

/** "4 servings" | ["6"] | 4 | "Serves 4-6" → a number. */
export function parseYield(v: unknown): number | null {
  if (Array.isArray(v)) {
    for (const item of v) {
      const n = parseYield(item);
      if (n) return n;
    }
    return null;
  }
  if (typeof v === 'number' && Number.isFinite(v)) return Math.round(v);
  if (typeof v !== 'string') return null;
  const m = clean(v).match(/\d+/);
  if (!m) return null;
  const n = parseInt(m[0], 10);
  return n > 0 && n < 200 ? n : null;
}

/** Nutrition values arrive as "512 calories" / "31 g" / 512. */
function parseNutrientNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.round(v);
  if (typeof v !== 'string') return null;
  const m = v.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = parseFloat(m[0]);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function firstString(v: unknown): string | null {
  if (typeof v === 'string') return v.trim() || null;
  if (Array.isArray(v)) {
    for (const item of v) {
      const s = firstString(item);
      if (s) return s;
    }
    return null;
  }
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return firstString(o.url) ?? firstString(o.contentUrl) ?? firstString(o.name);
  }
  return null;
}

function typeOf(node: unknown): string[] {
  if (!node || typeof node !== 'object') return [];
  const t = (node as Record<string, unknown>)['@type'];
  if (typeof t === 'string') return [t];
  if (Array.isArray(t)) return t.filter((x): x is string => typeof x === 'string');
  return [];
}

function isRecipeNode(node: unknown): boolean {
  return typeOf(node).some((t) => t.toLowerCase() === 'recipe');
}

/* ── instructions ──────────────────────────────────────────── */

/**
 * recipeInstructions is the messiest field in the wild: a single string with
 * newlines, an array of strings, an array of HowToStep objects, or
 * HowToSections that each nest their own list of steps.
 */
export function extractSteps(v: unknown, depth = 0): string[] {
  if (depth > 4 || v == null) return [];

  if (typeof v === 'string') {
    const text = clean(v);
    if (!text) return [];
    const byLine = v.split(/\r?\n+/).map(clean).filter(Boolean);
    if (byLine.length > 1) return byLine;
    // One long line: split on "1. " / "2) " markers if present.
    const byNumber = text.split(/(?:^|\s)\d{1,2}[.)]\s+/).map((s) => s.trim()).filter(Boolean);
    return byNumber.length > 1 ? byNumber : [text];
  }

  if (Array.isArray(v)) return v.flatMap((item) => extractSteps(item, depth + 1));

  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    const types = typeOf(o).map((t) => t.toLowerCase());
    // A section wraps more steps; recurse rather than reading its heading.
    if (types.includes('howtosection') || o.itemListElement) {
      return extractSteps(o.itemListElement ?? o.steps, depth + 1);
    }
    const text = clean(o.text ?? o.name ?? '');
    return text ? [text] : [];
  }

  return [];
}

export function extractIngredients(v: unknown): string[] {
  if (v == null) return [];
  if (typeof v === 'string') return v.split(/\r?\n+/).map(clean).filter(Boolean);
  if (Array.isArray(v)) {
    return v
      .flatMap((item) => {
        if (typeof item === 'string') return [clean(item)];
        if (item && typeof item === 'object') {
          const o = item as Record<string, unknown>;
          return [clean(o.text ?? o.name ?? '')];
        }
        return [];
      })
      .filter(Boolean);
  }
  return [];
}

function extractNutrition(v: unknown): ParsedNutrition | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const n: ParsedNutrition = {
    calories: parseNutrientNumber(o.calories),
    protein: parseNutrientNumber(o.proteinContent),
    carbs: parseNutrientNumber(o.carbohydrateContent),
    fat: parseNutrientNumber(o.fatContent),
    fiber: parseNutrientNumber(o.fiberContent),
    sugar: parseNutrientNumber(o.sugarContent),
    sodium: parseNutrientNumber(o.sodiumContent),
  };
  return Object.values(n).some((x) => x != null) ? n : null;
}

function extractTags(node: Record<string, unknown>): string[] {
  const raw: string[] = [];
  const push = (v: unknown) => {
    if (typeof v === 'string') raw.push(...v.split(','));
    else if (Array.isArray(v)) v.forEach((x) => typeof x === 'string' && raw.push(x));
  };
  push(node.recipeCategory);
  push(node.recipeCuisine);
  push(node.keywords);
  push(node.suitableForDiet);

  const out: string[] = [];
  for (const t of raw) {
    // suitableForDiet arrives as a schema.org URL, e.g. .../VeganDiet
    const label = clean(t.replace(/^https?:\/\/schema\.org\//i, '').replace(/Diet$/i, ''));
    if (!label || label.length > 30) continue;
    const nice = label[0].toUpperCase() + label.slice(1);
    if (!out.some((x) => x.toLowerCase() === nice.toLowerCase())) out.push(nice);
  }
  return out.slice(0, 12);
}

/* ── JSON-LD ───────────────────────────────────────────────── */

/** Walk an arbitrary JSON-LD payload looking for the first Recipe node. */
export function findRecipeNode(root: unknown, depth = 0): Record<string, unknown> | null {
  if (!root || depth > 6) return null;

  if (Array.isArray(root)) {
    for (const item of root) {
      const found = findRecipeNode(item, depth + 1);
      if (found) return found;
    }
    return null;
  }

  if (typeof root !== 'object') return null;
  const o = root as Record<string, unknown>;
  if (isRecipeNode(o)) return o;

  // @graph is the common wrapper; otherwise walk nested values.
  for (const key of ['@graph', 'mainEntity', 'mainEntityOfPage', 'itemListElement']) {
    const found = findRecipeNode(o[key], depth + 1);
    if (found) return found;
  }
  for (const value of Object.values(o)) {
    if (value && typeof value === 'object') {
      const found = findRecipeNode(value, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

function scriptBlocks(html: string): string[] {
  const out: string[] = [];
  // Quotes are optional around attribute values: minified WordPress pages emit
  // `type=application/ld+json` unquoted. Yoast does this, and it runs on a large
  // share of food blogs, so requiring quotes silently loses many sites.
  const re = /<script[^>]*\btype\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) out.push(m[1]);
  return out;
}

function fromJsonLd(html: string): Record<string, unknown> | null {
  for (const block of scriptBlocks(html)) {
    // Some sites emit CDATA wrappers or trailing commas; try progressively harder.
    const candidates = [
      block,
      block.replace(/^\s*<!\[CDATA\[/, '').replace(/\]\]>\s*$/, ''),
      block.replace(/,\s*([}\]])/g, '$1'),
    ];
    for (const text of candidates) {
      try {
        const node = findRecipeNode(JSON.parse(text));
        if (node) return node;
      } catch {
        /* try the next shape */
      }
    }
  }
  return null;
}

/* ── microdata / opengraph fallbacks ───────────────────────── */

function metaContent(html: string, prop: string): string | null {
  // Quotes optional here too, for the same minified-HTML reason.
  const re = new RegExp('<meta[^>]+(?:property|name)\\s*=\\s*["\']?' + prop + '["\']?[^>]*>', 'i');
  const tag = html.match(re)?.[0];
  if (!tag) return null;
  const content = tag.match(/content\s*=\s*["']([\s\S]*?)["']/i)?.[1];
  return content ? clean(content) : null;
}

/** Collect the text of every element carrying a given itemprop. */
function itemPropValues(html: string, prop: string): string[] {
  const re = new RegExp(
    '<([a-z0-9]+)[^>]*itemprop\\s*=\\s*["\'][^"\']*\\b' + prop + '\\b[^"\']*["\'][^>]*>([\\s\\S]*?)</\\1>',
    'gi'
  );
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const text = clean(m[2]);
    if (text) out.push(text);
  }
  return out;
}

/* ── entry points ──────────────────────────────────────────── */

export function parseRecipeHtml(html: string, sourceUrl: string): ParsedRecipe | null {
  const node = fromJsonLd(html);

  if (node) {
    const name = clean(firstString(node.name) ?? '');
    const ingredients = extractIngredients(node.recipeIngredient ?? node.ingredients);
    const steps = extractSteps(node.recipeInstructions);

    if (name && (ingredients.length || steps.length)) {
      const prep = isoDurationToMinutes(node.prepTime);
      const cook = isoDurationToMinutes(node.cookTime);
      const total = isoDurationToMinutes(node.totalTime);
      return {
        name,
        imageUrl: firstString(node.image),
        ingredients,
        steps,
        servings: parseYield(node.recipeYield ?? node.yield),
        prepMin: prep,
        // Many sites publish only totalTime. Treating the remainder as cook
        // time keeps the total honest instead of silently dropping it.
        cookMin: cook ?? (total != null && prep != null ? Math.max(0, total - prep) : total),
        tags: extractTags(node),
        description: clean(firstString(node.description) ?? '') || null,
        nutrition: extractNutrition(node.nutrition),
        sourceUrl,
        via: 'json-ld',
      };
    }
  }

  // Microdata: older sites, and a few large ones, still use it.
  const mdName = itemPropValues(html, 'name')[0] ?? null;
  const mdIngredients = [
    ...itemPropValues(html, 'recipeIngredient'),
    ...itemPropValues(html, 'ingredients'),
  ];
  const mdSteps = itemPropValues(html, 'recipeInstructions');
  if (mdName && (mdIngredients.length || mdSteps.length)) {
    return {
      name: mdName,
      imageUrl: metaContent(html, 'og:image'),
      ingredients: mdIngredients,
      steps: mdSteps.flatMap((s) => extractSteps(s)),
      servings: parseYield(itemPropValues(html, 'recipeYield')[0]),
      prepMin: isoDurationToMinutes(itemPropValues(html, 'prepTime')[0]),
      cookMin: isoDurationToMinutes(itemPropValues(html, 'cookTime')[0]),
      tags: [],
      description: metaContent(html, 'og:description'),
      nutrition: null,
      sourceUrl,
      via: 'microdata',
    };
  }

  // Last resort: enough to start a manual entry rather than nothing at all.
  const ogTitle =
    metaContent(html, 'og:title') ??
    clean(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '');
  if (ogTitle) {
    return {
      name: ogTitle,
      imageUrl: metaContent(html, 'og:image'),
      ingredients: [],
      steps: [],
      servings: null,
      prepMin: null,
      cookMin: null,
      tags: [],
      description: metaContent(html, 'og:description'),
      nutrition: null,
      sourceUrl,
      via: 'opengraph',
    };
  }

  return null;
}

export function normaliseUrl(input: string): string {
  const s = input.trim();
  if (!s) throw new Error('Paste a link first.');
  const withScheme = /^https?:\/\//i.test(s) ? s : 'https://' + s;
  let u: URL;
  try {
    u = new URL(withScheme);
  } catch {
    throw new Error('That does not look like a web address.');
  }
  if (!u.hostname.includes('.')) throw new Error('That does not look like a web address.');
  return u.toString();
}

/**
 * Fetch a page and parse it.
 *
 * Native has no CORS restriction so this is a direct request. On web the
 * browser blocks cross-site reads, which is why import is a phone feature for
 * now (see CLAUDE.md).
 */
export async function importFromUrl(rawUrl: string, timeoutMs = 20000): Promise<ParsedRecipe> {
  const url = normaliseUrl(rawUrl);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let html: string;
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        // Several recipe sites serve a stripped page to unrecognised clients.
        'User-Agent':
          'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    if (!res.ok) {
      throw new Error(
        res.status === 403 || res.status === 401
          ? 'That site refused the request. Try the photo import instead.'
          : 'The site returned ' + res.status + '.'
      );
    }
    html = await res.text();
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') throw new Error('The site took too long to respond.');
    if (e instanceof Error && /Network request failed/i.test(e.message)) {
      throw new Error('Could not reach that site. Check your connection.');
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }

  const parsed = parseRecipeHtml(html, url);
  if (!parsed) throw new Error('No recipe found on that page.');
  return parsed;
}
