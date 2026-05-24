import type { Readable } from "stream";

export type StorageVisibility = "public" | "private";

export type SaveFileInput = {
  key: string;
  data: Buffer | Uint8Array | Readable;
  contentType?: string;
  visibility?: StorageVisibility;
};

export type StoredFile = {
  key: string;
  url: string;
  size: number;
};

export type StorageUsage = {
  bytes: number;
  files: number;
};

export type StorageProvider = {
  saveFile(input: SaveFileInput): Promise<StoredFile>;
  deleteFile(keyOrUrl?: string | null): Promise<void>;
  getFileUrl(keyOrUrl?: string | null): string | null;
  getStorageUsage(prefix?: string): Promise<StorageUsage>;
  getLocalPath?(keyOrUrl?: string | null): string | null;
};
