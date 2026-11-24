import type { Dispatch, RefObject, SetStateAction } from 'react';
import { paced, pausableTimeout, HOP_MS, type NumberData, doneMessage, formatNumber } from '../../../math/shared';
import { type Cell, type Chip, type DivisionMethod, type DivisionResult, type Line, type Mover, TEN, type WorkRow, ZERO, planDivision, quotientUpTo } from './model';

// What the explanation works with: the board's props, state setters, refs and measurements
export interface DivisionScript {
  run: boolean;
  setChips: Dispatch<SetStateAction<Chip[]>>;
  num1: NumberData;
  num2: NumberData;
  method: DivisionMethod;
  result: DivisionResult;
  layout: RefObject<{ cell: number; yD: number; yWork: number; x: (k: number) => number; }>;
  setRows: Dispatch<SetStateAction<WorkRow[]>>;
  onStatus: (text: string) => void;
  setShifted: Dispatch<SetStateAction<boolean>>;
  setHl: Dispatch<SetStateAction<Set<string>>>;
  setQuot: Dispatch<SetStateAction<Cell[]>>;
  setLines: Dispatch<SetStateAction<Line[]>>;
  setHop: Dispatch<SetStateAction<{ x0: number; y0: number; x1: number; y1: number; key: string; } | null>>;
  setPop: Dispatch<SetStateAction<{ x: number; y: number; text: string; lead: number; splitting: boolean; } | null>>;
  setFadingCells: Dispatch<SetStateAction<Set<string>>>;
  setUsedD: Dispatch<SetStateAction<Set<number>>>;
  setMover: Dispatch<SetStateAction<Mover | null>>;
  setFinalRow: Dispatch<SetStateAction<string | null>>;
  setQSign: Dispatch<SetStateAction<1 | -1 | null>>;
  onDone: () => void;
}

// The explanation, started when `run` turns true
export function runDivision({ run, setChips, num1, num2, method, result, layout, setRows, onStatus, setShifted, setHl, setQuot, setLines, setHop, setPop, setFadingCells, setUsedD, setMover, setFinalRow, setQSign, onDone }: DivisionScript) {
  if (!run) return;
  let alive = true;
  const wait = (ms: number) => new Promise<boolean>(resolve => pausableTimeout(() => resolve(alive), paced(ms)));
  let seq = 0;
  const id = (p: string) => `${p}${seq++}`;

  const dropFaded = () => window.setTimeout(() => { if (alive) setChips(prev => prev.filter(c => !c.fading)); }, 900);
  const addChip = (col: number, rowY: number) => {
    setChips(prev => [...prev.map(c => (c.side === 'right' ? { ...c, fading: true } : c)), { id: id('c'), col, side: 'left', rowY, value: 1, fading: false }]);
    dropFaded();
  };
  // The borrow taken from the digit on the left slides into that digit's top-right corner
  const moveIncoming = (col: number) => {
    setChips(prev => prev.map(c => {
      if (c.fading) return c;
      if (c.side === 'right') return { ...c, fading: true };
      return { ...c, col, side: 'right' };
    }));
    dropFaded();
  };
  const fadeAll = () => { setChips(prev => prev.map(c => ({ ...c, fading: true }))); dropFaded(); };

  (async () => {

    // React's strict mode (dev) mounts, cleans up and mounts again: let the throwaway run end here,

    // before it announces its first step (otherwise that step shows twice)

    await Promise.resolve();

    if (!alive) return;
    // The plan with the decimal points moved (the board shows the numbers as entered until the first step)
    const plan = planDivision(num1, num2, method, result);
    const D = plan.Dt;
    const cellPx = () => layout.current.cell;
    const divisor = plan.divisor;
    const at = (k: number) => (k < D.length ? D[k] : 0);
    const rowsLocal: WorkRow[] = [];
    const linesLocal: Line[] = [];
    const quotLocal: Cell[] = [];
    const used = new Set<number>();
    const pushRows = () => setRows(rowsLocal.map(r => ({ ...r, cells: { ...r.cells } })));
    const digitsOf = (v: bigint) => String(v).split('').map(Number);
    const places = (k: number) => `${k} decimal place${k === 1 ? '' : 's'}`;
    const fmt = (x: NumberData) => {
      const i = x.digits.length - x.decimalCount;
      return x.digits.slice(0, i).join('') + (x.decimalCount ? '.' + x.digits.slice(i).join('') : '');
    };
    const dividendText = plan.dt ? `${D.slice(0, D.length - plan.dt).join('')}.${D.slice(D.length - plan.dt).join('')}` : D.join('');

    if (plan.shift > 0) {
      const s = plan.shift;
      onStatus(method === 'equalize'
        ? `${fmt(num1)} has ${places(num1.decimalCount)} and ${fmt(num2)} has ${places(num2.decimalCount)}. We give both the same number of decimal places, ${s}, and move the decimal point ${s} place${s > 1 ? 's' : ''} to the right in both numbers (zeros fill the empty places). Both become whole numbers and the quotient stays the same: ${dividendText} ÷ ${divisor}.`
        : `The divisor has ${places(s)}, so we move the decimal point ${s} place${s > 1 ? 's' : ''} to the right in both numbers. Now the divisor is a whole number: ${dividendText} ÷ ${divisor}.`);
      setShifted(true);
      if (!(await wait(3200))) return;
    } else {
      setShifted(true);
    }
    onStatus(`We divide by ${divisor}, taking the digits of N1 from left to right.`);
    // Start: 30% longer (1600 → 2080 ms, and the first step the same)
    if (!(await wait(2080))) return;

    // First number: take digits until the divisor fits into it
    let k = plan.k0;
    let cur = ZERO;
    for (let c = 0; c <= k; c++) cur = cur * TEN + BigInt(at(c));
    let minRow = 'D';
    let minRowY = layout.current.yD;
    let minStart = 0;
    const takenCols = Array.from({ length: k + 1 }, (_, i) => i);
    setHl(new Set(takenCols.map(c => `D:${c}`)));
    onStatus(k === 0 ? `We start with ${cur}.` : `${cur / TEN} is smaller than ${divisor}, so we take one more digit: ${cur}.`);
    if (!(await wait(k === 0 ? 2080 : 1600))) return;

    let yCursor = layout.current.yWork;

    for (;;) {
      const q = Number(cur / divisor);
      const prod = BigInt(q) * divisor;
      const rem = cur - prod;
      const minCols = Array.from({ length: k - minStart + 1 }, (_, i) => minStart + i);
      setHl(new Set([...minCols.map(c => `${minRow}:${c}`), 'V']));
      onStatus(q > 0
        ? `How many times does ${divisor} fit into ${cur}? ${q} time${q > 1 ? 's' : ''}, because ${q} × ${divisor} = ${prod}.`
        : `${divisor} doesn't fit into ${cur}, so we write 0 in the quotient.`);
      if (!(await wait(1800))) return;
      // The quotient so far, with its decimal point once the division reaches the dividend's decimals
      const shown = quotientUpTo(plan, k);
      quotLocal.splice(0, quotLocal.length, ...shown.map(d => ({ value: d.value, col: d.col, id: `q${d.col}` })));
      setQuot([...quotLocal]);
      if (!(await wait(800))) return;

      let value = cur;
      if (q > 0) {
        // The product, written under the current number
        const pd = digitsOf(prod);
        const pStart = k - pd.length + 1;
        const product: WorkRow = { id: id('r'), kind: 'product', y: yCursor + 16, cells: {}, minusAt: pStart };
        pd.forEach((v: number, t: number) => { product.cells[pStart + t] = { value: v, id: id('p') }; });
        rowsLocal.push(product);
        pushRows();
        yCursor = product.y + cellPx();
        onStatus(`Write ${prod} under ${cur} and subtract.`);
        if (!(await wait(1100))) return;
        linesLocal.push({ id: id('l'), y: yCursor + 8, from: Math.min(minStart, pStart), to: k });
        setLines([...linesLocal]);
        yCursor += 8 + 3;

        // The subtraction, digit by digit from the right, with borrows
        const remRow: WorkRow = { id: id('r'), kind: 'rem', y: yCursor + 8, cells: {} };
        rowsLocal.push(remRow);
        yCursor = remRow.y + cellPx();
        const curDigits = digitsOf(cur);
        const curAt = (c: number) => curDigits[c - (k - curDigits.length + 1)] ?? 0;
        const prodAt = (c: number) => product.cells[c]?.value ?? 0;
        let borrow = 0;
        for (let c = k; c >= minStart; c--) {
          setHl(new Set([`${minRow}:${c}`, `${product.id}:${c}`]));
          moveIncoming(c);
          if (!(await wait(1000))) return;
          const md = curAt(c);
          const pdd = prodAt(c);
          const raw = md - pdd - borrow;
          const next = raw < 0 ? 1 : 0;
          const digit = raw < 0 ? raw + 10 : raw;
          const left = borrow ? `${md} − 1` : `${md}`;
          onStatus(next ? `${left} is less than ${pdd} → borrow 10: ${md + 10 - borrow} − ${pdd} = ${digit}` : `${left} − ${pdd} = ${digit}`);
          if (next) {
            // The ten jumps from the digit on the left onto this one, which shows for a moment with the ten added
            const { x: X, cell: cl } = layout.current;
            // (just above the digit, so the digit itself stays readable)
            const cx = X(c) + cl / 2, cy = minRowY - 16;
            setHop({ x0: X(c - 1) + cl / 2, y0: minRowY + cl / 2, x1: cx, y1: cy, key: id('h') });
            if (!(await wait(HOP_MS))) return;
            setHop(null);
            const withTen = String(md - borrow + 10);
            setPop({ x: cx, y: cy, text: withTen, lead: withTen.length > 1 ? 1 : 0, splitting: false });
            if (!(await wait(1000))) return;
            setPop(prev => (prev ? { ...prev, splitting: true } : prev));
          }
          remRow.cells[c] = { value: digit, id: id('d') };
          pushRows();
          if (!(await wait(next ? 600 : 900))) return;
          setPop(null);
          borrow = next;
          if (borrow) {
            addChip(c, minRowY);
            if (!(await wait(900))) return;
          }
        }
        fadeAll();
        setHl(new Set());

        // Leading zeros of the remainder disappear (at least one digit stays)
        const fadeCols: number[] = [];
        for (let c = minStart; c < k; c++) {
          if (remRow.cells[c]?.value === 0) fadeCols.push(c); else break;
        }
        if (fadeCols.length) {
          setFadingCells(new Set(fadeCols.map(c => `${remRow.id}:${c}`)));
          if (!(await wait(900))) return;
          fadeCols.forEach(c => { delete remRow.cells[c]; });
          pushRows();
          setFadingCells(new Set());
        }
        value = rem;
        minRow = remRow.id;
        minRowY = remRow.y;
        minStart = k - String(rem).length + 1;
      }

      for (let c = 0; c <= k; c++) used.add(c);
      setUsedD(new Set(used));
      if (k >= plan.endCol) { cur = value; break; }
      k++;

      // Bring the next dividend digit down next to the remainder
      const target = rowsLocal.find(r => r.id === minRow);
      if (!target) { cur = value; break; }
      const down = at(k);
      onStatus(k >= D.length
        ? 'No digits are left, so we bring down a 0 and continue after the decimal point.'
        : k === plan.intLen && plan.intLen < D.length
          ? `We reach the decimal point, so the quotient gets one too. Bring down the next digit, ${down}.`
          : `Bring down the next digit, ${down}.`);
      setHl(new Set([`D:${k}`]));
      const mv = { id: id('m'), value: down, col: k, y: layout.current.yD };
      setMover(mv);
      if (!(await wait(60))) return;
      setMover({ ...mv, y: minRowY });
      if (!(await wait(750))) return;
      if (value === ZERO) {
        // A remainder of 0 is not written in front of the brought-down digit
        const zeroCols = Object.keys(target.cells).map(Number);
        zeroCols.forEach(c => { delete target.cells[c]; });
      }
      target.cells[k] = { value: down, id: id('d') };
      pushRows();
      setMover(null);
      used.add(k);
      setUsedD(new Set(used));
      cur = value * TEN + BigInt(down);
      minStart = k - String(cur).length + 1;
      if (!(await wait(800))) return;
    }

    setHl(new Set());
    setFinalRow(minRow);
    const qDigits = plan.quotient.join('');
    const qDecimals = plan.quotient.length - plan.qDot;
    const qs = (/[1-9]/.test(qDigits) ? num1.sign * num2.sign : 1) as 1 | -1;
    setQSign(qs);
    const quotientText = formatNumber(qDigits, qDecimals, qs);
    if (plan.decimalMode) {
      // With decimals we keep dividing after the decimal point instead of giving a remainder
      onStatus(doneMessage(quotientText, cur === ZERO ? '' : ` (we stop after ${qDecimals} decimal place${qDecimals === 1 ? '' : 's'})`));
    } else {
      // As in JavaScript and C: the remainder takes the sign of the dividend
      onStatus(doneMessage(
        quotientText,
        cur === ZERO ? ' (no remainder)' : `, remainder ${formatNumber(String(cur), 0, num1.sign)}`,
      ));
    }
    onDone();
  })();

  return () => { alive = false; setPop(null); setHop(null); };
  // The board runs once, on mount; a reset remounts it (through `key`)
  // eslint-disable-next-line react-hooks/exhaustive-deps
}
