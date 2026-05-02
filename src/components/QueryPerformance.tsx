'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button, Spinner, EmptyState, SectionHeader, Table, SearchInput, Pagination } from './LegacyUI';
import { exportToCSV } from '@/lib/csvExport';
import { paginate } from '@/lib/utils';
import { GSCRow } from '@/lib/gsc-fetcher';

type QueryPageRow = {
  query: string;
  page: string;
  clicks: number;
  impressions: number;
  ctr: string;
  position: string;
};

interface QueryPerformanceProps {
  data?: GSCRow[];
  isLoading?: boolean;
  error?: string;
  siteUrl?: string;
  startDate?: string;
  endDate?: string;
}

export function QueryPerformance({ data: propData, isLoading: propLoading, error: propError, siteUrl, startDate, endDate }: QueryPerformanceProps) {
  const [data, setData] = useState<QueryPageRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    if (propData) {
      setData(propData.map((r) => ({
        query: r.query || '',
        page: r.url || '',
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: ((r.ctr ?? 0) * 100).toFixed(2),
        position: r.position.toFixed(1),
      })));
      return;
    }

    if (!siteUrl) return;

    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/gsc-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteUrl,
          startDate,
          endDate,
          dimensions: ['query', 'page'],
          rowLimit: 5000,
        }),
      });
      const json = await res.json();
      const rows: GSCRow[] = json.rows || [];
      setData(rows.sort((a, b) => b.clicks - a.clicks).map((r) => ({
        query: r.query || '',
        page: r.url || '',
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: ((r.ctr ?? 0) * 100).toFixed(2),
        position: r.position.toFixed(1),
      })));
    } catch {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [propData, siteUrl, startDate, endDate]);

  useEffect(() => { load(); }, [load]);

  const filtered = data.filter((r) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return r.query.toLowerCase().includes(s) || r.page.toLowerCase().includes(s);
  });

  const paged = paginate(filtered, page);

  const handleExport = () => {
    exportToCSV('gsc-query-page.csv', ['Query', 'Page', 'Clicks', 'Impressions', 'CTR', 'Position'],
      filtered.map((r) => [r.query, r.page, r.clicks, r.impressions, r.ctr + '%', r.position])
    );
  };

  const columns = [
    { key: 'query', label: 'Query' },
    {
      key: 'page',
      label: 'Page',
      render: (val: unknown) => (
        <span className="truncate max-w-xs text-sm" title={String(val)}>
          {String(val).replace(/^https?:\/\/[^/]+/, '') || '/'}
        </span>
      ),
    },
    { key: 'clicks', label: 'Clicks', align: 'right' as const },
    { key: 'impressions', label: 'Impressions', align: 'right' as const },
    { key: 'ctr', label: 'CTR', align: 'right' as const, render: (v: unknown) => v + '%' },
    { key: 'position', label: 'Position', align: 'right' as const },
  ];

  const loadingFinal = propLoading ?? loading;
  const errorFinal = propError ?? error;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Query Performance"
        subtitle="Keywords and their associated landing pages"
      />

      {loadingFinal ? (
        <div className="flex items-center justify-center py-12 gap-3 text-gray-500"><Spinner /> Loading...</div>
      ) : errorFinal ? (
        <EmptyState message={errorFinal} />
      ) : (
        <div className="rounded-lg border bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
            <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search queries or pages..." />
            <Button variant="secondary" small onClick={handleExport}>Export CSV</Button>
          </div>
          {paged.totalItems > 0 ? (
            <>
              <Table columns={columns} rows={paged.items as unknown as Record<string, unknown>[]} />
              <Pagination {...paged} onPage={setPage} />
            </>
          ) : (
            <EmptyState message="No data available" />
          )}
        </div>
      )}
    </div>
  );
}