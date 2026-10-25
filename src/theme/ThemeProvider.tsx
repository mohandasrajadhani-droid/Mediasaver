/**
 * Light / dark theme. "System" follows the phone's setting; the user can
 * override it in Settings. The choice is saved with AsyncStorage.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

export type ThemeMode = 'system' | 'light' | 'dark';

const light = {
  bg: '#F6F5F2',
  surface: '#FFFFFF',
  surfaceAlt: '#EFEDE8',
  border: '#E2DFD8',
  text: '#16181D',
  textMuted: '#6B6F78',
  accent: '#E8590C',
  accentText: '#FFFFFF',
  accentSoft: '#FDE8DC',
  success: '#1F8A5B',
  successSoft: '#DDF3E8',
  danger: '#C92A2A',
  dangerSoft: '#FBE3E3',
  warning: '#B7791F',
  warningSoft: '#FCF0D9',
};

const dark: typeof light = {
  bg: '#111317',
  surface: '#1A1D23',
  surfaceAlt: '#23272F',
  border: '#2C313A',
  text: '#F2F1EE',
  textMuted: '#9AA0AA',
  accent: '#FF7A33',
  accentText: '#16181D',
  accentSoft: '#3A2418',
  success: '#4CC38A',
  successSoft: '#17322A',
  danger: '#FF6B6B',
  dangerSoft: '#3A1D1F',
  warning: '#F2B544',
  warningSoft: '#352B17',
};

export type Colors = typeof light;

interface ThemeValue {
  colors: Colors;
  isDark: boolean;
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);
const KEY = 'mediasaver-theme-mode';

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => {
        if (v === 'light' || v === 'dark' || v === 'system') setModeState(v);
      })
      .catch(() => {});
  }, []);

  const value = useMemo<ThemeValue>(() => {
    const isDark = mode === 'system' ? system === 'dark' : mode === 'dark';
    return {
      colors: isDark ? dark : light,
      isDark,
      mode,
      setMode: (m) => {
        setModeState(m);
        AsyncStorage.setItem(KEY, m).catch(() => {});
      },
    };
  }, [mode, system]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme(): ThemeValue {
  const v = useContext(ThemeContext);
  if (!v) throw new Error('useAppTheme must be used inside AppThemeProvider');
  return v;
}
