'use client';

import { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { MetricCard, Button, Spinner, EmptyState, SectionHeader, Table, SearchInput, Badge, Pagination } from './LegacyUI';
import { exportToCSV } from '@/lib/csvExport';
import { paginate } from '@/lib/utils';
import { GSCRow } from '@/lib/gsc-fetcher';

const PRESETS = ['last7', 'last28', 'last90'];

const POSITION_FILTERS = [
  { key: 'all', test: () => true },
  { key: 'pos1', test: (p: string) => parseFloat(p) < 1.8 },
  { key: 'top3', test: (p: string) => parseFloat(p) <= 3 },
  { key: 'page1', test: (p: string) => parseFloat(p) <= 10 },
  { key: 'page2', test: (p: string) => parseFloat(p) > 10 && parseFloat(p) <= 20 },
  { key: 'page3plus', test: (p: string) => parseFloat(p) > 20 },
  { key: 'lowCtr', test: () => true, ctrOnly: true },
];

function formatNum(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return Math.round(n).toString();
}

function calcMetrics(rows: GSCRow[]) {
  if (!rows.length) return { clicks: 0, impressions: 0, ctr: '0.00', position: '0.0' };
  const clicks = rows.reduce((s, r) => s + (r.clicks || 0), 0);
  const impressions = rows.reduce((s, r) => s + (r.impressions || 0), 0);
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
  const position = rows.reduce((s, r) => s + (r.position || 0), 0) / rows.length;
  return { clicks, impressions, ctr: ctr.toFixed(2), position: position.toFixed(1) };
}

type ChartDataPoint = {
  date: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

type PageRow = {
  page: string;
  clicks: number;
  impressions: number;
  ctr: string;
  position: string;
  lowCtr: boolean;
};

type QueryRow = {
  query: string;
  clicks: number;
  impressions: number;
  ctr: string;
  position: string;
  lowCtr: boolean;
};

interface GscDashboardProps {
  // Data passed directly from gsc-fetcher output
  chartData?: GSCRow[];      // rows with dimension=date
  pageData?: GSCRow[];       // rows with dimension=page
  queryData?: GSCRow[];      // rows with dimension=query
  isLoading?: boolean;
  error?: string;
  // Internal fetch mode: set siteUrl + dates to have component auto-fetch
  siteUrl?: string;
  startDate?: string;
  endDate?: string;
  onExport?: () => void;
}

const FILTER_LABELS: Record<string, string> = {
  all: 'All',
  pos1: 'Position 1',
  top3: 'Top 3',
  page1: 'Page 1',
  page2: 'Page 2',
  page3plus: 'Page 3+',
  lowCtr: 'Low CTR',
};

export function GscDashboard({ chartData: propChart, pageData: propPages, queryData: propQueries, isLoading: propLoading, error: propError, siteUrl, startDate, endDate, onExport }: GscDashboardProps) {
  const [preset, setPreset] = useState('last28');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [tab, setTab] = useState<'pages' | 'queries'>('pages');
  const [posFilter, setPosFilter] = useState('all');
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [pageData, setPageData] = useState<PageRow[]>([]);
  const [queryData, setQueryData] = useState<QueryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [pagePage, setPagePage] = useState(1);
  const [queryPage, setQueryPage] = useState(1);

  const load = useCallback(async () => {
    if (propChart && propPages && propQueries) {
      // External data mode
      setChartData(propChart.map((r) => ({
        date: (r as unknown as { data_date?: string }).data_date || '',
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: parseFloat(((r.ctr ?? 0) * 100).toFixed(2)),
        position: parseFloat(r.position.toFixed(1)),
      })));
      setPageData(propPages.map((r) => ({
        page: r.url || '',
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: ((r.ctr ?? 0) * 100).toFixed(2),
        position: r.position.toFixed(1),
        lowCtr: r.impressions > 100 && (r.ctr ?? 0) < 0.02,
      })));
      setQueryData(propQueries.map((r) => ({
        query: r.query || '',
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: ((r.ctr ?? 0) * 100).toFixed(2),
        position: r.position.toFixed(1),
        lowCtr: r.impressions > 100 && (r.ctr ?? 0) < 0.02,
      })));
      return;
    }

    if (!siteUrl) return;

    setLoading(true);
    setError('');
    try {
      const { start, end } = isCustom && customStart && customEnd
        ? { start: customStart, end: customEnd }
        : { start: startDate || '', end: endDate || '' };

      const [byDate, byPage, byQuery] = await Promise.all([
        fetch('/api/gsc-v2', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ siteUrl, startDate: start, endDate: end, dimensions: ['date'], rowLimit: 5000 }),
        }).then(r => r.json()),
        fetch('/api/gsc-v2', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ siteUrl, startDate: start, endDate: end, dimensions: ['page'], rowLimit: 5000 }),
        }).then(r => r.json()),
        fetch('/api/gsc-v2', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ siteUrl, startDate: start, endDate: end, dimensions: ['query'], rowLimit: 5000 }),
        }).then(r => r.json()),
      ]);

      const dateRows: GSCRow[] = byDate.rows || [];
      const pageRows: GSCRow[] = byPage.rows || [];
      const queryRows: GSCRow[] = byQuery.rows || [];

      setChartData(dateRows.map((r) => ({
        date: (r as unknown as { data_date?: string }).data_date || '',
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: parseFloat(((r.ctr ?? 0) * 100).toFixed(2)),
        position: parseFloat(r.position.toFixed(1)),
      })));
      setPageData(pageRows.sort((a, b) => b.clicks - a.clicks).map((r) => ({
        page: r.url || '',
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: ((r.ctr ?? 0) * 100).toFixed(2),
        position: r.position.toFixed(1),
        lowCtr: r.impressions > 100 && (r.ctr ?? 0) < 0.02,
      })));
      setQueryData(queryRows.sort((a, b) => b.clicks - a.clicks).map((r) => ({
        query: r.query || '',
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: ((r.ctr ?? 0) * 100).toFixed(2),
        position: r.position.toFixed(1),
        lowCtr: r.impressions > 100 && (r.ctr ?? 0) < 0.02,
      })));
    } catch {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [propChart, propPages, propQueries, siteUrl, startDate, endDate, isCustom, customStart, customEnd]);

  useEffect(() => { load(); }, [load]);

  const filterRows = <T extends { position: string; lowCtr?: boolean }>(rows: T[]): T[] => {
    const filterDef = POSITION_FILTERS.find((f) => f.key === posFilter) || POSITION_FILTERS[0];
    return rows
      .filter((r) => filterDef.ctrOnly ? r.lowCtr : filterDef.test(r.position))
      .filter((r) => !search || (tab === 'pages'
        ? (r as unknown as PageRow).page?.toLowerCase().includes(search.toLowerCase())
        : (r as unknown as QueryRow).query?.toLowerCase().includes(search.toLowerCase())));
  };

  const metrics = calcMetrics(chartData as unknown as GSCRow[]);
  const filteredPages = filterRows(pageData);
  const filteredQueries = filterRows(queryData);

  const pagedPages = paginate(filteredPages, pagePage);
  const pagedQueries = paginate(filteredQueries, queryPage);

  const handleExport = () => {
    const data = tab === 'pages' ? filteredPages : filteredQueries;
    exportToCSV(
      `gsc-${tab}.csv`,
      [tab === 'pages' ? 'Page' : 'Query', 'Clicks', 'Impressions', 'CTR', 'Position'],
      data.map((r) => [
        tab === 'pages' ? (r as unknown as PageRow).page : (r as unknown as QueryRow).query,
        r.clicks, r.impressions, r.ctr + '%', r.position,
      ])
    );
    onExport?.();
  };

  const pageColumns = [
    {
      key: 'page',
      label: 'Page',
      render: (val: unknown, row: Record<string, unknown>) => (
        <span className="flex items-center gap-1.5">
          <span className="truncate max-w-xs" title={String(val)}>{String(val).replace(/^https?:\/\/[^/]+/, '') || '/'}</span>
          {Boolean(row.lowCtr) && <Badge variant="warning">Low CTR</Badge>}
        </span>
      ),
    },
    { key: 'clicks', label: 'Clicks', align: 'right' as const, render: (v: unknown) => formatNum(Number(v)) },
    { key: 'impressions', label: 'Impressions', align: 'right' as const, render: (v: unknown) => formatNum(Number(v)) },
    { key: 'ctr', label: 'CTR', align: 'right' as const, render: (v: unknown) => v + '%' },
    { key: 'position', label: 'Position', align: 'right' as const },
  ];

  const queryColumns = [
    {
      key: 'query',
      label: 'Query',
      render: (val: unknown, row: Record<string, unknown>) => (
        <span className="flex items-center gap-1.5">
          <span>{String(val)}</span>
          {Boolean(row.lowCtr) && <Badge variant="warning">Low CTR</Badge>}
        </span>
      ),
    },
    { key: 'clicks', label: 'Clicks', align: 'right' as const, render: (v: unknown) => formatNum(Number(v)) },
    { key: 'impressions', label: 'Impressions', align: 'right' as const, render: (v: unknown) => formatNum(Number(v)) },
    { key: 'ctr', label: 'CTR', align: 'right' as const, render: (v: unknown) => v + '%' },
    { key: 'position', label: 'Position', align: 'right' as const },
  ];

  const loadingFinal = propLoading ?? loading;
  const errorFinal = propError ?? error;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Search Performance"
        subtitle="Google Search Console analytics overview"
        action={
          <div className="flex flex-col gap-2 items-end">
            <div className="flex gap-2 flex-wrap">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    !isCustom && preset === p
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                  onClick={() => { setPreset(p); setIsCustom(false); }}
                >
                  {p === 'last7' ? '7 Days' : p === 'last28' ? '28 Days' : '90 Days'}
                </button>
              ))}
              <button
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  isCustom ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                onClick={() => setIsCustom(true)}
              >
                Custom
              </button>
            </div>
            {isCustom && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  className="rounded-md border border-gray-300 px-2 py-1 text-xs"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                />
                <span className="text-gray-400 text-xs">→</span>
                <input
                  type="date"
                  className="rounded-md border border-gray-300 px-2 py-1 text-xs"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                />
                <Button small onClick={load} disabled={!customStart || !customEnd}>Apply</Button>
              </div>
            )}
          </div>
        }
      />

      {loadingFinal ? (
        <div className="flex items-center justify-center py-12 gap-3 text-gray-500"><Spinner /> Loading...</div>
      ) : errorFinal ? (
        <EmptyState message={errorFinal} />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard label="Total Clicks" value={formatNum(metrics.clicks)} />
            <MetricCard label="Total Impressions" value={formatNum(metrics.impressions)} />
            <MetricCard label="Avg CTR" value={metrics.ctr + '%'} />
            <MetricCard label="Avg Position" value={metrics.position} />
          </div>

          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <Tooltip />
                <Line type="monotone" dataKey="clicks" stroke="#1750a0" strokeWidth={2.5} dot={false} name="Clicks" />
                <Line type="monotone" dataKey="impressions" stroke="#2d9e6b" strokeWidth={1.5} dot={false} strokeOpacity={0.5} name="Impressions" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-lg border bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <div className="flex gap-1">
                <button
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${tab === 'pages' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}
                  onClick={() => { setTab('pages'); setSearch(''); setPagePage(1); }}
                >
                  Top Pages
                </button>
                <button
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${tab === 'queries' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}`}
                  onClick={() => { setTab('queries'); setSearch(''); setQueryPage(1); }}
                >
                  Top Queries
                </button>
              </div>
              <div className="flex items-center gap-2">
                <SearchInput value={search} onChange={(v) => { setSearch(v); setPagePage(1); setQueryPage(1); }} placeholder="Search..." />
                <Button variant="secondary" small onClick={handleExport}>Export CSV</Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-1 px-4 py-2 border-b border-gray-100">
              {POSITION_FILTERS.map((f) => (
                <button
                  key={f.key}
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                    posFilter === f.key
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  onClick={() => { setPosFilter(f.key); setPagePage(1); setQueryPage(1); }}
                >
                  {FILTER_LABELS[f.key]}
                </button>
              ))}
            </div>

            <div className="divide-y divide-gray-100">
              {tab === 'pages' ? (
                pagedPages.totalItems > 0 ? (
                  <>
                    <Table columns={pageColumns} rows={pagedPages.items as unknown as Record<string, unknown>[]} />
                    <Pagination {...pagedPages} onPage={setPagePage} />
                  </>
                ) : <EmptyState message="No data available" />
              ) : (
                pagedQueries.totalItems > 0 ? (
                  <>
                    <Table columns={queryColumns} rows={pagedQueries.items as unknown as Record<string, unknown>[]} />
                    <Pagination {...pagedQueries} onPage={setQueryPage} />
                  </>
                ) : <EmptyState message="No data available" />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}