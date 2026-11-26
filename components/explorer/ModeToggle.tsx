"use client";

import type { ReactElement } from 'react';

export type Mode = 'learning' | 'testing';

// Learning mode / Testing mode (Julian): a switch under the operation's name, learning on at first. A knob slides
// between the two halves; the active half's name is lit (learning: cyan, testing: amber)
export function ModeToggle({ mode, onChange, disabled = false }: { mode: Mode; onChange: (m: Mode) => void; disabled?: boolean }): ReactElement {
  const testing = mode === 'testing';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={testing}
      aria-label={testing ? 'Testing mode (switch to learning mode)' : 'Learning mode (switch to testing mode)'}
      disabled={disabled}
      onClick={() => onChange(testing ? 'learning' : 'testing')}
      className="relative grid grid-cols-2 w-[13rem] h-[1.875rem] p-[3px] rounded-full border border-zinc-700 bg-zinc-900/80 shadow-[inset_0_1px_3px_rgba(0,0,0,0.6)] cursor-pointer disabled:cursor-default disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-cyan-400"
    >
      {/* the knob: under the active half, sliding from one to the other */}
      <span
        aria-hidden="true"
        className={`absolute top-[3px] bottom-[3px] left-[3px] w-[calc(50%-3px)] rounded-full transition-[translate,background-color,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${testing
          ? 'translate-x-full bg-linear-to-b from-amber-500 to-amber-700 shadow-[0_0_10px_rgba(245,158,11,0.45),inset_0_1px_0_rgba(255,255,255,0.3)]'
          : 'translate-x-0 bg-linear-to-b from-cyan-500 to-cyan-700 shadow-[0_0_10px_rgba(6,182,212,0.45),inset_0_1px_0_rgba(255,255,255,0.3)]'}`}
      />
      {(['learning', 'testing'] as const).map(m => (
        <span key={m} className={`relative z-10 flex items-center justify-center text-[11px] font-black uppercase tracking-wider whitespace-nowrap transition-colors duration-300 ${mode === m ? 'text-white' : 'text-zinc-500'}`}>
          {/* (one word each: with a big minimum font size in the browser, 'Learning mode' didn't fit its half) */}
          {m === 'learning' ? 'Learning' : 'Testing'}
        </span>
      ))}
    </button>
  );
}
