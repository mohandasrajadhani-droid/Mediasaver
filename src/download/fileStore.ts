/**
 * Everything that touches the phone's storage lives here, using the
 * expo-file-system "File / Directory / Paths" API (SDK 54+).
 *
 * Layout inside the app's private storage:
 *   <documents>/downloads/   finished files shown in the library
 *   <cache>/partial/         in-progress downloads (never shown)
 */
import { Directory, File, Paths } from 'expo-file-system';

function ensureDir(dir: Directory): Directory {
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

export function downloadsDir(): Directory {
  return ensureDir(new Directory(Paths.document, 'downloads'));
}

export function partialFile(id: string): File {
  const dir = ensureDir(new Directory(Paths.cache, 'partial'));
  return new File(dir, `${id}.part`);
}

export function existingLibraryNames(): string[] {
  return downloadsDir()
    .list()
    .filter((e): e is File => e instanceof File)
    .map((f) => f.name);
}

/** Move a finished partial file into the library under its final name. */
export function promoteToLibrary(tmp: File, finalName: string): File {
  const dest = new File(downloadsDir(), finalName);
  tmp.moveSync(dest);
  return dest;
}

export function deleteQuietly(uri: string | undefined | null): void {
  if (!uri) return;
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // already gone — nothing to do
  }
}

export function fileExists(uri: string | undefined): boolean {
  if (!uri) return false;
  try {
    return new File(uri).exists;
  } catch {
    return false;
  }
}

export function freeSpaceBytes(): number {
  try {
    return Paths.availableDiskSpace;
  } catch {
    return Number.MAX_SAFE_INTEGER; // unknown: don't block the user
  }
}

/**
 * Copy a downloaded file to a folder the user picks (e.g. Download or Music)
 * using Android's folder picker. Works in Expo Go — no extra permissions.
 * Returns false if the user closed the picker.
 */
export async function exportToUserFolder(uri: string, fileName: string, mimeType: string): Promise<boolean> {
  let folder: Directory;
  try {
    folder = await Directory.pickDirectoryAsync();
  } catch {
    return false; // picker cancelled
  }
  const target = folder.createFile(fileName, mimeType);
  await new File(uri).copy(target, { overwrite: true });
  return true;
}
