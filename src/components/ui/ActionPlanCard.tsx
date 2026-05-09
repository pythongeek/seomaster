'use client';

import { useState } from 'react';
import type { ActionPlan, ActionStep } from '@/types';

interface Props {
  query: string;
  page: string;
  score: number;
  estimatedGain: number;
  actionPlan: ActionPlan;
  onMarkDone?: () => void;
  onDismiss?: () => void;
  expertMode?: boolean;
}

const ACTION_COLORS: Record<string, string> = {
  cannibalization_fix: '#f97316',
  ai_overview_pivot: '#8b5cf6',
  snippet_rewrite: '#3b82f6',
  declining_near_p1: '#ef4444',
  technical_review: '#f59e0b',
  quick_win_content: '#22c55e',
  content_creation: '#06b6d4',
  monitor: '#64748b',
};

const ACTION_LABELS: Record<string, string> = {
  cannibalization_fix: '🔗 Fix Cannibalization',
  ai_overview_pivot: '🤖 AI Overview Pivot',
  snippet_rewrite: '✏️ Rewrite Snippet',
  declining_near_p1: '📉 Stop Decline',
  technical_review: '🔧 Technical Fix',
  quick_win_content: '⚡ Quick Win',
  content_creation: '📝 Create Content',
  monitor: '👁 Monitor',
};

const EFFORT_ICONS: Record<string, string> = { low: '🟢', medium: '🟡', high: '🔴' };

export function ActionPlanCard({ query, page, score, estimatedGain, actionPlan, onMarkDone, onDismiss, expertMode }: Props) {
  const [expanded, setExpanded] = useState(false);
  const color = ACTION_COLORS[actionPlan.actionType] ?? '#64748b';
  const label = ACTION_LABELS[actionPlan.actionType] ?? actionPlan.actionType;

  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      border: `1px solid ${color}40`,
      borderRadius: 12,
      padding: '16px 20px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            background: color + '20', color, fontSize: 11, fontWeight: 700,
            padding: '3px 8px', borderRadius: 20, border: `1px solid ${color}50`,
            letterSpacing: '0.04em',
          }}>
            {label}
          </span>
          <span style={{ fontSize: 11, color: '#64748b' }}>{EFFORT_ICONS[actionPlan.effort]} {actionPlan.effortLabel}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#22c55e' }}>
            +{estimatedGain} clicks/mo
          </span>
          <span style={{ fontSize: 20, fontWeight: 700, color }}>
            {score}
          </span>
        </div>
      </div>

      {/* Query + Page */}
      <div style={{ marginBottom: 8 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#f1f5f9' }}>
          &ldquo;{query}&rdquo;
        </p>
        {expertMode && (
          <p style={{ margin: 0, fontSize: 11, color: '#64748b', marginTop: 2 }}>
            {page}
          </p>
        )}
      </div>

      {/* Steps preview */}
      {actionPlan.steps.length > 0 && (
        <div>
          <button
            onClick={() => setExpanded(e => !e)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 12, color: color, fontWeight: 600, padding: '4px 0',
            }}
          >
            {expanded ? '▲ Hide steps' : `▼ View ${actionPlan.steps.length} steps`}
          </button>

          {expanded && (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {actionPlan.steps.map((step: ActionStep, i: number) => (
                <div key={i} style={{
                  background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '10px 14px',
                  borderLeft: `3px solid ${color}80`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color }}>
                      {step.stepNumber}. {step.title}
                    </span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <span style={{ fontSize: 10, color: '#64748b' }}>⏱ {step.timeEstimate}</span>
                      <span style={{ fontSize: 10, color: '#22c55e' }}>↑ {step.expectedLift}</span>
                    </div>
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        {onMarkDone && (
          <button
            onClick={onMarkDone}
            id={`action-done-${query.replace(/\s+/g, '-').slice(0, 20)}`}
            style={{
              flex: 1, padding: '7px 12px', borderRadius: 8, border: 'none',
              background: color + '20', color, cursor: 'pointer', fontSize: 12, fontWeight: 600,
              transition: 'background 0.2s',
            }}
          >
            ✓ Mark Done
          </button>
        )}
        {onDismiss && (
          <button
            onClick={onDismiss}
            style={{
              padding: '7px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
              background: 'transparent', color: '#64748b', cursor: 'pointer', fontSize: 12,
            }}
          >
            Skip
          </button>
        )}
      </div>
    </div>
  );
}
