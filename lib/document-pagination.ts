import { A4 } from "@/lib/document-layout";

export const A4_PREVIEW_WIDTH = A4.previewWidth;
export const A4_PREVIEW_HEIGHT = A4.previewHeight;

export type PaginatedItem<T> = T & {
  paginationKey?: string;
};

export function estimateWrappedLineCount(text: string, charsPerLine: number) {
  const lines = text.split("\n");
  return lines.reduce((sum, line) => {
    const length = Math.max(line.trimEnd().length, 1);
    return sum + Math.max(1, Math.ceil(length / charsPerLine));
  }, 0);
}

export function estimatePreviewRowHeight(
  text: string,
  options: {
    baseHeight: number;
    charsPerLine: number;
    lineHeight: number;
    maxHeight?: number;
  }
) {
  const height = options.baseHeight + estimateWrappedLineCount(text || " ", options.charsPerLine) * options.lineHeight;
  return options.maxHeight ? Math.min(height, options.maxHeight) : height;
}

export function paginateDocumentItems<T>(
  items: T[],
  options: {
    firstPageHeight: number;
    nextPageHeight: number;
    getItemHeight: (item: T) => number;
    orphanReservedHeight?: number;
  }
) {
  const pages: T[][] = [];
  let currentPage: T[] = [];
  let remainingHeight = options.firstPageHeight;
  const orphanReservedHeight = options.orphanReservedHeight ?? 0;

  items.forEach((item) => {
    const itemHeight = Math.min(options.getItemHeight(item), options.nextPageHeight);
    const needsNewPage =
      currentPage.length > 0 &&
      (itemHeight > remainingHeight || remainingHeight - itemHeight < orphanReservedHeight);

    if (needsNewPage) {
      pages.push(currentPage);
      currentPage = [];
      remainingHeight = options.nextPageHeight;
    }

    currentPage.push(item);
    remainingHeight -= itemHeight;
  });

  if (currentPage.length || pages.length === 0) {
    pages.push(currentPage);
  }

  return pages;
}
