import { useEffect, useState } from 'react';
import { STEP_DELAYS_MS, pace } from '../math/shared';

// Step delay: which of STEP_DELAYS_MS (0, 0.5, 1, 1.5, 2 s) is added after each explanation step; remembered
export function useStepDelay() {
  const [stepDelay, setStepDelayState] = useState(0);
  const setStepDelay = (v: number) => {
    setStepDelayState(v);
    pace.stepMs = STEP_DELAYS_MS[v] ?? 0;
    try { localStorage.setItem('math-explorer-step-delay', String(v)); } catch { /* storage off */ }
  };
  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        const v = Number(localStorage.getItem('math-explorer-step-delay'));
        if (v > 0 && v < STEP_DELAYS_MS.length) { setStepDelayState(v); pace.stepMs = STEP_DELAYS_MS[v]; }
      } catch { /* storage off */ }
    }, 0);
    return () => window.clearTimeout(id);
  }, []);
  return { stepDelay, setStepDelay };
}
