'use client';

import { useExpertise } from '@/store/expertise-context';

interface Props {
  query: string;
  page: string;
  currentCTR: number;
  benchmarkCTR: number;
  impressions: number;
  expertMode?: boolean;
}

export function CtrBeforeAfter({ query, page, currentCTR, benchmarkCTR, impressions, expertMode }: Props) {
  const { isBeginner } = useExpertise();
  const gap = benchmarkCTR - currentCTR;
  const gapClicks = Math.round(impressions * gap / 100);
  const isUnder = gap > 0;
  const barMax = Math.max(benchmarkCTR * 1.2, currentCTR * 1.2, 5);

  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: `1px solid ${isUnder ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`,
      borderRadius: 10, padding: '14px 18px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 600, color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        &ldquo;{query}&rdquo;
      </p>
      {(expertMode || !isBeginner) && (
        <p style={{ margin: '0 0 10px', fontSize: 10, color: '#64748b' }}>{page}</p>
      )}

      {/* Bar chart */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {/* Current */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
            <span style={{ fontSize: 11, color: '#94a3b8' }}>Your CTR</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: isUnder ? '#ef4444' : '#22c55e' }}>
              {currentCTR.toFixed(2)}%
            </span>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 4, height: 8 }}>
            <div style={{
              background: isUnder ? '#ef4444' : '#22c55e',
              width: `${(currentCTR / barMax) * 100}%`, height: '100%', borderRadius: 4,
              transition: 'width 0.5s ease',
            }} />
          </div>
        </div>
        {/* Benchmark */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
            <span style={{ fontSize: 11, color: '#94a3b8' }}>Benchmark (pos {Math.round(benchmarkCTR)})</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa' }}>{benchmarkCTR.toFixed(2)}%</span>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 4, height: 8 }}>
            <div style={{
              background: '#3b82f6',
              width: `${(benchmarkCTR / barMax) * 100}%`, height: '100%', borderRadius: 4,
              transition: 'width 0.5s ease',
            }} />
          </div>
        </div>
      </div>

      {/* Gap summary */}
      <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        {isUnder ? (
          <p style={{ margin: 0, fontSize: 12, color: '#ef4444' }}>
            ⚠️ {gap.toFixed(1)}% CTR gap ≈ <strong style={{ color: '#f87171' }}>−{gapClicks} clicks/mo</strong> missed
          </p>
        ) : (
          <p style={{ margin: 0, fontSize: 12, color: '#22c55e' }}>
            ✓ Above benchmark by {Math.abs(gap).toFixed(1)}% (+{Math.abs(gapClicks)} extra clicks/mo)
          </p>
        )}
      </div>
    </div>
  );
}
