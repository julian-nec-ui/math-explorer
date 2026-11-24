"use client";

// Small marks drawn on the boards: the N1 / N2 tags, the operation icons, the thousands comma, the result's sign

import type { ReactElement } from 'react';
import type { MathOp } from './types';
import { toRem } from './layout';

// "N1 ▶" / "N2 ▶" on the left of a number's sign button: the label, 8px of room, and an arrow pointing at the number
// (the same triangle as the arrows in the steps window), both in the number's colour; 8px from the button
// `fixed`: always as wide as the widest of N1 / N2 (right-aligned), so the drums left of them line up (Julian)
export const OperandTag = ({ label, color, fixed = false }: { label: string; color: string; fixed?: boolean }): ReactElement => (
  <span data-tag={fixed ? '' : undefined} className={`flex items-center gap-2 font-bold uppercase whitespace-nowrap text-[9px] tracking-[1.5px] ${fixed ? 'w-8 justify-end' : ''} ${color}`}>
    {label}
    <svg viewBox="0 0 10 12" aria-hidden="true" className="h-2.5 w-auto shrink-0"><path d="M0 0 10 6 0 12z" fill="currentColor" /></svg>
  </span>
);

export const OpIcon = ({ op }: { op: MathOp }): ReactElement => (
  <svg viewBox="0 0 24 24" className="w-5 h-5 md:w-6 md:h-6 block" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
    {op === 'addition' && <path d="M0 12h24M12 0v24" />}
    {op === 'subtraction' && <path d="M0 12h24" />}
    {op === 'multiplication' && <path d="M1 1l22 22M23 1 1 23" />}
    {op === 'division' && (
      <>
        <path d="M0 12h24" />
        <circle cx="12" cy="4.5" r="2" fill="currentColor" stroke="none" />
        <circle cx="12" cy="19.5" r="2" fill="currentColor" stroke="none" />
      </>
    )}
    {op === 'fractions' && <path d="M19 0 5 24" />}
  </svg>
);

export const COMMA_STYLE = 'inline-block translate-y-0.5 font-black text-2xl leading-7 bg-linear-[180deg,#e6f6fd_50%,#a5ddf3_61%,#63c3e9_72%,#2f8fb8_85%,#b3e4f7_100%] bg-clip-text text-transparent drop-shadow-[0_0_3px_rgba(99,195,233,0.5)]';

export const ThousandsComma = ({ left, top }: { left: number; top: number }): ReactElement => (
  <div className="absolute w-5 flex justify-center leading-7" style={toRem({ left, top })} aria-hidden="true">
    <span className={COMMA_STYLE}>,</span>
  </div>
);

export const ResultSign = ({ sign }: { sign: 1 | -1 }): ReactElement => (
  <div className={`w-10 flex items-center justify-center text-[42px] leading-none font-bold transition-colors duration-700 ${sign === -1 ? 'text-pink-400' : 'text-cyan-400'}`}>
    {sign === 1 ? '+' : '-'}
  </div>
);
