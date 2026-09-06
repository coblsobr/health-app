/**
 * Turn text read off a photo into a structured recipe.
 *
 * The OCR engine itself is swappable (see `recognizeText`); everything here is
 * pure string work so it can be tested against transcripts without a phone.
 *
 * Cookbook pages are messier than web pages: the recipe is often split across
 * a spread, headings are decorative, and there is usually surrounding prose.
 * So this returns `warnings` describing what it could not find rather than
 * quietly producing a half-empty recipe.
 */

export type OcrRecipe = {
  name: string | null;
  ingredients: string[];
  steps: string[];
  servings: number | null;
  prepMin: number | null;
  cookMin: number | null;
  notes: string | null;
  /** Plain-language notes about what is missing or uncertain. */
  warnings: string[];
};

/* ── vocabulary ─────────────────────────────────────────────── */

const SECTION_PATTERNS: { key: Section; re: RegExp }[] = [
  { key: 'ingredients', re: /^(ingredients?|you will need|what you need|for the .{0,40})$/i },
  { key: 'steps', re: /^(method|directions?|instructions?|preparation|steps|how to make it?|to make)$/i },
  { key: 'story', re: /^(the story|story|about|introduction|note from .{0,30})$/i },
  { key: 'tools', re: /^(tools?|equipment|you.ll need)$/i },
  { key: 'timing', re: /^(timing|times?|at a glance)$/i },
  { key: 'notes', re: /^(notes?|tips?|to serve|variations?|storage)$/i },
  { key: 'nutrition', re: /^(nutrition|nutritional info(rmation)?|per serving)$/i },
];

type Section = 'ingredients' | 'steps' | 'story' | 'tools' | 'timing' | 'notes' | 'nutrition' | 'none';

const UNITS = [
  'cups?', 'tbsps?', 'tablespoons?', 'tsps?', 'teaspoons?', 'grams?', 'g', 'kg', 'kilograms?',
  'ml', 'millilitres?', 'milliliters?', 'l', 'litres?', 'liters?', 'oz', 'ounces?', 'lbs?', 'pounds?',
  'cloves?', 'pinch(?:es)?', 'dash(?:es)?', 'cans?', 'tins?', 'packets?', 'packages?', 'pkg',
  'slices?', 'sticks?', 'bunch(?:es)?', 'handfuls?', 'sprigs?', 'pieces?', 'sheets?', 'bulbs?',
  'quarts?', 'pints?', 'fl\\.? ?oz', 'cm', 'in', 'inch(?:es)?', 'stalks?', 'heads?', 'strips?',
];
const UNIT_RE = new RegExp('\\b(?:' + UNITS.join('|') + ')\\b', 'i');

// 1  1.5  1/2  1 1/2  ½  1½  2-3  2–3
const QTY_RE = /^\s*(?:\d+[\d.,]*\s*[-–—]\s*)?(?:\d+[\d.,]*\s*)?(?:\d\s*\/\s*\d|[¼½¾⅓⅔⅛⅜⅝⅞])?\s*/;
const STARTS_WITH_QTY = /^\s*(?:\d|[¼½¾⅓⅔⅛⅜⅝⅞])/;

/** Lines that are page furniture rather than recipe content. */
const NOISE_RE = /^(?:\d{1,4}|page \d+|chapter \d+|[.·•\-–—_=~]{2,}|[A-Z]{1,3}\d*)$/i;

/* ── helpers ────────────────────────────────────────────────── */

function tidy(line: string): string {
  return line
    // OCR frequently reads bullet glyphs as punctuation runs.
    .replace(/^[\s•·▪●\-–—*]+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function detectSection(line: string): Section | null {
  const bare = tidy(line).replace(/[:.]+$/, '').trim();
  if (!bare || bare.length > 40) return null;
  for (const { key, re } of SECTION_PATTERNS) if (re.test(bare)) return key;
  return null;
}

/** "3 hrs 10 mins" → 190. "30 mins" → 30. "1 hour" → 60. */
export function parseDurationText(s: string): number | null {
  if (!s) return null;
  const text = s.toLowerCase();
  let total = 0;
  let found = false;

  const hours = text.match(/(\d+(?:\.\d+)?)\s*(?:hrs?|hours?|h)\b/);
  if (hours) {
    total += parseFloat(hours[1]) * 60;
    found = true;
  }
  const mins = text.match(/(\d+(?:\.\d+)?)\s*(?:mins?|minutes?|m)\b/);
  if (mins) {
    total += parseFloat(mins[1]);
    found = true;
  }
  if (!found) {
    // A range like "16-17" — take the upper bound so timings are not optimistic.
    const range = text.match(/(\d+)\s*[-–—]\s*(\d+)/);
    if (range) return parseInt(range[2], 10);
    const bare = text.match(/\b(\d{1,3})\b/);
    if (bare) return parseInt(bare[1], 10);
    return null;
  }
  return Math.round(total);
}

function looksLikeIngredient(line: string): boolean {
  const l = tidy(line);
  if (l.length < 2 || l.length > 120) return false;
  if (/[.!?]$/.test(l) && l.split(' ').length > 12) return false; // a sentence, not an item
  if (STARTS_WITH_QTY.test(l)) return true;
  if (UNIT_RE.test(l) && l.split(' ').length <= 10) return true;
  return false;
}

function looksLikeStep(line: string): boolean {
  const l = tidy(line);
  if (l.length < 25) return false;
  const words = l.split(/\s+/).length;
  return words >= 6;
}

/** Strip a leading step number so "1. Heat the oven" becomes "Heat the oven". */
function stripStepNumber(line: string): string {
  return tidy(line).replace(/^\(?\d{1,2}\)?[.):]\s*/, '');
}

/* ── the parser ─────────────────────────────────────────────── */

/**
 * @param raw  OCR text. For a recipe spanning several pages, join each page's
 *             text with a newline and pass it all at once.
 */
export function parseRecipeText(raw: string): OcrRecipe {
  const warnings: string[] = [];
  const rawLines = raw.split(/\r?\n/).map(tidy).filter((l) => l && !NOISE_RE.test(l));

  if (rawLines.length === 0) {
    return {
      name: null, ingredients: [], steps: [], servings: null,
      prepMin: null, cookMin: null, notes: null,
      warnings: ['No readable text in that image.'],
    };
  }

  // 1. Split into sections.
  const sections = new Map<Section, string[]>();
  let current: Section = 'none';
  let sawAnyHeading = false;
  for (const line of rawLines) {
    const heading = detectSection(line);
    if (heading) {
      current = heading;
      sawAnyHeading = true;
      if (!sections.has(current)) sections.set(current, []);
      continue;
    }
    if (!sections.has(current)) sections.set(current, []);
    sections.get(current)!.push(line);
  }

  const get = (s: Section) => sections.get(s) ?? [];
  const preamble = get('none');

  // 2. Title — the first substantial line before any heading. Cookbook titles
  //    sit at the top, and OCR reads top-to-bottom.
  let name: string | null = null;
  for (const line of preamble) {
    const words = line.split(/\s+/).length;
    // Skip pronunciation guides and all-caps labels.
    if (/^\[.*\]$/.test(line) || /\[[^\]]*[·•][^\]]*\]/.test(line)) continue;
    if (line.length >= 3 && line.length <= 70 && words <= 9 && !/[.!?]$/.test(line)) {
      name = line.replace(/\s*\[[^\]]*\]\s*$/, '').trim();
      break;
    }
  }
  if (!name) warnings.push('Could not tell which line was the title.');

  // 3. Ingredients.
  let ingredients = get('ingredients').filter((l) => !detectSection(l));
  if (ingredients.length === 0) {
    // No heading found — fall back to shape, but never pull from prose sections.
    const pool = [...preamble, ...get('none')];
    ingredients = pool.filter(looksLikeIngredient);
    if (ingredients.length && !sawAnyHeading) {
      warnings.push('No "Ingredients" heading found — these were guessed from their shape.');
    }
  } else {
    // Under an Ingredients heading, keep short lines and anything shaped like
    // an item, but drop prose that bled in from an adjacent column.
    ingredients = ingredients.filter((l) => looksLikeIngredient(l) || (l.length < 60 && !looksLikeStep(l)));
  }
  ingredients = ingredients.filter((l) => l.length >= 2).slice(0, 60);

  // 4. Steps.
  let steps = get('steps').filter((l) => !detectSection(l)).map(stripStepNumber).filter(Boolean);
  if (steps.length === 0) {
    const pool = preamble.filter((l) => l !== name);
    steps = pool.filter((l) => /^\(?\d{1,2}[.)]/.test(l)).map(stripStepNumber);
  }
  // Rejoin lines that OCR split mid-sentence.
  steps = mergeWrappedLines(steps);

  // 5. Timing and yield.
  const all = rawLines.join('\n');
  const prepMin = labelledDuration(rawLines, /^(?:prep(?:aration)?|active)\b/i);
  const cookMin =
    labelledDuration(rawLines, /^(?:cook(?:ing)?|bake|baking|oven)\b/i) ??
    deriveCookFromTotal(rawLines, prepMin);

  // Read servings from the *unfiltered* text. A book often prints a bare "8"
  // beneath a SERVES heading, and the noise filter strips lone numbers as page
  // numbers — which would take the serving count with them.
  const servings = parseServings(raw);

  const notesLines = [...get('notes'), ...get('story')].filter(Boolean);
  const notes = notesLines.length ? notesLines.join(' ').slice(0, 1200) : null;

  // 6. Say plainly what is missing — a cookbook spread often carries only half
  //    the recipe, and silently saving an empty one is worse than saying so.
  if (ingredients.length === 0) {
    warnings.push('No ingredients found on this page. If they are on the facing page, add that photo too.');
  }
  if (steps.length === 0) {
    warnings.push('No method found on this page. If it is on the facing page, add that photo too.');
  }

  return { name, ingredients, steps, servings, prepMin, cookMin, notes, warnings };
}

/**
 * Find a duration on a line that *starts* with the given label.
 *
 * Searching the whole page instead matches prose: "might require baking in
 * batches" in the story beat the real "Bake time:" line and silently produced
 * a wrong cook time. A timing label always begins its own line.
 */
function labelledDuration(lines: string[], labelRe: RegExp): number | null {
  for (const line of lines) {
    if (!labelRe.test(line)) continue;
    const m = line.match(/^[^:]{0,24}[:\-]\s*(.{1,40})$/);
    const value = m ? m[1] : line.replace(labelRe, '');
    const mins = parseDurationText(value);
    if (mins != null) return mins;
  }
  return null;
}

/** Many books print only a total; derive cook time so the total stays honest. */
function deriveCookFromTotal(lines: string[], prep: number | null): number | null {
  const total = labelledDuration(lines, /^total\b/i);
  if (total == null) return null;
  if (prep == null) return total;
  // Resting and proving are not cooking; subtract them when the book lists them.
  const rest = labelledDuration(lines, /^(?:rest(?:ing)?|chill(?:ing)?|prov(?:e|ing)|ris(?:e|ing)|marinat)/i) ?? 0;
  return Math.max(0, total - prep - rest);
}

export function parseServings(text: string): number | null {
  // "Serves 8" / "SERVES: 4-6" / "Makes 24" / "Yields: 60 puffs"
  // "SERVES 8" and "Yields: 60 puffs" often both appear. How many people it
  // feeds is what a meal plan needs, so servings outranks item count.
  // The paired patterns also cover a bare heading with the number beneath it.
  const tiers = [
    /\b(?:serves?|servings?|portions?)\b\s*[:\-]?\s*(\d{1,3})/i,
    /\b(?:serves?|servings?|portions?)\b\s*[:\-]?\s*\n\s*(\d{1,3})\b/i,
    /\b(?:makes|yields?)\b\s*[:\-]?\s*(\d{1,3})/i,
    /\b(?:makes|yields?)\b\s*[:\-]?\s*\n\s*(\d{1,3})\b/i,
  ];
  for (const re of tiers) {
    const m = text.match(re);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > 0 && n < 500) return n;
    }
  }
  return null;
}

/**
 * OCR breaks paragraphs at the column edge. A line that does not end a sentence
 * and is followed by one starting lowercase is a continuation.
 */
export function mergeWrappedLines(lines: string[]): string[] {
  const out: string[] = [];
  for (const line of lines) {
    const prev = out[out.length - 1];
    if (
      prev &&
      !/[.!?:;]$/.test(prev) &&
      /^[a-z(]/.test(line) &&
      prev.length < 400
    ) {
      out[out.length - 1] = prev + ' ' + line;
    } else {
      out.push(line);
    }
  }
  return out;
}

/* ── the engine ─────────────────────────────────────────────── */

/**
 * Read text from an image on the device.
 *
 * Android uses Google ML Kit and iOS uses Vision, both bundled with the OS
 * family — free, offline, and the image never leaves the phone. Required
 * lazily so the module never enters the web bundle, where it does not exist.
 */
export async function recognizeText(imageUri: string): Promise<string> {
  const { Platform } = require('react-native') as typeof import('react-native');
  if (Platform.OS === 'web') {
    throw new Error('Photo import only works in the installed app.');
  }
  let TextRecognition: { recognize: (uri: string) => Promise<{ text: string }> };
  try {
    TextRecognition = require('@react-native-ml-kit/text-recognition').default;
  } catch {
    throw new Error('Text recognition is not available in this build. Install the latest APK.');
  }
  const result = await TextRecognition.recognize(imageUri);
  return result?.text ?? '';
}

/** Read one or more images and parse them together as a single recipe. */
export async function importFromImages(uris: string[]): Promise<OcrRecipe & { rawText: string }> {
  if (uris.length === 0) throw new Error('Pick a photo first.');
  const texts: string[] = [];
  for (const uri of uris) texts.push(await recognizeText(uri));
  const rawText = texts.join('\n');
  return { ...parseRecipeText(rawText), rawText };
}
