"use client";

// How many digits a number has, turned on a steel drum right next to the number on the board (Julian): left of N1 and
// left of N2 (fractions: left of each fraction, its numerator's drum over its denominator's). Drawn inside the board,
// so it shrinks with the board when the board has to shrink, and only then. The page gives the counts through
// `DigitDrums`; without it (nothing to change) no drum is drawn

import { createContext, useContext, type ReactElement } from 'react';
import { CountDrum } from './Drum';
import type { FracPart } from './types';

export interface DigitDrumsValue {
  value: (part: FracPart) => number;
  max: number;
  set: (part: FracPart, v: number) => void;
  disabled: boolean;
  label: (part: FracPart) => string;
}
export const DigitDrums = createContext<DigitDrumsValue | null>(null);

// When the board shrinks (a phone, or the steps window made wider), the drums shrink much less than the digits
// (Julian): not at all while the board is at 75% or more, then slowly, never below 80%
export const drumScaleFor = (fit: number): number => (fit >= 0.75 ? 1 : Math.max(0.8, 1 - (0.75 - fit) * 0.8));
// What the board gives its drums: their own scale over the board's (drawn from their right edge, so they grow to the
// left, away from the N1 / N2 tags). The boards keep room for that (see FitBoard and useAddSubFit)
export const DrumZoom = createContext(1);
// From a board's sign buttons (their left edge) to the drums' left edge: the tag (8px before the buttons, 32px wide),
// 15px, a drum (56px, w-14) — board px, at the drums' normal size
export const DRUM_W = 56;
export const DRUM_REACH = 8 + 32 + 15 + DRUM_W;
// The drums' extra width to the left when drawn `drumScaleFor(fit)` while the board is drawn `fit` (board px)
export const drumExtra = (drumW: number, fit: number): number => drumW * (drumScaleFor(fit) / fit - 1);
// The board's scale, found by trying: the room the drums need depends on the scale itself. `fitFor(extra)` is the
// scale for a board needing `extra` more px on the left
export const solveFit = (drumW: number, fitFor: (extra: number) => number): number => {
  let f = fitFor(0);
  if (!drumW) return f;
  for (let i = 0; i < 16; i++) f = fitFor(drumExtra(drumW, f));
  return f;
};

// `dy`: moved up (negative) or down by that many px, the digits staying where they are
export function OperandDrum({ part, dy = 0 }: { part: FracPart; dy?: number }): ReactElement | null {
  const c = useContext(DigitDrums);
  const zoom = useContext(DrumZoom);
  if (!c) return null;
  const v = c.value(part);
  return (
    <div data-drum className="relative pointer-events-auto shrink-0" style={{ ...(dy ? { top: dy } : {}), ...(zoom !== 1 ? { transform: `scale(${zoom})`, transformOrigin: 'right center' } : {}) }}>
      <CountDrum value={v} min={1} max={c.max} onChange={x => c.set(part, x)} color={part.endsWith('1') ? 'cyan' : 'pink'} disabled={c.disabled} label={`${c.label(part)}: ${v}`} />
    </div>
  );
}
