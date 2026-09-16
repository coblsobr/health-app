import type { ScanLine, ScanPage } from './ocr';

/**
 * Turn a photographed cookbook page into a recipe, using where the text sat.
 *
 * Guessing the ingredients/method split from wording failed on every real
 * page: it read prose as ingredients, kept only the first line of each step,
 * and dropped every ingredient whose name wrapped. The layout answers all of
 * it, and a page comes in one of two shapes:
 *
 *   - **Side by side** — ingredients in a narrow left column, method in a
 *     narrow right column.
 *   - **Stacked** — ingredients at the top, sometimes in two sub-columns, with
 *     the method full-width underneath.
 *
 * Telling them apart is what everything else hangs off, and the reliable test
 * is **how wide a numbered step is**: a step on a side-by-side page is one
 * column wide (~40% of the page), a stacked one spans it (~65%+). Column
 * counts and vertical extents both give the wrong answer on real pages.
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

/** Units in the singular — "4 teaspoon" is not English, so the 4 is a ¼. */
const SINGULAR_UNIT = /^(teaspoon|tablespoon|cup|pound|ounce|stick|clove|can|quart|pint)$/i;

const QTY = /^[\d¼½¾⅓⅔⅛⅜⅝⅞/]/;
/** A bare letter standing in for a fraction: "a teaspoon", "Va cup", "A cup". */
const LETTER_QTY = /^[A-Za-z]{1,2}$/;
/** Something numeric buried in the token: "V½", "V4", "1½". */
const HAS_NUMERAL = /[\d¼½¾⅓⅔⅛⅜⅝⅞]/;

/** Words that open an ingredient which carries no quantity at all. */
const HEAD_WORD =
  /^(pinch|dash|handful|kosher|sea|salt|freshly|leaves|zest|juice|few|several|some|good|large|small|medium|chopped|toasted|black|white|ground|fresh|grated|shredded|minced|crushed|cooked|additional|prepared|cream)\b/i;

/** A line ending mid-phrase, so the next line continues it whatever it is. */
const WRAP_TAIL =
  /(?:,|-|\b(?:into|with|and|or|of|for|plus|to|about|such as|cut|torn|roughly|finely|thinly|each|condensed|ground|freshly)\s*)$/i;

/** Openers that always continue the line above, never start an ingredient. */
const CONTINUES =
  /^(or|and|as|of|to|such as|plus|about|opposite|have|from|very|cleaned|drained|finely|roughly|thinly|cut|mixed)\b|^\(/i;

/**
 * A sub-heading inside an ingredient list: "DRESSING", "SALAD", "CHOPPED
 * TOMATOES". All caps, no digits, short. Without this, "CHOPPED TOMATOES"
 * reads as an ingredient the moment "chopped" is allowed to open one.
 */
const HEADING = /^[A-Z][A-Z\s&'\-:,.]*$/;
function isHeading(t: string): boolean {
  return t.length < 30 && !/\d/.test(t) && HEADING.test(t);
}

/** Page furniture: folios, running heads, bare numbers. */
const NOISE = /^(?:[\d\s]+|page \d+|chapter \d+|[.·•\-–—_=~|]{2,})$/i;

/** A yield or timing line, which belongs to neither list. */
const YIELD_OR_TIME =
  /^(makes|serves|servings?|yields?|prep\s*time|cook\s*time|bake[^:]{0,14}time|total\s*time)\b/i;

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

function byY(lines: ScanLine[]): ScanLine[] {
  return [...lines].sort((a, b) => a.y - b.y || a.x - b.x);
}

/**
 * Drop everything that is not this recipe.
 *
 * A photo of a magazine catches the facing page down the left edge and the
 * masthead across the top, and OCR reads both as confidently as the recipe.
 * Every one of those fragments looked like an ingredient to the parser.
 */
export function cleanLines(lines: ScanLine[], pageW: number, pageH: number): ScanLine[] {
  return lines.filter((l) => {
    const t = tidy(l.t);
    if (!t || t.length < 2 || NOISE.test(t)) return false;
    if (isVertical(l)) return false;
    // Bleed from the facing page, trapped in the left margin.
    if (l.x + l.w < pageW * 0.15) return false;
    // Trimmed off the top edge of the scan — a masthead or a barcode.
    if (l.y < pageH * 0.01) return false;
    // A folio or running head along the bottom.
    if (l.y > pageH * 0.9 && l.w < pageW * 0.2) return false;
    return true;
  });
}

/* ── the two page shapes ────────────────────────────────────── */

/**
 * Does this line open a method step?
 *
 * The word after the number has to be capitalised and not a unit, or every
 * "2 tablespoons Dijon" in the ingredient list would read as step 2.
 */
export function methodMarker(l: ScanLine): boolean {
  const raw = l.t.trim();
  if (/^[•·●]/.test(raw)) return true;
  const m = raw.match(/^\(?(?:\d{1,2}|[Il])[.,):]?\s+(\S+)/);
  if (!m) return false;
  const next = m[1];
  if (!/^[A-Z]/.test(next)) return false;
  return !UNITS.test(next.replace(/[^A-Za-z]/g, ''));
}

function stripMarker(text: string): string {
  return tidy(text.replace(/^\s*[•·●]\s*/, '').replace(/^\(?(?:\d{1,2}|[Il])[.,):]?\s+/, ''));
}

/**
 * Split lines into columns at a gap between their left edges.
 *
 * Clustering left edges rather than looking for a gap in horizontal coverage:
 * one line straddling the gutter closes a coverage gap completely and hides
 * the boundary.
 */
export function splitColumns(lines: ScanLine[], pageW: number): {
  full: ScanLine[];
  columns: ScanLine[][];
} {
  if (lines.length < 6) return { full: lines, columns: [] };

  // Full-width means wide relative to the PAGE, never to the widest line:
  // measured against the widest line, ordinary method lines count as
  // full-width and vanish from both columns.
  const full = lines.filter((l) => l.w > pageW * 0.6);
  const rest = lines.filter((l) => l.w <= pageW * 0.6);
  if (rest.length < 6) return { full: lines, columns: [] };

  const xs = [...new Set(rest.map((l) => l.x))].sort((a, b) => a - b);
  const candidates: { mid: number; width: number }[] = [];
  for (let i = 1; i < xs.length; i++) {
    const mid = (xs[i] + xs[i - 1]) / 2;
    if (mid > pageW * 0.25 && mid < pageW * 0.75) candidates.push({ mid, width: xs[i] - xs[i - 1] });
  }
  candidates.sort((a, b) => b.width - a.width);

  const floor = Math.max(3, Math.round(rest.length * 0.12));
  for (const cand of candidates) {
    if (cand.width < pageW * 0.02) break;
    const left = rest.filter((l) => l.x < cand.mid);
    const right = rest.filter((l) => l.x >= cand.mid);
    // A folio alone in the right margin is a bigger gap than the gutter, so a
    // split is believed only when both sides hold a real body of text.
    if (left.length >= floor && right.length >= floor) return { full, columns: [left, right] };
  }

  return { full, columns: [rest] };
}

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
    if (methodMarker(l)) score -= 4;
    if (t.length > 60) score -= 1.5;
    if (/[.!?]$/.test(t) && t.split(/\s+/).length > 8) score -= 1;
  }
  return score / lines.length;
}

/* ── quantities ─────────────────────────────────────────────── */

const FRACTION_FOR: Record<string, string> = { '2': '½', '3': '⅓', '4': '¼', '8': '⅛' };

/**
 * Put back the fraction OCR could not read.
 *
 * Scanned fraction glyphs come back as letters — ¼ as "Va", "VA", "Ya" or a
 * bare "4"; ½ as "a"; ⅓ as "s"; 1 as "l" or "I". "Ya cup olive oil" is not
 * something anyone can cook from.
 *
 * The bare-digit case leans on grammar rather than on shape: "4 teaspoon" is
 * not English, so the 4 is a ¼, while "4 teaspoons" is a real quantity and is
 * left alone. That distinction is what makes the rule safe to apply.
 */
export function normalizeQuantity(text: string): string {
  const words = text.split(/\s+/);
  if (words.length < 2) return text;
  const first = words[0];
  const unit = words[1].replace(/[^A-Za-z]/g, '');
  const singular = SINGULAR_UNIT.test(unit);

  let replacement: string | null = null;
  if (/^(V4|Va|VA|Ya|YA|1\/4|\/4)$/.test(first)) replacement = '¼';
  else if (/^(V2|1\/2|\/2)$/.test(first)) replacement = '½';
  else if (/^(V3|1\/3|Ye|Ys)$/.test(first)) replacement = '⅓';
  else if (first === 'a' && singular) replacement = '½';
  else if (first === 'A' && singular) replacement = '¼';
  else if (first === 's' && singular) replacement = '⅓';
  else if (/^[lI]$/.test(first) && singular) replacement = '1';
  else if (/^[2348]$/.test(first) && singular) replacement = FRACTION_FOR[first];

  if (!replacement) return text;
  words[0] = replacement;
  return words.join(' ');
}

/* ── ingredients ────────────────────────────────────────────── */

export function startsIngredient(text: string): boolean {
  const t = tidy(text);
  const words = t.split(/\s+/);
  const first = words[0] ?? '';
  const second = words[1] ?? '';
  if (CONTINUES.test(t)) return false;
  if (isHeading(t)) return false;
  return (
    QTY.test(first) ||
    // OCR leaves a bare "%" or "?%" where it could not read a fraction glyph.
    // It is still sitting in the quantity slot, so the line still starts one.
    (first.includes('%') && first.length <= 3) ||
    (HAS_NUMERAL.test(first) && first.length <= 4 && /^[A-Za-z]/.test(second)) ||
    // A lone letter only counts when a unit follows, or "as grapeseed, canola,"
    // would start an ingredient of its own.
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

    // A starred footnote runs to the end of the column and reads exactly like
    // ingredients — "is a blend of cinnamon,".
    if (/^\*/.test(line.t.trim())) footnote = true;
    if (footnote) continue;
    if (YIELD_OR_TIME.test(t) && t.length < 44) continue;
    // A sub-heading is not an item, and must not start the list either.
    if (isHeading(t)) continue;

    const prev = out[out.length - 1];
    const starts = startsIngredient(t);

    // A heading, or a scrap of intro that wrapped into this column, sits above
    // the list. Nothing counts until the first real item.
    if (!started && !starts) continue;
    started = true;

    // The line above wins when it was left hanging: "drained, and sliced into"
    // is followed by "4 patty-size pieces", which begins with a digit and is
    // still the same ingredient.
    if (prev && WRAP_TAIL.test(prev)) {
      out[out.length - 1] = prev.replace(/-$/, '') + (prev.endsWith('-') ? '' : ' ') + t;
      continue;
    }

    if (starts || !prev) out.push(t);
    else out[out.length - 1] = prev + ' ' + t;
  }

  return out.map(normalizeQuantity).filter((l) => l.length > 1);
}

/* ── steps ──────────────────────────────────────────────────── */

/** Break a run-on block into readable steps at sentence ends. */
function splitSentences(text: string): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+(?:["')\]]+)?\s*/g) ?? [text];
  const out: string[] = [];
  for (const raw of sentences) {
    const s = tidy(raw);
    if (!s) continue;
    const prev = out[out.length - 1];
    if (prev && (prev.length < 170 || s.length < 40)) out[out.length - 1] = prev + ' ' + s;
    else out.push(s);
  }
  return out;
}

export function groupSteps(lines: ScanLine[]): string[] {
  const ordered = byY(lines).filter((l) => {
    const t = tidy(l.t);
    if (!t || NOISE.test(t)) return false;
    // "MAKES 4 SERVINGS" and "PREP TIME: 15 MINUTES" sit inside the method
    // block on magazine pages, but "Bake 35 to 40 minutes or until…" is a real
    // step, so only a short line counts as a label.
    return !(YIELD_OR_TIME.test(t) && t.length < 44);
  });
  if (!ordered.length) return [];

  const marked = ordered.filter(methodMarker);
  let steps: string[];

  if (marked.length >= 2) {
    steps = [];
    for (const l of ordered) {
      if (methodMarker(l)) steps.push(stripMarker(l.t));
      else if (steps.length) steps[steps.length - 1] += ' ' + tidy(l.t);
    }
  } else {
    // Unnumbered: a gap noticeably larger than the usual line spacing is a
    // paragraph break, and a paragraph is a step. Paragraph leading is only
    // slightly looser than line leading, so 1.45x never fired and ran five
    // steps together.
    const gaps: number[] = [];
    for (let i = 1; i < ordered.length; i++) gaps.push(ordered[i].y - ordered[i - 1].y);
    const typical = median(gaps.filter((g) => g > 0));
    const breakAt = Math.max(typical * 1.22, typical + 10);

    steps = [];
    ordered.forEach((l, i) => {
      const t = i === 0 ? stripMarker(l.t) : tidy(l.t);
      const gap = i === 0 ? Infinity : l.y - ordered[i - 1].y;
      if (i === 0 || gap > breakAt) steps.push(t);
      else steps[steps.length - 1] += ' ' + t;
    });
  }

  steps = steps.map(tidy).filter((s) => s.length > 2);

  // A magazine sets its paragraphs tight enough that there is no gap to find,
  // so the whole method arrives as one block. Sentences are the next best cut.
  if (steps.length === 1 && steps[0].length > 400) return splitSentences(steps[0]);
  return steps;
}

/* ── title and yield ────────────────────────────────────────── */

export function findTitle(lines: ScanLine[], pageH: number, pageW: number): string | null {
  // Titles are short, wide enough to be type rather than a scrap, and near the
  // top. Without the word limit an intro paragraph wins on height alone about
  // half the time, since it is set nearly as tall and sits right underneath.
  const candidates = lines.filter(
    (l) =>
      !isVertical(l) &&
      l.y < pageH * 0.25 &&
      l.w > pageW * 0.12 &&
      tidy(l.t).length > 2 &&
      tidy(l.t).split(/\s+/).length <= 8
  );
  if (!candidates.length) return null;

  const tallest = candidates.reduce((a, b) => (b.h > a.h ? b : a));
  if (tallest.h < median(lines.map((l) => l.h)) * 1.3) return null;

  const sameLine = candidates
    .filter((l) => l.y < tallest.y + tallest.h && l.y + l.h > tallest.y && l.h >= tallest.h * 0.55)
    .sort((a, b) => a.y - b.y || a.x - b.x);

  return tidy(sameLine.map((l) => l.t).join(' ')) || null;
}

/**
 * Servings, read from a single line.
 *
 * The count has to sit on the same line as the word: a page printing "SERVES"
 * down the margin above the folio "143" gave 143 servings when the two were
 * allowed to match across lines. No word boundary after the keyword, because
 * OCR runs them together — "MAKES6 SERVINGS".
 */
export function findServings(lines: ScanLine[]): number | null {
  for (const l of lines) {
    const m = tidy(l.t).match(/(?:serves?|servings?|makes|yields?)\D{0,10}(\d{1,3})\b/i);
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
  const raw = page.lines ?? [];
  const pageW = page.w || 1;
  const pageH = page.h || 1;

  if (!raw.length) {
    return {
      name: null, ingredients: [], steps: [], servings: null, notes: null,
      warnings: ['No readable text in that photo.'],
    };
  }

  const lines = cleanLines(raw, pageW, pageH);
  const title = findTitle(lines, pageH, pageW);
  // Read from the uncleaned lines: the yield is often set down the margin, and
  // cleaning drops rotated text.
  const servings = findServings(raw);

  // Whatever became the title must not also be read as an ingredient — it sits
  // inside a column, and "Honey Ginger Ribs" is a plausible first item.
  const titleWords = new Set(title ? title.split(/\s+/).filter((w) => w.length > 2) : []);
  const isTitleLine = (l: ScanLine) => {
    if (!titleWords.size) return false;
    const words = tidy(l.t).split(/\s+/).filter((w) => w.length > 2);
    return words.length > 0 && words.every((w) => titleWords.has(w));
  };
  const body = lines.filter((l) => !isTitleLine(l));

  let ingredients: string[] = [];
  let steps: string[] = [];

  const markers = body.filter(methodMarker);
  const stacked = markers.length > 0 && median(markers.map((m) => m.w)) > pageW * 0.5;

  if (stacked) {
    const methodTop = Math.min(...markers.map((m) => m.y));
    const above = body.filter((l) => l.y < methodTop);
    const below = body.filter((l) => l.y >= methodTop);

    const { columns } = splitColumns(above, pageW);
    if (columns.length >= 2) {
      // Two sub-lists side by side ("DRESSING" then "SALAD") — read them in
      // page order, left column first.
      const ordered = [...columns].sort(
        (a, b) => Math.min(...a.map((l) => l.x)) - Math.min(...b.map((l) => l.x))
      );
      ingredients = ordered.flatMap(groupIngredients);
    } else {
      // Not `columns[0]`: splitColumns holds full-width lines back, and on a
      // stacked page a full-width line is usually just a long ingredient.
      ingredients = groupIngredients(above);
    }
    steps = groupSteps(below);
  } else {
    const { columns } = splitColumns(body, pageW);
    if (columns.length >= 2) {
      const scored = columns
        .map((c) => ({ c, score: ingredientScore(c) }))
        .sort((a, b) => b.score - a.score);
      ingredients = groupIngredients(scored[0].c);

      // Anything in the method column above where the ingredients begin is the
      // tail of the intro, not step 1.
      const top = ingredientsTop(scored[0].c);
      const lead = median(lines.map((l) => l.h)) * 1.5;
      steps = groupSteps(
        scored.slice(1).flatMap((s) => s.c).filter((l) => top == null || l.y >= top - lead)
      );
    } else if (columns.length === 1) {
      const col = byY(columns[0]);
      ingredients = groupIngredients(col.filter((l) => ingredientScore([l]) > 0));
      steps = groupSteps(col.filter((l) => ingredientScore([l]) <= 0));
      warnings.push('Only one column of text — the split between ingredients and method is a guess.');
    } else {
      warnings.push('Could not make out the layout of that page.');
    }
  }

  if (ingredients.some((i) => i.includes('%'))) {
    warnings.push('Some fractions were unreadable — check the quantities.');
  }
  if (!ingredients.length) {
    warnings.push('No ingredients found. If they are on the facing page, add that photo too.');
  }
  if (!steps.length) {
    warnings.push('No method found. If it is on the facing page, add that photo too.');
  }

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
