import { LIST_PAGE_SIZE } from "@/constants/pagination";

export function getPageRange(offset: number, pageSize = LIST_PAGE_SIZE) {
  const safeOffset = Math.max(0, offset);
  return {
    from: safeOffset,
    to: safeOffset + pageSize - 1,
    pageSize,
  };
}

export function mergeUniqueById<T extends { id: string }>(
  previous: T[],
  chunk: T[],
): T[] {
  const existingIds = new Set(previous.map((item) => item.id));
  const nextItems = chunk.filter((item) => !existingIds.has(item.id));
  return [...previous, ...nextItems];
}

export function hasAnotherPage(chunkLength: number, pageSize = LIST_PAGE_SIZE) {
  return chunkLength === pageSize;
}
