@AGENTS.md

# Health App — build guide

All-in-one nutrition + fitness app. Sideloaded to an **S23** now, iPhone later.
Spec and phase order live one level up in `../HEALTH-APP-PLAN.md`.
Approved visual reference: `../health-app-mockup.html` (open in a browser).

## Run it

```
npm --prefix health-app run web -- --port 8081
```

Then open http://localhost:8081. For the phone, see "Shipping" below.

## Hard-won constraints — read before touching navigation

- **Never import from `@react-navigation/*`.** As of SDK 56 expo-router vendors
  its own copy, and importing the real packages is a *hard bundling error*, not
  a warning. Those packages are deliberately absent from `package.json`.
  - `Drawer`, `DrawerContentScrollView`, `DrawerContentComponentProps` →
    `expo-router/drawer`
  - `Tabs`, `useNavigation`, `useRouter`, `Redirect` → `expo-router`
  - To open the drawer, dispatch the raw action:
    `navigation.dispatch({ type: 'OPEN_DRAWER' })`
- **Don't annotate tab `screenOptions` with an imported type.** Let it infer
  (see `components/tabBar.tsx`) — importing `BottomTabNavigationOptions` from
  the real package produces a spurious mismatch against expo-router's copy.
- `babel.config.js` uses `react-native-worklets/plugin`, **not**
  `react-native-reanimated/plugin` — Reanimated 4 moved it. Must stay last.

## Design direction — printed cookbook

The UI was rebuilt away from a generated look. Keep these when adding screens:

- **Content sits on the page, separated by `<Rule />`.** A `<Card>` is for a
  thing that is genuinely an object. Do not wrap every group in one.
- **Sentence-case serif headings** (`<SectionTitle>`), never uppercase tracked
  labels.
- **No emoji as icons.** Use `components/Icon.tsx`.
- **One accent.** `c.nut` carries the app; `fit`/`hlth`/`info` are muted
  supporting roles, not co-stars.
- **Use the type scale in `tokens.ts`.** One loud voice per screen (`hero`,
  46px) and a quiet one for everything else. Everything landing between
  10-20px is what made it read flat.
- **Warm paper, not screen white.** The ground is cream and the ink is warm
  near-black; dark mode is a warm near-black page, not a dimmed white one.
- **Cookbook devices, used sparingly.** `<Eyebrow>` tracked small caps as a
  running head (once per screen, not per section), `<DoubleRule>` under a
  heading, `<Caption>` italic under a figure, `<ScriptNote>` for a genuine
  margin note. Reach for these rarely — everywhere at once is noise.
- **Script is for warmth, never for information.** A limitation or a caveat set
  in handwriting reads as decoration; keep those in quiet plain text.
- Primitives: `Rule`, `SectionTitle`, `Hero`, `Meter`, `LineItem`,
  `TextAction`, `Eyebrow`, `DoubleRule`, `Caption`, `ScriptNote`, `Ornament`.
  Prefer them over `Card` + `Ch` + `Btn`.

Diary is the reference implementation. Other screens still use the old
card-heavy layout and get reworked one at a time.

## Theming

One set of semantic tokens, two value sets, in `theme/tokens.ts`. Components
**never** use a raw hex — always `const { c } = useTheme()`.

- `c.nut` coral = Nutrition, `c.fit` green = Fitness, `c.hlth` violet = Health
- Adding a third theme = a third object in `tokens.ts`, nothing else
- Light/Dark/System selector lives in `app/settings.tsx` and is live
- Theme choice is **not yet persisted** — it resets on reload. Wire it to
  storage when the DB layer lands.

## Layout

```
app/
  _layout.tsx        Drawer + fonts + ThemeProvider
  index.tsx          redirect -> /(nutrition)/diary
  (nutrition)/       diary · library · add · plan · shop
  (fitness)/         today · history · log · plan · progress
  (health)/          today · goals · trends
  profile · settings · account
components/          Screen (app bar), ui (kit), Icon, Ring, tabBar
theme/               tokens.ts, ThemeProvider.tsx
```

`components/ui.tsx` is the kit — Card, Row, Ch, H3, Num, Sm, Xs, KV, Chip, Tag,
Btn, Toggle, Prog, Tile, Seg, Stepper, Toast, Photo. Reuse before adding.

## Shipping

Native changes need a new APK; JS-only changes go over the air.

```
npx eas-cli build --platform android --profile preview   # APK to sideload
npx eas-cli update --branch preview -m "what changed"    # OTA update
```

Pushing to `main` runs `.github/workflows/update.yml`, which publishes the OTA
update automatically. Needs an `EXPO_TOKEN` repo secret.

`runtimeVersion` is on the `fingerprint` policy: it hashes the native layer, so
it changes by itself whenever a new APK is genuinely required.

## Project links

- Repo: https://github.com/coblsobr/health-app
- EAS project: https://expo.dev/accounts/coblsobr/projects/health-app
- First APK (v0.1.0, runtime `dda575f1`):
  https://expo.dev/accounts/coblsobr/projects/health-app/builds/cee0f7af-89e5-4be5-992b-ceb95751bf45

## Gotchas already hit — don't repeat these

- **Icon assets**: SDK 57's template ships `android-icon-foreground/background/
  monochrome.png`, *not* `adaptive-icon.png`. Pointing at the latter fails the
  EAS Prebuild phase with an unhelpful "Unknown error."
- **`edgeToEdgeEnabled` was removed** in SDK 57 — Android 16 makes it mandatory.
- **`expo-system-ui` is required** for `userInterfaceStyle: automatic`; without
  it the system dark-mode setting never reaches the app.
- **Verify config changes with `npx expo prebuild --platform android --no-install
  --clean` before pushing a build.** It runs the exact phase that fails, in ~20s
  instead of ~10 min. Delete the generated `android/` afterwards — and note that
  prebuild rewrites the `android`/`ios` npm scripts to `expo run:*` every time,
  which needs reverting since we don't build natively.

## Storage

`lib/db.ts` owns SQLite. Two conventions applied from the first migration so
sync and multiple profiles never need a rewrite: **text uuid `id`** on every
row, and **`user_id` on every table**. Deletes are soft (`deleted_at`) so sync
can propagate them.

Call the exported functions — they await `ready()` internally, which opens and
migrates once. Do **not** gate app startup on the database: a storage failure
should cost you the storage-backed screens, not the whole app.

**expo-sqlite does not work in the web dev server.** It runs as WebAssembly and
needs SharedArrayBuffer, which requires COOP/COEP headers on the HTML document.
Expo's dev server applies `metro.config.js` middleware *after* its own, so it
cannot set headers on the document — an `enhanceMiddleware` hook there looks
correct and silently does nothing. `ready()` therefore times out after 8s
rather than hanging forever, and the library screen shows "Storage
unavailable". **Verify anything storage-backed on the phone, not on web.**

## Recipe import

`lib/import.ts` reads **schema.org/Recipe JSON-LD** — the structured data sites
publish for search engines. Exact, free, no AI. `parseRecipeHtml` is pure, so
test it against saved or live HTML rather than through the UI.

Known truths, measured against 12 live sites:
- Every page that returns HTML parses fully via JSON-LD.
- **Dotdash Meredith sites (Allrecipes, Serious Eats, Simply Recipes) return
  403** to non-browser requests. Not fixable with headers; photo import is the
  answer for those.
- **Attribute values are often unquoted** in minified HTML (`type=application/ld+json`).
  Any regex over HTML here must treat quotes as optional — requiring them
  silently skipped every Yoast-powered blog.
- Import needs a direct cross-origin fetch, so it works on the phone only;
  browsers block it.

## Photo / OCR import

`lib/ocr.ts`. Engine is ML Kit (Android) / Vision (iOS) via
`@react-native-ml-kit/text-recognition` — free, on-device, offline. It is an
**old-architecture module** (no codegenConfig) that works through RN 0.86's
interop layer; check it still links after any SDK bump.

`parseRecipeText` is pure — test it against transcripts, not through the UI.

Lessons from real cookbook pages, all of which cost a wrong result first:
- **Read timings only from labelled line starts.** Scanning the page matched
  prose ("might require baking in batches") ahead of "Bake time:".
- **"Serves" outranks "Yields".** A page can carry both; a meal plan needs
  people fed, not items produced.
- **Parse servings before the noise filter.** That filter drops lone numbers as
  page numbers, which also eats the bare "8" printed under a SERVES heading.
- **A cookbook recipe usually spans a spread.** Reads up to 4 images as one
  recipe, and reports `warnings` rather than saving a half-empty recipe.

## Nutrition estimation

`lib/nutrition.ts` + `lib/foods.json` (4,182 USDA SR Legacy cooking foods,
public domain, with USDA's measured cup/tbsp/tsp/each gram weights). Pure and
offline — test it in node, not through the UI. Published nutrition always wins;
estimates run only when a source gave none, and are skipped below 50% coverage.

Matching rules learned the hard way, each from a wrong answer:
- **USDA descriptions read "Category, food, qualifier".** Identity spans the
  *first two* comma segments — "Spices, caraway seed", "Leavening agents,
  baking powder". Matching only segment one misses every spice and broth.
- **Penalise candidate words the recipe never asked for**, weighted far higher
  before the first comma than after. Without it "vegetable broth" matches
  "Fish broth"; with it applied evenly, "olive oil" matches nothing.
- **An unrequested cooking method is a real difference**, not a wording quirk —
  "Onions, yellow, sauteed" carries the oil it was cooked in.
- **Ambiguous staples get an explicit alias** (`ALIASES`). Nothing in the data
  says "flour" means wheat rather than carob or soy.
- **Parse fractions before leading integers.** "1/2" parsed as 1 for a while,
  silently doubling every fractional ingredient.

Benchmark: Love & Lemons lentil soup publishes 264 cal/serving; we estimate
281 (+6%). Re-check that after any scoring change.

## Meal planning

`lib/plan.ts` (pure, testable in node) + `meal_plan_entries` in `db.ts`.

- **Keyed by date, no "week" table.** A week is just a range, so nothing
  breaks at a boundary and a plan can be any length.
- **Two modes.** `prep` cooks a few batches and spreads them over contiguous
  days; `daily` picks a different recipe per slot. Leftovers share the cooked
  meal's `batch_id`, which is what lets the grocery list buy ingredients once
  per batch instead of once per serving.
- **Never use `toISOString()` for plan dates** — it shifts the day for anyone
  west of Greenwich. `toISODate()` builds from local calendar parts.
- Day totals multiply per-serving nutrition by servings; that number has to
  agree with the diary and the Health tab.

## Grocery list

`lib/grocery.ts` (pure) + `grocery_items` in `db.ts`.

- **Scale, then batch, then merge** — in that order. `servingsByRecipe()` sums
  a batch's servings into one scaling of the recipe; getting this wrong buys
  seven times too much for a prep week.
- **Merge in the unit of the largest contribution**, not a base unit. "1 lb +
  8 oz" must read 1.5 lb, never 680 g.
- **Never combine across unit families.** "500 g + 2 tbsp" is honest; averaging
  them is not. No quantity at all shows "to taste".
- Aisles come from the USDA category the nutrition matcher already resolves,
  so there is no second food taxonomy to maintain.
- `replacePlanGrocery()` preserves ticks by `item_key` and leaves manual items
  alone — rebuilding after a plan change must not undo a half-done shop.

## Diary and settings

`diary_entries` + `app_settings` in `db.ts`.

- **Diary entries snapshot their nutrition.** Never join a diary row back to
  the recipe for its calories: editing or deleting a recipe would rewrite
  history that already happened.
- `app_settings` is the key/value store for small preferences.
  `calorie_target` drives both the Diary and Health Today; `theme_mode`
  persists the light/dark choice.
- **Health Today shows a dash for anything not yet measured** (burn, steps,
  HR, weight). Do not substitute plausible numbers — that screen exists to get
  calories in vs. out right, and a fake burn corrupts exactly that.

**Web storage does not survive a Metro restart.** expo-sqlite on web is
memory-backed, so test data vanishes when the dev server restarts. Native is a
real file and unaffected. Re-seed rather than assuming a persistence bug.

## Status

- [x] Phase 0 — shell: three worlds, drawer, tabs, theming.
      Built, installed, on GitHub, EAS Update wired.
- [x] Phase 1 — recipe library: SQLite, add/view/edit/delete, rating,
      favourites, photos, search, sort, tags.
- [x] Phase 2a — import from a pasted link (`lib/import.ts`)
- [x] Phase 2b — photo / screenshot import (`lib/ocr.ts`), multi-page
- [ ] Phase 2c — in-app browser "browse & grab"
- [x] Phase 3 — nutrition estimation (cost waits on Meijer data, Phase 7)
- [x] Meal planning — prep vs daily modes, add-to-plan, day totals
- [x] Grocery list from a plan — batch-aware, merged, aisle-grouped
- [x] Diary logging + Health tab reading real data; theme now persists
- [ ] Next: Health Connect (Phase 8) to make 'Burned' real, then the adaptive budget
- [ ] Phases 4-11 — see `../HEALTH-APP-PLAN.md`
