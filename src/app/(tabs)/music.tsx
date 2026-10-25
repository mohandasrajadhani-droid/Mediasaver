/**
 * Music: search royalty-free songs that are cleared for commercial use,
 * preview them, and download straight into the library.
 */
import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Badge, Button, Notice } from '../../components/ui';
import { startDownload } from '../../download/downloadManager';
import { useLibrary } from '../../library/store';
import { MusicSearchError, searchMusic, trackToOption, type MusicTrack } from '../../music/openverse';
import { useAppTheme } from '../../theme/ThemeProvider';
import { formatDuration } from '../../utils/format';

const SUGGESTIONS = ['indian', 'celebration', 'wedding', 'flute', 'happy', 'calm piano'];

export default function MusicScreen() {
  const { colors } = useAppTheme();
  const [query, setQuery] = useState('');
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState('');
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [startingId, setStartingId] = useState<string | null>(null);
  const items = useLibrary((s) => s.items);

  const player = useAudioPlayer();
  const status = useAudioPlayerStatus(player);

  // Stop the preview when the track ends.
  useEffect(() => {
    if (status.didJustFinish) setPreviewId(null);
  }, [status.didJustFinish]);

  const run = async (q: string, nextPage = 1) => {
    if (!q.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await searchMusic(q, nextPage);
      setTracks((prev) => (nextPage === 1 ? res.tracks : [...prev, ...res.tracks.filter((t) => !prev.some((p) => p.id === t.id))]));
      setPage(res.page);
      setPageCount(res.pageCount);
      setSearched(q.trim());
    } catch (e) {
      setError(e instanceof MusicSearchError ? e.message : 'Search failed. Try again.');
      if (nextPage === 1) setTracks([]);
    } finally {
      setLoading(false);
    }
  };

  const togglePreview = (t: MusicTrack) => {
    try {
      if (previewId === t.id) {
        player.pause();
        setPreviewId(null);
        return;
      }
      player.replace({ uri: t.fileUrl });
      player.play();
      setPreviewId(t.id);
    } catch {
      Alert.alert("Can't play preview", 'This track could not be streamed. You can still try downloading it.');
    }
  };

  const download = async (t: MusicTrack, allowDuplicate = false) => {
    setStartingId(t.id);
    try {
      const res = await startDownload(
        {
          option: trackToOption(t),
          title: `${t.title} — ${t.creator}`,
          pageUrl: t.landingUrl ?? t.fileUrl,
          sourceName: t.source ? `Openverse · ${t.source}` : 'Openverse',
          licenseLabel: t.licenseLabel,
          attribution: t.needsCredit ? t.attribution : undefined,
        },
        { allowDuplicate },
      );
      if (res.ok) {
        Alert.alert(
          'Downloading',
          t.needsCredit
            ? `"${t.title}" is downloading. This licence asks you to credit the artist — use "Copy credit" on the Downloads tab and paste it in your caption.`
            : `"${t.title}" is downloading. No credit is required for this track.`,
          [{ text: 'OK' }, { text: 'Open Downloads', onPress: () => router.navigate('/downloads') }],
        );
      } else if (res.reason === 'duplicate-active') {
        Alert.alert('Already downloading', 'This track is already downloading.');
      } else if (res.reason === 'duplicate-completed') {
        Alert.alert('Already downloaded', `You already have "${res.existing.fileName}".`, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Download again', onPress: () => download(t, true) },
        ]);
      } else if ('message' in res) {
        Alert.alert('Download not started', res.message);
      }
    } finally {
      setStartingId(null);
    }
  };

  const downloadedUrls = new Set(items.filter((i) => i.status === 'completed' && !i.missing).map((i) => i.mediaUrl));

  const header = (
    <View style={{ gap: 14 }}>
      <View style={[s.searchWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search free music (e.g. wedding, flute)"
          placeholderTextColor={colors.textMuted}
          returnKeyType="search"
          onSubmitEditing={() => run(query)}
          style={[s.input, { color: colors.text }]}
          autoCapitalize="none"
          accessibilityLabel="Search music"
        />
        {loading && page === 1 ? <ActivityIndicator color={colors.accent} /> : null}
      </View>
      {!searched ? (
        <View style={s.chips}>
          {SUGGESTIONS.map((q) => (
            <Pressable
              key={q}
              onPress={() => {
                setQuery(q);
                run(q);
              }}
              style={[s.chip, { backgroundColor: colors.surfaceAlt }]}
              accessibilityRole="button"
            >
              <Text style={{ color: colors.text, fontSize: 13 }}>{q}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 19 }}>
        Every result is licensed for commercial use, so it's safe for business reels and status. Tracks marked
        "Credit needed" must name the artist in your caption.
      </Text>
      {error ? <Notice tone="warning" icon="cloud-offline-outline" title={error} /> : null}
    </View>
  );

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={s.content}
      data={tracks}
      keyExtractor={(t) => t.id}
      ListHeaderComponent={header}
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      keyboardShouldPersistTaps="handled"
      renderItem={({ item: t }) => {
        const playing = previewId === t.id && status.playing;
        const buffering = previewId === t.id && !status.isLoaded;
        const have = downloadedUrls.has(t.fileUrl);
        return (
          <View style={[s.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Pressable
              onPress={() => togglePreview(t)}
              accessibilityLabel={playing ? `Stop preview of ${t.title}` : `Preview ${t.title}`}
              style={[s.play, { backgroundColor: previewId === t.id ? colors.accent : colors.accentSoft }]}
            >
              {buffering ? (
                <ActivityIndicator color={colors.accentText} size="small" />
              ) : (
                <Ionicons name={playing ? 'pause' : 'play'} size={20} color={previewId === t.id ? colors.accentText : colors.accent} />
              )}
            </Pressable>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15 }} numberOfLines={1}>
                {t.title}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 13 }} numberOfLines={1}>
                {t.creator}
                {t.durationSec ? ` · ${formatDuration(t.durationSec)}` : ''}
              </Text>
              <View style={s.badges}>
                <Badge text={t.format.toUpperCase()} />
                <Badge text={t.needsCredit ? 'CREDIT NEEDED' : 'NO CREDIT NEEDED'} tone={t.needsCredit ? 'warning' : 'success'} />
                {t.landingUrl ? (
                  <Pressable onPress={() => Linking.openURL(t.landingUrl!).catch(() => {})} hitSlop={6} accessibilityRole="link">
                    <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '600' }}>{t.licenseLabel} ↗</Text>
                  </Pressable>
                ) : (
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>{t.licenseLabel}</Text>
                )}
              </View>
            </View>
            {have ? (
              <Ionicons name="checkmark-circle" size={26} color={colors.success} accessibilityLabel="Downloaded" />
            ) : (
              <Button compact icon="download" label="" accessibilityLabel={`Download ${t.title}`} loading={startingId === t.id} onPress={() => download(t)} />
            )}
          </View>
        );
      }}
      ListEmptyComponent={
        searched && !loading && !error ? (
          <Text style={{ color: colors.textMuted, textAlign: 'center', marginTop: 32 }}>
            No commercial-use tracks found for "{searched}". Try a simpler word, like "drums" or "romantic".
          </Text>
        ) : undefined
      }
      ListFooterComponent={
        tracks.length > 0 && page < pageCount ? (
          <View style={{ marginTop: 14 }}>
            <Button variant="secondary" label="Load more" icon="chevron-down" loading={loading} onPress={() => run(searched, page + 1)} />
          </View>
        ) : tracks.length > 0 ? (
          <Text style={{ color: colors.textMuted, fontSize: 12, textAlign: 'center', marginTop: 16 }}>
            Music from Openverse (openverse.org) — openly licensed audio.
          </Text>
        ) : undefined
      }
    />
  );
}

const s = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40, gap: 0 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, borderWidth: 1, paddingHorizontal: 12 },
  input: { flex: 1, fontSize: 16, paddingVertical: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth },
  play: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  badges: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
});
