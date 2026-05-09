'use client';

import { useState } from 'react';
import { useExpertise } from '@/store/expertise-context';

interface ContentGap {
  query: string;
  impressions: number;
  clicks: number;
  position: number;
  ctr: number;
  intent?: string;
  zeroClickReason?: string;
  estimatedPotential?: number;
}

interface Props {
  gaps: ContentGap[];
  onGenerateBrief?: (query: string, intent: string) => Promise<void>;
}

const INTENT_COLORS: Record<string, string> = {
  informational: '#3b82f6',
  commercial: '#f59e0b',
  transactional: '#22c55e',
  navigational: '#8b5cf6',
  local: '#06b6d4',
  unknown: '#64748b',
};

export function ContentGapPanel({ gaps, onGenerateBrief }: Props) {
  const [generating, setGenerating] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<'impressions' | 'potential' | 'position'>('impressions');
  const { isBeginner, isExpert } = useExpertise();

  const sorted = [...gaps].sort((a, b) => {
    if (sortKey === 'position') return a.position - b.position;
    if (sortKey === 'potential') return (b.estimatedPotential ?? b.impressions) - (a.estimatedPotential ?? a.impressions);
    return b.impressions - a.impressions;
  });

  const handleBrief = async (gap: ContentGap) => {
    if (!onGenerateBrief) return;
    setGenerating(gap.query);
    await onGenerateBrief(gap.query, gap.intent ?? 'informational').catch(() => {});
    setGenerating(null);
  };

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#f1f5f9' }}>
            📝 Content Gap Analysis
          </h3>
          {isBeginner ? (
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748b' }}>
              Pages that appear in search but get no clicks — create better content to fix this
            </p>
          ) : (
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748b' }}>
              {sorted.length} zero-click queries with organic impression data
            </p>
          )}
        </div>
        <select
          value={sortKey}
          onChange={e => setSortKey(e.target.value as typeof sortKey)}
          id="content-gap-sort"
          style={{
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8, padding: '5px 10px', color: '#94a3b8', fontSize: 11, cursor: 'pointer',
          }}
        >
          <option value="impressions">By Impressions</option>
          <option value="potential">By Potential</option>
          <option value="position">By Position</option>
        </select>
      </div>

      {sorted.length === 0 && (
        <div style={{ textAlign: 'center', padding: 32, color: '#64748b', fontSize: 13 }}>
          No content gaps detected. Great — all queries are getting clicks!
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {sorted.slice(0, 20).map(gap => {
          const intentColor = INTENT_COLORS[gap.intent ?? 'unknown'] ?? '#64748b';

          return (
            <div key={gap.query} style={{
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12, padding: '14px 18px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            }}>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  {gap.intent && (
                    <span style={{
                      background: intentColor + '20', color: intentColor, fontSize: 10, fontWeight: 700,
                      padding: '2px 7px', borderRadius: 20,
                    }}>
                      {gap.intent}
                    </span>
                  )}
                  {isExpert && gap.zeroClickReason && (
                    <span style={{ fontSize: 10, color: '#64748b' }}>
                      Reason: {gap.zeroClickReason}
                    </span>
                  )}
                </div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  &ldquo;{gap.query}&rdquo;
                </p>
                <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                  <span style={{ fontSize: 11, color: '#64748b' }}>
                    {gap.impressions.toLocaleString()} impressions
                  </span>
                  <span style={{ fontSize: 11, color: '#64748b' }}>
                    Pos {gap.position.toFixed(1)}
                  </span>
                  {gap.estimatedPotential && (
                    <span style={{ fontSize: 11, color: '#22c55e' }}>
                      +{gap.estimatedPotential} potential clicks
                    </span>
                  )}
                </div>
              </div>

              {onGenerateBrief && (
                <button
                  onClick={() => handleBrief(gap)}
                  disabled={generating === gap.query}
                  id={`brief-${gap.query.replace(/\s+/g, '-').slice(0, 20)}`}
                  style={{
                    padding: '7px 14px', borderRadius: 8, border: 'none',
                    background: 'rgba(59,130,246,0.2)', color: '#60a5fa',
                    cursor: 'pointer', fontSize: 11, fontWeight: 600, flexShrink: 0,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {generating === gap.query ? '⏳ Generating...' : '✍️ AI Brief'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
