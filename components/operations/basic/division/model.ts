import { type NumberData, type BoardProps } from '../../../math/shared';
export { GAP, COMMA_W, COMMA_NUDGE, DOT_ROOM } from '../geometry';

export interface Cell { value: number; id: string; col?: number; } // col: the dividend column a quotient digit sits under

// A row under the dividend: the product being subtracted, or the remainder (with brought-down digits).
// Digits are keyed by the dividend column they sit under (0 = leftmost digit).
// dx: drawn this far right of its columns (board px: the subtraction worked out on the side is to the left); move: glides
// when its place changes
export interface WorkRow { id: string; kind: 'product' | 'rem'; y: number; cells: Record<number, Cell>; minusAt?: number; dx?: number; move?: boolean; fading?: boolean;
  // subtraction, like on paper: a top digit whose value changed is crossed out, its new value small above it (column → value)
  crossed?: Record<number, string>; }
export interface Line { id: string; y: number; from: number; to: number; dx?: number; }
export interface Chip { id: string; col: number; side: 'left' | 'right'; rowY: number; value: number; fading: boolean; dx?: number; }
export interface Mover { id: string; value: number; col: number; y: number; }
// The multiplication worked out on the side, under the work (Julian): the divisor, × the quotient digit, a line, and the
// product written digit by digit from the right; then the product rises into its place under the current number.
// All right-aligned on column k; `shown`: how many product digits are written so far; `active`: the divisor digit being
// multiplied (its index), if any; `fly`: the product is moving up to `prodY`
export interface SideMul { id: string; k: number; y: number; prodY: number; divisor: number[]; q: number; prod: number[]; shown: number; active: number | null; carry: number; carryAt?: number; fly: boolean;
  // as in addition: the column's sum popping up where its digit goes (its tens green), and the carry hopping (board px)
  pop?: { x: number; y: number; text: string; lead: number; splitting: boolean; extra?: string } | null;
  hop?: { x0: number; y0: number; x1: number; y1: number; value: number; key: string } | null;
  // as in addition, the column's calculation written on the product row, ending just left of the digit's cell: "3 × 9 ="
  // with the result in the cell; with a carry "27 + [ ] =", the carry chip flying from its corner into the gap (`chip`)
  expr?: { key: string; right: number; y: number; cx: number; parts: string[]; slot: boolean; eq: boolean; result: string | null } | null;
  chip?: { x: number; y: number; value: number } | null; }

// The result (Julian): with a remainder (whole numbers: stop at the units and say what is left), or with decimals:
// the division goes on after the decimal point with brought-down zeros, for at most this many decimal places in the
// quotient (or until it comes out exact). Numbers with decimals always get a result with decimals
export type DivisionResult = 'remainder' | 'decimals';
export const MAX_QUOTIENT_DECIMALS = 3;

// How the decimal points are moved before dividing:
//   classic  — by the divisor's decimal places, so the divisor becomes whole (the dividend may keep decimals)
//   equalize — both numbers get the same number of decimal places (the larger of the two), so both become whole
//   none     — not moved yet: the numbers as entered (shown before the explanation starts)
export type DivisionMethod = 'classic' | 'equalize';
export type PlanMethod = DivisionMethod | 'none';

export const ZERO = BigInt(0);
export const TEN = BigInt(10);

// The whole division worked out in advance, so the layout knows every column and the quotient's length.
//   Dt / dt  — dividend digits and decimal places after moving the decimal point
//   Vt / vDec — divisor digits (leading zeros removed once moved; vOffset of them were removed) and the decimal
//              places it still has (only before moving)
//   intLen   — how many of Dt's digits are in the integer part
//   endCol   — last dividend column the division reaches (columns past Dt are brought-down zeros)
//   quotient / qDot — the quotient's digits as shown, and how many of them are in its integer part
// The numbers being divided are BigInts: with up to 12 digits and 4 decimals they can pass 2^53.
export interface DivisionPlan {
  Dt: number[]; dt: number; Vt: number[]; vDec: number; vOffset: number; shift: number; divisor: bigint;
  intLen: number; decimalMode: boolean; k0: number; endCol: number;
  qcols: number[]; quotient: number[]; qDot: number; remainder: bigint;
}
export const planDivision = (a: NumberData, b: NumberData, method: PlanMethod, result: DivisionResult = 'remainder'): DivisionPlan => {
  const shift = method === 'none' ? 0 : method === 'equalize' ? Math.max(a.decimalCount, b.decimalCount) : b.decimalCount;
  const Dt = [...a.digits, ...Array<number>(Math.max(0, shift - a.decimalCount)).fill(0)];
  const dt = Math.max(0, a.decimalCount - shift);
  const Vfull = [...b.digits, ...Array<number>(Math.max(0, shift - b.decimalCount)).fill(0)];
  const vDec = Math.max(0, b.decimalCount - shift);
  let vOffset = 0;
  if (method !== 'none') while (vOffset < Vfull.length - 1 && Vfull[vOffset] === 0) vOffset++;
  const Vt = Vfull.slice(vOffset);
  const divisor = BigInt(Vt.join('') || '0');
  const decimalMode = a.decimalCount > 0 || b.decimalCount > 0 || result === 'decimals';
  const intLen = Math.max(1, Dt.length - dt);
  const maxCol = decimalMode ? intLen - 1 + MAX_QUOTIENT_DECIMALS : Dt.length - 1;
  const at = (k: number) => BigInt(k < Dt.length ? Dt[k] : 0);
  const qcols: number[] = [];
  let k = 0;
  let cur = at(0);
  if (divisor > ZERO) {
    while (cur < divisor && k < maxCol) { qcols[k] = 0; k++; cur = cur * TEN + at(k); }
  }
  const k0 = k;
  let rem = cur;
  for (;;) {
    const q = divisor > ZERO ? cur / divisor : ZERO;
    qcols[k] = Number(q);
    rem = cur - q * divisor;
    if (k >= maxCol || (decimalMode && rem === ZERO && k >= Dt.length - 1)) break;
    k++;
    cur = rem * TEN + at(k);
  }
  const endCol = k;
  for (let c = 0; c <= endCol; c++) qcols[c] = qcols[c] ?? 0;
  const intDigits = qcols.slice(0, intLen);
  while (intDigits.length > 1 && intDigits[0] === 0) intDigits.shift();
  const quotient = [...intDigits, ...qcols.slice(intLen, endCol + 1)];
  return { Dt, dt, Vt, vDec, vOffset, shift, divisor, intLen, decimalMode, k0, endCol, qcols, quotient, qDot: intDigits.length, remainder: rem };
};
// The quotient shown after column `col` has been divided (same rules as the final quotient), each digit with the
// dividend column it sits under (place value: the quotient's units are under the dividend's units)
export const quotientUpTo = (plan: DivisionPlan, col: number): { value: number; col: number }[] => {
  const cols = plan.qcols.slice(0, col + 1);
  const intPart = cols.slice(0, plan.intLen);
  let first = 0;
  while (first < intPart.length - 1 && intPart[first] === 0) first++;
  return cols.slice(first).map((value, t) => ({ value, col: first + t }));
};

export interface DivisionBoardProps extends BoardProps { method?: DivisionMethod; result?: DivisionResult; }
