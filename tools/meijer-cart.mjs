#!/usr/bin/env node
/**
 * Fill your Meijer pickup cart from the app's grocery list.
 *
 *   node tools/meijer-cart.mjs                 list from clipboard, Downloads, or pasted
 *   node tools/meijer-cart.mjs list.txt        list from a file
 *   node tools/meijer-cart.mjs --dry           search and choose, add nothing
 *
 * In the app: Groceries → SEND TO MEIJER, and send the text to this laptop
 * (Quick Share, Gmail, Keep, or copy it with Phone Link). Then run this.
 *
 * How it works, and why:
 *
 *   - **Your own Chrome, started normally**, then Playwright attaches to it.
 *     Launching Chrome *through* Playwright sets automation flags that
 *     Meijer's bot protection (Akamai) answers with "Access Denied" — it did,
 *     on the second test run. Attached this way it is just Chrome.
 *   - **A separate Chrome profile** (~/.meijer-cart/profile), so your everyday
 *     Chrome is never touched. You sign in to Meijer in it yourself, once; the
 *     script never sees or types a password.
 *   - **It adds and stops.** It never checks out, picks a pickup time or
 *     pays. The cart is left open for you to look over and finish.
 *   - **Picks are remembered** in ~/.meijer-cart/picks.json. If it chose the
 *     wrong product, change it in the cart and correct the entry there (or
 *     delete it to let it choose again) — next week it adds the right one.
 *
 * Meijer can change their site at any time. When that happens this stops
 * finding buttons and says so, rather than adding the wrong things.
 */

import { chromium } from 'playwright';
import { spawn, execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import readline from 'node:readline/promises';
import { parseList, hasList, pickProduct } from './meijer-lib.mjs';

// MEIJER_CART_HOME points tests at a throwaway profile, away from your real cart.
const HOME = process.env.MEIJER_CART_HOME || join(homedir(), '.meijer-cart');
const PROFILE = join(HOME, 'profile');
const PICKS = join(HOME, 'picks.json');
const REPORT = join(HOME, 'last-run.txt');
const PORT = 9333;
const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  join(homedir(), 'AppData/Local/Google/Chrome/Application/chrome.exe'),
].find((p) => existsSync(p));

const args = process.argv.slice(2);
const dry = args.includes('--dry');
// --guest: skip the sign-in prompt and fill a guest cart (for testing).
const guest = args.includes('--guest');
const file = args.find((a) => !a.startsWith('--'));
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const pause = (min, max) => new Promise((r) => setTimeout(r, min + Math.random() * (max - min)));

/* ── the list ───────────────────────────────────────────────── */

async function readListText() {
  if (file) return readFileSync(file, 'utf8');

  try {
    const clip = execSync('powershell -NoProfile -Command Get-Clipboard', { encoding: 'utf8' });
    if (hasList(clip)) { console.log('Using the list on the clipboard.'); return clip; }
  } catch {}

  // A file shared to the laptop lands in Downloads; take the newest recent one.
  const dl = join(homedir(), 'Downloads');
  try {
    const recent = readdirSync(dl)
      .filter((f) => /\.txt$/i.test(f))
      .map((f) => ({ f, t: statSync(join(dl, f)).mtimeMs }))
      .filter((x) => Date.now() - x.t < 3 * 86_400_000)
      .sort((a, b) => b.t - a.t);
    for (const { f } of recent) {
      const text = readFileSync(join(dl, f), 'utf8');
      if (hasList(text)) { console.log(`Using ${f} from Downloads.`); return text; }
    }
  } catch {}

  console.log('Paste the list from the app, then press Enter on an empty line:');
  const lines = [];
  for (;;) {
    const line = await rl.question('');
    if (!line.trim() && lines.length) break;
    lines.push(line);
  }
  return lines.join('\n');
}

/* ── Chrome ─────────────────────────────────────────────────── */

async function connect() {
  try { return await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`); } catch {}
  if (!CHROME) throw new Error('Google Chrome is not installed where expected.');
  mkdirSync(PROFILE, { recursive: true });
  spawn(CHROME, [
    `--user-data-dir=${PROFILE}`, `--remote-debugging-port=${PORT}`,
    '--no-first-run', '--no-default-browser-check', 'about:blank',
  ], { detached: true, stdio: 'ignore' }).unref();
  for (let i = 0; i < 40; i++) {
    try { return await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`); } catch { await pause(400, 600); }
  }
  throw new Error('Chrome started but could not be reached.');
}

const signedOut = async (page) =>
  /\bSign In\b/.test(await page.locator('header').innerText().catch(() => 'Sign In'));

/** What a search found, read off the page. */
async function readResults(page) {
  return page.locator('article[data-testid="product-card"]').evaluateAll((cards) =>
    cards.slice(0, 24).map((a) => {
      const add = a.querySelector('button[data-testid="quantity-input-add-to-cart"]');
      const link = a.querySelector('a[href*="/shopping/product/"]');
      const label = add?.getAttribute('aria-label') ?? '';
      const fromLabel = label.replace(/^Add\s+/, '').replace(/\s+to Cart$/, '');
      const fromSlug = (link?.getAttribute('href') ?? '').split('/').slice(-2, -1)[0]?.replace(/-/g, ' ') ?? '';
      return {
        name: fromLabel || fromSlug,
        href: link?.getAttribute('href') ?? '',
        sponsored: /Sponsored/.test(a.innerText),
        price: (a.innerText.match(/\$\d+\.\d\d/) || [''])[0],
        canAdd: !!add,
        inCart: !!a.querySelector('[data-testid="quantity-input-update-quantity"], [data-testid="quantity-input-increment"]'),
      };
    })
  );
}

async function addOne(page, href, qty) {
  const card = page.locator('article[data-testid="product-card"]').filter({ has: page.locator(`a[href="${href}"]`) }).first();
  const add = card.locator('button[data-testid="quantity-input-add-to-cart"]');
  const inCart = () => card.locator('[data-testid="quantity-input-update-quantity"], [data-testid="quantity-input-increment"]').count();
  await add.scrollIntoViewIfNeeded();
  // A click before the page has finished wiring up its buttons does nothing
  // at all — that is how the first live test lost the garbanzo beans. Wait,
  // and try once more if Meijer did not answer.
  let ok = false;
  for (let attempt = 0; attempt < 2 && !ok; attempt++) {
    await pause(900, 1500);
    if (await inCart()) { ok = true; break; }
    const added = page.waitForResponse((r) => /shoppingcart\/.*\/add\//.test(r.url()), { timeout: 10000 }).catch(() => null);
    await add.click({ timeout: 8000 }).catch(() => {});
    const res = await added;
    ok = (!!res && res.ok()) || (await inCart()) > 0;
  }
  if (!ok) return false;
  for (let n = 1; n < qty; n++) {
    await pause(600, 1000);
    const inc = card.locator('[data-testid="quantity-input-increment"]');
    if (!(await inc.count())) await card.locator('[data-testid="quantity-input-update-quantity"]').click().catch(() => {});
    await card.locator('[data-testid="quantity-input-increment"]').click({ timeout: 5000 }).catch(() => {});
  }
  return true;
}

/* ── run ────────────────────────────────────────────────────── */

const items = parseList(await readListText());
if (!items.length) {
  console.log('No list found. In the app: Groceries → SEND TO MEIJER.');
  process.exit(1);
}
console.log(`${items.length} items${dry ? ' (dry run — nothing will be added)' : ''}.\n`);

const picks = existsSync(PICKS) ? JSON.parse(readFileSync(PICKS, 'utf8')) : {};
const browser = await connect();
const page = browser.contexts()[0].pages()[0] ?? (await browser.contexts()[0].newPage());
await page.bringToFront();

const home = await page.goto('https://www.meijer.com/', { waitUntil: 'domcontentloaded' });
if (home?.status() === 403) {
  console.log('Meijer answered "Access Denied". Wait a few minutes and try again.');
  process.exit(1);
}
await pause(2500, 3500);
if (!dry && !guest && (await signedOut(page))) {
  console.log('Sign in to Meijer in the Chrome window that just opened (first time only).');
  await rl.question('Press Enter here once you are signed in… ').catch(() => {});
  await page.reload({ waitUntil: 'domcontentloaded' });
  await pause(2000, 3000);
  if (await signedOut(page)) console.log('Still looks signed out — carrying on; the cart will be a guest cart.');
}

const report = [];
for (const [i, item] of items.entries()) {
  const tag = `[${i + 1}/${items.length}] ${item.search}`;
  try {
    await page.goto(`https://www.meijer.com/shopping/search/${encodeURIComponent(item.search)}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('article[data-testid="product-card"]', { timeout: 15000 }).catch(() => {});
    const results = await readResults(page);
    const pick = pickProduct(item.search, results, { remembered: picks[item.search]?.href });
    if (!pick) {
      console.log(`  ✗ ${tag} — nothing close enough`);
      report.push(`NOT FOUND   ${item.label}  (searched "${item.search}")`);
    } else if (pick.inCart) {
      console.log(`  = ${tag} → ${pick.name} (already in cart)`);
      report.push(`IN CART     ${item.label}  → ${pick.name}`);
    } else if (dry) {
      console.log(`  ? ${tag} → ${pick.name} ${pick.price}${item.qty > 1 ? ` ×${item.qty}` : ''}`);
      report.push(`WOULD ADD   ${item.label}  → ${pick.name} ${pick.price}`);
    } else if (await addOne(page, pick.href, item.qty)) {
      picks[item.search] ??= { href: pick.href, name: pick.name };
      console.log(`  ✓ ${tag} → ${pick.name} ${pick.price}${item.qty > 1 ? ` ×${item.qty}` : ''}`);
      report.push(`ADDED       ${item.label}  → ${pick.name} ${pick.price}${item.qty > 1 ? ` ×${item.qty}` : ''}`);
    } else {
      console.log(`  ✗ ${tag} — Meijer did not take it`);
      report.push(`FAILED      ${item.label}  → ${pick.name}`);
    }
  } catch (e) {
    console.log(`  ✗ ${tag} — ${e.message.split('\n')[0]}`);
    report.push(`ERROR       ${item.label}`);
  }
  await pause(1500, 3000); // be a person, not a crawler
}

mkdirSync(HOME, { recursive: true });
if (!dry) writeFileSync(PICKS, JSON.stringify(picks, null, 2));
writeFileSync(REPORT, report.join('\n') + '\n');

const missing = report.filter((r) => !/^(ADDED|IN CART|WOULD ADD)/.test(r));
console.log(`\nDone. ${report.length - missing.length} of ${items.length} ${dry ? 'matched' : 'in the cart'}.`);
if (missing.length) console.log(`Add these yourself:\n  ${missing.join('\n  ')}`);
console.log(`Report: ${REPORT}`);

if (!dry) {
  await page.goto('https://www.meijer.com/shopping/cart', { waitUntil: 'domcontentloaded' }).catch(() => {});
  console.log('\nThe cart is open in Chrome — check it, pick a pickup time, and check out.');
}
rl.close();
process.exit(0);
