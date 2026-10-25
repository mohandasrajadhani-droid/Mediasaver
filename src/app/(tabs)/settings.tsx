import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Card } from '../../components/ui';
import { useAppTheme, type ThemeMode } from '../../theme/ThemeProvider';

const MODES: { mode: ThemeMode; label: string; icon: 'phone-portrait-outline' | 'sunny-outline' | 'moon-outline' }[] = [
  { mode: 'system', label: 'Match phone', icon: 'phone-portrait-outline' },
  { mode: 'light', label: 'Light', icon: 'sunny-outline' },
  { mode: 'dark', label: 'Dark', icon: 'moon-outline' },
];

export default function SettingsScreen() {
  const { colors, mode, setMode } = useAppTheme();
  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={s.content}>
      <Card>
        <Text style={[s.title, { color: colors.text }]}>Appearance</Text>
        <View style={{ gap: 8 }} accessibilityRole="radiogroup">
          {MODES.map((m) => {
            const on = m.mode === mode;
            return (
              <Pressable
                key={m.mode}
                onPress={() => setMode(m.mode)}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                style={[s.option, { borderColor: on ? colors.accent : colors.border, backgroundColor: on ? colors.accentSoft : 'transparent' }]}
              >
                <Ionicons name={m.icon} size={20} color={on ? colors.accent : colors.textMuted} />
                <Text style={{ color: colors.text, fontSize: 15, flex: 1 }}>{m.label}</Text>
                {on ? <Ionicons name="checkmark" size={20} color={colors.accent} /> : null}
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card>
        <Text style={[s.title, { color: colors.text }]}>Downloading responsibly</Text>
        <Text style={[s.body, { color: colors.textMuted }]}>
          MediaSaver only downloads files that a source openly offers: direct file links you own or have permission to use,
          and items from sources like the Internet Archive. It never bypasses DRM, logins, paywalls or platform restrictions,
          and it does not extract audio or video from YouTube or other streaming services.
        </Text>
        <Text style={[s.body, { color: colors.textMuted }]}>
          Files are stored inside the app. Use the folder button on a download to copy it to a folder such as Download or Music.
        </Text>
      </Card>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  content: { padding: 16, gap: 16 },
  title: { fontSize: 16, fontWeight: '700' },
  body: { fontSize: 14, lineHeight: 21 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, borderWidth: 1.5 },
});
