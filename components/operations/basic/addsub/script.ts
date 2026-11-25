import type { Dispatch, RefObject, SetStateAction } from 'react';
import { nav, paced, pausableTimeout, HOP_MS, doneMessage, formatNumber, intLength, CARRY_CHIP, type NumberData, type BadgeKind } from '../../../math/shared';
import { type Badge, type ExprFly, FLIGHT_MS, type FlightData, type ResultDigit, type RewrittenView, compareMagnitude, digitAt, toColumns } from './model';

// What the explanation works with: the board's props, state setters, refs and measurements
export interface AddSubScript {
  run: boolean;
  num1: NumberData;
  num2: NumberData;
  op: "addition" | "subtraction";
  setView: Dispatch<SetStateAction<RewrittenView | null>>;
  row1Ref: RefObject<HTMLDivElement | null>;
  row2Ref: RefObject<HTMLDivElement | null>;
  setSwapDist: Dispatch<SetStateAction<number>>;
  fitRef: RefObject<number>;
  setSwapMs: Dispatch<SetStateAction<number>>;
  setSwapping: Dispatch<SetStateAction<boolean>>;
  onStatus: (text: string) => void;
  setBadges: Dispatch<SetStateAction<Badge[]>>;
  setZero: Dispatch<SetStateAction<{ col: number; row: "top" | "bottom"; sub: boolean; fading: boolean; } | null>>;
  setCrossedFading: Dispatch<SetStateAction<boolean>>;
  setCrossed: Dispatch<SetStateAction<Record<number, string>>>;
  resultRefs: RefObject<Record<number, HTMLDivElement | null>>;
  setExpr: Dispatch<SetStateAction<{ key: string; right: number; y: number; cx: number; size: number; parts: string[]; slot: boolean; shown: boolean; eq: boolean; result: string | null; fly: ExprFly[]; landed: boolean; } | null>>;
  exprPartRefs: RefObject<(HTMLSpanElement | null)[]>;
  carryRefs: RefObject<Record<number, HTMLDivElement | null>>;
  exprSlotRef: RefObject<HTMLSpanElement | null>;
  setCurrentColumn: Dispatch<SetStateAction<number>>;
  setOpMark: Dispatch<SetStateAction<{ col: number; sub: boolean; } | null>>;
  topRefs: RefObject<Record<number, HTMLDivElement | null>>;
  setHop: Dispatch<SetStateAction<{ x0: number; y0: number; x1: number; y1: number; value: number | string; kind: BadgeKind; key: string; } | null>>;
  zeroRef: RefObject<HTMLDivElement | null>;
  opMarkRef: RefObject<HTMLDivElement | null>;
  bottomRefs: RefObject<Record<number, HTMLDivElement | null>>;
  setSumChip: Dispatch<SetStateAction<{ x: number; y: number; text: string; lead: number; kind: BadgeKind; splitting: boolean; } | null>>;
  setResult: Dispatch<SetStateAction<Record<number, ResultDigit>>>;
  setComputedColumns: Dispatch<SetStateAction<Set<number>>>;
  lineRef: RefObject<HTMLDivElement | null>;
  setFlight: Dispatch<SetStateAction<FlightData | null>>;
  setFadingCols: Dispatch<SetStateAction<Set<number>>>;
  setResultSign: Dispatch<SetStateAction<1 | -1 | null>>;
  onDone: () => void;
}

// The explanation, started when `run` turns true. Stopping (or any reset) remounts the board, which ends it
export function runAddSub({ run, num1, num2, op, setView, row1Ref, row2Ref, setSwapDist, fitRef, setSwapMs, setSwapping, onStatus, setBadges, setZero, setCrossedFading, setCrossed, resultRefs, setExpr, exprPartRefs, carryRefs, exprSlotRef, setCurrentColumn, setOpMark, topRefs, setHop, zeroRef, opMarkRef, bottomRefs, setSumChip, setResult, setComputedColumns, lineRef, setFlight, setFadingCols, setResultSign, onDone }: AddSubScript) {
  if (!run) return;
  let alive = true;
  const runId = Date.now();

  // Prev (Julian): every step can be played backwards, the way it went forwards. What the board shows is kept here
  // too (`shadow`, as the state setters below are called); where each step ended (`ends`, taken at its last pause:
  // where Prev / Next stop) is what a step goes back to, after its own backward moves (`extras`: the digits flying
  // back up, the carry flying back, the result digit fading...). See nav.undo in timing
  type Snap = Record<string, unknown>;
  const shadow: Snap = { result: {}, resultSign: null, currentColumn: -1, computedColumns: new Set<number>(), badges: [], opMark: null, zero: null, fadingCols: new Set<number>(), flight: null, sumChip: null, expr: null, hop: null, crossed: {}, crossedFading: false, view: null, swapping: false, swapDist: 0, swapMs: 700 };
  const real: Record<string, (v: unknown) => void> = {};
  const track = <T,>(name: string, set: Dispatch<SetStateAction<T>>): Dispatch<SetStateAction<T>> => {
    real[name] = set as (v: unknown) => void;
    return (v: SetStateAction<T>) => {
      const nv = typeof v === 'function' ? (v as (p: T) => T)(shadow[name] as T) : v;
      shadow[name] = nv;
      set(nv);
    };
  };
  setResult = track('result', setResult); setResultSign = track('resultSign', setResultSign);
  setCurrentColumn = track('currentColumn', setCurrentColumn); setComputedColumns = track('computedColumns', setComputedColumns);
  setBadges = track('badges', setBadges); setOpMark = track('opMark', setOpMark); setZero = track('zero', setZero);
  setFadingCols = track('fadingCols', setFadingCols); setFlight = track('flight', setFlight); setSumChip = track('sumChip', setSumChip);
  setExpr = track('expr', setExpr); setHop = track('hop', setHop); setCrossed = track('crossed', setCrossed);
  setCrossedFading = track('crossedFading', setCrossedFading); setView = track('view', setView); setSwapping = track('swapping', setSwapping);
  setSwapDist = track('swapDist', setSwapDist); setSwapMs = track('swapMs', setSwapMs);
  const restore = (snap: Snap) => { for (const k of Object.keys(snap)) { shadow[k] = snap[k]; real[k]?.(snap[k]); } };
  const sleep = (ms: number) => new Promise<void>(r => window.setTimeout(r, ms));
  const fadeOut = (el: Element | null | undefined, ms = 450) => { el?.animate([{ opacity: 1, scale: '1' }, { opacity: 0, scale: '0.7' }], { duration: ms, easing: 'ease-in', fill: 'forwards' }); };
  let lastSnap: Snap = { ...shadow };
  let curStep = 0;
  const ends: Record<number, Snap> = {};
  const extras: Record<number, (before: Snap) => Promise<void>> = {};
  const undoExtra = (fn: (before: Snap) => Promise<void>) => { extras[curStep] = fn; };
  // (a board made again — Prev — ends this run at once, even before React unmounts it)
  const myGen = nav.gen;
  const say = (text: string) => {
    if (nav.gen !== myGen) { alive = false; return; }
    ends[curStep] = lastSnap;
    if (!text.startsWith('Done')) {
      curStep++;
      const k = curStep, before = ends[k - 1];
      nav.undo[k] = async () => {
        const x = extras[k];
        if (x) await x(before);
        restore(before);
        await sleep(750);
      };
    } else {
      const before = ends[curStep];
      nav.undoDone = async () => { restore(before); await sleep(750); };
    }
    onStatus(text);
  };
  const a = num1, b = num2;
  (async () => {
    // React's strict mode (dev) mounts, cleans up and mounts again: let the throwaway run end here,
    // before it announces its first step (otherwise that step shows twice)
    await Promise.resolve();
    if (!alive) return;
    const wait = (ms: number) => {
      lastSnap = { ...shadow };
      return new Promise<boolean>(resolve => {
        pausableTimeout(() => resolve(alive), paced(ms));
      });
    };

    const dec = Math.max(a.decimalCount, b.decimalCount);
    const int = Math.max(intLength(a), intLength(b), 1);
    const len = int + dec;

    // Signed terms: N1, and N2 with the sign it really has in the sum (subtracting N2 = adding −N2)
    const signA = a.sign;
    const signB = (op === 'subtraction' ? -b.sign : b.sign) as 1 | -1;
    const subtract = signA !== signB;

    const fmt = (n: NumberData) => {
      const i = intLength(n);
      return n.digits.slice(0, i).join('') + (n.decimalCount ? '.' + n.digits.slice(i).join('') : '');
    };
    const show = (n: NumberData) => (n.sign < 0 ? `(−${fmt(n)})` : fmt(n));
    const mag = (n: NumberData): NumberData => ({ ...n, sign: 1 });
    const ea = fmt(a), eb = fmt(b);
    const original = `${show(a)} ${op === 'subtraction' ? '−' : '+'} ${show(b)}`;

    // Slides the two operand rows past each other, then shows them swapped
    // What the board currently shows, and whether its rows are in the opposite order to N1 / N2
    // (used at the end to animate back to the problem as entered)
    let shown: RewrittenView | null = null;
    let rowsSwapped = false;
    const putView = (v: RewrittenView | null) => { shown = v; setView(v); };

    // Slides the two operand rows past each other, then shows `next` (null = the numbers as entered)
    // `k` scales the timing (REWRITE at the start, 1 when the rows go back at the end)
    const swapRows = async (next: RewrittenView | null, k = 1): Promise<boolean> => {
      const r1 = row1Ref.current?.getBoundingClientRect(), r2 = row2Ref.current?.getBoundingClientRect();
      // measured on the screen: divided by the zoom, since the rows move inside the zoomed board
      setSwapDist(r1 && r2 ? (r2.bottom - r1.bottom) / fitRef.current : 0);
      setSwapMs(Math.round(700 * k));
      setSwapping(true);
      if (!(await wait(Math.round(750 * k)))) return false;
      putView(next);
      rowsSwapped = !rowsSwapped;
      setSwapping(false);
      return wait(Math.round(500 * k));
    };
    // Start timing. When the problem is rewritten first (signs taken out of the numbers, rows swapped, the brackets
    // and the pink minus), those steps are 30% shorter; when it starts straight away, the start is 30% longer
    const REWRITE = 0.7, START = 1.3;
    let rewritten = false;

    // The board is rewritten as the operation really done on the digits, in at most two steps:
    //  1. the signs leave the numbers: adding a negative becomes a subtraction (positive number on top),
    //     subtracting a negative becomes an addition, two negatives become −(… + …)
    //  2. when the bottom number of a subtraction is the larger one, the rows swap and the minus goes in front: 3 − 8 = −(8 − 3)
    let top: NumberData, bottom: NumberData, outerMinus: boolean;
    if (!subtract) {
      top = mag(a); bottom = mag(b); outerMinus = signA < 0;
      if (op === 'subtraction' || signA < 0) {
        const sum = `${ea} + ${eb}`;
        say(signA < 0
          ? `${original} = −(${sum}): both parts are negative, so we add the numbers and keep the minus in front. We use carries.`
          : `${original} = ${sum}: subtracting a negative number means adding it. We use carries.`);
        putView({ top, bottom, op: 'addition', outerMinus });
        rewritten = true;
        if (!(await wait(3000 * REWRITE))) return;
      }
    } else {
      // Positive number on top
      const posFirst = signA > 0;
      top = mag(posFirst ? a : b); bottom = mag(posFirst ? b : a); outerMinus = false;
      const posText = fmt(top), negText = fmt(bottom);
      if (!(op === 'subtraction' && signA > 0)) {
        say(op === 'addition'
          ? `${original} = ${posText} − ${negText}: adding a negative number means subtracting it. We put the positive number, ${posText}, on top.`
          : `${original} = ${posText} − ${negText}: subtracting a negative number means adding it, so we put the positive number, ${posText}, on top and subtract ${negText}.`);
        if (posFirst) {
          putView({ top, bottom, op: 'subtraction', outerMinus: false });
        } else {
          // The rows trade places so the positive number ends up on top
          putView({ top: mag(a), bottom: mag(b), op: 'subtraction', outerMinus: false });
          if (!(await swapRows({ top, bottom, op: 'subtraction', outerMinus: false }, REWRITE))) return;
        }
        rewritten = true;
        if (!(await wait(2600 * REWRITE))) return;
      }
      // A larger number can't be taken from a smaller one column by column, so subtract the other way round
      const width = Math.max(intLength(a), intLength(b), 1), decs = Math.max(a.decimalCount, b.decimalCount);
      if (compareMagnitude(toColumns(top, width, decs), toColumns(bottom, width, decs)) < 0) {
        say(`${negText} is larger than ${posText}, so we swap them and subtract the other way round: ${posText} − ${negText} = −(${negText} − ${posText}). The minus stays in front of the result.`);
        // (a plain positive subtraction like 3 − 8 has no rewrite yet: show it as entered before the swap)
        putView({ top, bottom, op: 'subtraction', outerMinus: false });
        [top, bottom] = [bottom, top];
        outerMinus = true;
        if (!(await swapRows({ top, bottom, op: 'subtraction', outerMinus: true }, REWRITE))) return;
        rewritten = true;
        if (!(await wait(2400 * REWRITE))) return;
      }
    }
    const finalSign: 1 | -1 = outerMinus ? -1 : 1;
    const topCols = toColumns(top, int, dec);
    const bottomCols = toColumns(bottom, int, dec);

    // The carry (or borrow) produced by a pair appears in its top-left corner.
    // At the next pair it slides into that pair's top-right corner, where it is used,
    // and at the pair after that it slowly fades out.
    const kind: BadgeKind = subtract ? 'borrow' : 'carry';
    let badgeSeq = 0;
    const dropFaded = () => window.setTimeout(() => {
      if (alive) setBadges(prev => prev.filter(x => !x.fading));
    }, 1100);
    const addBadge = (col: number, value: number) => {
      const id = `b${runId}-${badgeSeq++}`;
      // The new carry replaces the used one: the old one (top-right) slowly fades out
      setBadges(prev => [...prev.map(x => (x.side === 'right' ? { ...x, fading: true } : x)), { id, col, side: 'left', value, kind, fading: false }]);
      dropFaded();
    };
    const moveIncomingBadge = (col: number) => {
      setBadges(prev => prev.map(x => {
        if (x.fading) return x;
        if (x.side === 'right') return { ...x, fading: true }; // used at the previous pair
        return { ...x, col, side: 'right' };                    // moves to the current pair
      }));
      dropFaded();
    };
    const fadeAllBadges = () => {
      setBadges(prev => prev.map(x => ({ ...x, fading: true })));
      setZero(prev => (prev ? { ...prev, fading: true } : prev));
      window.setTimeout(() => { if (alive) setZero(null); }, 1100);
      dropFaded();
      // The crossed-out digits go back to normal too
      setCrossedFading(true);
      window.setTimeout(() => {
        if (alive) { setCrossed({}); setCrossedFading(false); }
      }, 1100);
    };

    // The column's calculation on the result row (see `expr`)
    const centre = (el: Element | null | undefined) => {
      const r = el?.getBoundingClientRect();
      return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
    };
    const frames = (n = 2) => new Promise<void>(r => { const f = (i: number) => (i ? requestAnimationFrame(() => f(i - 1)) : r()); f(n); });
    let exprSeq = 0;
    // The line ends 6px (board px, scaled) before the result's cell, on its middle; the font is the board's 22px, scaled
    const exprPlace = (col: number) => {
      const c = resultRefs.current[col]?.getBoundingClientRect();
      if (!c) return null;
      const kp = (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16) / 16;
      const f = fitRef.current;
      return { right: c.left - 6 * kp * f, y: c.top + c.height / 2, cx: c.left + c.width / 2, size: 22 * f };
    };
    // "a op b =": the two digits and the sign come down from the column into the line, then "=" and the result
    const showCalc = async (col: number, a: string, op: string, b: string, result: string, from: (ReturnType<typeof centre>)[]) => {
      const place = exprPlace(col);
      if (!place) return true;
      const key = `e${runId}-${exprSeq++}`;
      const base = { key, ...place, parts: [a, op, b], slot: false, shown: false, eq: false, result: null, fly: [] as ExprFly[], landed: false };
      setExpr(base);
      await frames();
      const to = [0, 1, 2].map(i => centre(exprPartRefs.current[i]));
      const fly: ExprFly[] = [a, op, b].map((text, i) => ({ text, from: from[i] ?? to[i] ?? { x: place.cx, y: place.y }, to: null }));
      setExpr({ ...base, fly });
      await frames();
      setExpr({ ...base, fly: fly.map((f, i) => ({ ...f, to: to[i] ?? f.from })) });
      // backwards: the digits and the sign fly back up to the column
      undoExtra(async () => {
        setExpr({ ...base, fly: fly.map((f, i) => ({ ...f, to: to[i] ?? f.from })) });
        await frames();
        setExpr({ ...base, fly });
        await sleep(750);
      });
      if (!(await wait(700))) return false;
      setExpr({ ...base, shown: true });
      if (!(await wait(300))) return false;
      setExpr({ ...base, shown: true, eq: true, result });
      return wait(1100);
    };
    // Addition with a carry: "s + [ ] =", the green carry chip flies from its corner into the gap, then "= total"
    const addCarry = async (col: number, s: number, c: number) => {
      const place = exprPlace(col);
      const sl = carryRefs.current[col]?.getBoundingClientRect();
      if (!place || !sl) return true;
      const kp = (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16) / 16;
      const f = fitRef.current;
      // the used carry sits in the column's top-right corner, at 80% (origin bottom right)
      const from = { x: sl.right - (1 + 0.4 * CARRY_CHIP) * kp * f, y: sl.bottom + (9 - 0.4 * CARRY_CHIP) * kp * f };
      const key = `e${runId}-${exprSeq++}`;
      const base = { key, ...place, parts: [String(s), '+'], slot: true, shown: true, eq: false, result: null, fly: [] as ExprFly[], landed: false };
      setExpr(base);
      await frames();
      const to = centre(exprSlotRef.current) ?? from;
      setBadges(prev => prev.map(x => (x.side === 'right' && !x.fading ? { ...x, fading: true } : x)));
      dropFaded();
      const chip: ExprFly = { text: String(c), from, to: null, chip: true };
      setExpr({ ...base, fly: [chip] });
      await frames();
      setExpr({ ...base, fly: [{ ...chip, to }] });
      // backwards: the carry flies back to its corner
      undoExtra(async () => {
        setExpr({ ...base, fly: [{ ...chip, to }] });
        await frames();
        setExpr({ ...base, fly: [chip] });
        await sleep(950);
      });
      if (!(await wait(900))) return false;
      setExpr({ ...base, fly: [{ ...chip, to }], landed: true, eq: true, result: String(s + c) });
      return wait(1300);
    };

    if (!(await wait(rewritten ? 600 : 600 * START))) return;


    const res: Record<number, ResultDigit> = {};
    let carry = 0;
    let allZero = true;
    let calcFrom: (ReturnType<typeof centre>)[] = [];

    for (let col = 0; col < len; col++) {
      const idx = len - 1 - col;
      const t = topCols[idx], btm = bottomCols[idx];
      setCurrentColumn(col);
      setOpMark({ col, sub: subtract });
      moveIncomingBadge(col);
      const missing: 'top' | 'bottom' | null = !digitAt(top, col, dec) ? 'top' : !digitAt(bottom, col, dec) ? 'bottom' : null;
      if (missing) setZero({ col, row: missing, sub: subtract, fading: false });
      // (Julian) each part of a column is its own step (Prev / Next stop at each): the column lit with its sign, the
      // calculation coming down, the carry added, the borrow, the digit written
      say(!subtract
        ? `Next column: ${t} + ${btm}${carry ? ', and the carry 1' : ''}`
        : `Next column: ${t} − ${btm}${carry ? `, and ${t} lent 1` : ''}`);
      if (!(await wait(col === 0 && !rewritten ? 1000 * START : 1000))) return;

      // Subtraction: this digit lent 1 to the column on the right. The red mark drops onto it, and the digit is
      // crossed out with its new value above it (9 → 8). A 0 has nothing to give yet: it borrows first (below)
      if (subtract && carry) {
        const to = topRefs.current[col]?.getBoundingClientRect(), sl = carryRefs.current[col]?.getBoundingClientRect();
        if (to && sl) {
          setBadges(prev => prev.map(x => (x.side === 'right' && !x.fading ? { ...x, fading: true } : x)));
          dropFaded();
          setHop({ x0: sl.right - 11, y0: sl.bottom - 1, x1: to.left + to.width / 2, y1: to.top + to.height / 2, value: '−1', kind: 'borrow', key: `m${runId}-${col}` });
          // backwards: the −1 goes back up to its corner
          undoExtra(async (before) => {
            setCrossed(before.crossed as Record<number, string>);
            setHop({ x0: to.left + to.width / 2, y0: to.top + to.height / 2, x1: sl.right - 11, y1: sl.bottom - 1, value: '−1', kind: 'borrow', key: `u${runId}-${col}-${Date.now()}` });
            await sleep(HOP_MS);
            setHop(null);
          });
          if (!(await wait(HOP_MS))) return;
          setHop(null);
          if (t > 0) {
            setCrossed(prev => ({ ...prev, [col]: String(t - 1) }));
            say(`${t} lent 1 to the column on the right, so it is now ${t - 1}.`);
            if (!(await wait(1000))) return;
          }
        }
      }

      let digit: number, next: number;
      if (!subtract) {
        const sum = t + btm + carry;
        digit = sum % 10;
        next = sum >= 10 ? 1 : 0;
      } else {
        const raw = t - btm - carry;
        next = raw < 0 ? 1 : 0;
        digit = raw < 0 ? raw + 10 : raw;
      }
      const left = carry ? `${t} − 1` : `${t}`;

      // The calculation on the result row (Julian). Subtraction with a borrow: the borrow is done first, up in the column
      // (below), and the calculation comes down after it with the borrowed ten
      {
        const missing2 = !digitAt(top, col, dec) ? 'top' : !digitAt(bottom, col, dec) ? 'bottom' : null;
        const from = [
          centre(missing2 === 'top' ? zeroRef.current : topRefs.current[col]),
          centre(opMarkRef.current),
          centre(missing2 === 'bottom' ? zeroRef.current : bottomRefs.current[col]),
        ];
        if (!subtract) {
          say(`${t} + ${btm} = ${t + btm}`);
          if (!(await showCalc(col, String(t), '+', String(btm), String(t + btm), from))) return;
          if (carry) {
            say(`${t + btm} + the carry 1 = ${t + btm + carry}`);
            if (!(await addCarry(col, t + btm, carry))) return;
          }
          setExpr(null);
        } else if (!next) {
          say(`${left} − ${btm} = ${digit}`);
          if (!(await showCalc(col, String(t - carry), '−', String(btm), String(digit), from))) return;
          setExpr(null);
        }
        calcFrom = from;
      }

      // First the result digit, then the new carry (if any) in the top-left corner
      if (digit !== 0) allZero = false;
      const cellEl = resultRefs.current[col], slotEl = carryRefs.current[col];
      if (!subtract && next && cellEl && slotEl) {
        // The whole sum (e.g. 12) appears where the result digit goes
        const c = cellEl.getBoundingClientRect(), sl = slotEl.getBoundingClientRect();
        const x = c.left + c.width / 2, y = c.top + c.height / 2;
        say(`${t + btm + carry} goes on the result row: ${digit} is written, the 1 is carried`);
        setSumChip({ x, y, text: String(t + btm + carry), lead: 1, kind: 'carry', splitting: false });
        undoExtra(async () => { setSumChip(sc => (sc ? { ...sc, splitting: true } : sc)); await sleep(450); });
        if (!(await wait(900))) return;
        say(`Write ${digit}, carry 1 up to the next column`);
        // It splits: the units become the result digit, the tens jump to this column's carry corner
        setSumChip(prev => (prev ? { ...prev, splitting: true } : prev));
        res[col] = { value: digit, id: `r${runId}-${col}` };
        setResult({ ...res });
        setComputedColumns(prev => new Set(prev).add(col));
        // to the centre of the carry chip's place: 1px in from the slot's left, its bottom 9px under the slot (screen px)
        const kp = (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16) / 16;
        const hx0 = x - 0.3 * c.width, hy0 = y, hx1 = sl.left + (1 + CARRY_CHIP / 2) * kp, hy1 = sl.bottom + (9 - CARRY_CHIP / 2) * kp;
        setHop({ x0: hx0, y0: hy0, x1: hx1, y1: hy1, value: next, kind: 'carry', key: `h${runId}-${col}` });
        // backwards: the carry jumps back from its corner into the sum, the digit written fades
        undoExtra(async (before) => {
          setBadges(before.badges as Badge[]);
          fadeOut(cellEl.firstElementChild);
          setHop({ x0: hx1, y0: hy1, x1: hx0, y1: hy0, value: next, kind: 'carry', key: `u${runId}-${col}-${Date.now()}` });
          await sleep(HOP_MS);
          setHop(null);
        });
        if (!(await wait(HOP_MS))) return;
        setSumChip(null);
        setHop(null);
        addBadge(col, next);
        if (!(await wait(700))) return;
        carry = next;
      } else if (subtract && next && topRefs.current[col] && topRefs.current[col + 1]) {
        // Borrow: the ten jumps from the top digit on the left onto this column's top digit (e.g. 3 becomes 13)
        const from = topRefs.current[col + 1]!.getBoundingClientRect(), to = topRefs.current[col]!.getBoundingClientRect();
        // (just above the digit, so the digit itself stays readable)
        const x = to.left + to.width / 2, y = to.top - 16;
        say(`${left} is less than ${btm} → borrow 10 from the left: ${t - carry} becomes ${t - carry + 10}`);
        setHop({ x0: from.left + from.width / 2, y0: from.top + from.height / 2, x1: x, y1: y, value: 10, kind: 'borrow', key: `h${runId}-${col}` });
        // backwards: the ten goes back to the digit on the left
        undoExtra(async (before) => {
          setSumChip(null);
          setCrossed(before.crossed as Record<number, string>);
          setHop({ x0: x, y0: y, x1: from.left + from.width / 2, y1: from.top + from.height / 2, value: 10, kind: 'borrow', key: `u${runId}-${col}-${Date.now()}` });
          await sleep(HOP_MS);
          setHop(null);
        });
        if (!(await wait(HOP_MS))) return;
        setHop(null);
        const withTen = String(t - carry + 10);
        setSumChip({ x, y, text: withTen, lead: withTen.length > 1 ? 1 : 0, kind: 'borrow', splitting: false });
        if (!(await wait(1000))) return;
        // Then the digit is crossed out with its new value above it, the difference is written, and the borrow mark
        // goes to the corner as before
        setSumChip(prev => (prev ? { ...prev, splitting: true } : prev));
        setCrossed(prev => ({ ...prev, [col]: withTen }));
        if (!(await wait(600))) return;
        setSumChip(null);
        // Then the calculation comes down with the borrowed ten (Julian): "13 − 7 =", 6
        say(`${withTen} − ${btm} = ${digit}`);
        if (!(await showCalc(col, withTen, '−', String(btm), String(digit), calcFrom))) return;
        setExpr(null);
        say(`Write ${digit}`);
        undoExtra(async () => { fadeOut(resultRefs.current[col]?.firstElementChild); await sleep(450); });
        res[col] = { value: digit, id: `r${runId}-${col}` };
        setResult({ ...res });
        setComputedColumns(prev => new Set(prev).add(col));
        if (!(await wait(600))) return;
        setSumChip(null);
        carry = next;
        addBadge(col, carry);
        if (!(await wait(900))) return;
      } else {
        say(`Write ${digit}${next && !subtract ? ', carry 1' : ''}`);
        undoExtra(async () => { fadeOut(resultRefs.current[col]?.firstElementChild); await sleep(450); });
        res[col] = { value: digit, id: `r${runId}-${col}` };
        setResult({ ...res });
        setComputedColumns(prev => new Set(prev).add(col));
        if (!(await wait(1000))) return;

        carry = next;
        if (carry) {
          addBadge(col, carry);
          if (!(await wait(1000))) return;
        }
      }
    }
    setCurrentColumn(-1);
    setOpMark(null);

    const lastCol = carry ? len : len - 1;
    if (carry) {
      say('The last carry moves left, drops below the line and becomes the first digit of the result.');
      const startEl = carryRefs.current[len - 1];
      const endEl = resultRefs.current[len];
      if (startEl && endEl) {
        const s = startEl.getBoundingClientRect();
        const e = endEl.getBoundingClientRect();
        const kp = (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16) / 16;
        const startX = s.left + (1 + CARRY_CHIP / 2) * kp, startY = s.bottom + (9 - CARRY_CHIP / 2) * kp;
        const endX = e.left + e.width / 2, endY = e.top + e.height / 2;
        // When the carry crosses the dividing line: the first 40% of the time is the move to the left,
        // the rest is the (linear) drop, so we can work out exactly when it reaches the line.
        const lineY = lineRef.current ? lineRef.current.getBoundingClientRect().bottom : (startY + endY) / 2;
        const drop = endY - startY;
        const crossing = 0.4 + 0.6 * Math.min(1, Math.max(0, drop > 0 ? (lineY - startY) / drop : 1));
        setBadges(prev => prev.filter(x => !(x.col === len - 1 && x.side === 'left')));
        setFlight({ startX, startY, endX, endY, value: carry });
        if (!(await wait(Math.round(FLIGHT_MS * crossing)))) return;
      }
      res[len] = { value: carry, id: `r${runId}-${len}` };
      allZero = false;
      setResult({ ...res });
      setFlight(null);
      if (!(await wait(800))) return;
    }
    fadeAllBadges();

    // Leading zeros disappear (the units digit always stays)
    const fading = new Set<number>();
    for (let c = lastCol; c > dec; c--) {
      if (res[c].value === 0) fading.add(c); else break;
    }
    if (fading.size > 0) {
      say('Leading zeros are removed.');
      setFadingCols(fading);
      if (!(await wait(1000))) return;
      fading.forEach(c => { delete res[c]; });
      setResult({ ...res });
      setFadingCols(new Set());
    }

    setResultSign(allZero ? 1 : finalSign);
    const resultDigits = Object.keys(res).map(Number).sort((x, y) => y - x).map(c => res[c].value).join('');
    const resultText = formatNumber(resultDigits, dec, allZero ? 1 : finalSign);

    // If the board was rewritten, it goes back to the problem as entered, so it's clear where we started:
    // a pause on the worked form, then the brackets and the pink minus go, the rows slide back if they were
    // swapped, and the signs return. The result stays where it is.
    const worked = shown as RewrittenView | null;
    if (worked) {
      const plain = formatNumber(resultDigits, dec, 1);
      say(`So ${fmt(worked.top)} ${worked.op === 'addition' ? '+' : '−'} ${fmt(worked.bottom)} = ${plain}${outerMinus && !allZero ? `, and with the minus in front the result is ${resultText}` : ''}.`);
      if (!(await wait(2000))) return;
      if (rowsSwapped) {
        if (!(await swapRows(null))) return;
      } else {
        putView(null);
        if (!(await wait(600))) return;
      }
      say(`So ${original} = ${resultText}.`);
      if (!(await wait(1200))) return;
    }
    say(doneMessage(resultText));
    onDone();

  })();
  return () => { alive = false; };
  // Runs once per start: the numbers can't change while it runs
  // eslint-disable-next-line react-hooks/exhaustive-deps
}
