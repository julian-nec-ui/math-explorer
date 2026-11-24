"use client";

import { type CSSProperties, type ReactElement } from 'react';
import { CELL, COMMA_STYLE, intLength, type NumberData, type BadgeKind, type BoardProps } from '../../../math/shared';

export type DotState = 'on' | 'dim' | 'hidden';
export interface ResultDigit { value: number; id: string; }
export interface FlightData { startX: number; startY: number; endX: number; endY: number; value: number; }
export interface Badge { id: string; col: number; side: 'left' | 'right'; value: number; kind: BadgeKind; fading: boolean; }
export interface CellDigit { value: number; index: number; } // index = position in `digits`, -1 for a padding zero
// How the board shows an addition/subtraction with negative numbers, rewritten as the operation actually done
// on the digits: the two magnitudes (no signs), top and bottom, the real operation, and whether the whole
// result takes a minus in front, as in −(8 − 3)
export interface RewrittenView { top: NumberData; bottom: NumberData; op: 'addition' | 'subtraction'; outerMinus: boolean; }
export type CustomCSSProperties = CSSProperties & Record<`--${string}`, string>;

export const FLIGHT_MS = 1400;

export const digitAt = (n: NumberData, col: number, decLen: number): CellDigit | null => {
  const intLen = intLength(n);
  if (col < decLen) {
    const k = decLen - 1 - col; // which decimal place, from the left
    return k < n.decimalCount ? { value: n.digits[intLen + k], index: intLen + k } : { value: 0, index: -1 };
  }
  const j = col - decLen; // which integer digit, from the right
  return j < intLen ? { value: n.digits[intLen - 1 - j], index: intLen - 1 - j } : null;
};

export const toColumns = (n: NumberData, intLen: number, decLen: number): number[] => {
  const out: number[] = [];
  for (let col = intLen + decLen - 1; col >= 0; col--) out.push(digitAt(n, col, decLen)?.value ?? 0);
  return out;
};

export const compareMagnitude = (a: number[], b: number[]): number => {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
};

export const EmptyCell = (): ReactElement => <div className={`${CELL} shrink-0`} aria-hidden="true" />;

export const DecimalPoint = ({ state }: { state: DotState }): ReactElement => (
  // The same 6px point as in multiplication and division, 3px from the digits on each side (Julian): the rows' 6px gaps
  // are taken back by −3px margins (see DOT_OUTER)
  <div className={`w-1.5 h-1.5 -mx-0.75 mb-0.75 shrink-0 self-end rounded-full transition-opacity duration-500 ${state === 'on' ? 'bg-cyan-300 shadow-[0_0_4px_rgba(103,232,249,0.9)]' : state === 'dim' ? 'bg-zinc-600' : 'opacity-0'}`} aria-label={state === 'hidden' ? undefined : 'point'} />
);

export const CommaSeparator = ({ visible }: { visible: boolean }): ReactElement => (
  <div className={`w-3 shrink-0 flex justify-center leading-7 self-end ${visible ? '' : 'opacity-0'}`}>
    <span className={COMMA_STYLE}>,</span>
  </div>
);

export interface AddSubBoardProps extends BoardProps {
  op: 'addition' | 'subtraction';
}

// Size and place (Julian's rule). Desktop (64rem and wider): the digits keep their normal size and the board stays
// a little left of the centre while it fits (0px with 1 digit … 20px with 12). Too long for the board area (more digits, or the steps window widened): first it moves left,
// into the free room up to 15px from the controls column (`leftRoom`), so its right end stays at the area's edge (2px
// from the steps window); only when there is no room left on the left does it shrink, smoothly, down to 50%; then the
// window comes over the digits and the board scrolls. Room again: the normal size and the centre come back.
// Tablet / phone: shrink to fit, down to 45%
export const ADD_MIN_FIT_DESK = 0.5;
export const ADD_SHIFT_MAX = 20; // px left of the centre with 12 digits (reached by 11: 10/11 of it)
export const ADD_EDGE_GAP = 1; // px between the last digit and the board area's edge when the board is as wide as it gets
export const ADD_GROW_LEFT_FROM = 11; // from this many digits on, more digits only grow the board to the left
export const ADD_MIN_FIT_SMALL = 0.45;
export const WIDE_QUERY = '(min-width: 64rem)';
export const subscribeWide = (cb: () => void) => {
  const mq = window.matchMedia(WIDE_QUERY);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
};
// Room between the cells of a row: 6px (half the 11px of the other boards) and 12px thousands commas (instead of 20px),
// so long numbers fit at a bigger size
export const G = 6;
export const COMMA_SLOT = 12;
// The decimal point's room in a row: 6px wide with −3px margins on both sides (3px from each digit; Julian
// chose 3px over 2px)
export const DOT_OUTER = 6 - 6;

export type ExprFly = { text: string; from: { x: number; y: number }; to: { x: number; y: number } | null; chip?: boolean };
