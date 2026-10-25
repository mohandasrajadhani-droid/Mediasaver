/**
 * Home: paste a link → Check → see what's allowed → pick format/quality → Download.
 */
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SourceResult } from '../../components/SourceResult';
import { DownloadRow } from '../../components/DownloadRow';
import { Button, Card } from '../../components/ui';
import { isActive, startDownload } from '../../download/downloadManager';
import { useLibrary } from '../../library/store';
import { checkSource } from '../../sources/checkSource';
import type { MediaOption, SourceCheck } from '../../sources/types';
import { useAppTheme } from '../../theme/ThemeProvider';

export default function HomeScreen() {
  const { colors } = useAppTheme();
  const [text, setText] = useState('');
  const [checking, setChecking] = useState(false);
  const [starting, setStarting] = useState(false);
  const [result, setResult] = useState<SourceCheck | null>(null);
  const items = useLibrary((s) => s.items);
  const active = items.filter(isActive).slice(0, 2);

  const runCheck = async (value = text) => {
    if (checking) return;
    setChecking(true);
    setResult(null);
    try {
      setResult(await checkSource(value));
    } finally {
      setChecking(false);
    }
  };

  const paste = async () => {
    const value = (await Clipboard.getStringAsync().catch(() => '')).trim();
    if (!value) {
      Alert.alert('Clipboard is empty', 'Copy a link first, then tap Paste.');
      return;
    }
    setText(value);
    runCheck(value);
  };

  const download = async (option: MediaOption, allowDuplicate = false) => {
    if (!result || result.status !== 'ready') return;
    setStarting(true);
    try {
      const res = await startDownload(
        { option, title: result.title, pageUrl: result.pageUrl, sourceName: result.sourceName },
        { allowDuplicate },
      );
      if (res.ok) {
        router.navigate('/downloads');
        return;
      }
      if (res.reason === 'duplicate-active') {
        Alert.alert('Already downloading', 'This file is already downloading. Check the Downloads tab.');
      } else if (res.reason === 'duplicate-completed') {
        Alert.alert('Already downloaded', `You already have "${res.existing.fileName}".`, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Downloads', onPress: () => router.navigate('/downloads') },
          { text: 'Download again', onPress: () => download(option, true) },
        ]);
      } else if ('message' in res) {
        Alert.alert(res.reason === 'offline' ? "You're offline" : res.reason === 'no-space' ? 'Not enough storage' : 'Error', res.message);
      }
    } finally {
      setStarting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={{ backgroundColor: colors.bg }}
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[s.lead, { color: colors.textMuted }]}>
          Paste a link to a media file you're allowed to download.
        </Text>

        <Card>
          <View style={[s.inputWrap, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
            <Ionicons name="link" size={18} color={colors.textMuted} />
            <TextInput
              value={text}
              onChangeText={(v) => {
                setText(v);
                setResult(null);
              }}
              placeholder="https://…"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="go"
              onSubmitEditing={() => runCheck()}
              style={[s.input, { color: colors.text }]}
              accessibilityLabel="Media link"
            />
            {text ? (
              <Pressable onPress={() => { setText(''); setResult(null); }} hitSlop={10} accessibilityLabel="Clear link">
                <Ionicons name="close-circle" size={20} color={colors.textMuted} />
              </Pressable>
            ) : null}
          </View>
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Button variant="secondary" icon="clipboard-outline" label="Paste" onPress={paste} />
            </View>
            <View style={{ flex: 1 }}>
              <Button icon="search" label="Check link" loading={checking} disabled={!text.trim()} onPress={() => runCheck()} />
            </View>
          </View>
        </Card>

        {result ? <SourceResult result={result} busy={starting} onDownload={(o) => download(o)} /> : null}

        {active.length > 0 ? (
          <View style={{ gap: 10 }}>
            <Text style={[s.section, { color: colors.textMuted }]}>IN PROGRESS</Text>
            {active.map((i) => (
              <DownloadRow key={i.id} item={i} />
            ))}
          </View>
        ) : null}

        {!result ? <SupportedSources /> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function SupportedSources() {
  const { colors } = useAppTheme();
  const rows: [keyof typeof Ionicons.glyphMap, string, string][] = [
    ['document-outline', 'Direct file links', 'Links ending in .mp4, .mp3, .m4a and similar — from your own server, cloud storage share links that point to the file, or any site that offers the file for download.'],
    ['library-outline', 'Internet Archive', 'Paste an archive.org/details/… link to pick from the MP4 and MP3 versions the Archive provides.'],
    ['ban-outline', 'Not supported', 'YouTube, Instagram, Netflix, Spotify and other streaming platforms don\'t allow third-party downloads. We\'ll point you to their official app instead.'],
  ];
  return (
    <Card>
      <Text style={[s.cardTitle, { color: colors.text }]}>What works</Text>
      {rows.map(([icon, title, body]) => (
        <View key={title} style={s.help}>
          <Ionicons name={icon} size={20} color={colors.accent} style={{ marginTop: 2 }} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15 }}>{title}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 19 }}>{body}</Text>
          </View>
        </View>
      ))}
    </Card>
  );
}

const s = StyleSheet.create({
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  lead: { fontSize: 15, lineHeight: 21 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12 },
  input: { flex: 1, fontSize: 16, paddingVertical: 12 },
  row: { flexDirection: 'row', gap: 10 },
  section: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6 },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  help: { flexDirection: 'row', gap: 12 },
});
