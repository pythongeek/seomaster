'use client';

import { useEffect, useState } from 'react';
import { HealthScoreBadge } from '@/components/ui/HealthScoreBadge';
import { PriorityActionFeed } from '@/components/ui/PriorityActionFeed';
import { ExpertiseLevelToggle } from '@/components/ui/ExpertiseLevelToggle';
import { useExpertise } from '@/store/expertise-context';
import { useStore } from '@/store';
import type { HealthScoreResult } from '@/types';

interface DashboardData {
  healthScore: HealthScoreResult | null;
  openOpportunities: number;
  resolvedThisWeek: number;
  estimatedMonthlyGain: number;
  priorityActions: Array<{
    actionType: string;
    label: string;
    description: string;
    estimatedGain: number;
    effort: string;
    effortLabel: string;
    color: string;
    steps: Array<{ title: string; timeEstimate: string }>;
  }>;
  trendSeries: Array<{ week: Date | null; score: number }>;
}

const ACTION_COLORS: Record<string, string> = {
  cannibalization_fix: '#f97316', ai_overview_pivot: '#8b5cf6',
  snippet_rewrite: '#3b82f6', declining_near_p1: '#ef4444',
  technical_review: '#f59e0b', quick_win_content: '#22c55e',
  content_creation: '#06b6d4', monitor: '#64748b',
};
const ACTION_LABELS: Record<string, string> = {
  cannibalization_fix: '🔗 Fix Cannibalization', ai_overview_pivot: '🤖 AI Overview Pivot',
  snippet_rewrite: '✏️ Rewrite Snippet', declining_near_p1: '📉 Stop Decline',
  technical_review: '🔧 Technical Fix', quick_win_content: '⚡ Quick Win',
  content_creation: '📝 Create Content', monitor: '👁 Monitor',
};

interface Props {
  siteUrl: string;
}

export function ExecutiveDashboard({ siteUrl }: Props) {
  const [data, setData] = useState<DashboardData>({
    healthScore: null, openOpportunities: 0, resolvedThisWeek: 0,
    estimatedMonthlyGain: 0, priorityActions: [], trendSeries: [],
  });
  const [loading, setLoading] = useState(true);
  const { isBeginner } = useExpertise();

  useEffect(() => {
    if (!siteUrl) { setLoading(false); return; }

    async function load() {
      try {
        const [healthRes, progressRes] = await Promise.all([
          fetch(`/api/health-score?siteUrl=${encodeURIComponent(siteUrl)}&weeks=8`),
          fetch(`/api/progress?siteUrl=${encodeURIComponent(siteUrl)}&status=open&limit=10`),
        ]);

        const healthData = healthRes.ok ? await healthRes.json() : null;
        const progressData = progressRes.ok ? await progressRes.json() : null;

        const opps = progressData?.opportunities ?? [];
        const priorityActions = opps.map((o: { actionType: string; actionPlan: { steps: Array<{ title: string; timeEstimate: string }>; effortLabel: string } | null; estimatedGain: number; effort: string }) => ({
          actionType: o.actionType,
          label: ACTION_LABELS[o.actionType] ?? o.actionType,
          description: (o.actionPlan as { steps: Array<{ description: string }> } | null)?.steps?.[0]?.description ?? 'See action plan for steps',
          estimatedGain: o.estimatedGain,
          effort: o.effort,
          effortLabel: (o.actionPlan as { effortLabel: string } | null)?.effortLabel ?? o.effort,
          color: ACTION_COLORS[o.actionType] ?? '#64748b',
          steps: (o.actionPlan as { steps: Array<{ title: string; timeEstimate: string }> } | null)?.steps?.map((s) => ({
            title: s.title, timeEstimate: s.timeEstimate,
          })) ?? [],
        }));

        const latestEntry = healthData?.latestEntry;
        setData({
          healthScore: healthData ? {
            overallScore: healthData.currentScore ?? 0,
            grade: healthData.grade ?? 'C',
            trend: healthData.trend ?? '→ Stable',
            weeklyDelta: latestEntry?.delta ?? null,
            dimensions: [],
            totalOpportunities: progressData?.count ?? 0,
            resolvedThisWeek: latestEntry?.resolvedThisWeek ?? 0,
            estimatedMonthlyGain: latestEntry?.estimatedMonthlyGain ?? 0,
          } : null,
          openOpportunities: progressData?.count ?? 0,
          resolvedThisWeek: latestEntry?.resolvedThisWeek ?? 0,
          estimatedMonthlyGain: latestEntry?.estimatedMonthlyGain ?? 0,
          priorityActions,
          trendSeries: healthData?.trendSeries ?? [],
        });
      } catch (e) {
        console.error('[ExecutiveDashboard load error]', e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [siteUrl]);

  if (loading) {
    return (
      <div style={{
        background: 'rgba(255,255,255,0.02)', borderRadius: 16, padding: 32,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: '-apple-system, sans-serif', color: '#64748b', fontSize: 14,
      }}>
        Loading dashboard...
      </div>
    );
  }

  if (!siteUrl && !data.healthScore) {
    return (
      <div style={{
        background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.1)',
        borderRadius: 16, padding: '60px 32px', textAlign: 'center',
        fontFamily: '-apple-system, sans-serif', color: '#f1f5f9',
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔌</div>
        <h2 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 8px' }}>Connect Your Data</h2>
        <p style={{ color: '#94a3b8', fontSize: 14, maxWidth: 400, margin: '0 auto 24px' }}>
          To view your Executive Dashboard and AI recommendations, you need to connect your Google Search Console or upload a CSV export.
        </p>
        <button
          onClick={() => useStore.getState().setActiveTab('gsc')}
          style={{
            background: '#ef4444', color: '#fff', border: 'none', padding: '12px 24px',
            borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer',
            boxShadow: '0 4px 14px 0 rgba(239,68,68,0.39)',
          }}
        >
          Connect GSC / Upload Data
        </button>
      </div>
    );
  }

  const hs = data.healthScore;
  const totalGain = data.estimatedMonthlyGain;

  return (
    <div style={{
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      display: 'flex', flexDirection: 'column', gap: 20,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#f1f5f9' }}>
            📊 Executive Dashboard
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#64748b' }}>
            {siteUrl} · Updated on analysis
          </p>
        </div>
        <ExpertiseLevelToggle compact />
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        {/* Health Score */}
        <div style={{
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 14, padding: '20px 24px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
        }}>
          {hs ? (
            <HealthScoreBadge
              score={hs.overallScore} grade={hs.grade}
              trend={hs.trend} weeklyDelta={hs.weeklyDelta}
              size="lg"
            />
          ) : (
            <div style={{ width: 110, height: 110, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 12 }}>
              No data
            </div>
          )}
          <span style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8' }}>SEO Health</span>
        </div>

        {/* Open Opportunities */}
        <KPICard
          value={data.openOpportunities}
          label="Open Opportunities"
          color="#3b82f6"
          icon="🎯"
          beginner={isBeginner ? 'SEO tasks waiting for you' : undefined}
        />

        {/* Resolved this week */}
        <KPICard
          value={data.resolvedThisWeek}
          label="Resolved This Week"
          color="#22c55e"
          icon="✅"
          beginner={isBeginner ? 'Issues fixed recently' : undefined}
        />

        {/* Monthly gain */}
        <KPICard
          value={`+${totalGain.toLocaleString()}`}
          label="Est. Monthly Gain"
          color="#f59e0b"
          icon="📈"
          suffix="clicks/mo"
          beginner={isBeginner ? 'Extra visitors if all fixed' : undefined}
        />
      </div>

      {/* Trend sparkline (expert mode only) */}
      {!isBeginner && data.trendSeries.length >= 3 && (
        <div style={{
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 14, padding: '16px 20px',
        }}>
          <p style={{ margin: '0 0 12px', fontSize: 12, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Health Score Trend (last {data.trendSeries.length} weeks)
          </p>
          <SparkLine series={data.trendSeries} color="#3b82f6" />
        </div>
      )}

      {/* Priority Actions */}
      <div style={{
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 14, padding: '20px 24px',
      }}>
        <p style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}>
          🚀 Priority Actions
        </p>
        <PriorityActionFeed actions={data.priorityActions} />
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KPICard({ value, label, color, icon, suffix, beginner }: {
  value: string | number;
  label: string;
  color: string;
  icon: string;
  suffix?: string;
  beginner?: string;
}) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)', border: `1px solid ${color}20`,
      borderRadius: 14, padding: '20px 24px',
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 8,
    }}>
      <span style={{ fontSize: 24 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1 }}>
          {value}
        </div>
        {suffix && <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{suffix}</div>}
      </div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8' }}>{label}</div>
        {beginner && <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{beginner}</div>}
      </div>
    </div>
  );
}

function SparkLine({ series, color }: { series: Array<{ score: number }>; color: string }) {
  const scores = series.map(s => s.score);
  const min = Math.min(...scores, 0);
  const max = Math.max(...scores, 100);
  const range = max - min || 1;
  const W = 320, H = 48, pad = 4;
  const step = (W - pad * 2) / (scores.length - 1);

  const points = scores.map((s, i) => {
    const x = pad + i * step;
    const y = H - pad - ((s - min) / range) * (H - pad * 2);
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={W} height={H} style={{ overflow: 'visible' }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {scores.map((s, i) => {
        const x = pad + i * step;
        const y = H - pad - ((s - min) / range) * (H - pad * 2);
        return <circle key={i} cx={x} cy={y} r={3} fill={color} />;
      })}
    </svg>
  );
}
