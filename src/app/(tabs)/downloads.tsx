/** Downloads library: in-progress downloads on top, saved files below. */
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';
import { DownloadRow } from '../../components/DownloadRow';
import { Button } from '../../components/ui';
import { importFromPhone } from '../../library/importFiles';
import { freeSpaceBytes } from '../../download/fileStore';
import { isActive, refreshMissingFiles } from '../../download/downloadManager';
import { useLibrary } from '../../library/store';
import { useAppTheme } from '../../theme/ThemeProvider';
import { formatBytes } from '../../utils/format';

export default function DownloadsScreen() {
  const { colors } = useAppTheme();
  const items = useLibrary((s) => s.items);
  const [free, setFree] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(() => {
    refreshMissingFiles();
    setFree(freeSpaceBytes());
  }, []);

  const [importing, setImporting] = useState(false);
  const runImport = async () => {
    setImporting(true);
    try {
      const r = await importFromPhone();
      if (r.cancelled) return;
      refresh();
      const lines = [`${r.imported} file${r.imported === 1 ? '' : 's'} added to your library.`, ...r.skipped];
      Alert.alert(r.imported > 0 ? 'Imported' : 'Nothing imported', lines.join('\n'));
    } catch {
      Alert.alert("Couldn't import", 'The file picker could not be opened. Please try again.');
    } finally {
      setImporting(false);
    }
  };

  // Re-check files and free space each time the tab is opened.
  useFocusEffect(refresh);

  const sections = useMemo(() => {
    const active = items.filter((i) => isActive(i) || i.status === 'failed' || i.status === 'cancelled');
    const done = items.filter((i) => i.status === 'completed');
    const usedBytes = done.reduce((sum, i) => sum + Math.max(0, i.totalBytes), 0);
    return {
      usedBytes,
      list: [
        ...(active.length ? [{ title: 'IN PROGRESS & ISSUES', data: active }] : []),
        ...(done.length ? [{ title: `SAVED · ${done.length}`, data: done }] : []),
      ],
    };
  }, [items]);

  return (
    <SectionList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={s.content}
      sections={sections.list}
      keyExtractor={(i) => i.id}
      renderItem={({ item }) => <DownloadRow item={item} />}
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      renderSectionHeader={({ section }) => (
        <Text style={[s.section, { color: colors.textMuted, backgroundColor: colors.bg }]}>{section.title}</Text>
      )}
      ListHeaderComponent={
        <View style={{ gap: 10 }}>
          <Button variant="secondary" icon="add-circle-outline" label="Import songs or videos from phone" loading={importing} onPress={runImport} />
          <View style={[s.storage, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="server-outline" size={18} color={colors.textMuted} />
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>
              Using {formatBytes(sections.usedBytes)} · {free == null ? '…' : formatBytes(free)} free on phone
            </Text>
          </View>
        </View>
      }
      ListEmptyComponent={
        <View style={s.empty}>
          <Ionicons name="cloud-download-outline" size={48} color={colors.textMuted} />
          <Text style={{ color: colors.text, fontSize: 17, fontWeight: '600' }}>No downloads yet</Text>
          <Text style={{ color: colors.textMuted, textAlign: 'center', lineHeight: 20 }}>
            Paste a link on the Get tab. Finished files appear here to play, share or save to a folder.
          </Text>
        </View>
      }
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            refresh();
            setRefreshing(false);
          }}
          tintColor={colors.accent}
        />
      }
      stickySectionHeadersEnabled={false}
    />
  );
}

const s = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40, flexGrow: 1 },
  section: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6, paddingTop: 16, paddingBottom: 8 },
  storage: { flexDirection: 'row', gap: 8, alignItems: 'center', padding: 12, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  empty: { alignItems: 'center', gap: 10, paddingTop: 80, paddingHorizontal: 24 },
});
