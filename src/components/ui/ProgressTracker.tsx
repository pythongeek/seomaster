'use client';

import { useState } from 'react';

interface ProgressItem {
  id: number;
  query: string;
  actionType: string;
  status: 'open' | 'in_progress' | 'resolved' | 'dismissed';
  estimatedGain: number;
  resolvedAt?: string | Date | null;
  resolvedReason?: string | null;
}

interface Props {
  items: ProgressItem[];
  totalResolved: number;
  totalOpportunities: number;
  resolutionRate: number;
  onMarkResolved?: (id: number) => Promise<void>;
  onDismiss?: (id: number) => Promise<void>;
}

const STATUS_COLORS = {
  open: { bg: 'rgba(59,130,246,0.15)', text: '#3b82f6', label: 'Open' },
  in_progress: { bg: 'rgba(234,179,8,0.15)', text: '#eab308', label: 'In Progress' },
  resolved: { bg: 'rgba(34,197,94,0.15)', text: '#22c55e', label: '✓ Resolved' },
  dismissed: { bg: 'rgba(100,116,139,0.15)', text: '#64748b', label: 'Skipped' },
};

export function ProgressTracker({ items, totalResolved, totalOpportunities, resolutionRate, onMarkResolved, onDismiss }: Props) {
  const [loading, setLoading] = useState<number | null>(null);

  const handle = async (id: number, fn?: (id: number) => Promise<void>) => {
    if (!fn) return;
    setLoading(id);
    await fn(id).catch(() => {});
    setLoading(null);
  };

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      {/* Progress bar */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>
            Resolution Progress
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#22c55e' }}>
            {totalResolved}/{totalOpportunities} resolved ({resolutionRate}%)
          </span>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 8, height: 8, overflow: 'hidden' }}>
          <div style={{
            background: 'linear-gradient(90deg, #22c55e, #16a34a)',
            height: '100%', borderRadius: 8,
            width: `${resolutionRate}%`,
            transition: 'width 0.6s ease',
          }} />
        </div>
      </div>

      {/* Item list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map(item => {
          const s = STATUS_COLORS[item.status];
          return (
            <div key={item.id} style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 10, padding: '12px 16px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
              opacity: item.status === 'dismissed' ? 0.5 : 1,
            }}>
              <div style={{ flex: 1 }}>
                <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>
                  &ldquo;{item.query}&rdquo;
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    background: s.bg, color: s.text, fontSize: 10, fontWeight: 700,
                    padding: '2px 6px', borderRadius: 20,
                  }}>
                    {s.label}
                  </span>
                  <span style={{ fontSize: 11, color: '#64748b' }}>
                    {item.actionType.replace(/_/g, ' ')}
                  </span>
                  {item.status === 'resolved' && item.resolvedReason && (
                    <span style={{ fontSize: 10, color: '#64748b' }} title={item.resolvedReason}>
                      ↳ {item.resolvedReason.slice(0, 40)}...
                    </span>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#22c55e' }}>
                  +{item.estimatedGain}
                </span>
                {item.status === 'open' && (
                  <>
                    {onMarkResolved && (
                      <button
                        onClick={() => handle(item.id, onMarkResolved)}
                        disabled={loading === item.id}
                        id={`resolve-${item.id}`}
                        style={{
                          padding: '5px 10px', borderRadius: 7, border: 'none',
                          background: 'rgba(34,197,94,0.2)', color: '#22c55e',
                          cursor: 'pointer', fontSize: 11, fontWeight: 600,
                        }}
                      >
                        {loading === item.id ? '...' : '✓ Done'}
                      </button>
                    )}
                    {onDismiss && (
                      <button
                        onClick={() => handle(item.id, onDismiss)}
                        disabled={loading === item.id}
                        style={{
                          padding: '5px 10px', borderRadius: 7, border: '1px solid rgba(255,255,255,0.1)',
                          background: 'transparent', color: '#64748b', cursor: 'pointer', fontSize: 11,
                        }}
                      >
                        Skip
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
