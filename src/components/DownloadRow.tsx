/** One row in the Downloads library — shows status and the actions that fit it. */
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { Alert, StyleSheet, Text, View } from 'react-native';
import {
  cancelDownload,
  deleteDownload,
  pauseDownload,
  resumeDownload,
  retryDownload,
} from '../download/downloadManager';
import { exportToUserFolder } from '../download/fileStore';
import type { DownloadItem } from '../library/types';
import { useAppTheme } from '../theme/ThemeProvider';
import { formatBytes, progressRatio } from '../utils/format';
import { Badge, Button, IconButton, ProgressBar } from './ui';

export function DownloadRow({ item }: { item: DownloadItem }) {
  const { colors } = useAppTheme();
  const ratio = progressRatio(item.bytesWritten, item.totalBytes);

  const confirmDelete = () =>
    Alert.alert('Delete file?', `"${item.fileName}" will be removed from this phone.`, [
      { text: 'Keep', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteDownload(item.id) },
    ]);

  const share = async () => {
    if (!item.fileUri) return;
    if (!(await Sharing.isAvailableAsync())) {
      Alert.alert('Sharing unavailable', 'Sharing is not available on this device.');
      return;
    }
    await Sharing.shareAsync(item.fileUri, { mimeType: item.mimeType, dialogTitle: item.fileName }).catch(() => {});
  };

  const saveToDevice = async () => {
    if (!item.fileUri) return;
    try {
      const saved = await exportToUserFolder(item.fileUri, item.fileName, item.mimeType);
      if (saved) Alert.alert('Saved', `"${item.fileName}" was copied to the folder you chose.`);
    } catch {
      Alert.alert("Couldn't save", 'Copying to that folder failed. Try another folder, such as Download.');
    }
  };

  const statusBadge = () => {
    switch (item.status) {
      case 'downloading':
        return <Badge text="DOWNLOADING" tone="accent" />;
      case 'paused':
        return <Badge text="PAUSED" tone="warning" />;
      case 'failed':
        return <Badge text="FAILED" tone="danger" />;
      case 'cancelled':
        return <Badge text="CANCELLED" />;
      default:
        return item.missing ? <Badge text="FILE MISSING" tone="danger" /> : null;
    }
  };

  const playable = item.status === 'completed' && !item.missing;

  return (
    <View style={[s.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={s.top}>
        <View style={[s.icon, { backgroundColor: colors.accentSoft }]}>
          <Ionicons name={item.kind === 'video' ? 'film' : 'musical-note'} size={22} color={colors.accent} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[s.name, { color: colors.text }]} numberOfLines={2}>
            {item.fileName}
          </Text>
          <View style={s.meta}>
            <Badge text={item.format.toUpperCase()} />
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>
              {item.status === 'completed'
                ? formatBytes(item.totalBytes)
                : `${formatBytes(item.bytesWritten)} of ${item.totalBytes > 0 ? formatBytes(item.totalBytes) : 'unknown size'}`}
            </Text>
            {statusBadge()}
          </View>
        </View>
      </View>

      {item.status === 'downloading' || item.status === 'paused' ? (
        <View style={{ gap: 6 }}>
          <ProgressBar ratio={ratio} />
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>
            {ratio == null ? 'Downloading… (size unknown)' : `${Math.round(ratio * 100)}%`}
          </Text>
        </View>
      ) : null}

      {item.error && item.status !== 'completed' && item.status !== 'cancelled' ? (
        <Text style={{ color: colors.danger, fontSize: 13 }}>{item.error}</Text>
      ) : null}

      <View style={s.actions}>
        {item.status === 'downloading' ? (
          <>
            <Button compact variant="secondary" icon="pause" label="Pause" onPress={() => pauseDownload(item.id).catch(() => {})} />
            <Button compact variant="danger" icon="close" label="Cancel" onPress={() => cancelDownload(item.id)} />
          </>
        ) : null}
        {item.status === 'paused' ? (
          <>
            <Button compact icon="play" label="Resume" onPress={() => resumeDownload(item.id)} />
            <Button compact variant="danger" icon="close" label="Cancel" onPress={() => cancelDownload(item.id)} />
          </>
        ) : null}
        {item.status === 'failed' || item.status === 'cancelled' ? (
          <>
            <Button compact icon="refresh" label="Retry" onPress={() => retryDownload(item.id)} />
            <IconButton icon="trash-outline" label="Remove from list" color={colors.danger} onPress={() => deleteDownload(item.id)} />
          </>
        ) : null}
        {playable ? (
          <>
            <Button compact icon="play" label="Play" onPress={() => router.push(`/player/${item.id}`)} />
            <IconButton icon="share-social-outline" label="Share" onPress={share} />
            <IconButton icon="folder-open-outline" label="Save to a folder on this phone" onPress={saveToDevice} />
            <IconButton icon="trash-outline" label="Delete" color={colors.danger} onPress={confirmDelete} />
          </>
        ) : null}
        {item.status === 'completed' && item.missing ? (
          <Button compact variant="danger" icon="trash-outline" label="Remove" onPress={() => deleteDownload(item.id)} />
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  row: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 12 },
  top: { flexDirection: 'row', gap: 12 },
  icon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 15, fontWeight: '600', lineHeight: 20 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  actions: { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
});
