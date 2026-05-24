import "server-only";

import { LocalStorageProvider } from "./local-storage-provider";
import type { SaveFileInput, StorageUsage } from "./types";

const provider = new LocalStorageProvider();

export function storageProvider() {
  return provider;
}

export async function saveFile(input: SaveFileInput) {
  return provider.saveFile(input);
}

export async function deleteFile(keyOrUrl?: string | null) {
  await provider.deleteFile(keyOrUrl);
}

export function getFileUrl(keyOrUrl?: string | null) {
  return provider.getFileUrl(keyOrUrl);
}

export async function getStorageUsage(prefix?: string): Promise<StorageUsage> {
  return provider.getStorageUsage(prefix);
}

export function getLocalFilePath(keyOrUrl?: string | null) {
  return provider.getLocalPath?.(keyOrUrl) || null;
}
