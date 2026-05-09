'use client';

import { useState } from 'react';
import { useExpertise } from '@/store/expertise-context';
import type { AIOverviewRiskResult } from '@/types';

interface Props {
  items: Array<{
    query: string;
    page: string;
    position: number;
    ctr: number;
    impressions: number;
    risk: AIOverviewRiskResult;
  }>;
  geminiAvailable?: boolean;
  onSerpCheck?: (query: string) => Promise<void>;
}

const TIER_CONFIG = {
  standard: { color: '#22c55e', bg: 'rgba(34,197,94,0.1)', label: '✅ Standard', description: 'Low AI Overview risk — focus on organic improvements' },
  featured_snippet_target: { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)', label: '⭐ Snippet Target', description: 'Aim for featured snippet to protect against AI displacement' },
  data_pivot: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', label: '📊 Data Pivot', description: 'Add unique data/research to differentiate from AI answers' },
  deprioritize: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)', label: '⚠️ Deprioritize', description: 'High AI risk — redirect effort to related transactional queries' },
};

export function AIOverviewPanel({ items, geminiAvailable, onSerpCheck }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [checking, setChecking] = useState<string | null>(null);
  const { isBeginner, isExpert } = useExpertise();

  const handleSerpCheck = async (query: string) => {
    if (!onSerpCheck) return;
    setChecking(query);
    await onSerpCheck(query).catch(() => {});
    setChecking(null);
  };

  const sorted = [...items].sort((a, b) => b.risk.riskScore - a.risk.riskScore);
  const high = sorted.filter(i => i.risk.riskScore >= 60).length;
  const medium = sorted.filter(i => i.risk.riskScore >= 30 && i.risk.riskScore < 60).length;

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#f1f5f9' }}>
          🤖 AI Overview Risk
        </h3>
        {isBeginner ? (
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748b' }}>
            These keywords may be losing clicks to Google&apos;s AI answers
          </p>
        ) : (
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748b' }}>
            {high} high-risk · {medium} moderate-risk · {sorted.length} total analysed
          </p>
        )}
      </div>

      {!geminiAvailable && (
        <div style={{
          background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
          borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#fbbf24',
        }}>
          ⚡ Add <code style={{ background: 'rgba(255,255,255,0.1)', padding: '1px 4px', borderRadius: 4 }}>GEMINI_API_KEY</code> to enable live SERP checks for high-risk queries
        </div>
      )}

      {sorted.length === 0 && (
        <div style={{ textAlign: 'center', padding: 32, color: '#64748b', fontSize: 13 }}>
          Run an analysis to identify AI Overview risk in your GSC data.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {sorted.slice(0, 15).map(item => {
          const tier = TIER_CONFIG[item.risk.riskTier];
          const isOpen = expanded === item.query;

          return (
            <div key={item.query} style={{
              background: tier.bg, border: `1px solid ${tier.color}30`,
              borderRadius: 12, overflow: 'hidden',
            }}>
              <button
                onClick={() => setExpanded(isOpen ? null : item.query)}
                style={{
                  all: 'unset', display: 'flex', width: '100%', boxSizing: 'border-box',
                  alignItems: 'center', justifyContent: 'space-between', gap: 12,
                  padding: '14px 18px', cursor: 'pointer',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span style={{
                      background: tier.color + '20', color: tier.color, fontSize: 10, fontWeight: 700,
                      padding: '2px 7px', borderRadius: 20,
                    }}>
                      {tier.label}
                    </span>
                    {isExpert && (
                      <span style={{ fontSize: 10, color: '#64748b' }}>Pos {item.position.toFixed(1)} · {item.ctr.toFixed(2)}% CTR</span>
                    )}
                  </div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>
                    &ldquo;{item.query}&rdquo;
                  </p>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: tier.color }}>{item.risk.riskScore}</div>
                  <div style={{ fontSize: 9, color: '#64748b' }}>RISK</div>
                </div>
              </button>

              {isOpen && (
                <div style={{ padding: '0 18px 14px', borderTop: `1px solid ${tier.color}20` }}>
                  {/* Counter strategy */}
                  <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '10px 14px', margin: '12px 0' }}>
                    <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 700, color: tier.color, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Recommended Action
                    </p>
                    <p style={{ margin: 0, fontSize: 12, color: '#cbd5e1', lineHeight: 1.5 }}>
                      {item.risk.counterStrategy}
                    </p>
                  </div>

                  {/* Risk signals */}
                  {isExpert && item.risk.signals.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <p style={{ margin: '0 0 6px', fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Risk Signals
                      </p>
                      <ul style={{ margin: 0, paddingLeft: 16 }}>
                        {item.risk.signals.map((s, i) => (
                          <li key={i} style={{ fontSize: 11, color: '#94a3b8', marginBottom: 3 }}>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Score breakdown (expert only) */}
                  {isExpert && (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                      {Object.entries(item.risk.signalBreakdown).map(([k, v]) => (
                        <span key={k} style={{
                          fontSize: 10, background: 'rgba(255,255,255,0.06)', padding: '3px 8px',
                          borderRadius: 20, color: '#94a3b8',
                        }}>
                          {k.replace(/([A-Z])/g, ' $1').trim()}: <strong style={{ color: '#f1f5f9' }}>{v}</strong>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Gemini SERP check */}
                  {geminiAvailable && item.risk.geminiCheckRecommended && onSerpCheck && (
                    <button
                      onClick={() => handleSerpCheck(item.query)}
                      disabled={checking === item.query}
                      id={`serp-check-${item.query.replace(/\s+/g, '-').slice(0, 20)}`}
                      style={{
                        padding: '7px 14px', borderRadius: 8, border: 'none',
                        background: 'rgba(139,92,246,0.2)', color: '#a78bfa',
                        cursor: 'pointer', fontSize: 12, fontWeight: 600,
                      }}
                    >
                      {checking === item.query ? '⏳ Checking SERP...' : '🔍 Live SERP Check'}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
