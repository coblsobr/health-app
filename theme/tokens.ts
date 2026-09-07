/**
 * Colour tokens — one semantic name, two value sets.
 *
 * Components must never reference a raw hex. Always go through `useTheme()`.
 * Adding a third theme later means adding a third object here, nothing else.
 */

export type ThemeName = 'light' | 'dark';

export type Palette = {
  // surfaces
  surface: string;
  card: string;
  cardAlt: string;
  line: string;
  track: string;
  // text
  ink: string;
  inkSoft: string;
  inkFaint: string;
  // the three worlds
  nut: string;
  nutSoft: string;
  fit: string;
  fitSoft: string;
  hlth: string;
  hlthSoft: string;
  // supporting
  info: string;
  infoSoft: string;
  gold: string;
  goldSoft: string;
  danger: string;
  dangerSoft: string;
  ok: string;
  // tag pairs (bg / fg)
  tagA: [string, string]; // green  — vegetarian
  tagB: [string, string]; // teal   — vegan
  tagC: [string, string]; // blue   — low sodium
  tagD: [string, string]; // orange — anti-inflammatory
  tagE: [string, string]; // violet — high protein
  tagF: [string, string]; // gold   — gluten free
  // photo placeholder gradients
  g1: [string, string];
  g2: [string, string];
  g3: [string, string];
  g4: [string, string];
  g5: [string, string];
  g6: [string, string];
  // misc
  scrim: string;
  shadow: string;
  mapBg: string;
  mapGrid: string;
};

export const light: Palette = {
  surface: '#FAF5EC',
  card: '#FFFDF8',
  cardAlt: '#F1EADC',
  line: '#E0D6C3',
  track: '#E6DCCA',

  ink: '#221C14',
  inkSoft: '#6A5F4E',
  inkFaint: '#A3977F',

  nut: '#A8352B',
  nutSoft: '#F5E6E1',
  fit: '#5A6E43',
  fitSoft: '#EBEFE1',
  hlth: '#7A4A56',
  hlthSoft: '#F3EAEC',

  info: '#41627A',
  infoSoft: '#E7EDF1',
  gold: '#B27A22',
  goldSoft: '#F7EED9',
  danger: '#98302A',
  dangerSoft: '#F7E7E4',
  ok: '#5A6E43',

  tagA: ['#ECF0E8', '#4C6541'],
  tagB: ['#E7F0EE', '#3F6B62'],
  tagC: ['#E9EEF3', '#3D5C75'],
  tagD: ['#F6EBE7', '#96432B'],
  tagE: ['#F3ECF0', '#6B4A5C'],
  tagF: ['#F7F0E1', '#8A6620'],

  g1: ['#D98C6A', '#B3452C'],
  g2: ['#9DB88C', '#5F7A52'],
  g3: ['#E0BC72', '#B8862F'],
  g4: ['#D69A8C', '#A33A2C'],
  g5: ['#94AEC4', '#4A6B85'],
  g6: ['#B79BAA', '#7A5568'],

  scrim: 'rgba(26,23,20,0.42)',
  shadow: '#4A3B26',
  mapBg: '#EDE4D3',
  mapGrid: 'rgba(120,105,88,0.14)',
};

export const dark: Palette = {
  surface: '#17130E',
  card: '#1F1A13',
  cardAlt: '#292217',
  line: '#332B1F',
  track: '#332B1F',

  ink: '#F2EADB',
  inkSoft: '#A99B84',
  inkFaint: '#7A6E5A',

  nut: '#D95F4C',
  nutSoft: '#33201B',
  fit: '#8FA173',
  fitSoft: '#1E2417',
  hlth: '#BC8F9B',
  hlthSoft: '#2A1F22',

  info: '#7FA0B8',
  infoSoft: '#1A242B',
  gold: '#D9A94E',
  goldSoft: '#2E2515',
  danger: '#D96B5C',
  dangerSoft: '#331D19',
  ok: '#8FA173',

  tagA: ['#1B2418', '#9BBA8A'],
  tagB: ['#152220', '#7FB3A8'],
  tagC: ['#182229', '#8FB2CC'],
  tagD: ['#2E1D18', '#D9836A'],
  tagE: ['#251C21', '#C09CB0'],
  tagF: ['#2A2116', '#D9B36A'],

  g1: ['#A85A3E', '#7A3520'],
  g2: ['#6E8A5F', '#425738'],
  g3: ['#A8823C', '#75581F'],
  g4: ['#A85A4C', '#75281F'],
  g5: ['#5A7994', '#36485A'],
  g6: ['#7E6070', '#54394A'],

  scrim: 'rgba(0,0,0,0.6)',
  shadow: '#000000',
  mapBg: '#221D16',
  mapGrid: 'rgba(255,255,255,0.06)',
};

export const palettes: Record<ThemeName, Palette> = { light, dark };

/**
 * A serif with character over a quiet grotesque. The previous pairing
 * (geometric sans + Inter) is the default look of generated UI; Fraunces has
 * an actual voice, which is what the screens were missing.
 */
export const fonts = {
  display: 'Fraunces_600SemiBold',
  displayBold: 'Fraunces_700Bold',
  /** Flourishes: a caption under a title, a unit after a figure. */
  displayItalic: 'Fraunces_600SemiBold_Italic',
  /** Handwriting, used sparingly — a margin note, never body copy. */
  script: 'Caveat_600SemiBold',
  body: 'AlbertSans_400Regular',
  medium: 'AlbertSans_500Medium',
  semi: 'AlbertSans_600SemiBold',
  bold: 'AlbertSans_700Bold',
};

/**
 * A scale with real contrast. The old set ran 9.5-20px, which is exactly why
 * every screen read at one volume: a designed page has a loud voice and a
 * quiet one, not six middling ones.
 */
export const type = {
  hero: 46,     // the single number a screen exists to show
  title: 26,
  section: 17,
  body: 14,
  small: 12,
  micro: 10.5,
};

/** Shared spacing / radius scale — identical across themes. */
export const radius = { sm: 8, md: 12, lg: 16, xl: 20, pill: 30 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
