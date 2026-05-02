'use client';

import { useState, useEffect, useCallback } from 'react';

export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function getDateRange(preset: string): { start: string; end: string } {
  const end = new Date();
  end.setDate(end.getDate() - 3);
  const start = new Date(end);
  const days: Record<string, number> = { last7: 7, last28: 28, last90: 90 };
  start.setDate(start.getDate() - (days[preset] || 28));
  return { start: formatDate(start), end: formatDate(end) };
}

export function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}