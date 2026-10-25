/**
 * Shows the result of checking a link:
 *  - blocked     → why, plus the official way (e.g. "Open in YouTube")
 *  - unsupported → plain-language reason
 *  - ready       → pick format + quality, confirm permission, download
 */
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import type { MediaOption, SourceCheck } from '../sources/types';
import { useAppTheme } from '../theme/ThemeProvider';
import { Badge, Button, Card, Notice } from './ui';

interface Props {
  result: SourceCheck;
  busy: boolean;
  onDownload: (option: MediaOption) => void;
}

export function SourceResult({ result, busy, onDownload }: Props) {
  if (result.status === 'invalid') {
    return <Notice tone="warning" icon="alert-circle" title={result.message} />;
  }
  if (result.status === 'unsupported') {
    return (
      <Notice tone="warning" icon="information-circle" title="Can't download this link">
        <Body>{result.message}</Body>
      </Notice>
    );
  }
  if (result.status === 'blocked') {
    return (
      <Notice tone="danger" icon="hand-left" title={`${result.platform} doesn't permit downloading here`}>
        <Body>{result.message}</Body>
        {result.officialAction ? (
          <View style={{ marginTop: 8, alignSelf: 'flex-start' }}>
            <Button
              compact
              variant="secondary"
              icon="open-outline"
              label={result.officialAction.label}
              onPress={() => Linking.openURL(result.officialAction!.url).catch(() => {})}
            />
          </View>
        ) : null}
      </Notice>
    );
  }
  return <ReadyCard result={result} busy={busy} onDownload={onDownload} />;
}

function Body({ children }: { children: string }) {
  const { colors } = useAppTheme();
  return <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20 }}>{children}</Text>;
}

function ReadyCard({ result, busy, onDownload }: { result: Extract<SourceCheck, { status: 'ready' }>; busy: boolean; onDownload: (o: MediaOption) => void }) {
  const { colors } = useAppTheme();
  const formats = useMemo(() => {
    const seen = new Map<string, MediaOption[]>();
    for (const o of result.options) {
      const key = o.format;
      seen.set(key, [...(seen.get(key) ?? []), o]);
    }
    return Array.from(seen.entries());
  }, [result.options]);

  const [format, setFormat] = useState(formats[0][0]);
  const choices = formats.find(([f]) => f === format)?.[1] ?? [];
  const [selectedId, setSelectedId] = useState(choices[0]?.id);
  const [confirmed, setConfirmed] = useState(!result.requiresPermissionConfirm);

  useEffect(() => setSelectedId(choices[0]?.id), [format]); // eslint-disable-line react-hooks/exhaustive-deps

  const selected = choices.find((c) => c.id === selectedId) ?? choices[0];

  return (
    <Card>
      <View style={{ gap: 4 }}>
        <Badge text={result.sourceName.toUpperCase()} tone="success" />
        <Text style={[s.title, { color: colors.text }]} numberOfLines={3}>
          {result.title}
        </Text>
        {result.licenseNote ? <Text style={[s.small, { color: colors.textMuted }]}>{result.licenseNote}</Text> : null}
      </View>

      {formats.length > 1 ? (
        <View style={[s.segment, { backgroundColor: colors.surfaceAlt }]} accessibilityRole="tablist">
          {formats.map(([f, opts]) => {
            const on = f === format;
            return (
              <Pressable
                key={f}
                onPress={() => setFormat(f)}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                style={[s.segmentItem, on && { backgroundColor: colors.surface }]}
              >
                <Ionicons name={opts[0].kind === 'video' ? 'videocam' : 'musical-notes'} size={16} color={on ? colors.accent : colors.textMuted} />
                <Text style={{ color: on ? colors.text : colors.textMuted, fontWeight: '600' }}>
                  {f.toUpperCase()} {opts[0].kind === 'video' ? 'Video' : 'Audio'}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <View style={{ gap: 6 }} accessibilityRole="radiogroup">
        <Text style={[s.label, { color: colors.textMuted }]}>{choices.length > 1 ? 'Choose quality' : 'File'}</Text>
        {choices.map((c) => {
          const on = c.id === selected?.id;
          return (
            <Pressable
              key={c.id}
              onPress={() => setSelectedId(c.id)}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              style={[s.option, { borderColor: on ? colors.accent : colors.border, backgroundColor: on ? colors.accentSoft : 'transparent' }]}
            >
              <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={20} color={on ? colors.accent : colors.textMuted} />
              <Text style={{ color: colors.text, flex: 1, fontSize: 15 }}>{c.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {result.requiresPermissionConfirm ? (
        <Pressable
          onPress={() => setConfirmed((v) => !v)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: confirmed }}
          style={s.confirm}
        >
          <Ionicons name={confirmed ? 'checkbox' : 'square-outline'} size={22} color={confirmed ? colors.accent : colors.textMuted} />
          <Text style={{ color: colors.text, flex: 1, fontSize: 14, lineHeight: 20 }}>
            I own this file or have permission from the owner to download it.
          </Text>
        </Pressable>
      ) : null}

      <Button
        label={busy ? 'Starting…' : 'Download'}
        icon="download"
        loading={busy}
        disabled={!confirmed || !selected}
        onPress={() => selected && onDownload(selected)}
      />
    </Card>
  );
}

const s = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '700', lineHeight: 24 },
  small: { fontSize: 12, lineHeight: 17 },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  segment: { flexDirection: 'row', borderRadius: 12, padding: 4, gap: 4 },
  segmentItem: { flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 9 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, borderWidth: 1.5 },
  confirm: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', paddingVertical: 4 },
});
