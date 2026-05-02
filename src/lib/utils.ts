'use client';

export const PAGE_SIZE = 50;

export function paginate<T>(data: T[], page: number) {
  const total = Math.ceil(data.length / PAGE_SIZE);
  const current = Math.min(Math.max(1, page), total || 1);
  const start = (current - 1) * PAGE_SIZE;
  return {
    items: data.slice(start, start + PAGE_SIZE),
    current,
    total,
    totalItems: data.length,
  };
}