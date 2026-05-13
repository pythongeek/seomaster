'use client';

import { useState, useEffect } from 'react';
import { ActionPlanCard } from '@/components/ui/ActionPlanCard';
import { ProgressTracker } from '@/components/ui/ProgressTracker';
import { CtrBeforeAfter } from '@/components/ui/CtrBeforeAfter';
import { useExpertise } from '@/store/expertise-context';
import { useStore } from '@/store';
import type { ActionPlan } from '@/types';

interface Opportunity {
  id: number;
  query: string;
  page: string;
  position: number;
  ctr: number;
  impressions: number;
  score: number;
  estimatedGain: number;
  actionType: string;
  actionPlan: ActionPlan | null;
  aiRisk?: number;
  status: 'open' | 'in_progress' | 'resolved' | 'dismissed';
  benchmarkCTR?: number;
}

interface Props {
  opportunities?: Opportunity[];
  siteUrl: string;
  onRefresh?: () => void;
}

type SortKey = 'score' | 'gain' | 'position';
type FilterStatus = 'open' | 'all';

// Derive opportunities from gscResult when DB is empty
function deriveFromGscResult(gscResult: unknown, siteUrl: string): Opportunity[] {
  if (!gscResult) return [];
  const r = gscResult as Record<string, unknown>;

  const opportunities: Opportunity[] = [];

  // From priorityMatrix
  const priorityMatrix = (r.priorityMatrix as Array<{
    query?: string; page?: string; opportunityScore?: number;
    recommendedAction?: string; effort?: string; impact?: string;
    timeToValue?: string; commercialValue?: number;
  }>) || [];
  priorityMatrix.slice(0, 25).forEach(p => {
    opportunities.push({
      id: 0, // derived, not from DB
      query: p.query ?? '',
      page: p.page ?? '',
      position: 0,
      ctr: 0,
      impressions: 0,
      score: p.opportunityScore ?? 0,
      estimatedGain: p.commercialValue ?? 0,
      actionType: p.category ?? 'position',
      actionPlan: p.recommendedAction ? {
        actionType: p.category ?? 'position',
        priority: p.impact ?? 'medium',
        effort: p.effort ?? 'medium',
        effortLabel: p.effortLabel ?? p.effort ?? 'medium',
        steps: p.timeToValue ? [{ stepNumber: 1, title: 'Execute recommendation', description: p.recommendedAction, timeEstimate: p.timeToValue, expectedLift: '' }] : [],
        summary: p.recommendedAction ?? '',
        estimatedGain: String(p.commercialValue ?? 0),
        timeToValue: p.timeToValue ?? '',
        whyThisMatters: '',
      } : null,
      status: 'open',
    });
  });

  // From quickWins
  const quickWins = (r.quickWins as Array<{
    query?: string; page?: string; position?: number; estimatedTrafficGain?: number;
    action?: string; effort?: string; currentCTR?: number; benchmarkCTR?: number;
  }>) || [];
  quickWins.slice(0, 15).forEach(qw => {
    opportunities.push({
      id: 0,
      query: qw.query ?? '',
      page: qw.page ?? '',
      position: qw.position ?? 0,
      ctr: qw.currentCTR ?? 0,
      impressions: 0,
      score: Math.round((qw.estimatedTrafficGain ?? 0) / 10),
      estimatedGain: qw.estimatedTrafficGain ?? 0,
      actionType: 'quick_win_content',
      actionPlan: qw.action ? {
        actionType: 'quick_win_content',
        priority: 'medium',
        effort: qw.effort ?? 'low',
        effortLabel: qw.effort ?? 'low',
        steps: [{ stepNumber: 1, title: 'Quick win action', description: qw.action, timeEstimate: '1-2 weeks', expectedLift: `+${qw.estimatedTrafficGain} clicks` }],
        summary: qw.action ?? '',
        estimatedGain: String(qw.estimatedTrafficGain ?? 0),
        timeToValue: qw.effort ?? 'low',
        whyThisMatters: '',
      } : null,
      status: 'open',
      benchmarkCTR: qw.benchmarkCTR,
    });
  });

  return opportunities;
}

export function OpportunityQueue({ siteUrl, onRefresh }: Props) {
  const gscResult = useStore(s => s.gscResult);
  const [sort, setSort] = useState<SortKey>('score');
  const [filter, setFilter] = useState<FilterStatus>('open');
  const [view, setView] = useState<'list' | 'ctr'>('list');
  const [updating, setUpdating] = useState<number | null>(null);
  const [dbOpportunities, setDbOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const { isExpert } = useExpertise();

  useEffect(() => {
    if (!siteUrl) {
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`/api/progress?siteUrl=${encodeURIComponent(siteUrl)}&status=all&limit=50`)
      .then(r => r.json())
      .then(res => {
        setDbOpportunities(res.opportunities || []);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load opportunities', err);
        setLoading(false);
      });
  }, [siteUrl]);

  // Use DB opportunities if available, otherwise derive from gscResult
  const opportunities = dbOpportunities.length > 0 ? dbOpportunities : deriveFromGscResult(gscResult, siteUrl);

  const filtered = opportunities
    .filter(o => filter === 'all' || o.status === 'open')
    .sort((a, b) => {
      if (sort === 'gain') return b.estimatedGain - a.estimatedGain;
      if (sort === 'position') return a.position - b.position;
      return b.score - a.score;
    });

  const totalGain = filtered.reduce((s, o) => s + o.estimatedGain, 0);
  const resolvedCount = opportunities.filter(o => o.status === 'resolved').length;

  const markResolved = async (id: number) => {
    setUpdating(id);
    try {
      await fetch('/api/progress', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'resolved', reason: 'Manually marked as done' }),
      });
      onRefresh?.();
    } catch { /* non-critical */ } finally {
      setUpdating(null);
    }
  };

  const markDismissed = async (id: number) => {
    setUpdating(id);
    try {
      await fetch('/api/progress', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'dismissed' }),
      });
      onRefresh?.();
    } catch { /* non-critical */ } finally {
      setUpdating(null);
    }
  };

  if (loading) {
    return (
      <div style={{
        background: 'rgba(255,255,255,0.02)', borderRadius: 16, padding: 32,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: '-apple-system, sans-serif', color: '#64748b', fontSize: 14,
      }}>
        Loading opportunities...
      </div>
    );
  }

  if (!siteUrl && opportunities.length === 0) {
    return (
      <div style={{
        background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.1)',
        borderRadius: 16, padding: '60px 32px', textAlign: 'center',
        fontFamily: '-apple-system, sans-serif', color: '#f1f5f9',
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🎯</div>
        <h2 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 8px' }}>No Opportunities Found</h2>
        <p style={{ color: '#94a3b8', fontSize: 14, maxWidth: 400, margin: '0 auto' }}>
          Connect your GSC data or upload a CSV to generate actionable SEO opportunities.
        </p>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header + Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#f1f5f9' }}>
            🎯 Opportunity Queue
          </h3>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>
            {filtered.length} opportunities · +{totalGain.toLocaleString()} est. clicks/mo potential
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {/* View toggle */}
          {[{ k: 'list', l: '📋 List' }, { k: 'ctr', l: '📊 CTR Gap' }].map(v => (
            <button key={v.k} onClick={() => setView(v.k as 'list' | 'ctr')} style={{
              padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600,
              background: view === v.k ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.06)',
              color: view === v.k ? '#60a5fa' : '#94a3b8',
            }}>
              {v.l}
            </button>
          ))}
          {/* Sort */}
          <select
            value={sort}
            onChange={e => setSort(e.target.value as SortKey)}
            id="opp-queue-sort"
            style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8, padding: '5px 10px', color: '#94a3b8', fontSize: 11, cursor: 'pointer',
            }}
          >
            <option value="score">By Score</option>
            <option value="gain">By Gain</option>
            <option value="position">By Position</option>
          </select>
          {/* Status filter */}
          <select
            value={filter}
            onChange={e => setFilter(e.target.value as FilterStatus)}
            id="opp-queue-filter"
            style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8, padding: '5px 10px', color: '#94a3b8', fontSize: 11, cursor: 'pointer',
            }}
          >
            <option value="open">Open only</option>
            <option value="all">Show all</option>
          </select>
        </div>
      </div>

      {/* Progress summary (always visible) */}
      <ProgressTracker
        items={opportunities.slice(0, 10).map(o => ({
          id: o.id,
          query: o.query,
          actionType: o.actionType,
          status: o.status,
          estimatedGain: o.estimatedGain,
        }))}
        totalResolved={resolvedCount}
        totalOpportunities={opportunities.length}
        resolutionRate={opportunities.length > 0 ? Math.round((resolvedCount / opportunities.length) * 100) : 0}
        onMarkResolved={markResolved}
        onDismiss={markDismissed}
      />

      {/* Main content — list or CTR gap view */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 32, color: '#64748b', fontSize: 13 }}>
          No open opportunities. Run an analysis to discover your next wins.
        </div>
      ) : view === 'list' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(o => o.actionPlan ? (
            <ActionPlanCard
              key={o.id}
              query={o.query}
              page={o.page}
              score={o.score}
              estimatedGain={o.estimatedGain}
              actionPlan={o.actionPlan}
              onMarkDone={o.status === 'open' ? () => markResolved(o.id) : undefined}
              onDismiss={o.status === 'open' ? () => markDismissed(o.id) : undefined}
              expertMode={isExpert}
            />
          ) : (
            <div key={o.id} style={{
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 10, padding: 14,
            }}>
              <p style={{ margin: 0, fontSize: 13, color: '#f1f5f9' }}>&ldquo;{o.query}&rdquo;</p>
              <p style={{ margin: '4px 0 0', fontSize: 11, color: '#64748b' }}>{o.actionType.replace(/_/g, ' ')} · {o.status}</p>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {filtered.filter(o => o.benchmarkCTR !== undefined).map(o => (
            <CtrBeforeAfter
              key={o.id}
              query={o.query}
              page={o.page}
              currentCTR={o.ctr}
              benchmarkCTR={o.benchmarkCTR!}
              impressions={o.impressions}
              expertMode={isExpert}
            />
          ))}
        </div>
      )}
    </div>
  );
}
