'use client';

import { useExpertise } from '@/store/expertise-context';
import type { ExpertiseLevel } from '@/types';

interface LevelConfig {
  value: ExpertiseLevel;
  label: string;
  emoji: string;
  description: string;
  color: string;
}

const LEVELS: LevelConfig[] = [
  {
    value: 'beginner',
    label: 'Beginner',
    emoji: '🌱',
    description: 'Plain English, guided mode',
    color: '#22c55e',
  },
  {
    value: 'intermediate',
    label: 'Intermediate',
    emoji: '📈',
    description: 'Balanced insights + data',
    color: '#3b82f6',
  },
  {
    value: 'expert',
    label: 'Expert',
    emoji: '⚡',
    description: 'Full metrics, no hand-holding',
    color: '#8b5cf6',
  },
];

interface Props {
  compact?: boolean;
  showDescriptions?: boolean;
}

export function ExpertiseLevelToggle({ compact = false, showDescriptions = true }: Props) {
  const { level, setLevel } = useExpertise();

  if (compact) {
    return (
      <div style={{
        display: 'inline-flex', background: 'rgba(255,255,255,0.06)',
        borderRadius: 20, padding: 3, gap: 2,
        border: '1px solid rgba(255,255,255,0.1)',
      }}>
        {LEVELS.map(l => (
          <button
            key={l.value}
            onClick={() => setLevel(l.value)}
            id={`expertise-${l.value}`}
            style={{
              padding: '5px 12px', borderRadius: 17, border: 'none',
              background: level === l.value ? l.color + '30' : 'transparent',
              color: level === l.value ? l.color : '#64748b',
              cursor: 'pointer', fontSize: 11, fontWeight: level === l.value ? 700 : 400,
              transition: 'all 0.2s',
              outline: level === l.value ? `1px solid ${l.color}40` : 'none',
            }}
          >
            {l.emoji} {l.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 8,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      <p style={{ margin: '0 0 4px', fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        Expertise Mode
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {LEVELS.map(l => {
          const active = level === l.value;
          return (
            <button
              key={l.value}
              onClick={() => setLevel(l.value)}
              id={`expertise-full-${l.value}`}
              style={{
                all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 14px', borderRadius: 10,
                background: active ? l.color + '15' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${active ? l.color + '50' : 'rgba(255,255,255,0.08)'}`,
                transition: 'all 0.2s',
              }}
            >
              <span style={{ fontSize: 20 }}>{l.emoji}</span>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: active ? l.color : '#f1f5f9' }}>
                  {l.label}
                </p>
                {showDescriptions && (
                  <p style={{ margin: 0, fontSize: 11, color: '#64748b' }}>{l.description}</p>
                )}
              </div>
              {active && (
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: l.color, flexShrink: 0 }} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
