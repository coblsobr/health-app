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

## Shipping — read this before publishing

The APK is built on channel **`preview`**, and that channel is mapped to the
**`main`** branch. Always `eas update --branch main --environment production`.

**Publishing to a branch no channel points at succeeds, prints a green tick,
and reaches no phone.** It cost a whole session of work that never left the
laptop, so verify the mapping with `eas channel:view preview`, not just
`eas update:list`.

Native changes (a new native module, an SDK bump) change the fingerprint
runtimeVersion and cannot ship over the air — they need a new APK, and the
phone stays on its last compatible update until that is installed.

## Right now: Recipes is the app

`app/recipes.tsx` is the landing screen and the only one being worked on. It is
deliberately three things — the recipes, a photos/names toggle in the
bottom-left corner, and one Add button — and nothing else. **Do not add a
search field, a sort control, a filter strip, a tab bar or a summary line to
it.** Every one of those was there before and every one of them was scaffolding
around a library holding three recipes.

ADD toggles three small cells directly above it — Hand (`/recipe/new`),
Camera (`/recipe/scan`), Web (`/recipe/import`). **Not a bottom sheet.** A
titled panel with full-width labelled rows, hint text under each and a scrim
behind it was four times the furniture this needs.

Camera opens straight into a live viewfinder (`components/PageCamera.tsx`,
expo-camera): shutter in the middle, gallery in the bottom-left corner, close
top-left. It does **not** hand off to the system camera app, and there is no
intermediate form asking again what you already chose. `takePictureAsync` must
wait for `onCameraReady` — called earlier it returns a blank frame on Android.

**Two framed shots, not one page.** Shot 1 is the ingredients, shot 2 the
directions, each fitted inside a guide rectangle the way a bank frames a
cheque. This is the important design decision in the whole scan path: reading
a full page and working out which lines are ingredients and which are method
is the least reliable thing the app does, and on-device OCR is nowhere near
good enough for it. Framing tells the parser what it is looking at.

- `GUIDE` in `lib/ocr.ts` is shared by the overlay and the region filter, so
  the rectangle drawn and the rectangle filtered against cannot drift apart.
- ML Kit returns a `frame` per line, so filtering to the guide is arithmetic —
  no cropping library, no native module, ships over the air.
- `linesInRegion` returns **null** rather than a short list when filtering
  would leave almost nothing, and the caller falls back to the full text. The
  preview and the capture do not always cover the same field of view, and a
  silently dropped ingredient is far worse than a stray line you can see and
  delete. The guide is also widened by `REGION_SLACK` for the same reason.
- Ingredients use `mergeIngredientWraps`, **not** `mergeWrappedLines`. The
  prose version joins any lowercase line to a previous line lacking end
  punctuation — correct for method, catastrophic for a list, where it merges
  "1 onion, diced" with "salt and pepper" and loses the salt. Only an explicit
  dangling ending (a comma, or a word like "into"/"with") counts as a wrap.
- The recipe **name** is deliberately left blank: the frame is around the list,
  not the title. A visible blank the user fills in beats a confident wrong guess.

**Gallery photos are framed too**, with `components/CropFrame.tsx` — drag a
rectangle over the photo instead of through a viewfinder. One photo carrying
both halves gets two rectangles drawn on it; two photos get one each. The
rectangle becomes the shot's `region`, so a crop and a camera guide are the
same thing to the parser and nothing is cropped in the image sense.

- A `Shot` without a `region` is read **whole**. That is the honest fallback
  for a photo nobody framed, and it is what "Use the whole photo" does.
- `linesInRegion` widens the camera's `GUIDE` by `REGION_SLACK` but a dragged
  rectangle by almost nothing: the preview and the capture can disagree about
  the field of view, whereas a dragged rectangle is exactly where the user put
  it, and widening it would pull back the lines they meant to exclude.
- `CropFrame` reads live state through refs inside its PanResponder handlers.
  The handlers are created once, so closing over the first render's state
  freezes the rectangle after a single drag.
- Testing drag on the web preview needs **touch** events, not mouse events —
  the mobile viewport puts react-native-web in touch mode and synthetic
  MouseEvents are never translated. That is why a drag looks like it does
  nothing when you simulate it wrong; check with touch before assuming a bug.

Nutrition, Fitness and Health still exist and still work; they are reachable
from the drawer and are not being developed. Do not restyle them.

## Two worlds, two design languages

Nutrition and Fitness are deliberately **not** the same app with a different
accent colour. They share the drawer, the theme system and the database; they
share nothing visually. Read the section for the world you are editing and do
not carry a primitive across the boundary.

| | Nutrition (and Health) | Fitness |
|---|---|---|
| Idea | a cookbook | a training logbook |
| Chrome | filled section-coloured app bar, centred title | black spine down the left edge, no bar |
| Nav | bottom tabs | numbered rail in the spine |
| Type | Fraunces + Albert Sans | Archivo + DM Mono |
| Ground | warm cream `#FFFDF9` | concrete grey `fitPaper`, its own ink and rules |
| Colour | red on cream | burnt orange `#CC4E14`, charcoal spine |
| Shapes | photos, rules, the odd card | hairline rules only, no cards at all |
| Figures | serif, in place | monospace, right-aligned in one column |
| Primitives | `components/ui.tsx`, `Screen` | `components/fit.tsx`, `fitChrome.tsx` |

## Fitness — the logbook

Every rule here is a reaction to a specific complaint: *"a centred number at the
top, selection buttons at the bottom, a chart, and all that spaced out — that's
how every single app made with Claude looks."*

- **No cards.** Rows sit on the page ground, divided by full-bleed hairlines.
- **No centred hero figure.** The number a screen exists to show goes at the end
  of a line, in the same right-hand column as every other number.
- **No standalone chart panel.** A magnitude is a bar *inside* its row, so the
  chart and the table are one object.
- **No segmented control and no bottom bar.** Period switching is `<Switcher>`,
  small caps sitting on the right of a column head. Section switching is the
  rail. Both were pill-row shapes; both are gone.
- **Every block must look different from the block above it.** This is the
  rule that matters most, and the one that took three tries to get right. A run
  of sections that share a heading, a rule and a row height fails exactly the
  way a run of cards fails: nothing is louder than anything else, so the eye
  finds no hierarchy and reads all of it as noise. A screen gets **one**
  `<Statement>`, **one** `<MetaLine>`, **one** list, **one** `<Aside>`.
- **Say less.** Three or four facts per screen. Anything secondary goes on the
  MetaLine — steps, active minutes and distance are one line, not three rows.
  If a section needs a fifth block, it probably needs its own screen.
- **Rules belong to lists.** A hairline under every single thing is noise.
- **Figures are monospaced and tabular** (`<Fig>`); words are Archivo (`<T>`).
- **Fitness owns its whole palette**, not just an accent: `fitPaper`,
  `fitText`, `fitTextSoft`, `fitTextFaint`, `fitLine`, `fitTrack`, `fitInk`.
  Never use `c.surface`, `c.ink` or `c.line` on a Fitness screen — borrowing
  Nutrition's warm cream and then putting a cool accent on it is why the
  colours read as mismatched for two passes.
- Primitives: `Statement`, `Bar`, `MetaLine`, `Label`, `Session`, `Aside`,
  `Row`, `Rule`, `Fig`, `T`, `Switcher`, `Note`, `FitBtn`, and
  `FitScreen` / `FitRail` for the chrome.
- The rail navigates with `navigation.dispatch({ ...CommonActions.navigate(route),
  target: state.key })`. **`navigation.navigate()` silently does nothing here** —
  a navigator's own navigation object navigates in its *parent*, so it asked the
  Drawer for a route it does not have. `CommonActions` comes from
  `expo-router/react-navigation`, never from `@react-navigation/*`.
- `tabBarPosition: 'left'` is what makes the navigator lay out in a row.

## Nutrition — cookbook type

Keep these when adding Nutrition or Health screens:

- **Content sits on the page, separated by `<Rule />`.** A `<Card>` is for a
  thing that is genuinely an object. Do not wrap every group in one.
- **Sentence-case serif headings** (`<SectionTitle>`), never uppercase tracked
  labels.
- **No emoji as icons.** Use `components/Icon.tsx`.
- **Each section owns a colour and wears it.** `Screen` fills the app bar with
  the section tone: Nutrition red, Health purple. (Fitness does not use
  `Screen` at all — see above.) Detecting the section is still needed for
  Health.
  Detect the section with **`useSegments()`, never `usePathname()`** — the
  latter strips group segments, so `/(fitness)/today` arrives as `/today`.
- **Saturated, not muted.** Confident colour is what separates a real app from
  the generic minimal look; a desaturated palette reads as generated.
- **Dense over airy.** Generous whitespace everywhere is its own house style.
  Photos and content should carry the screen.
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

Reference implementations: **Library** (photo grid, section chrome) and
**Diary** (typographic page). The rest still use the old card-heavy layout and
get reworked one at a time.

## Theming

One set of semantic tokens, two value sets, in `theme/tokens.ts`. Components
**never** use a raw hex — always `const { c } = useTheme()`.

- `c.nut` red = Nutrition, `c.fit` green = Fitness, `c.hlth` purple = Health
- Adding a third theme = a third object in `tokens.ts`, nothing else
- Light/Dark/System lives in `app/settings.tsx`, and **is persisted** via
  `app_settings.theme_mode`

## Layout

```
app/
  _layout.tsx        Drawer + fonts + ThemeProvider
  index.tsx          redirect -> /(nutrition)/diary
  (nutrition)/       diary · library · add · plan · shop
  (fitness)/         today · history · log · plan · progress
  (health)/          today · goals · trends
  profile · settings · account
components/          Screen (section chrome), ui (kit), Icon, Ring, tabBar,
                     RecipeForm, UpdatePanel
lib/                 db.ts (SQLite + all queries), import.ts (link),
                     ocr.ts (photo), nutrition.ts + foods.json (USDA),
                     plan.ts (meal plan), grocery.ts, health/ (parked)
theme/               tokens.ts, ThemeProvider.tsx
```

`components/ui.tsx` is the kit. Prefer the newer primitives — `Rule`,
`SectionTitle`, `Hero`, `Meter`, `LineItem`, `TextAction`, `Eyebrow`,
`DoubleRule`, `Caption`, `ScriptNote`, `Ornament` — over the older card-era set
(`Card`, `Ch`, `Btn`, `Tile`, `Prog`, `Toast`), which survives only on screens
not yet reworked.

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

Full history and the ordered next steps live in `../HEALTH-APP-PLAN.md` §11.
Short version:

**Working end to end:** import a recipe (link or photo) → nutrition estimated →
plan a week (batch prep or daily) → grocery list scaled and merged → log what
you ate → Health tab counts it.

**Parked:** Health Connect. `lib/health/` has a finished provider behind a
platform interface, but `react-native-health-connect` is uninstalled (it
changes the runtime fingerprint) and nothing imports it. Resuming needs the
package, its config plugin, wiring, and a new APK.

**Next:** finish the design rework (Recipe detail → Plan/Shop → Fitness world),
then Health Connect, then browse-&-grab import.

**Shipping:** current APK runtime is `71e5137ee23f4d4e7ae79059bed33193a12dcbb9`.
JS-only changes match it and ship over the air. Check with
`npx expo-updates fingerprint:generate --platform android` *before* publishing,
and confirm with `eas update:list` afterwards — a mismatched publish succeeds
silently and never reaches the phone.
