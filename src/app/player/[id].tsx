/** Plays a saved file: expo-video for video, expo-audio for audio. */
import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ProgressBar } from '../../components/ui';
import { useLibrary } from '../../library/store';
import type { DownloadItem } from '../../library/types';
import { useAppTheme } from '../../theme/ThemeProvider';
import { formatDuration } from '../../utils/format';

export default function PlayerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const item = useLibrary((s) => s.items.find((i) => i.id === id));
  const { colors } = useAppTheme();

  if (!item?.fileUri || item.status !== 'completed' || item.missing) {
    return (
      <View style={[s.center, { backgroundColor: colors.bg }]}>
        <Ionicons name="alert-circle-outline" size={40} color={colors.textMuted} />
        <Text style={{ color: colors.text }}>This file is no longer available.</Text>
      </View>
    );
  }
  return (
    <>
      <Stack.Screen options={{ title: item.fileName }} />
      {item.kind === 'video' ? <VideoPlayback item={item} /> : <AudioPlayback item={item} />}
    </>
  );
}

function VideoPlayback({ item }: { item: DownloadItem }) {
  const player = useVideoPlayer(item.fileUri!, (p) => {
    p.play();
  });
  return (
    <View style={[s.fill, { backgroundColor: '#000' }]}>
      <VideoView player={player} style={s.fill} nativeControls contentFit="contain" fullscreenOptions={{ enable: true }} />
    </View>
  );
}

function AudioPlayback({ item }: { item: DownloadItem }) {
  const { colors } = useAppTheme();
  const player = useAudioPlayer(item.fileUri!);
  const status = useAudioPlayerStatus(player);
  const ratio = status.duration > 0 ? status.currentTime / status.duration : 0;

  const toggle = () => {
    if (status.playing) {
      player.pause();
    } else {
      if (status.didJustFinish || (status.duration > 0 && status.currentTime >= status.duration - 0.5)) {
        player.seekTo(0);
      }
      player.play();
    }
  };
  const skip = (delta: number) =>
    player.seekTo(Math.max(0, Math.min(status.duration || 0, status.currentTime + delta)));

  return (
    <View style={[s.audio, { backgroundColor: colors.bg }]}>
      <View style={[s.art, { backgroundColor: colors.accentSoft }]}>
        <Ionicons name="musical-notes" size={72} color={colors.accent} />
      </View>
      <Text style={[s.title, { color: colors.text }]} numberOfLines={2}>
        {item.title}
      </Text>
      <Text style={{ color: colors.textMuted }}>{item.sourceName}</Text>

      <View style={{ alignSelf: 'stretch', gap: 6 }}>
        <ProgressBar ratio={ratio} />
        <View style={s.times}>
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>{formatDuration(status.currentTime)}</Text>
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>{formatDuration(status.duration)}</Text>
        </View>
      </View>

      <View style={s.controls}>
        <Pressable onPress={() => skip(-10)} accessibilityLabel="Back 10 seconds" hitSlop={10}>
          <Ionicons name="play-back" size={32} color={colors.text} />
        </Pressable>
        <Pressable
          onPress={toggle}
          disabled={!status.isLoaded}
          accessibilityLabel={status.playing ? 'Pause' : 'Play'}
          style={[s.play, { backgroundColor: colors.accent, opacity: status.isLoaded ? 1 : 0.5 }]}
        >
          <Ionicons name={status.playing ? 'pause' : 'play'} size={36} color={colors.accentText} />
        </Pressable>
        <Pressable onPress={() => skip(10)} accessibilityLabel="Forward 10 seconds" hitSlop={10}>
          <Ionicons name="play-forward" size={32} color={colors.text} />
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  audio: { flex: 1, alignItems: 'center', padding: 24, gap: 16, paddingTop: 48 },
  art: { width: 200, height: 200, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  title: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  times: { flexDirection: 'row', justifyContent: 'space-between' },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 36, marginTop: 8 },
  play: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
});
