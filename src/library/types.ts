import type { MediaFormat, MediaKind } from '../sources/types';

export type DownloadStatus = 'downloading' | 'paused' | 'completed' | 'failed' | 'cancelled';

export interface DownloadItem {
  id: string;
  title: string;
  fileName: string;
  /** The page or link the user pasted. */
  pageUrl: string;
  /** The actual file URL being downloaded. */
  mediaUrl: string;
  sourceName: string;
  kind: MediaKind;
  format: MediaFormat;
  mimeType: string;
  status: DownloadStatus;
  bytesWritten: number;
  /** -1 when the server didn't say how big the file is. */
  totalBytes: number;
  /** Where the finished file lives inside the app's storage. */
  fileUri?: string;
  error?: string;
  createdAt: number;
  completedAt?: number;
  /** True if the file was deleted outside the app. */
  missing?: boolean;
}
