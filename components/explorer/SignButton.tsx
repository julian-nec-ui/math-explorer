"use client";

import type { ReactElement } from 'react';

// The +/− button in front of each number (each board places it)
export function SignButton({ which, sign, disabled, onToggle }: { which: 'n1' | 'n2'; sign: 1 | -1; disabled: boolean; onToggle: (which: 'n1' | 'n2') => void }): ReactElement {
  return (
    <button
      type="button"
      onClick={() => onToggle(which)}
      disabled={disabled}
      aria-label={`Toggle sign of ${which.toUpperCase()}`}
      className={`w-8 h-8 shrink-0 self-center flex items-center justify-center rounded-full transition-all duration-500 disabled:opacity-60 bg-zinc-900/40 hover:bg-zinc-900/60 ${sign === 1 ? 'text-cyan-400 border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.2)] hover:shadow-[0_0_25px_rgba(6,182,212,0.4)]' : 'text-pink-400 border border-pink-500/30 shadow-[0_0_15px_rgba(236,72,153,0.2)] hover:shadow-[0_0_25px_rgba(236,72,153,0.4)]'}`}
    >
      {/* Drawn, not typed: a font's + and − sit a little off-centre; these are exactly in the middle of the circle */}
      <svg viewBox="0 0 12 12" aria-hidden="true" className="w-3 h-3 block">
        <path d={sign === 1 ? 'M6 1.5v9M1.5 6h9' : 'M1.5 6h9'} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
      </svg>
    </button>
  );
}
