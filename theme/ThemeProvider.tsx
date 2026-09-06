import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import { getSetting, setSetting } from '../lib/db';
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

const MODES: ThemeMode[] = ['light', 'dark', 'system'];

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  // Restore the saved choice. Failing to read it is not worth surfacing —
  // 'system' is a reasonable default and the app must still start.
  useEffect(() => {
    let alive = true;
    getSetting('theme_mode')
      .then((saved) => {
        if (alive && saved && (MODES as string[]).includes(saved)) setModeState(saved as ThemeMode);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const setMode = React.useCallback((m: ThemeMode) => {
    setModeState(m);
    setSetting('theme_mode', m).catch(() => {});
  }, []);

  const resolved: ThemeName = mode === 'system' ? (system === 'dark' ? 'dark' : 'light') : mode;

  const value = useMemo<ThemeValue>(
    () => ({ c: palettes[resolved], resolved, mode, setMode, fonts, radius, space }),
    [resolved, mode, setMode]
  );

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme(): ThemeValue {
  const v = useContext(ThemeCtx);
  if (!v) throw new Error('useTheme must be used inside <ThemeProvider>');
  return v;
}
