/**
 * The download manager. It:
 *  1. checks for duplicates, connectivity and free space,
 *  2. downloads into a hidden ".part" file with progress updates,
 *  3. moves the finished file into the library folder,
 *  4. supports cancel, pause/resume and retry.
 *
 * Native download tasks can't be saved to disk, so they live in a Map here,
 * while the visible state (progress, status) lives in the library store.
 */
import { File } from 'expo-file-system';
import type { DownloadTask } from 'expo-file-system';
import * as Network from 'expo-network';
import { getItem, useLibrary } from '../library/store';
import type { DownloadItem } from '../library/types';
import type { MediaOption } from '../sources/types';
import { makeId, uniqueFileName } from '../utils/format';
import {
  deleteQuietly,
  existingLibraryNames,
  fileExists,
  freeSpaceBytes,
  partialFile,
  promoteToLibrary,
} from './fileStore';
import { describeError, findDuplicate, hasRoomFor } from './rules';

const tasks = new Map<string, DownloadTask>();
const PROGRESS_INTERVAL_MS = 300;

export interface StartRequest {
  option: MediaOption;
  title: string;
  pageUrl: string;
  sourceName: string;
  licenseLabel?: string;
  attribution?: string;
}

export type StartResult =
  | { ok: true; id: string }
  | { ok: false; reason: 'duplicate-active' | 'duplicate-completed'; existing: DownloadItem }
  | { ok: false; reason: 'offline' | 'no-space' | 'error'; message: string };

async function isOnline(): Promise<boolean> {
  try {
    const s = await Network.getNetworkStateAsync();
    return s.isConnected !== false && s.isInternetReachable !== false;
  } catch {
    return true; // if we can't tell, let the download itself report errors
  }
}

/** Mark library entries whose files were deleted outside the app. */
export function refreshMissingFiles(): void {
  const { items, update } = useLibrary.getState();
  for (const i of items) {
    if (i.status !== 'completed') continue;
    const missing = !fileExists(i.fileUri);
    if (missing !== !!i.missing) update(i.id, { missing });
  }
}

export async function startDownload(req: StartRequest, opts: { allowDuplicate?: boolean } = {}): Promise<StartResult> {
  const { add } = useLibrary.getState();
  refreshMissingFiles();

  const dup = findDuplicate(useLibrary.getState().items, req.option.url);
  if (dup?.kind === 'active') return { ok: false, reason: 'duplicate-active', existing: dup.item };
  if (dup?.kind === 'completed' && !opts.allowDuplicate) {
    return { ok: false, reason: 'duplicate-completed', existing: dup.item };
  }

  if (!(await isOnline())) {
    return { ok: false, reason: 'offline', message: "You're offline. Connect to Wi-Fi or mobile data and try again." };
  }
  if (!hasRoomFor(req.option.sizeBytes, freeSpaceBytes())) {
    return {
      ok: false,
      reason: 'no-space',
      message: 'Not enough free storage for this file. Delete some files and try again.',
    };
  }

  const item: DownloadItem = {
    id: makeId(),
    title: req.title,
    fileName: req.option.fileName,
    pageUrl: req.pageUrl,
    mediaUrl: req.option.url,
    sourceName: req.sourceName,
    kind: req.option.kind,
    format: req.option.format,
    mimeType: req.option.mimeType,
    status: 'downloading',
    bytesWritten: 0,
    totalBytes: req.option.sizeBytes ?? -1,
    createdAt: Date.now(),
    licenseLabel: req.licenseLabel,
    attribution: req.attribution,
  };
  add(item);
  run(item.id, 'start');
  return { ok: true, id: item.id };
}

function run(id: string, mode: 'start' | 'resume'): void {
  const { update } = useLibrary.getState();
  const item = getItem(id);
  if (!item) return;

  let task = tasks.get(id);
  let lastEmit = 0;
  const onProgress = ({ bytesWritten, totalBytes }: { bytesWritten: number; totalBytes: number }) => {
    const now = Date.now();
    if (now - lastEmit < PROGRESS_INTERVAL_MS) return;
    lastEmit = now;
    update(id, { bytesWritten, totalBytes: totalBytes > 0 ? totalBytes : item.totalBytes });
  };

  if (mode === 'start' || !task) {
    const tmp = partialFile(id);
    deleteQuietly(tmp.uri);
    task = File.createDownloadTask(item.mediaUrl, tmp, { onProgress });
    tasks.set(id, task);
  }

  update(id, { status: 'downloading', error: undefined });
  const promise = mode === 'resume' && task.state === 'paused' ? task.resumeAsync() : task.downloadAsync();

  promise
    .then((file) => {
      if (!file) return; // paused — the resume path will continue it
      const finalName = uniqueFileName(item.fileName, existingLibraryNames());
      const saved = promoteToLibrary(file, finalName);
      update(id, {
        status: 'completed',
        fileName: finalName,
        fileUri: saved.uri,
        bytesWritten: saved.size,
        totalBytes: saved.size,
        completedAt: Date.now(),
        missing: false,
      });
      tasks.delete(id);
    })
    .catch((e: unknown) => {
      const current = getItem(id);
      tasks.delete(id);
      deleteQuietly(partialFile(id).uri);
      if (current?.status === 'cancelled') return; // user cancelled: already handled
      const { kind, message } = describeError(e);
      update(id, { status: kind === 'cancelled' ? 'cancelled' : 'failed', error: message });
    });
}

export function cancelDownload(id: string): void {
  useLibrary.getState().update(id, { status: 'cancelled', error: 'Download cancelled.' });
  const task = tasks.get(id);
  tasks.delete(id);
  try {
    task?.cancel();
  } catch {
    // task already finished
  }
  deleteQuietly(partialFile(id).uri);
}

export async function pauseDownload(id: string): Promise<void> {
  const task = tasks.get(id);
  if (!task) return;
  await task.pauseAsync();
  useLibrary.getState().update(id, { status: 'paused' });
}

export function resumeDownload(id: string): void {
  if (!tasks.has(id)) return retryDownload(id);
  run(id, 'resume');
}

export function retryDownload(id: string): void {
  tasks.delete(id);
  useLibrary.getState().update(id, { bytesWritten: 0, error: undefined });
  run(id, 'start');
}

/** Delete a library entry and its file. Active downloads are cancelled first. */
export function deleteDownload(id: string): void {
  const item = getItem(id);
  if (!item) return;
  if (item.status === 'downloading' || item.status === 'paused') cancelDownload(id);
  deleteQuietly(item.fileUri);
  useLibrary.getState().remove(id);
}

export const isActive = (i: DownloadItem) => i.status === 'downloading' || i.status === 'paused';
