'use client';

import type { HealthScoreResult } from '@/types';

interface Props {
  score: number;
  grade: HealthScoreResult['grade'];
  trend: HealthScoreResult['trend'];
  weeklyDelta?: number | null;
  size?: 'sm' | 'md' | 'lg';
  showDetails?: boolean;
}

const GRADE_COLORS: Record<HealthScoreResult['grade'], { bg: string; text: string; ring: string }> = {
  A: { bg: 'rgba(34,197,94,0.15)', text: '#22c55e', ring: '#22c55e' },
  B: { bg: 'rgba(59,130,246,0.15)', text: '#3b82f6', ring: '#3b82f6' },
  C: { bg: 'rgba(234,179,8,0.15)', text: '#eab308', ring: '#eab308' },
  D: { bg: 'rgba(249,115,22,0.15)', text: '#f97316', ring: '#f97316' },
  F: { bg: 'rgba(239,68,68,0.15)', text: '#ef4444', ring: '#ef4444' },
};

const SIZE = {
  sm: { circle: 56, font: 14, label: 10, stroke: 4 },
  md: { circle: 80, font: 20, label: 11, stroke: 6 },
  lg: { circle: 110, font: 26, label: 12, stroke: 8 },
};

export function HealthScoreBadge({ score, grade, trend, weeklyDelta, size = 'md', showDetails = true }: Props) {
  const colors = GRADE_COLORS[grade];
  const s = SIZE[size];
  const radius = (s.circle / 2) - s.stroke;
  const circumference = 2 * Math.PI * radius;
  const filled = (score / 100) * circumference;

  const trendIcon = trend === '↑ Rising' ? '▲' : trend === '↓ Declining' ? '▼' : '→';
  const trendColor = trend === '↑ Rising' ? '#22c55e' : trend === '↓ Declining' ? '#ef4444' : '#64748b';

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      {/* Circular gauge */}
      <div style={{ position: 'relative', width: s.circle, height: s.circle }}>
        <svg width={s.circle} height={s.circle} style={{ transform: 'rotate(-90deg)' }}>
          {/* Track */}
          <circle
            cx={s.circle / 2} cy={s.circle / 2} r={radius}
            fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={s.stroke}
          />
          {/* Progress */}
          <circle
            cx={s.circle / 2} cy={s.circle / 2} r={radius}
            fill="none" stroke={colors.ring} strokeWidth={s.stroke}
            strokeDasharray={circumference}
            strokeDashoffset={circumference - filled}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.8s ease' }}
          />
        </svg>
        {/* Center text */}
        <div style={{
          position: 'absolute', inset: 0, display: 'flex',
          flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: s.font, fontWeight: 700, color: colors.text, lineHeight: 1 }}>
            {score}
          </span>
          <span style={{ fontSize: s.label - 1, color: colors.text, fontWeight: 700, lineHeight: 1, marginTop: 1 }}>
            {grade}
          </span>
        </div>
      </div>

      {showDetails && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 11, color: trendColor, fontWeight: 600 }}>
            {trendIcon} {trend}
          </span>
          {weeklyDelta !== null && weeklyDelta !== undefined && weeklyDelta !== 0 && (
            <span style={{ fontSize: 10, color: trendColor, fontWeight: 500 }}>
              ({weeklyDelta > 0 ? '+' : ''}{weeklyDelta})
            </span>
          )}
        </div>
      )}
    </div>
  );
}
