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
  /**
   * Fitness owns its whole palette, not just an accent.
   *
   * Borrowing Nutrition's warm cream paper and warm beige rules and then
   * putting a cool accent on top was the reason the section never looked
   * settled: the ground and the accent were at different temperatures. This
   * world gets concrete-grey paper, cool neutral rules and one warm accent.
   */
  fitPaper: string;
  fitText: string;
  fitTextSoft: string;
  fitTextFaint: string;
  fitLine: string;
  fitTrack: string;
  /** The spine down the left edge. Dark in both themes. */
  fitInk: string;
  fitInkSoft: string;
  fitRule: string;
  fitDim: string;
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
  surface: '#FFFDF9',
  card: '#FFFFFF',
  cardAlt: '#F4EFE4',
  line: '#E2D9C8',
  track: '#EAE2D3',

  ink: '#1E1913',
  inkSoft: '#645B4C',
  inkFaint: '#9C927F',

  nut: '#C8102E',
  nutSoft: '#FBE9EB',
  fit: '#CC4E14',
  fitSoft: '#F6E7DF',
  fitPaper: '#F0F0ED',
  fitText: '#16171A',
  fitTextSoft: '#5C5F65',
  fitTextFaint: '#9B9EA4',
  fitLine: '#D9D9D4',
  fitTrack: '#E1E1DC',
  fitInk: '#17181B',
  fitInkSoft: '#232529',
  fitRule: '#2E3035',
  fitDim: '#85888E',
  hlth: '#5B3E96',
  hlthSoft: '#EDE8F6',

  info: '#1F6FB2',
  infoSoft: '#E6F0F8',
  gold: '#E09B00',
  goldSoft: '#FCF2DC',
  danger: '#C8102E',
  dangerSoft: '#FBE9EB',
  ok: '#1E7A4C',

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
  surface: '#15120E',
  card: '#1E1A14',
  cardAlt: '#282219',
  line: '#332C21',
  track: '#332C21',

  ink: '#F5EEE1',
  inkSoft: '#AA9F8A',
  inkFaint: '#7B7160',

  nut: '#FF4D5E',
  nutSoft: '#3A1319',
  fit: '#FF7A33',
  fitSoft: '#2A1710',
  fitPaper: '#111214',
  fitText: '#ECECEA',
  fitTextSoft: '#9B9EA4',
  fitTextFaint: '#6E7178',
  fitLine: '#24262A',
  fitTrack: '#202226',
  fitInk: '#08090A',
  fitInkSoft: '#17181B',
  fitRule: '#26282C',
  fitDim: '#7B7E84',
  hlth: '#9B7BE8',
  hlthSoft: '#221B33',

  info: '#4E9EDA',
  infoSoft: '#132330',
  gold: '#F0B429',
  goldSoft: '#2E2412',
  danger: '#FF4D5E',
  dangerSoft: '#3A1319',
  ok: '#35B87A',

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

  // --- Fitness only ---------------------------------------------------------
  // Fitness is deliberately a different typeface from Nutrition. Sharing one
  // family across both was the main reason the two worlds felt like tabs of the
  // same generated app rather than two tools that talk to each other.
  // Archivo is a squared-off grotesque with lowercase, replacing Bebas Neue.
  // Bebas has no lowercase at all, so every label, heading and session name on
  // the screen was set in caps and the whole section read as shouting.
  fitDisplay: 'Archivo_700Bold',
  fitDisplayHeavy: 'Archivo_800ExtraBold',
  fitLabel: 'Archivo_600SemiBold',
  fitBody: 'Archivo_500Medium',
  /** Every figure. Monospaced digits are what make the columns line up. */
  fitMono: 'DMMono_400Regular',
  fitMonoMed: 'DMMono_500Medium',
  fitMonoLight: 'DMMono_300Light',
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
