import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { isActive } from '../../download/downloadManager';
import { useLibrary } from '../../library/store';
import { useAppTheme } from '../../theme/ThemeProvider';

export default function TabsLayout() {
  const { colors } = useAppTheme();
  const activeCount = useLibrary((s) => s.items.filter(isActive).length);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        headerStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
        headerTitleStyle: { color: colors.text, fontWeight: '700' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'MediaSaver',
          tabBarLabel: 'Get',
          tabBarIcon: ({ color, size }) => <Ionicons name="link" color={color as string} size={size} />,
        }}
      />
      <Tabs.Screen
        name="downloads"
        options={{
          title: 'Downloads',
          tabBarBadge: activeCount > 0 ? activeCount : undefined,
          tabBarIcon: ({ color, size }) => <Ionicons name="download" color={color as string} size={size} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" color={color as string} size={size} />,
        }}
      />
    </Tabs>
  );
}
