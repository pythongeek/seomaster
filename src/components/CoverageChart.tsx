'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button, Spinner, EmptyState, SectionHeader, Table, SearchInput } from './LegacyUI';
import { exportToCSV } from '@/lib/csvExport';
import { GSCRow } from '@/lib/gsc-fetcher';

const STATUS_COLORS: Record<string, string> = {
  valid: '#0F6E56',
  error: '#A32D2D',
  excluded: '#854F0B',
  warning: '#185FA5',
};

function DonutChart({ segments }: { segments: { label: string; value: number; color: string }[] }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) return null;

  let cumulative = 0;
  const radius = 60;
  const cx = 80;
  const cy = 80;
  const circumference = 2 * Math.PI * radius;

  const arcs = segments.map((seg) => {
    const pct = seg.value / total;
    const offset = circumference * (1 - cumulative - pct);
    cumulative += pct;
    return { ...seg, pct, offset, dash: circumference * pct };
  });

  return (
    <svg width={160} height={160} viewBox="0 0 160 160" className="flex-shrink-0">
      {arcs.map((arc, i) => (
        <circle
          key={i}
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={arc.color}
          strokeWidth={18}
          strokeDasharray={`${arc.dash} ${circumference - arc.dash}`}
          strokeDashoffset={arc.offset + circumference * 0.25}
          style={{ transition: 'stroke-dasharray 0.4s ease' }}
        />
      ))}
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize={22} fontWeight={500} fill="currentColor">
        {total.toLocaleString()}
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle" fontSize={11} fill="#888">
        total
      </text>
    </svg>
  );
}

type CoverageRow = {
  page: string;
  clicks: number;
  impressions: number;
  ctr: string;
  position: string;
  status: 'valid' | 'excluded' | 'error' | 'warning';
};

interface CoverageChartProps {
  data?: GSCRow[];
  isLoading?: boolean;
  error?: string;
  siteUrl?: string;
  startDate?: string;
  endDate?: string;
  onInspectUrl?: (url: string) => void;
}

export function CoverageChart({ data: propData, isLoading: propLoading, error: propError, siteUrl, startDate, endDate, onInspectUrl }: CoverageChartProps) {
  const [data, setData] = useState<CoverageRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    if (propData) {
      setData(propData.map((r) => ({
        page: r.url || '',
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: ((r.ctr ?? 0) * 100).toFixed(2),
        position: r.position.toFixed(1),
        status: r.impressions > 0 ? 'valid' : 'excluded',
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
        body: JSON.stringify({ siteUrl, startDate, endDate, dimensions: ['page'], rowLimit: 5000 }),
      });
      const json = await res.json();
      const rows: GSCRow[] = json.rows || [];
      setData(rows.map((r) => ({
        page: r.url || '',
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: ((r.ctr ?? 0) * 100).toFixed(2),
        position: r.position.toFixed(1),
        status: r.impressions > 0 ? 'valid' : 'excluded',
      })));
    } catch {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [propData, siteUrl, startDate, endDate]);

  useEffect(() => { load(); }, [load]);

  const counts = {
    valid: data.filter((d) => d.status === 'valid').length,
    excluded: data.filter((d) => d.status === 'excluded').length,
    error: 0,
    warning: 0,
  };

  const donutSegments = [
    { label: 'Valid', value: counts.valid, color: STATUS_COLORS.valid },
    { label: 'Excluded', value: counts.excluded, color: STATUS_COLORS.excluded },
    { label: 'Error', value: counts.error, color: STATUS_COLORS.error },
    { label: 'Warning', value: counts.warning, color: STATUS_COLORS.warning },
  ].filter((s) => s.value > 0);

  const filtered = data.filter(
    (d) => !search || d.page.toLowerCase().includes(search.toLowerCase())
  );

  const handleExport = () => {
    exportToCSV('gsc-coverage.csv', ['Status', 'URL', 'Clicks', 'Impressions', 'CTR', 'Position'],
      filtered.map((r) => [r.status, r.page, r.clicks, r.impressions, r.ctr + '%', r.position])
    );
  };

  const columns = [
    {
      key: 'status',
      label: 'Status',
      render: (val: unknown) => (
        <span className={`inline-flex items-center gap-1.5`}>
          <span className={`inline-block w-2 h-2 rounded-full ${
            val === 'valid' ? 'bg-green-600' :
            val === 'excluded' ? 'bg-yellow-600' :
            val === 'error' ? 'bg-red-600' : 'bg-blue-600'
          }`} />
          <span className="text-sm capitalize">{String(val)}</span>
        </span>
      ),
    },
    {
      key: 'page',
      label: 'URL',
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
    ...(onInspectUrl ? [{
      key: 'inspect',
      label: '',
      render: (_: unknown, row: Record<string, unknown>) => (
        <button
          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          onClick={(e) => { e.stopPropagation(); onInspectUrl(String(row.page)); }}
        >
          Inspect →
        </button>
      ),
    }] : []),
  ];

  const loadingFinal = propLoading ?? loading;
  const errorFinal = propError ?? error;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Coverage"
        subtitle="Index coverage and performance by URL"
      />

      {loadingFinal ? (
        <div className="flex items-center justify-center py-12 gap-3 text-gray-500"><Spinner /> Loading...</div>
      ) : errorFinal ? (
        <EmptyState message={errorFinal} />
      ) : (
        <>
          <div className="flex items-center gap-8 rounded-lg border bg-white p-6 shadow-sm">
            <DonutChart segments={donutSegments} />
            <div className="space-y-3">
              {[
                { key: 'valid', label: 'Valid', count: counts.valid },
                { key: 'excluded', label: 'Excluded', count: counts.excluded },
                { key: 'error', label: 'Error', count: counts.error },
                { key: 'warning', label: 'Warning', count: counts.warning },
              ].map((item) => (
                <div key={item.key} className="flex items-center gap-3">
                  <span className="inline-block w-3 h-3 rounded-full" style={{ background: STATUS_COLORS[item.key] }} />
                  <span className="text-sm text-gray-600">{item.label}</span>
                  <span className="text-sm font-semibold text-gray-900">{item.count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
              <SearchInput value={search} onChange={(v) => setSearch(v)} placeholder="Search URLs..." />
              <Button variant="secondary" small onClick={handleExport}>Export CSV</Button>
            </div>
            {filtered.length > 0 ? (
              <Table columns={columns} rows={filtered as unknown as Record<string, unknown>[]} />
            ) : (
              <EmptyState message="No data available" />
            )}
          </div>
        </>
      )}
    </div>
  );
}