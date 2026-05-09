'use client';

import { useState } from 'react';
import { getExplainer } from '@/lib/seo-explainers';
import { useExpertise } from '@/store/expertise-context';

interface Props {
  termKey: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export function EducationalTooltip({ termKey, children, position = 'top' }: Props) {
  const [show, setShow] = useState(false);
  const { level } = useExpertise();
  const text = getExplainer(termKey, level);

  const offset = position === 'top' ? { bottom: '100%', left: '50%', transform: 'translateX(-50%)', marginBottom: 8 }
    : position === 'bottom' ? { top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: 8 }
    : position === 'left' ? { right: '100%', top: '50%', transform: 'translateY(-50%)', marginRight: 8 }
    : { left: '100%', top: '50%', transform: 'translateY(-50%)', marginLeft: 8 };

  if (!text) return <>{children}</>;

  return (
    <span
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', cursor: 'help' }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
    >
      {children}
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 14, height: 14, borderRadius: '50%', background: 'rgba(148,163,184,0.2)',
        color: '#94a3b8', fontSize: 9, fontWeight: 700, marginLeft: 4, cursor: 'help',
        border: '1px solid rgba(148,163,184,0.3)',
      }}>?</span>

      {show && (
        <span style={{
          position: 'absolute',
          ...offset,
          zIndex: 1000,
          background: '#0f172a',
          border: '1px solid rgba(148,163,184,0.2)',
          borderRadius: 8,
          padding: '10px 14px',
          fontSize: 12,
          color: '#cbd5e1',
          lineHeight: 1.6,
          width: 260,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          pointerEvents: 'none',
        }}>
          <strong style={{ display: 'block', color: '#f1f5f9', marginBottom: 4, fontSize: 11 }}>
            [{level.charAt(0).toUpperCase() + level.slice(1)}]
          </strong>
          {text}
        </span>
      )}
    </span>
  );
}
