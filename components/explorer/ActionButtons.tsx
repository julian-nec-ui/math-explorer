"use client";

import type { ReactElement } from 'react';

// Explain to Me, New Numbers and Stop. `wide`: in the controls column from md up, Explain to Me takes a whole row
// (New Numbers and Stop share the next one), since the column is only as wide as INTEGER / FLOAT / Redo
export function ActionButtons({ wide, label, busy, explainDisabled, title, onExplain, onNew, onStop }: { wide: boolean; label: string; busy: boolean; explainDisabled: boolean; title?: string; onExplain: () => void; onNew: () => void; onStop: () => void }): ReactElement {
  // In the column the buttons share its width, so they keep a small padding
  const pad = wide ? 'px-2' : 'px-2 sm:px-5 lg:px-4';
  return (
    <>
                <button
              type="button"
              onClick={onExplain}
              disabled={explainDisabled}
              title={title}
              className={`${wide ? 'md:col-span-2 ' : ''}h-10 sm:h-8 ${pad} inline-flex items-center justify-center whitespace-nowrap rounded-xl text-[11px] sm:text-[10px] font-bold leading-none text-white text-shadow-[0_1px_1px_rgba(0,0,0,0.3)] border transition-all hover:scale-105 border-[#1b55b8] bg-linear-to-l from-[#22b8d6] to-[#1d5fd1] shadow-[inset_0_1px_0_rgba(255,255,255,0.22),inset_0_-2px_0_rgba(0,0,0,0.25),0_3px_6px_rgba(0,0,0,0.35)] hover:from-[#3cc8e4] hover:to-[#2a6fe0] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.28),inset_0_-2px_0_rgba(0,0,0,0.25),0_3px_14px_rgba(34,184,214,0.45)] active:translate-y-px active:shadow-[inset_0_1px_0_rgba(255,255,255,0.15),inset_0_-1px_0_rgba(0,0,0,0.25),0_1px_2px_rgba(0,0,0,0.35)] disabled:bg-none disabled:bg-zinc-700 disabled:border-zinc-600 disabled:text-zinc-500 disabled:shadow-none disabled:text-shadow-none disabled:hover:scale-100 disabled:active:translate-y-0`}
            >
              {label}
            </button>
                <button
              type="button"
              disabled={busy}
              onClick={onNew}
              className={`h-10 sm:h-8 ${pad} inline-flex items-center justify-center whitespace-nowrap rounded-xl text-[11px] sm:text-[10px] font-bold leading-none text-white text-shadow-[0_1px_1px_rgba(0,0,0,0.3)] border transition-all hover:scale-105 border-zinc-600 bg-linear-to-l from-[#55555f] to-[#34343b] shadow-[inset_0_1px_0_rgba(255,255,255,0.22),inset_0_-2px_0_rgba(0,0,0,0.25),0_3px_6px_rgba(0,0,0,0.35)] hover:from-[#62626d] hover:to-[#3d3d45] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.28),inset_0_-2px_0_rgba(0,0,0,0.25),0_3px_14px_rgba(161,161,170,0.3)] active:translate-y-px active:shadow-[inset_0_1px_0_rgba(255,255,255,0.15),inset_0_-1px_0_rgba(0,0,0,0.25),0_1px_2px_rgba(0,0,0,0.35)] disabled:opacity-60 disabled:hover:shadow-none disabled:hover:from-[#55555f] disabled:hover:to-[#34343b] disabled:hover:scale-100 disabled:active:translate-y-0`}
            >
              New Numbers
            </button>
                <button
              type="button"
              onClick={onStop}
              disabled={!busy}
              className={`h-10 sm:h-8 ${pad} inline-flex items-center justify-center whitespace-nowrap rounded-xl text-[11px] sm:text-[10px] font-bold leading-none text-white text-shadow-[0_1px_1px_rgba(0,0,0,0.3)] border transition-all hover:scale-105 border-[#9a1c1c] bg-linear-to-l from-[#f04a4a] to-[#9c1a1a] shadow-[inset_0_1px_0_rgba(255,255,255,0.22),inset_0_-2px_0_rgba(0,0,0,0.25),0_3px_6px_rgba(0,0,0,0.35)] hover:from-[#f85d5d] hover:to-[#ae2020] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.28),inset_0_-2px_0_rgba(0,0,0,0.25),0_3px_14px_rgba(211,50,50,0.45)] active:translate-y-px active:shadow-[inset_0_1px_0_rgba(255,255,255,0.15),inset_0_-1px_0_rgba(0,0,0,0.25),0_1px_2px_rgba(0,0,0,0.35)] disabled:opacity-40 disabled:hover:shadow-none disabled:hover:from-[#f04a4a] disabled:hover:to-[#9c1a1a] disabled:hover:scale-100 disabled:active:translate-y-0`}
            >
              Stop
            </button>
    </>
  );
}
