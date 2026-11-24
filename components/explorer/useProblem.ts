import { useEffect, useState } from 'react';
import { cleanNumber, computeNumber, type FracPart, type FractionParts, type MathOp, type NumberData, type NumberType } from '../math/shared';
import type { DivisionMethod, DivisionResult } from '../operations/basic/DivisionBoard';
import { OPERATIONS } from '../operations/registry';
import { EMPTY, newFraction, type DigitCounts } from './problem';

// The problem being explained: the operation, its numbers (and the fractions' parts), how many digits and decimals
// each has, integer / float, the division's options, and everything that changes them. Every change clears the
// explanation (`resetResult`); nothing changes while one runs (`isAnimating`)
export function useProblem({ isAnimating, resetResult }: { isAnimating: boolean; resetResult: (keepBoard?: boolean) => void }) {
  const [digitCounts, setDigitCounts] = useState<Record<MathOp, DigitCounts>>({
    // Every number starts with 1 digit (Julian); the drums go up to 12
    addition: { n1: 1, n2: 1 }, subtraction: { n1: 1, n2: 1 }, multiplication: { n1: 1, n2: 1 }, division: { n1: 1, n2: 1 }, fractions: { n1: 1, n2: 1 },
  });
  // Decimal places chosen for each number when it's a float (0 to 4)
  const [decimalCounts, setDecimalCounts] = useState<Record<MathOp, DigitCounts>>({
    addition: { n1: 2, n2: 2 }, subtraction: { n1: 2, n2: 2 }, multiplication: { n1: 2, n2: 2 }, division: { n1: 2, n2: 2 }, fractions: { n1: 2, n2: 2 },
  });
  const [numberTypes, setNumberTypes] = useState<Record<MathOp, NumberType>>({
    addition: 'integer', subtraction: 'integer', multiplication: 'integer', division: 'integer', fractions: 'integer',
  });
  const [activeOp, setActiveOp] = useState<MathOp>('addition');
  const [num1, setNum1] = useState<NumberData>({ digits: [], decimalCount: 0, sign: 1 });
  const [num2, setNum2] = useState<NumberData>({ digits: [], decimalCount: 0, sign: 1 });
  // Fractions: the numerators and denominators (their signs are N1's and N2's)
  const [fracCounts, setFracCounts] = useState<Record<FracPart, number>>({ n1: 1, d1: 1, n2: 1, d2: 1 });
  const [fracParts, setFracParts] = useState<FractionParts>({ n1: EMPTY, d1: EMPTY, n2: EMPTY, d2: EMPTY });
  const [divisionMethod, setDivisionMethod] = useState<DivisionMethod>('classic');
  // Division: a result with a remainder or with decimals (at most 3); numbers with decimals always get decimals
  const [divisionResult, setDivisionResult] = useState<DivisionResult>('remainder');
  const effectiveDivisionResult: DivisionResult = numberTypes.division === 'float' ? 'decimals' : divisionResult;

  useEffect(() => {
    const id = window.setTimeout(() => {
      setNum1(computeNumber(1, 'integer'));
      setNum2(computeNumber(1, 'integer'));
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  const regenerate = (n1: number, n2: number, type: NumberType, op: MathOp = activeOp, decs: DigitCounts = decimalCounts[op]) => {
    // Floats get the decimal places chosen for each number. New numbers are never ones the operation can't explain
    // (its `blocked` in the registry, e.g. a fraction with the denominator 0): they are drawn again until they can be
    const blockedFor = OPERATIONS.find(o => o.id === op)?.blocked;
    let a: NumberData;
    let b: NumberData;
    let fraction: FractionParts;
    let tries = 0;
    do {
      a = computeNumber(n1, type, { decimals: decs.n1 });
      b = computeNumber(n2, type, { decimals: decs.n2 });
      // In division, the divisor can't be 0
      while (op === 'division' && b.digits.every(d => d === 0)) b = computeNumber(n2, type, { decimals: decs.n2 });
      // Fractions: new numerators and denominators too (N1 and N2 only give them their signs)
      fraction = op === 'fractions' ? newFraction(fracCounts) : fracParts;
    } while (blockedFor?.({ num1: a, num2: b, fraction }) && ++tries < 100);
    setNum1(a);
    setNum2(b);
    if (op === 'fractions') setFracParts(fraction);
    resetResult();
  };
  
  const selectOp = (op: MathOp) => {
    if (isAnimating) return;
    setActiveOp(op);
    regenerate(digitCounts[op].n1, digitCounts[op].n2, numberTypes[op], op);
  };
  
  const handleDigitCountChange = (target: 'n1' | 'n2', val: number) => {
    if (isAnimating) return;
    const next = { ...digitCounts[activeOp], [target]: val };
    setDigitCounts(prev => ({ ...prev, [activeOp]: next }));
    // Fewer digits than decimals + 1: the decimals come down too (a float keeps one digit before the point)
    const decs = { ...decimalCounts[activeOp] };
    if (decs[target] > val - 1) {
      decs[target] = Math.max(0, val - 1);
      setDecimalCounts(prev => ({ ...prev, [activeOp]: decs }));
    }
    regenerate(next.n1, next.n2, numberTypes[activeOp], activeOp, decs);
  };
  
  // Fractions: a slider changed how many digits a numerator or denominator has (1 to 6); new ones are drawn for all four
  const handleFracCountChange = (part: FracPart, val: number) => {
    if (isAnimating) return;
    const next = { ...fracCounts, [part]: val };
    setFracCounts(next);
    setFracParts(newFraction(next));
    resetResult();
  };
  
  // The decimal places a float number gets: as chosen, but never more than its digits allow
  const effectiveDecimals = (which: 'n1' | 'n2') => Math.min(decimalCounts[activeOp][which], digitCounts[activeOp][which] - 1);
  // − / + next to "N1 decimals" and "N2 decimals" (0 to 4); more decimals than the digits allow adds digits
  const changeDecimals = (which: 'n1' | 'n2', delta: 1 | -1) => {
    if (isAnimating) return;
    const d = Math.max(0, Math.min(4, effectiveDecimals(which) + delta));
    const decs = { ...decimalCounts[activeOp], [which]: d };
    const digs = { ...digitCounts[activeOp] };
    if (digs[which] < d + 1) digs[which] = d + 1;
    setDecimalCounts(prev => ({ ...prev, [activeOp]: decs }));
    setDigitCounts(prev => ({ ...prev, [activeOp]: digs }));
    regenerate(digs.n1, digs.n2, numberTypes[activeOp], activeOp, decs);
  };
  
  // Removes leading zeros left by turning the digit drums, and syncs the sliders with the new lengths
  const cleanOperands = (): [NumberData, NumberData] => {
    const a = cleanNumber(num1);
    const b = cleanNumber(num2);
    setNum1(a);
    setNum2(b);
    setDigitCounts(prev => ({ ...prev, [activeOp]: { n1: a.digits.length, n2: b.digits.length } }));
    return [a, b];
  };
  
  const cycleDigit = (which: 'n1' | 'n2', index: number, direction: 1 | -1) => {
    // Digits are changed by hovering a digit and turning its steel drum, but not during a computation
    if (isAnimating || index < 0) return;
    const setter = which === 'n1' ? setNum1 : setNum2;
    setter(prev => {
      const digits = [...prev.digits];
      digits[index] = (digits[index] + direction + 10) % 10;
      return { ...prev, digits };
    });
    resetResult(true);
  };
  
  // Fractions: a digit of a numerator / denominator turned with its steel drum
  const cycleFractionDigit = (part: FracPart, index: number, direction: 1 | -1) => {
    if (isAnimating || index < 0) return;
    setFracParts(prev => {
      const digits = [...prev[part].digits];
      digits[index] = (digits[index] + direction + 10) % 10;
      return { ...prev, [part]: { ...prev[part], digits } };
    });
    resetResult(true);
  };
  
  const toggleSign = (which: 'n1' | 'n2') => {
    if (isAnimating) return;
    const setter = which === 'n1' ? setNum1 : setNum2;
    setter(prev => ({ ...prev, sign: prev.sign === 1 ? -1 : 1 }));
    resetResult(true); // the board stays mounted
  };

  // INTEGER / FLOAT
  const chooseType = (t: NumberType) => {
    setNumberTypes(prev => ({ ...prev, [activeOp]: t }));
    // A float needs at least 2 digits (one before the point), so in division FLOAT raises 1-digit numbers to 2
    const c = digitCounts[activeOp];
    const next = t === 'float' && activeOp === 'division' ? { n1: Math.max(2, c.n1), n2: Math.max(2, c.n2) } : c;
    if (next !== c) setDigitCounts(prev => ({ ...prev, [activeOp]: next }));
    regenerate(next.n1, next.n2, t);
  };
  // Division: the decimal method (CLASSIC / EQUAL DECIMALS) and the result (REMAINDER / DECIMALS)
  const chooseDivisionMethod = (m: DivisionMethod) => {
    if (m === divisionMethod) return;
    setDivisionMethod(m);
    resetResult();
  };
  const chooseDivisionResult = (r: DivisionResult) => {
    if (r === divisionResult) return;
    setDivisionResult(r);
    resetResult();
  };

  return {
    digitCounts, decimalCounts, numberTypes, activeOp, num1, num2, fracCounts, fracParts, setFracParts, setFracCounts,
    divisionMethod, divisionResult, effectiveDivisionResult,
    regenerate, selectOp, handleDigitCountChange, handleFracCountChange, effectiveDecimals, changeDecimals, cleanOperands,
    cycleDigit, cycleFractionDigit, toggleSign, chooseType, chooseDivisionMethod, chooseDivisionResult,
  };
}
export type Problem = ReturnType<typeof useProblem>;
