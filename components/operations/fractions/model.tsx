"use client";

import { type ReactElement, type ReactNode } from 'react';
import { Digit, numberValue, type BoardProps, type DigitVariant, type FracPart, type FractionParts } from '../../math/shared';

// Fractions: two fractions, each numerator and denominator its own number of 1 to 6 digits (one slider each in the
// page; every digit turns with the steel drum). The ± buttons (N1's and N2's signs) give each fraction its sign; each
// signed fraction sits in round brackets, so (+2/3) + (−1/4) shows the subtraction.
// The explanation: a common denominator (lists of multiples), amplification (top and bottom times the same number),
// one long fraction line under all the numerators and their signs, then the sum, simplifying and a mixed number.

export interface Frac { n: number; d: number; s: 1 | -1; }
// A fraction being amplified (×k) or simplified (÷k): the chip beside it, then the old values crossed out in red
// with the new ones written small next to them
export interface Mark { k: number; crossed: boolean; n: number; d: number; }
export interface Hop { x0: number; y0: number; x1: number; y1: number; value: number | string; key: string; }

// The numbers jump more slowly than the carries of the other operations (950 ms), with a short pause after each
// jump, so a child can follow every number
export const FR_HOP_MS = 1700;
export const FR_HOP_PAUSE = 400;
// A jumping number shrinks only 20% (from 1.6 to 1.28 times a chip), so it stays easy to read
export const FR_HOP_END = 1.28;
// The landing: the number it brings starts to appear (blurred, then sharp) FR_LAND_MS before the jump ends, while the
// jumping square fades out, so there is never a moment with nothing on the screen
export const FR_LAND_MS = 300;
// A mixed number with up to this many wholes is split piece by piece ((8 + 8 + 7)/8); more wholes are written as a
// product ((8 × 9 + 8)/9)
export const MAX_WHOLE_PIECES = 3;
// Fit to the board area: the whole board shrinks down to 75% at most; the gap between the parts of the row (gap-x-5)
export const MIN_FIT = 0.75;
export const EXPR_GAP = 20;

// While a denominator is 0 the page keeps Explain to Me and Redo disabled (see `blocked` in operations/registry), and
// the board shows its warning
export const hasZeroDenominator = (fr: FractionParts): boolean =>
  (['d1', 'd2'] as const).some(k => fr[k].digits.length > 0 && numberValue(fr[k]) === 0);
// How many cells the list of multiples would have (without building it: the numbers can be big)
export const listLength = (d: number, k: number): number => (d === 1 && k > 2 ? 3 : k);

// The multiples of a denominator up to the common one. A denominator of 1 doesn't list 1, 2, 3, 4, 5: it shows 1 … 5
// (its first multiple, dots — null —, the common one)
export const listOf = (d: number, k: number): (number | null)[] =>
  d === 1 && k > 2 ? [1, null, k] : Array.from({ length: k }, (_, i) => d * (i + 1));
// Lists of multiples up to this long are shown; when one would be longer, the LCM is found by prime factorization
export const MAX_MULTIPLES = 7;

// The prime factors of n with their powers, e.g. 12 → 2² × 3 = [{ p: 2, e: 2 }, { p: 3, e: 1 }] (1 → none)
export const primeFactors = (n: number): { p: number; e: number }[] => {
  const out: { p: number; e: number }[] = [];
  for (let p = 2; n > 1; p++) {
    let e = 0;
    while (n % p === 0) { n /= p; e++; }
    if (e) out.push({ p, e });
  }
  return out;
};
// 2 and 3 → "2³" (for the status line and the jumping square)
export const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
export const powerText = (p: number, e: number): string => (e > 1 ? `${p}${[...String(e)].map(c => SUP[Number(c)]).join('')}` : `${p}`);

// A cell of the prime factorization: a factor (2), a power (2³ with a small raised 3) or a value; green when picked
// for the LCM. It fades in blurred -> sharp
export function FactorChip({ p, e = 1, pick = false, hidden = false, refFn }: { p: number; e?: number; pick?: boolean; hidden?: boolean; refFn?: (el: HTMLSpanElement | null) => void }): ReactElement {
  return (
    <span ref={refFn} className={`min-w-6.5 h-6.5 px-1 text-xs sm:min-w-8 sm:h-7 sm:px-1.5 sm:text-sm flex items-center justify-center rounded-md border font-black transition-[color,background-color,border-color,box-shadow,opacity,filter] duration-300 ${hidden ? 'opacity-0 blur-sm' : 'opacity-100 blur-none'} ${pick ? 'bg-green-600 border-green-400 text-white shadow-[0_0_12px_rgba(74,222,128,0.6)]' : 'bg-zinc-800 border-zinc-700 text-zinc-300'}`}>
      {/* inline text, so the small power is raised next to its base (2³), not put under it */}
      <span className="leading-none">{p}{e > 1 && <sup className="ml-px text-[0.68em]">{e}</sup>}</span>
    </span>
  );
}
export const Mul = ({ hidden = false }: { hidden?: boolean }): ReactElement => (
  <span className={`text-sm font-black text-zinc-500 transition-opacity duration-300 ${hidden ? 'opacity-0' : 'opacity-100'}`}>×</span>
);
export const SmallEq = (): ReactElement => <span className="px-0.5 text-sm font-black text-zinc-400 animate-pop-in">=</span>;

// A tall round bracket around a signed fraction: ( +2/3 )
export const Bracket = ({ side }: { side: 'left' | 'right' }): ReactElement => (
  <svg viewBox="0 0 14 100" preserveAspectRatio="none" aria-hidden="true" className="w-3.5 self-stretch my-5 text-zinc-400 shrink-0">
    <path d={side === 'left' ? 'M12 2 Q1 50 12 98' : 'M2 2 Q13 50 2 98'} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
  </svg>
);
export const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));
export const lcm = (a: number, b: number): number => (a / gcd(a, b)) * b;
export const showFrac = (f: Frac): string => `${f.s < 0 && f.n !== 0 ? '−' : ''}${f.n}/${f.d}`;

// A whole number as a row of digit cells
export function Num({ value, variant, refFn, hidden = false }: { value: number; variant: DigitVariant; refFn?: (el: HTMLDivElement | null) => void; hidden?: boolean }): ReactElement {
  return (
    <div ref={refFn} className={`flex gap-1 transition-[opacity,filter] duration-300 ease-out ${hidden ? 'opacity-0 blur-sm' : 'opacity-100 blur-none'}`}>
      {String(Math.abs(value)).split('').map((c, i) => <Digit key={i} digit={Number(c)} variant={variant} operand compact />)}
    </div>
  );
}

// A sign written inside an expression: cyan plus, pink minus (like the rewritten negatives in addition)
export const SignMark = ({ s, hidden = false }: { s: 1 | -1; hidden?: boolean }): ReactElement => (
  <span className={`w-6 text-center text-[32px] font-black leading-none transition-[opacity,filter] duration-300 ease-out ${hidden ? 'opacity-0 blur-sm' : 'opacity-100 blur-none'} ${s < 0 ? 'text-pink-400' : 'text-cyan-400'}`}>
    {s < 0 ? '−' : '+'}
  </span>
);

// A bracket around a negative sum: −(8/8 + 7/8)
export const Paren = ({ ch }: { ch: '(' | ')' }): ReactElement => <span className="text-[44px] font-light leading-none text-zinc-400">{ch}</span>;
// The "×" inside a product (8 × 9)
export const Times = (): ReactElement => <span className="w-6 text-center text-[28px] font-black leading-none text-cyan-400">×</span>;

export const Eq = (): ReactElement => <span className="text-[34px] font-black leading-none text-zinc-400 animate-pop-in">=</span>;

// The "×4" / "÷2" chip beside a numerator or a denominator: 28px tall, 9px padding at the sides, the sign and the
// digit 18.4px (20% bigger than 15.3px; the chip itself keeps its height and padding, so there is room all round)
export const OpChip = ({ text, kind }: { text: string; kind: 'times' | 'divide' }): ReactElement => (
  <div className={`absolute left-full ml-2 top-1/2 -translate-y-1/2 h-7 px-[9px] flex items-center rounded-md border text-[18.4px] leading-none font-black text-white whitespace-nowrap animate-pop-in ${kind === 'times' ? 'bg-green-600 border-green-400 shadow-[0_0_10px_rgba(74,222,128,0.5)]' : 'bg-red-600 border-red-400 shadow-[0_0_10px_rgba(248,113,113,0.5)]'}`}>
    {text}
  </div>
);

// A value that gets crossed out in red, with its new value written small above it (numerator) or below it (denominator)
// — 6px away from the digit (was 4px), so it doesn't crowd it
export function Crossable({ children, crossed, value, below = false, refFn }: { children: ReactNode; crossed: boolean; value: number; below?: boolean; refFn?: (el: HTMLDivElement | null) => void }): ReactElement {
  return (
    <div className="relative">
      {children}
      {crossed && (
        <>
          {/* The red strike: from the bottom-left to the top-right corner of the number, so it stays inside it however
              many digits it has. The width and height are set: an svg doesn't stretch between left/right like a div,
              without them it takes the browser's default size (300×150) and the lines run across the board */}
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" className="absolute -left-1 top-1 w-[calc(100%+0.5rem)] h-[calc(100%-0.5rem)] z-40 pointer-events-none overflow-visible drop-shadow-[0_0_4px_rgba(239,68,68,0.8)]">
            <line x1="0" y1="82" x2="100" y2="18" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </svg>
          <div ref={refFn} className={`absolute left-1/2 -translate-x-1/2 ${below ? 'top-full mt-1.5' : 'bottom-full mb-1.5'} text-xl font-black leading-none text-red-300 drop-shadow-[0_0_6px_rgba(248,113,113,0.6)] animate-pop-in whitespace-nowrap`}>
            {value}
          </div>
        </>
      )}
    </div>
  );
}

// The warning triangle, in relief, lit from the top left: the face in #f2f2f2 (lighter at the top left, greyer
// towards the base and the right side), a bright edge along the left side, a darker edge along the base and the right
// side, and a shadow falling down and to the right. The "!" in #e73131 is raised too: lighter at the top, darker at
// the bottom, with a thin highlight on its left and a small shadow to the bottom right
export const TRIANGLE = 'M10.27 1.9a2 2 0 0 1 3.46 0l9.5 16.5A2 2 0 0 1 21.5 21.4h-19a2 2 0 0 1-1.73-3L10.27 1.9z';
export const WarningIcon = (): ReactElement => (
  <svg viewBox="0 0 24 22" aria-hidden="true" className="absolute left-3 top-2.5 w-6.5 h-6 overflow-visible drop-shadow-[1.5px_2px_1.5px_rgba(0,0,0,0.5)]">
    <defs>
      <linearGradient id="warn-face" x1="0.2" y1="0" x2="0.8" y2="1">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset="0.45" stopColor="#f2f2f2" />
        <stop offset="0.8" stopColor="#dadada" />
        <stop offset="1" stopColor="#c2c2c2" />
      </linearGradient>
      <linearGradient id="warn-light" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#ffffff" stopOpacity="1" />
        <stop offset="0.5" stopColor="#ffffff" stopOpacity="0" />
      </linearGradient>
      <linearGradient id="warn-dark" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0.45" stopColor="#000000" stopOpacity="0" />
        <stop offset="1" stopColor="#000000" stopOpacity="0.38" />
      </linearGradient>
      <linearGradient id="warn-mark" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ff6b6b" />
        <stop offset="0.5" stopColor="#e73131" />
        <stop offset="1" stopColor="#b01f1f" />
      </linearGradient>
      <clipPath id="warn-clip"><path d={TRIANGLE} /></clipPath>
      <filter id="warn-mark-shadow" x="-50%" y="-20%" width="200%" height="140%">
        <feDropShadow dx="0.6" dy="0.8" stdDeviation="0.35" floodColor="#000000" floodOpacity="0.45" />
      </filter>
    </defs>
    <path d={TRIANGLE} fill="url(#warn-face)" />
    {/* Bevel: a bright edge at the top left, a dark one along the base and the right side (inside the triangle only) */}
    <g clipPath="url(#warn-clip)" fill="none">
      <path d={TRIANGLE} stroke="url(#warn-light)" strokeWidth="2" />
      <path d={TRIANGLE} stroke="url(#warn-dark)" strokeWidth="2.4" />
    </g>
    <g filter="url(#warn-mark-shadow)" fill="url(#warn-mark)">
      <rect x="10.85" y="6.6" width="2.3" height="8" rx="1.15" />
      <circle cx="12" cy="17.6" r="1.35" />
    </g>
    {/* A thin highlight on the left of the "!" */}
    <rect x="11.15" y="7.2" width="0.55" height="6.6" rx="0.27" fill="#ffffff" opacity="0.45" />
  </svg>
);

// A fraction: its top, a line as wide as the wider of top and bottom (signs included), its bottom
// The chips beside it get exactly the room they need: an invisible copy of the chip after the fraction, so whatever
// follows (a bracket, a sign) comes after the chips. The line sticks out 6px on both sides of the wider number
export function FracView({ top, bottom, chip, roomForChip = false, topRef }: { top: ReactNode; bottom: ReactNode; chip?: { text: string; kind: 'times' | 'divide' }; roomForChip?: boolean; topRef?: (el: HTMLDivElement | null) => void }): ReactElement {
  return (
    <div className="flex items-center">
      <div className="frac-col flex flex-col items-center gap-2 py-7 px-1.5">
        <div ref={topRef} className="relative flex items-center gap-1.5 px-1">{top}{chip && <OpChip {...chip} />}</div>
        <div className="h-1 self-stretch -mx-1.5 rounded-full bg-zinc-300 shadow-[0_0_8px_rgba(212,212,216,0.35)]" />
        <div className="relative flex items-center gap-1.5 px-1">{bottom}{chip && <OpChip {...chip} />}</div>
      </div>
      {chip && roomForChip && (
        <span aria-hidden="true" className="invisible ml-2 h-7 px-[9px] border text-[18.4px] leading-none font-black whitespace-nowrap">{chip.text}</span>
      )}
    </div>
  );
}

export interface FractionBoardProps extends BoardProps {
  fraction: FractionParts;
  onCycleFractionDigit: (part: FracPart, index: number, direction: 1 | -1) => void;
}
