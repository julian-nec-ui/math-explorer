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
