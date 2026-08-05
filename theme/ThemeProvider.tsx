import React, { createContext, useContext, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { palettes, fonts, radius, space, type Palette, type ThemeName } from './tokens';

export type ThemeMode = 'light' | 'dark' | 'system';

type ThemeValue = {
  c: Palette;
  /** The theme actually being shown right now. */
  resolved: ThemeName;
  /** What the user picked — 'system' follows the phone. */
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
  fonts: typeof fonts;
  radius: typeof radius;
  space: typeof space;
};

const ThemeCtx = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [mode, setMode] = useState<ThemeMode>('system');

  const resolved: ThemeName = mode === 'system' ? (system === 'dark' ? 'dark' : 'light') : mode;

  const value = useMemo<ThemeValue>(
    () => ({ c: palettes[resolved], resolved, mode, setMode, fonts, radius, space }),
    [resolved, mode]
  );

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme(): ThemeValue {
  const v = useContext(ThemeCtx);
  if (!v) throw new Error('useTheme must be used inside <ThemeProvider>');
  return v;
}
