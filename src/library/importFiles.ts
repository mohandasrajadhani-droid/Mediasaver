/**
 * Import your own songs or videos (e.g. AI-composed tracks) from the phone
 * into the MediaSaver library. Uses Android's file picker — works in Expo Go,
 * no storage permission needed. Files are copied, originals stay untouched.
 */
import { File } from 'expo-file-system';
import { downloadsDir, existingLibraryNames } from '../download/fileStore';
import { MEDIA_EXTENSIONS, extensionFromMime, extensionFromPath } from '../sources/mediaTypes';
import { makeId, sanitizeFileName, uniqueFileName } from '../utils/format';
import { useLibrary } from './store';
import type { DownloadItem } from './types';

export interface ImportPlan {
  ok: boolean;
  fileName?: string;
  kind?: 'audio' | 'video';
  reason?: string;
}

/** Pure: decide the library name and type for a picked file. Unit-tested. */
export function planImport(pickedName: string, mimeType: string | null | undefined, taken: string[]): ImportPlan {
  const ext = extensionFromPath(pickedName) || extensionFromMime(mimeType);
  const info = ext ? MEDIA_EXTENSIONS[ext] : undefined;
  if (!info) return { ok: false, reason: `"${pickedName}" isn't a supported audio or video file.` };
  const clean = sanitizeFileName(pickedName, ext!);
  return { ok: true, fileName: uniqueFileName(clean, taken), kind: info.kind };
}

export interface ImportResult {
  imported: number;
  skipped: string[];
  cancelled: boolean;
}

export async function importFromPhone(): Promise<ImportResult> {
  const picked = await File.pickFileAsync({ multipleFiles: true, mimeTypes: ['audio/*', 'video/*'] });
  if (picked.canceled) return { imported: 0, skipped: [], cancelled: true };

  const taken = existingLibraryNames();
  const skipped: string[] = [];
  let imported = 0;

  for (const src of picked.result) {
    const plan = planImport(src.name, src.type, taken);
    if (!plan.ok || !plan.fileName || !plan.kind) {
      skipped.push(plan.reason ?? src.name);
      continue;
    }
    try {
      const dest = new File(downloadsDir(), plan.fileName);
      await src.copy(dest);
      taken.push(plan.fileName);
      const ext = extensionFromPath(plan.fileName)!;
      const info = MEDIA_EXTENSIONS[ext];
      const size = dest.size ?? 0;
      const item: DownloadItem = {
        id: makeId(),
        title: plan.fileName.replace(/\.[^.]+$/, ''),
        fileName: plan.fileName,
        pageUrl: '',
        mediaUrl: `import:${makeId()}`,
        sourceName: 'Imported from phone',
        kind: plan.kind,
        format: info.format,
        mimeType: info.mime,
        status: 'completed',
        bytesWritten: size,
        totalBytes: size,
        fileUri: dest.uri,
        createdAt: Date.now(),
        completedAt: Date.now(),
      };
      useLibrary.getState().add(item);
      imported++;
    } catch {
      skipped.push(`"${src.name}" couldn't be copied (it may be too large for the free space left).`);
    }
  }
  return { imported, skipped, cancelled: false };
}
