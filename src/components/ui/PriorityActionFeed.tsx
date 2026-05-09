'use client';

import { useExpertise } from '@/store/expertise-context';

interface Action {
  actionType: string;
  label: string;
  description: string;
  estimatedGain: number;
  effort: string;
  effortLabel: string;
  color: string;
  steps: Array<{ title: string; timeEstimate: string }>;
}

interface Props {
  actions: Action[];
  maxItems?: number;
  onSelect?: (action: Action) => void;
}

const EFFORT_DOTS: Record<string, string> = { low: '#22c55e', medium: '#f59e0b', high: '#ef4444' };

export function PriorityActionFeed({ actions, maxItems, onSelect }: Props) {
  const { isBeginner, isExpert } = useExpertise();
  const show = maxItems ?? (isBeginner ? 1 : isExpert ? 3 : 2);
  const visibleActions = actions.slice(0, show);

  if (actions.length === 0) {
    return (
      <div style={{
        background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)',
        borderRadius: 12, padding: '20px 24px', textAlign: 'center',
      }}>
        <p style={{ fontSize: 24, margin: '0 0 8px' }}>🎉</p>
        <p style={{ fontSize: 14, color: '#22c55e', fontWeight: 600, margin: '0 0 4px' }}>
          All caught up!
        </p>
        <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
          No open priority actions. Run a new analysis to check for opportunities.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {isBeginner && (
        <div style={{
          background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)',
          borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#94a3b8',
        }}>
          💡 Your <strong style={{ color: '#60a5fa' }}>next best action</strong> — do this one thing to improve your rankings.
        </div>
      )}

      {visibleActions.map((action, i) => (
        <button
          key={i}
          id={`priority-action-${i}-${action.actionType}`}
          onClick={() => onSelect?.(action)}
          style={{
            all: 'unset', cursor: 'pointer', display: 'block', width: '100%', boxSizing: 'border-box',
            background: 'rgba(255,255,255,0.04)',
            border: `1px solid ${action.color}40`,
            borderRadius: 12, padding: '14px 18px',
            transition: 'all 0.2s', textAlign: 'left',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.background = `${action.color}15`;
            (e.currentTarget as HTMLButtonElement).style.borderColor = `${action.color}80`;
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)';
            (e.currentTarget as HTMLButtonElement).style.borderColor = `${action.color}40`;
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                {show > 1 && (
                  <span style={{
                    background: `${action.color}20`, color: action.color, fontSize: 10, fontWeight: 700,
                    padding: '2px 6px', borderRadius: 20, border: `1px solid ${action.color}40`,
                  }}>
                    #{i + 1}
                  </span>
                )}
                <span style={{ fontSize: 13, fontWeight: 700, color: action.color }}>{action.label}</span>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: EFFORT_DOTS[action.effort] ?? '#64748b',
                  display: 'inline-block',
                }} />
                <span style={{ fontSize: 11, color: '#64748b' }}>{action.effortLabel}</span>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: '#cbd5e1', lineHeight: 1.5 }}>
                {action.description}
              </p>
              {isExpert && action.steps.length > 0 && (
                <div style={{ marginTop: 6, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {action.steps.slice(0, 3).map((s, j) => (
                    <span key={j} style={{ fontSize: 10, color: '#64748b', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: 20 }}>
                      {s.title} ({s.timeEstimate})
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#22c55e' }}>
                +{action.estimatedGain}
              </div>
              <div style={{ fontSize: 10, color: '#64748b' }}>clicks/mo</div>
            </div>
          </div>
        </button>
      ))}

      {actions.length > show && (
        <p style={{ textAlign: 'center', fontSize: 11, color: '#64748b', margin: 0 }}>
          +{actions.length - show} more opportunities in the queue
        </p>
      )}
    </div>
  );
}
