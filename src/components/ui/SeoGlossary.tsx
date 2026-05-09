'use client';

import { useState } from 'react';
import { getGlossaryTerms, SEO_EXPLAINERS } from '@/lib/seo-explainers';
import { useExpertise } from '@/store/expertise-context';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function SeoGlossary({ isOpen, onClose }: Props) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const { level } = useExpertise();
  const terms = getGlossaryTerms().filter(t =>
    t.term.toLowerCase().includes(search.toLowerCase()) ||
    t.shortDef.toLowerCase().includes(search.toLowerCase()),
  );

  if (!isOpen) return null;

  const activeExplainer = selected ? SEO_EXPLAINERS[selected] : null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end',
      padding: 20, pointerEvents: 'none',
    }}>
      <div style={{
        width: 380, height: 560, background: '#0f172a',
        border: '1px solid rgba(148,163,184,0.15)', borderRadius: 16,
        boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
        display: 'flex', flexDirection: 'column',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        pointerEvents: 'all', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#f1f5f9' }}>
              📖 SEO Glossary
            </h3>
            <p style={{ margin: 0, fontSize: 11, color: '#64748b' }}>{terms.length} terms · {level} mode</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
        </div>

        {!activeExplainer ? (
          <>
            {/* Search */}
            <div style={{ padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <input
                type="text"
                placeholder="Search terms..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                id="glossary-search"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8, padding: '8px 12px', color: '#f1f5f9', fontSize: 13,
                  outline: 'none',
                }}
              />
            </div>

            {/* Term list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
              {terms.map(t => (
                <button
                  key={t.key}
                  onClick={() => setSelected(t.key)}
                  style={{
                    all: 'unset', display: 'block', width: '100%', boxSizing: 'border-box',
                    padding: '10px 20px', cursor: 'pointer', textAlign: 'left',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)'}
                  onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'transparent'}
                >
                  <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>{t.term}</p>
                  <p style={{ margin: 0, fontSize: 11, color: '#94a3b8' }}>{t.shortDef}</p>
                </button>
              ))}
              {terms.length === 0 && (
                <p style={{ textAlign: 'center', color: '#64748b', fontSize: 12, padding: 20 }}>No terms match your search</p>
              )}
            </div>
          </>
        ) : (
          /* Detail view */
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
            <button
              onClick={() => setSelected(null)}
              style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', fontSize: 12, marginBottom: 12 }}
            >
              ← Back to list
            </button>
            <h4 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 700, color: '#f1f5f9' }}>
              {activeExplainer.term}
            </h4>
            <p style={{ margin: '0 0 16px', fontSize: 12, color: '#64748b', fontStyle: 'italic' }}>
              {activeExplainer.shortDef}
            </p>
            <div style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 8, padding: 14, marginBottom: 14 }}>
              <p style={{ margin: '0 0 6px', fontSize: 10, fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {level} explanation
              </p>
              <p style={{ margin: 0, fontSize: 13, color: '#cbd5e1', lineHeight: 1.6 }}>
                {activeExplainer[level]}
              </p>
            </div>
            <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8, padding: 14 }}>
              <p style={{ margin: '0 0 6px', fontSize: 10, fontWeight: 700, color: '#22c55e', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Why it matters
              </p>
              <p style={{ margin: 0, fontSize: 12, color: '#94a3b8', lineHeight: 1.6 }}>
                {activeExplainer.whyItMatters}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
