/** Downloads library: in-progress downloads on top, saved files below. */
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';
import { DownloadRow } from '../../components/DownloadRow';
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
        <View style={[s.storage, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="server-outline" size={18} color={colors.textMuted} />
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>
            Using {formatBytes(sections.usedBytes)} · {free == null ? '…' : formatBytes(free)} free on phone
          </Text>
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
