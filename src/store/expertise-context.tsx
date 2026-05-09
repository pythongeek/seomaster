'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { ExpertiseLevel } from '@/types';

// ─── Context ──────────────────────────────────────────────────────────────────

interface ExpertiseContextValue {
  level: ExpertiseLevel;
  setLevel: (l: ExpertiseLevel) => void;
  isBeginner: boolean;
  isExpert: boolean;
}

const ExpertiseContext = createContext<ExpertiseContextValue>({
  level: 'beginner',
  setLevel: () => {},
  isBeginner: true,
  isExpert: false,
});

const STORAGE_KEY = 'seomaster_expertise_level';

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ExpertiseProvider({ children }: { children: ReactNode }) {
  const [level, setLevelState] = useState<ExpertiseLevel>('beginner');

  // Hydrate from localStorage after mount (avoids SSR mismatch)
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'beginner' || stored === 'intermediate' || stored === 'expert') {
      setLevelState(stored);
    }
  }, []);

  const setLevel = (l: ExpertiseLevel) => {
    setLevelState(l);
    localStorage.setItem(STORAGE_KEY, l);
  };

  return (
    <ExpertiseContext.Provider value={{
      level,
      setLevel,
      isBeginner: level === 'beginner',
      isExpert: level === 'expert',
    }}>
      {children}
    </ExpertiseContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useExpertise() {
  return useContext(ExpertiseContext);
}
