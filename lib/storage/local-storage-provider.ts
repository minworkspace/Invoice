import "server-only";

import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import { Readable } from "stream";
import type { SaveFileInput, StorageProvider, StorageUsage } from "./types";

const PUBLIC_ROOT = path.join(process.cwd(), "public");
const PUBLIC_URL_PREFIX = "/";
const USAGE_CACHE_TTL_MS = 60_000;
const usageCache = new Map<string, { expiresAt: number; usage: StorageUsage }>();

function normalizeKey(keyOrUrl?: string | null) {
  if (!keyOrUrl) return null;
  const withoutQuery = keyOrUrl.split("?")[0] || "";
  return withoutQuery
    .replace(/^https?:\/\/[^/]+/i, "")
    .replace(/^\/+/, "")
    .replace(/\.\.+/g, "")
    .replace(/\\/g, "/");
}

async function writeReadable(readable: Readable, absolutePath: string) {
  await new Promise<void>((resolve, reject) => {
    const output = fsSync.createWriteStream(absolutePath);
    readable.on("error", reject);
    output.on("error", reject);
    output.on("finish", resolve);
    readable.pipe(output);
  });
}

async function folderSize(folder: string): Promise<StorageUsage> {
  try {
    const entries = await fs.readdir(folder, { withFileTypes: true });
    let bytes = 0;
    let files = 0;

    for (const entry of entries) {
      const entryPath = path.join(folder, entry.name);
      if (entry.isDirectory()) {
        const child = await folderSize(entryPath);
        bytes += child.bytes;
        files += child.files;
      } else {
        const stat = await fs.stat(entryPath);
        bytes += stat.size;
        files += 1;
      }
    }

    return { bytes, files };
  } catch {
    return { bytes: 0, files: 0 };
  }
}

export class LocalStorageProvider implements StorageProvider {
  private absolutePathFor(keyOrUrl?: string | null) {
    const key = normalizeKey(keyOrUrl);
    if (!key) return null;

    const absolutePath = path.join(PUBLIC_ROOT, key);
    const relative = path.relative(PUBLIC_ROOT, absolutePath);
    if (relative.startsWith("..") || path.isAbsolute(relative)) return null;

    return absolutePath;
  }

  async saveFile(input: SaveFileInput) {
    const absolutePath = this.absolutePathFor(input.key);
    if (!absolutePath) throw new Error("Invalid storage key.");

    await fs.mkdir(path.dirname(absolutePath), { recursive: true });

    if (input.data instanceof Readable) {
      await writeReadable(input.data, absolutePath);
    } else {
      await fs.writeFile(absolutePath, input.data);
    }

    const stat = await fs.stat(absolutePath);
    const key = normalizeKey(input.key) || input.key;
    usageCache.clear();

    return {
      key,
      url: this.getFileUrl(key) || `/${key}`,
      size: stat.size
    };
  }

  async deleteFile(keyOrUrl?: string | null) {
    const absolutePath = this.absolutePathFor(keyOrUrl);
    if (!absolutePath) return;

    try {
      await fs.unlink(absolutePath);
      usageCache.clear();
    } catch {
      // Missing files should not break document or settings updates.
    }
  }

  getFileUrl(keyOrUrl?: string | null) {
    const key = normalizeKey(keyOrUrl);
    return key ? `${PUBLIC_URL_PREFIX}${key}` : null;
  }

  async getStorageUsage(prefix = "uploads") {
    const cached = usageCache.get(prefix);
    if (cached && cached.expiresAt > Date.now()) return cached.usage;

    const absolutePath = this.absolutePathFor(prefix);
    const usage = absolutePath ? await folderSize(absolutePath) : { bytes: 0, files: 0 };
    usageCache.set(prefix, { usage, expiresAt: Date.now() + USAGE_CACHE_TTL_MS });
    return usage;
  }

  getLocalPath(keyOrUrl?: string | null) {
    return this.absolutePathFor(keyOrUrl);
  }
}
