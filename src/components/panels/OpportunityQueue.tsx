'use client';

import { useState } from 'react';
import { ActionPlanCard } from '@/components/ui/ActionPlanCard';
import { ProgressTracker } from '@/components/ui/ProgressTracker';
import { CtrBeforeAfter } from '@/components/ui/CtrBeforeAfter';
import { useExpertise } from '@/store/expertise-context';
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
  opportunities: Opportunity[];
  siteUrl: string;
  onRefresh?: () => void;
}

type SortKey = 'score' | 'gain' | 'position';
type FilterStatus = 'open' | 'all';

export function OpportunityQueue({ opportunities, siteUrl, onRefresh }: Props) {
  const [sort, setSort] = useState<SortKey>('score');
  const [filter, setFilter] = useState<FilterStatus>('open');
  const [view, setView] = useState<'list' | 'ctr'>('list');
  const [updating, setUpdating] = useState<number | null>(null);
  const { isExpert } = useExpertise();

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
