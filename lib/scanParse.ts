import type { ScanLine, ScanPage } from './ocr';

/**
 * Turn a photographed cookbook page into a recipe, using where the text sat.
 *
 * The text-only parser guessed the ingredients/method split from wording, and
 * got it wrong on every real page: it read prose as ingredients, kept only the
 * first line of each step, and dropped every ingredient whose name wrapped to
 * a second line. The page itself answers all of that — cookbook pages are laid
 * out in two columns, and a column boundary is unambiguous where a heuristic
 * about word shape is not.
 *
 * Signals used, in order of how much they are trusted:
 *   1. **Columns.** A vertical gap no line crosses splits ingredients from
 *      method. Nothing about the wording is as reliable.
 *   2. **Line starts.** An ingredient begins with a quantity or a head word
 *      ("Pinch of", "Kosher salt"); anything else continues the line above.
 *   3. **Vertical gaps.** A bigger-than-usual gap between lines ends a
 *      paragraph, which is how unnumbered method splits into steps.
 *   4. **Type size.** The biggest text near the top of the page is the title.
 */

export type ScanRecipe = {
  name: string | null;
  ingredients: string[];
  steps: string[];
  servings: number | null;
  notes: string | null;
  warnings: string[];
};

/* ── vocabulary ─────────────────────────────────────────────── */

const UNITS =
  /^(cups?|tbsps?|tablespoons?|tsps?|teaspoons?|grams?|g|kg|kilograms?|ml|millilitres?|milliliters?|l|litres?|liters?|oz|ounces?|lbs?|pounds?|cloves?|pinch(es)?|dash(es)?|cans?|tins?|packets?|packages?|pkg|slices?|sticks?|bunch(es)?|handfuls?|sprigs?|pieces?|sheets?|bulbs?|quarts?|pints?|stalks?|heads?|strips?|blocks?)$/i;

/**
 * A quantity as OCR actually renders one.
 *
 * Scanned fraction glyphs come back as stray letters — ½ reads as "a" or "V½",
 * ¼ as "/4" or "V4", ⅓ as "s", 1 as "l" or "I". Requiring a clean digit here
 * dropped a third of every ingredient list, so a lone letter counts as a
 * quantity when a unit follows it.
 */
const QTY = /^[\d¼½¾⅓⅔⅛⅜⅝⅞/]/;
/** A bare letter standing in for a fraction: "a teaspoon", "Va cup", "A cup". */
const LETTER_QTY = /^[A-Za-z]{1,2}$/;
/** Something numeric buried in the token: "V½", "V4", "1½". */
const HAS_NUMERAL = /[\d¼½¾⅓⅔⅛⅜⅝⅞]/;

/** Words that open an ingredient which has no quantity at all. */
const HEAD_WORD =
  /^(pinch|dash|handful|kosher|sea|salt|freshly|leaves|zest|juice|few|several|some|a few|good|large|small|medium)\b/i;

/** A line ending mid-phrase, so the next line continues it whatever it is. */
const WRAP_TAIL =
  /(?:,|-|\b(?:into|with|and|or|of|for|plus|to|about|such as|cut|torn|roughly|finely|thinly|each)\s*)$/i;

/** Openers that always continue the line above, never start an ingredient. */
const CONTINUES =
  /^(or|and|as|of|to|such as|plus|about|opposite|have|from|very|cleaned|drained|finely|roughly|thinly|cut|mixed|\()|^\(/i;

const STEP_NUMBER = /^\(?(\d{1,2})[.,):]\s+\S/;

/** Page furniture: folios, running heads, and the like. */
const NOISE = /^(?:\d{1,4}|page \d+|chapter \d+|[.·•\-–—_=~|]{2,})$/i;

/* ── helpers ────────────────────────────────────────────────── */

function tidy(s: string): string {
  return s.replace(/^[\s•·▪●\-–—*]+/, '').replace(/\s+/g, ' ').trim();
}

/** Rotated margin text — a spine label, not part of the recipe body. */
function isVertical(l: ScanLine): boolean {
  return l.h > l.w * 1.6;
}

function median(ns: number[]): number {
  if (!ns.length) return 0;
  const s = [...ns].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

/* ── columns ────────────────────────────────────────────────── */

/**
 * Split lines into columns at a vertical gap nothing crosses.
 *
 * Full-width lines — the title, an intro paragraph — cross every gap, so they
 * are set aside first or they would hide the boundary entirely.
 */
export function splitColumns(lines: ScanLine[], pageW: number): {
  full: ScanLine[];
  columns: ScanLine[][];
} {
  const body = lines.filter((l) => !isVertical(l) && !NOISE.test(tidy(l.t)) && tidy(l.t).length > 1);
  if (body.length < 6) return { full: body, columns: [] };

  // Full-width means wide relative to the PAGE. Measuring against the widest
  // line instead classified ordinary method lines as full-width — they are the
  // widest thing on a page whose only real full-width text is the title.
  const full = body.filter((l) => l.w > pageW * 0.6);
  const rest = body.filter((l) => l.w <= pageW * 0.6);
  if (rest.length < 6) return { full: body, columns: [] };

  // Cluster on left edges, not on a gap in horizontal coverage: one line
  // straddling the gutter — a sentence that runs long, a stray caption — closes
  // a coverage gap completely and hides the boundary. Left edges stay in two
  // tight clusters regardless.
  const xs = [...new Set(rest.map((l) => l.x))].sort((a, b) => a - b);

  type Candidate = { mid: number; width: number };
  const candidates: Candidate[] = [];
  for (let i = 1; i < xs.length; i++) {
    const gap = xs[i] - xs[i - 1];
    const mid = (xs[i] + xs[i - 1]) / 2;
    if (mid > pageW * 0.25 && mid < pageW * 0.75) candidates.push({ mid, width: gap });
  }
  candidates.sort((a, b) => b.width - a.width);

  const floor = Math.max(3, Math.round(rest.length * 0.12));
  for (const cand of candidates) {
    if (cand.width < pageW * 0.02) break;
    const left = rest.filter((l) => l.x < cand.mid);
    const right = rest.filter((l) => l.x >= cand.mid);
    // A margin folio sitting far to the right is a bigger gap than the gutter,
    // so a split is only believed when both sides hold a real body of text.
    if (left.length >= floor && right.length >= floor) {
      return { full, columns: [left, right] };
    }
  }

  return { full, columns: [rest] };
}

/** Reading order within a column. */
function byY(lines: ScanLine[]): ScanLine[] {
  return [...lines].sort((a, b) => a.y - b.y || a.x - b.x);
}

/* ── which column is which ──────────────────────────────────── */

/** How much a column reads like an ingredient list rather than method. */
export function ingredientScore(lines: ScanLine[]): number {
  if (!lines.length) return 0;
  let score = 0;
  for (const l of lines) {
    const t = tidy(l.t);
    const first = t.split(/\s+/)[0] ?? '';
    const second = t.split(/\s+/)[1] ?? '';
    if (QTY.test(first)) score += 2;
    if (UNITS.test(second)) score += 2;
    if (LETTER_QTY.test(first) && UNITS.test(second)) score += 2;
    if (t.length < 40) score += 0.5;
    // Method gives itself away: numbered, long, and written in sentences.
    if (STEP_NUMBER.test(t)) score -= 4;
    if (t.length > 60) score -= 1.5;
    if (/[.!?]$/.test(t) && t.split(/\s+/).length > 8) score -= 1;
  }
  return score / lines.length;
}

/* ── ingredients ────────────────────────────────────────────── */

/**
 * Group an ingredient column into one entry per ingredient.
 *
 * A cookbook hangs the quantity in the margin and indents what wraps, so most
 * lines that start a new ingredient begin with a quantity. Indentation alone
 * is not enough — some books indent barely at all — so the decision is made on
 * the wording, with the line above given a veto when it ends mid-phrase.
 */
export function startsIngredient(text: string): boolean {
  const t = tidy(text);
  const words = t.split(/\s+/);
  const first = words[0] ?? '';
  const second = words[1] ?? '';
  if (CONTINUES.test(t)) return false;
  return (
    // A clean quantity, or "/4" where the slash survived and the 1 did not.
    QTY.test(first) ||
    // "V½ medium onion" — a glyph inside the token, so any word may follow.
    (HAS_NUMERAL.test(first) && first.length <= 4 && /^[A-Za-z]/.test(second)) ||
    // "Va teaspoon", "A cup" — a lone letter only counts when a unit follows,
    // or "as grapeseed, canola," would start an ingredient of its own.
    (LETTER_QTY.test(first) && UNITS.test(second)) ||
    HEAD_WORD.test(t)
  );
}

/** Where the ingredient list actually begins, or null if it never does. */
export function ingredientsTop(lines: ScanLine[]): number | null {
  for (const l of byY(lines)) if (startsIngredient(l.t)) return l.y;
  return null;
}

export function groupIngredients(lines: ScanLine[]): string[] {
  const out: string[] = [];
  let footnote = false;
  let started = false;

  for (const line of byY(lines)) {
    const t = tidy(line.t);
    if (!t || NOISE.test(t)) continue;

    // A starred footnote runs to the end of the column; none of it is an
    // ingredient, and "is a blend of cinnamon," reads exactly like one.
    if (/^\*/.test(line.t.trim()) || /^\*/.test(t)) footnote = true;
    if (footnote) continue;

    const prev = out[out.length - 1];
    const starts = startsIngredient(t);

    // A heading, or a scrap of the intro that wrapped into this column, sits
    // above the list. Nothing counts until the first real item.
    if (!started && !starts) continue;
    started = true;

    // The line above wins if it was left hanging: "drained, and sliced into"
    // is followed by "4 patty-size pieces", which starts with a digit and is
    // still the same ingredient.
    if (prev && WRAP_TAIL.test(prev)) {
      out[out.length - 1] = prev.replace(/-$/, '') + (prev.endsWith('-') ? '' : ' ') + t;
      continue;
    }

    if (starts || !prev) out.push(t);
    else out[out.length - 1] = prev + ' ' + t;
  }

  return out.filter((l) => l.length > 1);
}

/* ── steps ──────────────────────────────────────────────────── */

/**
 * Group a method column into steps.
 *
 * Numbered method splits on its numbers. Unnumbered method splits on the gap
 * between paragraphs — a page leaves more space between two steps than between
 * two lines of the same step, and that is the only thing distinguishing them.
 */
export function groupSteps(lines: ScanLine[]): string[] {
  const ordered = byY(lines).filter((l) => {
    const t = tidy(l.t);
    return t && !NOISE.test(t);
  });
  if (!ordered.length) return [];

  const numbered = ordered.some((l) => STEP_NUMBER.test(tidy(l.t)));

  if (numbered) {
    const steps: string[] = [];
    for (const l of ordered) {
      const t = tidy(l.t);
      if (STEP_NUMBER.test(t)) steps.push(t.replace(/^\(?\d{1,2}[.,):]\s*/, ''));
      else if (steps.length) steps[steps.length - 1] += ' ' + t;
    }
    return steps.map(tidy).filter((s) => s.length > 2);
  }

  // Unnumbered: a gap noticeably larger than the usual line spacing is a
  // paragraph break, and a paragraph is a step.
  const gaps: number[] = [];
  for (let i = 1; i < ordered.length; i++) gaps.push(ordered[i].y - ordered[i - 1].y);
  const typical = median(gaps.filter((g) => g > 0));
  // Paragraph leading is only a little looser than line leading — 1.45x never
  // fired and ran five steps together. The floor keeps noise from splitting a
  // paragraph on a one-pixel wobble.
  const breakAt = Math.max(typical * 1.22, typical + 10);

  const steps: string[] = [];
  ordered.forEach((l, i) => {
    const t = tidy(l.t);
    const gap = i === 0 ? Infinity : l.y - ordered[i - 1].y;
    if (i === 0 || gap > breakAt) steps.push(t);
    else steps[steps.length - 1] += ' ' + t;
  });
  return steps.map(tidy).filter((s) => s.length > 2);
}

/* ── title and yield ────────────────────────────────────────── */

/** The biggest type near the top, plus anything sharing its line. */
export function findTitle(lines: ScanLine[], pageH: number, pageW: number): string | null {
  // Only the top of the page, and never a full-width line: an intro paragraph
  // is set in text nearly as tall as the title and sits right under it, so
  // height alone picks the blurb about half the time.
  const candidates = lines.filter(
    (l) => !isVertical(l) && l.y < pageH * 0.25 && l.w <= pageW * 0.6 && tidy(l.t).length > 2
  );
  if (!candidates.length) return null;

  const tallest = candidates.reduce((a, b) => (b.h > a.h ? b : a));
  const typical = median(lines.map((l) => l.h));
  if (tallest.h < typical * 1.3) return null;

  // A title broken into two OCR lines still overlaps vertically.
  const sameLine = candidates
    .filter((l) => l.y < tallest.y + tallest.h && l.y + l.h > tallest.y && l.h >= tallest.h * 0.55)
    .sort((a, b) => a.y - b.y || a.x - b.x);

  return tidy(sameLine.map((l) => l.t).join(' ')) || null;
}

/**
 * Servings, read from a single line.
 *
 * The count has to sit on the same line as the word. A page that prints
 * "SERVES" down the margin above the folio "143" produced 143 servings when
 * the two were allowed to match across lines.
 */
export function findServings(lines: ScanLine[]): number | null {
  for (const l of lines) {
    const m = tidy(l.t).match(/\b(?:serves|makes|yields?)\b[^\d]{0,12}(\d{1,3})\b/i);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n >= 1 && n <= 60) return n;
    }
  }
  return null;
}

/* ── the parser ─────────────────────────────────────────────── */

export function parseScanPage(page: ScanPage): ScanRecipe {
  const warnings: string[] = [];
  const lines = page.lines ?? [];
  if (!lines.length) {
    return { name: null, ingredients: [], steps: [], servings: null, notes: null, warnings: ['No readable text in that photo.'] };
  }

  const { full, columns } = splitColumns(lines, page.w || 1);
  const title = findTitle([...full, ...columns.flat()], page.h || 1, page.w || 1);

  // Whatever became the title must not also be read as an ingredient — it sits
  // inside a column, and "Honey Ginger Ribs" is a plausible-looking first item.
  const titleParts = new Set(
    title ? title.split(/\s+/).filter((w) => w.length > 2) : []
  );
  const isTitleLine = (l: ScanLine) => {
    if (!titleParts.size) return false;
    const words = tidy(l.t).split(/\s+/).filter((w) => w.length > 2);
    if (!words.length) return false;
    return words.every((w) => titleParts.has(w));
  };
  const strip = (ls: ScanLine[]) => ls.filter((l) => !isTitleLine(l));

  let ingredients: string[] = [];
  let steps: string[] = [];

  if (columns.length >= 2) {
    const scored = columns.map((c) => ({ c: strip(c), score: ingredientScore(c) }));
    scored.sort((a, b) => b.score - a.score);
    ingredients = groupIngredients(scored[0].c);

    // Anything in the method column sitting above where the ingredients begin
    // is the tail of the intro, not a step. One line of blurb wrapping into
    // the right-hand column otherwise becomes step 1.
    const top = ingredientsTop(scored[0].c);
    const lead = median(lines.map((l) => l.h)) * 1.5;
    const methodLines = scored
      .slice(1)
      .flatMap((s) => s.c)
      .filter((l) => top == null || l.y >= top - lead);
    steps = groupSteps(methodLines);
  } else if (columns.length === 1) {
    // One column: fall back to shape, since there is no boundary to trust.
    const col = byY(strip(columns[0]));
    const ing = col.filter((l) => ingredientScore([l]) > 0);
    const rest = col.filter((l) => ingredientScore([l]) <= 0);
    ingredients = groupIngredients(ing);
    steps = groupSteps(rest);
    warnings.push('Only one column of text — the split between ingredients and method is a guess.');
  } else {
    warnings.push('Could not make out the layout of that page.');
  }

  const servings = findServings(lines);

  if (!ingredients.length) warnings.push('No ingredients found. If they are on the facing page, add that photo too.');
  if (!steps.length) warnings.push('No method found. If it is on the facing page, add that photo too.');

  return { name: title, ingredients, steps, servings, notes: null, warnings };
}

/** Several photos of one recipe: parse each, then join the parts. */
export function parseScanPages(pages: ScanPage[]): ScanRecipe {
  const parsed = pages.map(parseScanPage);
  if (parsed.length === 1) return parsed[0];
  return {
    name: parsed.find((p) => p.name)?.name ?? null,
    ingredients: parsed.flatMap((p) => p.ingredients),
    steps: parsed.flatMap((p) => p.steps),
    servings: parsed.find((p) => p.servings != null)?.servings ?? null,
    notes: null,
    warnings: [...new Set(parsed.flatMap((p) => p.warnings))],
  };
}

export type { ScanLine, ScanPage };
