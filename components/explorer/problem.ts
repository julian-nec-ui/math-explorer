// The problem's pieces that aren't state: the fractions' limits and labels, new random fractions, an empty number

import { FRAC_PARTS, computeNumber, numberValue, type FracPart, type FractionParts, type NumberData } from '../math/shared';

export interface DigitCounts { n1: number; n2: number; }

// Fractions: how many digits each numerator / denominator has (1 to 6, one slider each), and new random ones: never 0
// (no denominator 0, and no numerator 0 either, which would make an empty example)
export const FRACTION_MAX_DIGITS = 6;
export const FRACTION_LABELS: Record<FracPart, string> = { n1: 'Numerator 1', d1: 'Denominator 1', n2: 'Numerator 2', d2: 'Denominator 2' };
export const newFraction = (counts: Record<FracPart, number>): FractionParts => {
  let parts: FractionParts;
  let tries = 0;
  do {
    parts = { n1: computeNumber(counts.n1, 'integer'), d1: computeNumber(counts.d1, 'integer'), n2: computeNumber(counts.n2, 'integer'), d2: computeNumber(counts.d2, 'integer') };
  } while (FRAC_PARTS.some(k => numberValue(parts[k]) === 0) && ++tries < 100);
  return parts;
};
export const EMPTY: NumberData = { digits: [], decimalCount: 0, sign: 1 };
