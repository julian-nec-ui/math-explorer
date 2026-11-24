// The shapes of the data every board and the page share: the operations, a number as its digits, the fractions'
// four parts, and what a board receives from the page

import type { ReactNode } from 'react';

export type MathOp = 'addition' | 'subtraction' | 'multiplication' | 'division' | 'fractions';
export type NumberType = 'integer' | 'float';
export type BadgeKind = 'carry' | 'borrow';
export type DigitVariant = 'highlight' | 'ghostHighlight' | 'result' | 'computed' | 'ghost' | 'idle' | 'input';

// A number as its digits (integer part first, then decimals), how many of them are decimals, and its sign
export interface NumberData { digits: number[]; decimalCount: number; sign: 1 | -1; }

// Fractions: each numerator and denominator is its own number (1 to 6 digits, one slider each); the signs of the two
// fractions are the signs of N1 and N2
export type FracPart = 'n1' | 'd1' | 'n2' | 'd2';
export type FractionParts = Record<FracPart, NumberData>;
export const FRAC_PARTS: FracPart[] = ['n1', 'd1', 'n2', 'd2'];

// What the multiplication and division boards receive from MathExplorer
export interface BoardProps {
  num1: NumberData;
  num2: NumberData;
  run: boolean;
  onStatus: (text: string) => void;
  onDone: () => void;
  renderSign: (which: 'n1' | 'n2', sign: 1 | -1) => ReactNode;
  onCycleDigit: (which: 'n1' | 'n2', index: number, direction: 1 | -1) => void;
  hoverEdit?: boolean;
  availableWidth?: number;
  // How much wider (px) the steps window is than its usual width, beside the board (0 = usual or narrower, closed, or
  // under the board): addition / subtraction shrink their board in the same proportion as the board area
  stepsExtra?: number;
  // Room (px) on the left of the board area the board may move into (desktop): up to 15px from the controls column
  leftRoom?: number;
  // The steps window is collapsed (beside the board or under it): the board can sit in the middle of all the room
  stepsClosed?: boolean;
  // The middle of the page (px from the board area's left content edge)
  pageMidX?: number;
  // The board area's height (nominal px): multiplication and division shrink what is under their operands to fit it
  availableHeight?: number;
  // The steps window is opening / closing and the board's size or place changes with it: glide there (600ms)
  smoothFit?: boolean;
  // Reports the width the board needs at full size (nominal px), to tell whether the steps window's width affects it
  onNaturalWidth?: (w: number) => void;
}
