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

## Status

- [x] Phase 0 — shell: three worlds, drawer, tabs, theming. Screens are static.
- [ ] Phase 1 — recipe library (SQLite, CRUD, tags)
- [ ] Phase 2 — imports (browser grab, link, photo OCR)
- [ ] Phases 3-11 — see `../HEALTH-APP-PLAN.md`
