'use client';

import { useExpertise } from '@/store/expertise-context';
import type { ClusterResult } from '@/types';

interface Props {
  clusters: ClusterResult[];
}

export function TopicClusters({ clusters }: Props) {
  const { isBeginner, isExpert } = useExpertise();

  if (clusters.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: '#64748b', fontSize: 13 }}>
        Upload more GSC data to enable topic cluster analysis (requires 50+ queries).
      </div>
    );
  }

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#f1f5f9' }}>🗂 Topic Clusters</h3>
        {isBeginner ? (
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748b' }}>
            Groups of related keywords — your site&apos;s main content themes
          </p>
        ) : (
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748b' }}>
            {clusters.length} clusters detected · K-Means TF-IDF
          </p>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
        {clusters.map(cluster => {
          const health = cluster.health;
          const healthColor = health >= 70 ? '#22c55e' : health >= 40 ? '#f59e0b' : '#ef4444';

          return (
            <div key={cluster.clusterId} style={{
              background: 'rgba(255,255,255,0.03)',
              border: `1px solid ${healthColor}30`,
              borderRadius: 14, padding: '16px 20px',
              display: 'flex', flexDirection: 'column', gap: 12,
            }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}>
                    {cluster.label}
                  </p>
                  {cluster.pillarPage && (
                    <p style={{ margin: '2px 0 0', fontSize: 10, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      Pillar: {cluster.pillarPage.replace(/https?:\/\/[^/]+/, '')}
                    </p>
                  )}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: healthColor }}>{health}</div>
                  <div style={{ fontSize: 9, color: '#64748b' }}>HEALTH</div>
                </div>
              </div>

              {/* Metrics */}
              <div style={{ display: 'flex', gap: 16 }}>
                <Metric label="Queries" value={cluster.queries.length} />
                <Metric label="Avg Pos" value={cluster.avgPosition.toFixed(1)} />
                <Metric label="Avg CTR" value={`${cluster.avgCTR.toFixed(1)}%`} />
                <Metric label="Impressions" value={cluster.totalImpressions.toLocaleString()} />
              </div>

              {/* Queries preview */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {cluster.queries.slice(0, 5).map(q => (
                  <span key={q} style={{
                    fontSize: 10, background: 'rgba(255,255,255,0.06)', padding: '2px 7px',
                    borderRadius: 20, color: '#94a3b8', maxWidth: 140,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {q}
                  </span>
                ))}
                {cluster.queries.length > 5 && (
                  <span style={{ fontSize: 10, color: '#64748b', padding: '2px 4px' }}>
                    +{cluster.queries.length - 5} more
                  </span>
                )}
              </div>

              {/* Gaps */}
              {cluster.gaps.length > 0 && (
                <div style={{ background: 'rgba(239,68,68,0.08)', borderRadius: 8, padding: '8px 12px' }}>
                  <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 700, color: '#f87171', textTransform: 'uppercase' }}>
                    Content Gaps
                  </p>
                  {cluster.gaps.slice(0, 2).map(g => (
                    <p key={g} style={{ margin: '0 0 2px', fontSize: 11, color: '#94a3b8' }}>• {g}</p>
                  ))}
                </div>
              )}

              {/* Expert: pages */}
              {isExpert && cluster.pages.length > 0 && (
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                    Pages ({cluster.pages.length})
                  </p>
                  {cluster.pages.slice(0, 2).map(p => (
                    <p key={p} style={{ margin: 0, fontSize: 10, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.replace(/https?:\/\/[^/]+/, '') || '/'}
                    </p>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9' }}>{value}</div>
      <div style={{ fontSize: 10, color: '#64748b' }}>{label}</div>
    </div>
  );
}
