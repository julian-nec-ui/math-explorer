// Numbers as digits: random ones, cleaning, thousands separators, formatting and the final message

import type { NumberData, NumberType } from './types';

// Thousands separators in a number of `len` digits: how many come before digit `k` (0 = leftmost),
// and whether one follows digit `k`
export const commasBefore = (k: number, len: number): number => Math.floor((len - 1) / 3) - Math.floor((len - 1 - k) / 3);
export const commaAfter = (k: number, len: number): boolean => k < len - 1 && (len - 1 - k) % 3 === 0;

// A random number with `count` digits (no leading zero). A float gets `decimals` decimal places (default 2,
// at most 4), keeping at least one digit before the point
export const computeNumber = (count: number, type: NumberType, options: { decimals?: number } = {}): NumberData => {
  const { decimals = 2 } = options;
  const digits: number[] = [];
  for (let i = 0; i < count; i++) digits.push(i === 0 && count > 1 ? Math.floor(Math.random() * 9) + 1 : Math.floor(Math.random() * 10));
  const decimalCount = type === 'float' ? Math.max(0, Math.min(decimals, 4, count - 1)) : 0;
  return { digits, decimalCount, sign: 1 };
};

export const intLength = (n: NumberData): number => n.digits.length - n.decimalCount;

// Removes leading zeros from the integer part (at least one integer digit stays)
export const cleanNumber = (n: NumberData): NumberData => {
  const intLen = Math.max(1, intLength(n));
  let k = 0;
  while (k < intLen - 1 && n.digits[k] === 0) k++;
  return { ...n, digits: n.digits.slice(k) };
};

// "1234567" with 2 decimals → "12,345.67"; a minus sign only when the number isn't zero
export const formatNumber = (digits: string, decimals = 0, sign: 1 | -1 = 1): string => {
  const intPart = (decimals ? digits.slice(0, digits.length - decimals) : digits) || '0';
  const decPart = decimals ? digits.slice(digits.length - decimals) : '';
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign < 0 && /[1-9]/.test(digits) ? '−' : ''}${grouped}${decPart ? `.${decPart}` : ''}`;
};

export const doneMessage = (result: string, extra = ''): string => `Done!  Result = ${result}${extra}`;

export const numberValue = (n: NumberData): number => Number(n.digits.join('') || '0');
