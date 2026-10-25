/** Small reusable building blocks so every screen looks consistent. */
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useAppTheme } from '../theme/ThemeProvider';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, style]}>{children}</View>
  );
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  label,
  onPress,
  icon,
  variant = 'primary',
  disabled,
  loading,
  compact,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  icon?: IconName;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  compact?: boolean;
  accessibilityLabel?: string;
}) {
  const { colors } = useAppTheme();
  const bg =
    variant === 'primary' ? colors.accent : variant === 'secondary' ? colors.surfaceAlt : variant === 'danger' ? colors.dangerSoft : 'transparent';
  const fg =
    variant === 'primary' ? colors.accentText : variant === 'danger' ? colors.danger : colors.text;
  const off = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        { backgroundColor: bg, opacity: off ? 0.5 : pressed ? 0.8 : 1 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} size="small" />
      ) : icon ? (
        <Ionicons name={icon} size={compact ? 16 : 18} color={fg} />
      ) : null}
      {label ? <Text style={[styles.buttonText, compact && { fontSize: 13 }, { color: fg }]}>{label}</Text> : null}
    </Pressable>
  );
}

export function IconButton({
  icon,
  onPress,
  label,
  color,
}: {
  icon: IconName;
  onPress: () => void;
  label: string;
  color?: string;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.iconButton, { backgroundColor: colors.surfaceAlt, opacity: pressed ? 0.7 : 1 }]}
    >
      <Ionicons name={icon} size={18} color={color ?? colors.text} />
    </Pressable>
  );
}

export function ProgressBar({ ratio }: { ratio: number | null }) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.track, { backgroundColor: colors.surfaceAlt }]}>
      <View
        style={[
          styles.fill,
          { backgroundColor: colors.accent, width: ratio == null ? '30%' : `${Math.round(ratio * 100)}%` },
          ratio == null && { opacity: 0.5 },
        ]}
      />
    </View>
  );
}

export function Badge({ text, tone = 'neutral' }: { text: string; tone?: 'neutral' | 'accent' | 'success' | 'danger' | 'warning' }) {
  const { colors } = useAppTheme();
  const map = {
    neutral: [colors.surfaceAlt, colors.textMuted],
    accent: [colors.accentSoft, colors.accent],
    success: [colors.successSoft, colors.success],
    danger: [colors.dangerSoft, colors.danger],
    warning: [colors.warningSoft, colors.warning],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: fg }]}>{text}</Text>
    </View>
  );
}

export function Notice({ tone, icon, title, children }: { tone: 'danger' | 'warning' | 'success'; icon: IconName; title: string; children?: ReactNode }) {
  const { colors } = useAppTheme();
  const bg = tone === 'danger' ? colors.dangerSoft : tone === 'warning' ? colors.warningSoft : colors.successSoft;
  const fg = tone === 'danger' ? colors.danger : tone === 'warning' ? colors.warning : colors.success;
  return (
    <View style={[styles.notice, { backgroundColor: bg }]} accessibilityRole="alert">
      <Ionicons name={icon} size={20} color={fg} style={{ marginTop: 1 }} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={[styles.noticeTitle, { color: fg }]}>{title}</Text>
        {children}
      </View>
    </View>
  );
}

export const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 12 },
  button: {
    minHeight: 48,
    borderRadius: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonCompact: { minHeight: 36, paddingHorizontal: 12, borderRadius: 10 },
  buttonText: { fontSize: 15, fontWeight: '600' },
  iconButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-start' },
  badgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
  notice: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: 12 },
  noticeTitle: { fontSize: 15, fontWeight: '700' },
});
