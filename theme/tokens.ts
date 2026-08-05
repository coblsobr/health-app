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
  surface: '#F7F9FC',
  card: '#FFFFFF',
  cardAlt: '#EFF3F9',
  line: '#E4EAF2',
  track: '#E7EDF5',

  ink: '#131A26',
  inkSoft: '#5A667A',
  inkFaint: '#8E9AAC',

  nut: '#FF5C39',
  nutSoft: '#FFEDE7',
  fit: '#12C97E',
  fitSoft: '#E1FAF0',
  hlth: '#7C5CFF',
  hlthSoft: '#EFEBFF',

  info: '#2BA8FF',
  infoSoft: '#E4F3FF',
  gold: '#FFA820',
  goldSoft: '#FFF3DC',
  danger: '#F0475E',
  dangerSoft: '#FFE9EC',
  ok: '#12B76A',

  tagA: ['#E4F8EC', '#0E8A52'],
  tagB: ['#DDF6F2', '#0C8478'],
  tagC: ['#E4F1FF', '#1F73C4'],
  tagD: ['#FFEEE2', '#C2570F'],
  tagE: ['#EFEAFF', '#6741D9'],
  tagF: ['#FFF3D9', '#A87503'],

  g1: ['#FF9A6B', '#FF5C39'],
  g2: ['#5BE3AE', '#12C97E'],
  g3: ['#FFD066', '#FFA820'],
  g4: ['#FF9B8A', '#F0475E'],
  g5: ['#78CCFF', '#2BA8FF'],
  g6: ['#B49CFF', '#7C5CFF'],

  scrim: 'rgba(6,10,16,0.55)',
  shadow: '#172B4D',
  mapBg: '#E8EEF6',
  mapGrid: 'rgba(90,110,140,0.16)',
};

export const dark: Palette = {
  surface: '#0F141C',
  card: '#1A222E',
  cardAlt: '#232D3B',
  line: '#28323F',
  track: '#28323F',

  ink: '#EDF2FA',
  inkSoft: '#9AA8BC',
  inkFaint: '#6C7A8E',

  nut: '#FF7154',
  nutSoft: '#3C1F17',
  fit: '#2EDC94',
  fitSoft: '#0F3227',
  hlth: '#9B84FF',
  hlthSoft: '#241E42',

  info: '#4DB8FF',
  infoSoft: '#0F2B3E',
  gold: '#FFC44D',
  goldSoft: '#372814',
  danger: '#FF6B7E',
  dangerSoft: '#3B1C23',
  ok: '#2EDC94',

  tagA: ['#123021', '#4ADE80'],
  tagB: ['#0F2E2C', '#45D6C6'],
  tagC: ['#12283F', '#68B6F7'],
  tagD: ['#3B2415', '#FF9A5B'],
  tagE: ['#241E42', '#AC93FF'],
  tagF: ['#372814', '#FFC44D'],

  g1: ['#E2724A', '#C6401F'],
  g2: ['#33BC86', '#0E8C58'],
  g3: ['#E0AA45', '#C07C12'],
  g4: ['#D9705F', '#B32F45'],
  g5: ['#4F9AD1', '#1B76B8'],
  g6: ['#8570D6', '#5D42C4'],

  scrim: 'rgba(0,0,0,0.6)',
  shadow: '#000000',
  mapBg: '#18202B',
  mapGrid: 'rgba(255,255,255,0.07)',
};

export const palettes: Record<ThemeName, Palette> = { light, dark };

/** Outfit for headings + numbers, Inter for everything else. */
export const fonts = {
  display: 'Outfit_600SemiBold',
  displayBold: 'Outfit_700Bold',
  body: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semi: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
};

/** Shared spacing / radius scale — identical across themes. */
export const radius = { sm: 8, md: 12, lg: 16, xl: 20, pill: 30 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
