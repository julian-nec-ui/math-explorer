// The addition test (Julian): its levels and the questions of each, made at random every time a new test starts.
//
// Beginner: 18 additions of two numbers, in six groups of three, in this order (Julian):
//   1 digit, no carry · 2 digits, no carry · 1 digit, with carry · 2 digits, with carry · 3 digits, no carry ·
//   3 digits, with carry
// "With carry": at least one column carries (a mix: sometimes one column, sometimes all of them).
// Medium / Advanced / Pro: to be defined (shown, not yet available).

export type Level = 'beginner' | 'medium' | 'advanced' | 'pro';
export const LEVELS: { id: Level; label: string; ready: boolean }[] = [
  { id: 'beginner', label: 'Beginner', ready: true },
  { id: 'medium', label: 'Medium', ready: false },
  { id: 'advanced', label: 'Advanced', ready: false },
  { id: 'pro', label: 'Pro', ready: false },
];

export type Group = { digits: number; carry: boolean };
export const PER_GROUP = 3;
const GROUPS: Record<Level, Group[]> = {
  beginner: [
    { digits: 1, carry: false },
    { digits: 2, carry: false },
    { digits: 1, carry: true },
    { digits: 2, carry: true },
    { digits: 3, carry: false },
    { digits: 3, carry: true },
  ],
  medium: [],
  advanced: [],
  pro: [],
};
export const groupsOf = (level: Level): Group[] => GROUPS[level];
export const groupLabel = (g: Group): string => `${g.digits} digit${g.digits > 1 ? 's' : ''} · ${g.carry ? 'with carry' : 'no carry'}`;

export type Question = Group & { a: number; b: number };

// Carry (Julian): in a test with carry the carries are written too, in small boxes above the first number — one above each
// column the carry goes into, from the tens to the longer number's leftmost column (what comes out of that last column
// is written straight into the result, as before). A question is right only when the result AND every carry are right
// (an empty box: no carry). The boxes are there only in the groups with carry; nothing jumps into them by itself — the
// child decides where a carry goes.
export const columnsOf = (q: { a: number; b: number }): number => Math.max(String(q.a).length, String(q.b).length);
// the carry into each column above the units: [into the tens, into the hundreds, …], 0 or 1 — up to the column past
// the numbers (what comes out of the leftmost one)
export const carriesOf = (q: { a: number; b: number }): number[] => {
  const out: number[] = [];
  let c = 0;
  for (let k = 0, x = q.a, y = q.b; k < columnsOf(q); k++, x = Math.floor(x / 10), y = Math.floor(y / 10)) {
    c = (x % 10) + (y % 10) + c >= 10 ? 1 : 0;
    out.push(c);
  }
  return out;
};
// 1 digit with carry (Julian): a box above the tens too — the carry is written there, and at Check it turns green and
// comes down into the result as its first digit (8 + 7: 5 typed, 1 above, Check → 15)
export const dropsCarry = (q: Question): boolean => q.carry && columnsOf(q) === 1;
// how many carry boxes a question has (none in the groups without carry)
export const carryBoxes = (q: Question): number => (q.carry ? columnsOf(q) - 1 + (dropsCarry(q) ? 1 : 0) : 0);
export const carryRight = (q: Question, carry: string[] | undefined): boolean =>
  carriesOf(q).slice(0, carryBoxes(q)).every((c, k) => Number(carry?.[k] || 0) === c);
export const isRight = (q: Question, value: number | null | undefined, carry: string[] | undefined): boolean =>
  value !== null && value !== undefined && value === q.a + q.b && carryRight(q, carry);
// the carries as written, leftmost column first ("1 –")
export const carryText = (q: Question, carry: string[] | undefined): string =>
  Array.from({ length: carryBoxes(q) }, (_, k) => carry?.[k] || '–').reverse().join(' ');
export const carryExpectedText = (q: Question): string => carriesOf(q).slice(0, carryBoxes(q)).map(c => (c ? '1' : '–')).reverse().join(' ');

// Does adding a and b carry in any column?
export const hasCarry = (a: number, b: number): boolean => {
  for (let x = a, y = b; x > 0 || y > 0; x = Math.floor(x / 10), y = Math.floor(y / 10)) {
    if ((x % 10) + (y % 10) >= 10) return true; // (no carry so far, so nothing comes in from the right)
  }
  return false;
};

const randInt = (lo: number, hi: number): number => lo + Math.floor(Math.random() * (hi - lo + 1));
// a number with exactly `digits` digits (1 digit: 1–9, never 0)
const randNumber = (digits: number): number => (digits === 1 ? randInt(1, 9) : randInt(10 ** (digits - 1), 10 ** digits - 1));

// One question of a group, different from the ones already in `used` (a + b and b + a count as the same)
export function makeQuestion(g: Group, used: Set<string>): Question {
  let last: Question = { ...g, a: 0, b: 0 };
  for (let i = 0; i < 5000; i++) {
    const a = randNumber(g.digits), b = randNumber(g.digits);
    if (hasCarry(a, b) !== g.carry) continue;
    last = { ...g, a, b };
    const key = `${Math.min(a, b)}+${Math.max(a, b)}`;
    if (used.has(key)) continue;
    used.add(key);
    return last;
  }
  return last;
}

export function makeTest(level: Level): Question[] {
  const used = new Set<string>();
  return groupsOf(level).flatMap(g => Array.from({ length: PER_GROUP }, () => makeQuestion(g, used)));
}
