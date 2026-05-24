import "server-only";

import { getStorageUsage } from "@/lib/storage";

export const ADMIN_PAGE_SIZE = 20;

export function pageNumber(value?: string) {
  const page = Number(value || "1");
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

export function pagination(page: number, pageSize = ADMIN_PAGE_SIZE) {
  return {
    take: pageSize,
    skip: (page - 1) * pageSize
  };
}

export function pageCount(total: number, pageSize = ADMIN_PAGE_SIZE) {
  return Math.max(1, Math.ceil(total / pageSize));
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export async function pdfStorageSummary(companyId?: string) {
  const summary = await getStorageUsage(companyId ? `uploads/company-${companyId}` : "uploads");

  return {
    ...summary,
    display: formatBytes(summary.bytes)
  };
}

export function adminSearchParams(params: Record<string, string | undefined>, nextPage: number) {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) next.set(key, value);
  }
  next.set("page", String(nextPage));
  return `?${next.toString()}`;
}
