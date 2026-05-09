'use client';

import { useExpertise } from '@/store/expertise-context';

export interface CWVData {
  url: string;
  lcp: number | null;       // seconds
  inp: number | null;       // milliseconds
  cls: number | null;       // unitless
  score: number | null;     // 0–100 PSI score
  status: 'good' | 'needs_improvement' | 'poor' | 'unknown';
}

interface Props {
  pages: CWVData[];
  onRunPSI?: (url: string) => Promise<void>;
}

function grade(lcp: number | null, inp: number | null, cls: number | null): CWVData['status'] {
  if (!lcp && !inp && !cls) return 'unknown';
  const lcpOk = !lcp || lcp <= 2.5;
  const inpOk = !inp || inp <= 200;
  const clsOk = !cls || cls <= 0.1;
  if (lcpOk && inpOk && clsOk) return 'good';
  if ((!lcp || lcp > 4) || (!inp || inp > 500) || (!cls || cls > 0.25)) return 'poor';
  return 'needs_improvement';
}

const STATUS_CONFIG = {
  good: { color: '#22c55e', label: 'Good', bg: 'rgba(34,197,94,0.1)' },
  needs_improvement: { color: '#f59e0b', label: 'Needs Work', bg: 'rgba(245,158,11,0.1)' },
  poor: { color: '#ef4444', label: 'Poor', bg: 'rgba(239,68,68,0.1)' },
  unknown: { color: '#64748b', label: 'No Data', bg: 'rgba(100,116,139,0.1)' },
};

function MetricBar({ value, unit, good, poor, label }: { value: number | null; unit: string; good: number; poor: number; label: string }) {
  if (!value) return (
    <div>
      <div style={{ fontSize: 10, color: '#64748b', marginBottom: 3 }}>{label}</div>
      <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 4, height: 6 }} />
      <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>No data</div>
    </div>
  );

  const pct = Math.min(100, (value / (poor * 1.5)) * 100);
  const color = value <= good ? '#22c55e' : value <= poor ? '#f59e0b' : '#ef4444';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 10, color: '#64748b' }}>{label}</span>
        <span style={{ fontSize: 10, fontWeight: 700, color }}>{value}{unit}</span>
      </div>
      <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
        <div style={{ background: color, width: `${pct}%`, height: '100%', borderRadius: 4, transition: 'width 0.5s ease' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
        <span style={{ fontSize: 9, color: '#22c55e' }}>Good ≤{good}{unit}</span>
        <span style={{ fontSize: 9, color: '#ef4444' }}>Poor ≥{poor}{unit}</span>
      </div>
    </div>
  );
}

export function CoreWebVitals({ pages, onRunPSI }: Props) {
  const { isBeginner } = useExpertise();
  const [running, setRunning] = React.useState<string | null>(null);

  const handlePSI = async (url: string) => {
    if (!onRunPSI) return;
    setRunning(url);
    await onRunPSI(url).catch(() => {});
    setRunning(null);
  };

  const poor = pages.filter(p => p.status === 'poor').length;
  const ni = pages.filter(p => p.status === 'needs_improvement').length;

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#f1f5f9' }}>⚡ Core Web Vitals</h3>
        {isBeginner ? (
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748b' }}>
            Measures how fast and smooth your pages feel — Google uses this for rankings
          </p>
        ) : (
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748b' }}>
            {poor} poor · {ni} needs improvement · {pages.length} pages measured
          </p>
        )}
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        {['LCP ≤2.5s', 'INP ≤200ms', 'CLS ≤0.1'].map(m => (
          <div key={m} style={{ flex: 1, background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '10px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8' }}>{m}</div>
          </div>
        ))}
      </div>

      {pages.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 32, color: '#64748b', fontSize: 13 }}>
          {onRunPSI
            ? 'No CWV data yet. Run PageSpeed Insights to measure your pages.'
            : 'Add PAGESPEED_API_KEY to enable Core Web Vitals measurement.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[...pages].sort((a, b) => {
            const order = { poor: 0, needs_improvement: 1, unknown: 2, good: 3 };
            return (order[a.status] ?? 4) - (order[b.status] ?? 4);
          }).map(page => {
            const status = page.status !== 'unknown' ? page.status : grade(page.lcp, page.inp, page.cls);
            const sc = STATUS_CONFIG[status];

            return (
              <div key={page.url} style={{
                background: sc.bg, border: `1px solid ${sc.color}30`,
                borderRadius: 12, padding: '14px 18px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {page.url.replace(/https?:\/\/[^/]+/, '') || '/'}
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      background: sc.color + '20', color: sc.color, fontSize: 10, fontWeight: 700,
                      padding: '2px 8px', borderRadius: 20,
                    }}>
                      {sc.label}
                    </span>
                    {onRunPSI && (
                      <button
                        onClick={() => handlePSI(page.url)}
                        disabled={running === page.url}
                        id={`psi-${page.url.replace(/[^a-z0-9]/gi, '-').slice(-20)}`}
                        style={{
                          padding: '4px 10px', borderRadius: 7, border: 'none',
                          background: 'rgba(255,255,255,0.08)', color: '#94a3b8',
                          cursor: 'pointer', fontSize: 10,
                        }}
                      >
                        {running === page.url ? '...' : 'Re-run'}
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                  <MetricBar value={page.lcp} unit="s" good={2.5} poor={4} label="LCP" />
                  <MetricBar value={page.inp} unit="ms" good={200} poor={500} label="INP" />
                  <MetricBar value={page.cls} unit="" good={0.1} poor={0.25} label="CLS" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Need React import for useState in this module
import React from 'react';
