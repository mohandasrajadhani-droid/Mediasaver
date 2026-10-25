/** Root layout: theme provider + a stack that holds the tabs and the player. */
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { refreshMissingFiles } from '../download/downloadManager';
import { useLibrary } from '../library/store';
import { AppThemeProvider, useAppTheme } from '../theme/ThemeProvider';

function Navigation() {
  const { colors, isDark } = useAppTheme();
  const hydrated = useLibrary((s) => s.hydrated);

  // Once the saved library is loaded, flag any files deleted outside the app.
  useEffect(() => {
    if (hydrated) refreshMissingFiles();
  }, [hydrated]);

  const base = isDark ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: { ...base.colors, background: colors.bg, card: colors.surface, text: colors.text, border: colors.border, primary: colors.accent },
  };

  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="player/[id]" options={{ title: 'Player', presentation: 'modal' }} />
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AppThemeProvider>
      <Navigation />
    </AppThemeProvider>
  );
}
