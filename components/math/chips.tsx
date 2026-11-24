"use client";

// Carries and borrows: the chips, the jump from one place to another, and the sum shown for a moment

import { useEffect, useRef, type ReactElement } from 'react';
import type { BadgeKind } from './types';
import { REM_PX } from './layout';

// The green carry chips are 50% bigger than the red borrow ones (Julian): 30px with a 24px digit (15px, then 60% bigger), against 20px / 10px
export const CARRY_CHIP = 30;
export const BORROW_CHIP = 20;
export const chipSize = (kind: BadgeKind): string => (kind === 'borrow' ? 'w-5 h-5 text-[10px] rounded-md' : 'w-7.5 h-7.5 text-[24px] leading-none rounded-lg');
export const CarryChip = ({ value, kind }: { value: number; kind: BadgeKind }): ReactElement => (
  <div className={`${chipSize(kind)} flex items-center justify-center font-black shadow-[0_0_10px_rgba(0,0,0,0.35)] border animate-pop-in ${kind === 'borrow' ? 'bg-red-600 border-red-400 text-white' : 'bg-green-600 border-green-400 text-white'}`}>
    {value}
  </div>
);

// ---------- Carries and borrows that move where you can see them ----------

// How long a carry (or a borrowed ten) takes to jump from one place to another
export const HOP_MS = 950;
// Coordinates are px: real screen px for `fixed` (measured with getBoundingClientRect), board px (written as rem,
// like the rest of the board) otherwise
const hopUnit = (v: number, fixed: boolean) => (fixed ? `${v}px` : `${v / REM_PX}rem`);

// A chip jumping in an arc (a curve over both ends) from (x0, y0) to (x1, y1), centres. It starts big and lands at
// the size of a carry / borrow chip. Green for a carry, red for a borrow
// `duration`: how long the jump takes (fractions jump more slowly, so a child can follow each number).
// `endScale`: the size it lands at (it starts at 1.6; 1 = the size of a carry chip; fractions land at 1.28, only 20%
// smaller than at the start). `fadeOutMs`: it fades out during its last fadeOutMs (0 = it doesn't), so what it brings
// can appear in its place at the same time. `wide`: the square grows sideways with its text (24, 2³), keeping the
// same room on the left and right as above and below (otherwise it is a fixed 20px square, as for the carries)
export function CarryHop({ x0, y0, x1, y1, value, kind = 'carry', fixed = false, duration = HOP_MS, endScale = 1, fadeOutMs = 0, wide = false }: { x0: number; y0: number; x1: number; y1: number; value: number | string; kind?: BadgeKind; fixed?: boolean; duration?: number; endScale?: number; fadeOutMs?: number; wide?: boolean }): ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const peak = Math.min(y0, y1) - 46;
    // Half its size, to centre it on the path, in the unit of the path (screen px when fixed, board px otherwise)
    const k = fixed ? 1 : (parseFloat(getComputedStyle(document.documentElement).fontSize) || REM_PX) / REM_PX;
    const half = el.offsetWidth / 2 / k || 10;
    const halfH = el.offsetHeight / 2 / k || 10;
    const frames: Keyframe[] = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16, u = 1 - t;
      const x = u * u * x0 + 2 * u * t * ((x0 + x1) / 2) + t * t * x1;
      const y = u * u * y0 + 2 * u * t * (2 * peak - (y0 + y1) / 2) + t * t * y1;
      frames.push({ transform: `translate(${hopUnit(x - half, fixed)}, ${hopUnit(y - halfH, fixed)}) scale(${1.6 + (endScale - 1.6) * t})`, opacity: fadeOutMs ? Math.min(1, ((1 - t) * duration) / fadeOutMs) : 1, offset: t });
    }
    const a = el.animate(frames, { duration: reduce ? 1 : duration, easing: 'ease-in-out', fill: 'forwards' });
    return () => a.cancel();
  }, [x0, y0, x1, y1, fixed, duration, endScale, fadeOutMs]);
  return (
    <div
      ref={ref}
      className={`${fixed ? 'fixed' : 'absolute'} left-0 top-0 z-100 pointer-events-none ${wide ? 'min-w-5 px-1.5 whitespace-nowrap h-5 text-[10px] rounded-md' : chipSize(kind)} flex items-center justify-center font-black text-white border ${kind === 'borrow' ? 'bg-red-600 border-red-400 shadow-[0_0_12px_rgba(248,113,113,0.6)]' : 'bg-green-600 border-green-400 shadow-[0_0_12px_rgba(74,222,128,0.6)]'}`}
      style={{ transform: `translate(${hopUnit(x0 - (wide || kind === 'borrow' ? 10 : CARRY_CHIP / 2), fixed)}, ${hopUnit(y0 - (wide || kind === 'borrow' ? 10 : CARRY_CHIP / 2), fixed)}) scale(1.6)` }}
    >
      {value}
    </div>
  );
}

// A number shown for a moment, centred on (x, y): a column's sum (e.g. 16: the carry 1 in green, 6 in white) or,
// in a subtraction, the top digit with the borrowed ten (e.g. 13: the borrowed 1 in red). `lead` = how many of its
// first characters are the carry / borrowed ten. When `splitting`, the coloured part goes and the rest shrinks away
// `extra`: shown after the number in the carry colour, smaller (multiplication: "42 + 3", the carry being added)
export function SumPop({ x, y, text, lead, kind = 'carry', splitting = false, fixed = false, extra }: { x: number; y: number; text: string; lead: number; kind?: BadgeKind; splitting?: boolean; fixed?: boolean; extra?: string }): ReactElement {
  return (
    <div className={`${fixed ? 'fixed' : 'absolute'} z-90 pointer-events-none -translate-x-1/2 -translate-y-1/2 flex items-baseline font-black text-[30px] leading-none animate-pop-in`} style={{ left: hopUnit(x, fixed), top: hopUnit(y, fixed) }}>
      {lead > 0 && (
        <span className={`transition-opacity duration-200 ${splitting ? 'opacity-0' : 'opacity-100'} ${kind === 'borrow' ? 'text-red-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.7)]' : 'text-green-400 drop-shadow-[0_0_8px_rgba(74,222,128,0.7)]'}`}>{text.slice(0, lead)}</span>
      )}
      <span className={`text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)] transition-[opacity,scale] duration-500 ${splitting ? 'opacity-0 scale-75' : 'opacity-100'}`}>{text.slice(lead)}</span>
      {/* Above the number, outside the flow: the number stays centred where its digit goes, and the "+ 3" covers
          neither the digits already written on its right nor the row below */}
      {extra && <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 text-[22px] leading-none text-green-400 drop-shadow-[0_0_8px_rgba(74,222,128,0.7)] whitespace-nowrap animate-pop-in">{extra}</span>}
    </div>
  );
}
