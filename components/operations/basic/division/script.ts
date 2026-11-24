import type { Dispatch, RefObject, SetStateAction } from 'react';
import { paced, pausableTimeout, HOP_MS, CARRY_CHIP, type NumberData, doneMessage, formatNumber } from '../../../math/shared';
import { type Cell, type Chip, type DivisionMethod, type DivisionResult, type Line, type Mover, type SideMul, TEN, type WorkRow, ZERO, planDivision, quotientUpTo } from './model';

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
  setHop: Dispatch<SetStateAction<{ x0: number; y0: number; x1: number; y1: number; key: string; value?: number | string; } | null>>;
  setPop: Dispatch<SetStateAction<{ x: number; y: number; text: string; lead: number; splitting: boolean; } | null>>;
  setFadingCells: Dispatch<SetStateAction<Set<string>>>;
  setUsedD: Dispatch<SetStateAction<Set<number>>>;
  setMover: Dispatch<SetStateAction<Mover | null>>;
  setFinalRow: Dispatch<SetStateAction<string | null>>;
  setQSign: Dispatch<SetStateAction<1 | -1 | null>>;
  setSide: Dispatch<SetStateAction<SideMul | null>>;
  setFrames: Dispatch<SetStateAction<Array<{ y: number; from: number; to: number }>>>;
  onDone: () => void;
}

// The explanation, started when `run` turns true
export function runDivision({ run, setChips, num1, num2, method, result, layout, setRows, onStatus, setShifted, setHl, setQuot, setLines, setHop, setPop, setFadingCells, setUsedD, setMover, setFinalRow, setQSign, setSide, setFrames, onDone }: DivisionScript) {
  if (!run) return;
  let alive = true;
  const wait = (ms: number) => new Promise<boolean>(resolve => pausableTimeout(() => resolve(alive), paced(ms)));
  let seq = 0;
  const id = (p: string) => `${p}${seq++}`;

  const dropFaded = () => window.setTimeout(() => { if (alive) setChips(prev => prev.filter(c => !c.fading)); }, 900);
  const addChip = (col: number, rowY: number, dx = 0) => {
    setChips(prev => [...prev.map(c => (c.side === 'right' ? { ...c, fading: true } : c)), { id: id('c'), col, side: 'left', rowY, value: 1, fading: false, dx }]);
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
        const prodY = yCursor + 16;

        // First, on the side under the work: where the product comes from, q × divisor, worked out digit by digit
        const dv = digitsOf(divisor);
        const side: SideMul = { id: id('s'), k, y: prodY + cellPx() + 28, prodY, divisor: dv, q, prod: pd, shown: 0, active: null, carry: 0, fly: false };
        setSide({ ...side });
        onStatus(`Where does ${prod} come from? We multiply ${divisor} × ${q} on the side.`);
        if (!(await wait(1400))) return;
        // As in addition (Julian): each column's sum pops up where its digit goes; a carry waiting in the column's corner
        // hops into it first ("+ 1"); a sum of 10 or more splits: the units stay as the digit, the tens hop to the next
        // column's corner
        const L = layout.current;
        const cellNow = cellPx();
        const yProd = side.y + 2 * cellNow + 27;
        const colOf = (len: number, j: number) => k - (len - 1 - j);
        // the centre of the carry corner over divisor digit j (j = -1: in front of the divisor)
        const corner = (j: number) => ({ x: L.x(colOf(dv.length, j)) + cellNow - 16 + CARRY_CHIP / 2, y: side.y - 12 + CARRY_CHIP / 2 });
        // (the gap for the carry in "m + [ ] =": its centre this far left of the expression's right end: "=" 20px wide
        // with 6px before it, the gap 30px wide with 6px each side)
        const SLOT_FROM_RIGHT = 20 + 6 + 6 + CARRY_CHIP / 2;
        let carry = 0;
        for (let t = dv.length - 1; t >= 0; t--) {
          const m = dv[t] * q;
          const p = m + carry;
          const digit = p % 10;
          const next = Math.floor(p / 10);
          const j = pd.length - 1 - (dv.length - 1 - t); // the product digit this column writes
          const at2 = { x: L.x(colOf(pd.length, j)) + cellNow / 2, y: yProd + cellNow / 2 };
          side.active = t;
          // the calculation on the product row, as in addition: "q × d =", the result in the digit's cell
          const exprAt = { right: L.x(colOf(pd.length, j)) - 6, y: at2.y, cx: at2.x };
          side.expr = { key: id('e'), ...exprAt, parts: [String(q), '×', String(dv[t])], slot: false, eq: true, result: String(m) };
          setSide({ ...side });
          onStatus(`${q} × ${dv[t]} = ${m}` + (carry ? `, plus the carry ${carry}` : ''));
          if (!(await wait(1300))) return;
          if (carry) {
            // "m + [ ] =": the carry chip flies from its corner into the gap, then "= p"
            const key = id('e');
            side.expr = { key, ...exprAt, parts: [String(m), '+'], slot: true, eq: false, result: null };
            const from = corner(t);
            side.carry = 0;
            side.chip = { ...from, value: carry };
            setSide({ ...side });
            if (!(await wait(60))) return;
            side.chip = { x: exprAt.right - SLOT_FROM_RIGHT, y: exprAt.y, value: carry };
            setSide({ ...side });
            if (!(await wait(900))) return;
            side.expr = { key, ...exprAt, parts: [String(m), '+'], slot: true, eq: true, result: String(p) };
            setSide({ ...side });
            onStatus(`${m} + ${carry} = ${p}`);
            if (!(await wait(1300))) return;
            side.chip = null;
          }
          side.expr = null;
          if (next) side.pop = { ...at2, text: String(p), lead: String(next).length, splitting: false };
          setSide({ ...side });
          if (next && !(await wait(900))) return;
          if (next) {
            // it splits: the units become the digit, the tens hop to the next column's corner
            onStatus(`${p}: write ${digit}, carry ${next}.`);
            side.pop = { ...side.pop!, splitting: true };
            side.shown += 1;
            const to = corner(t - 1);
            side.hop = { x0: at2.x - 0.3 * cellNow, y0: at2.y, x1: to.x, y1: to.y, value: next, key: id('sh') };
            setSide({ ...side });
            if (!(await wait(HOP_MS))) return;
            side.hop = null;
            side.pop = null;
            side.carry = next;
            side.carryAt = t - 1; // (over the next digit to the left; -1: in front of the divisor)
            setSide({ ...side });
            if (!(await wait(700))) return;
          } else {
            onStatus(`Write ${digit}.`);
            side.pop = null;
            side.shown += 1;
            setSide({ ...side });
            if (!(await wait(800))) return;
          }
          carry = next;
        }
        if (side.shown < pd.length) {
          // the last carry, waiting in front of the divisor, comes down in front of the product
          const from = corner(-1);
          const at2 = { x: L.x(colOf(pd.length, 0)) + cellNow / 2, y: yProd + cellNow / 2 };
          side.carry = 0;
          side.hop = { x0: from.x, y0: from.y, x1: at2.x, y1: at2.y, value: carry, key: id('sh') };
          setSide({ ...side });
          onStatus(`The carry ${carry} goes in front: ${q} × ${divisor} = ${prod}.`);
          if (!(await wait(HOP_MS))) return;
          side.hop = null;
          side.shown = pd.length;
          setSide({ ...side });
          if (!(await wait(900))) return;
        }
        side.active = null;
        side.carry = 0;
        setSide({ ...side });
        onStatus(`${q} × ${divisor} = ${prod}. Now it goes into its place, under ${cur}.`);
        if (!(await wait(1100))) return;
        // The product rises into its place
        side.fly = true;
        setSide({ ...side });
        if (!(await wait(850))) return;
        setSide(null);

        const product: WorkRow = { id: id('r'), kind: 'product', y: prodY, cells: {}, minusAt: pStart };
        pd.forEach((v: number, t: number) => { product.cells[pStart + t] = { value: v, id: id('p') }; });
        rowsLocal.push(product);
        pushRows();
        yCursor = product.y + cellPx();
        // The two numbers of the subtraction, each in a red frame (as the column being added in multiplication)
        setFrames([{ y: minRowY, from: minStart, to: k }, { y: product.y, from: pStart, to: k }]);
        onStatus(`${prod} is under ${cur}: now we subtract ${cur} − ${prod}.`);
        if (!(await wait(1100))) return;
        linesLocal.push({ id: id('l'), y: yCursor + 8, from: Math.min(minStart, pStart), to: k });
        setLines([...linesLocal]);
        yCursor += 8 + 3;
        // where the difference will go, under the line
        const mainRemY = yCursor + 8;
        yCursor = mainRemY + cellPx();

        // The subtraction is worked out on the side (Julian): copies of both numbers glide down and to the left, the
        // difference is found there, digit by digit with borrows, and then glides up into its place
        const cl0 = cellPx();
        const X0 = layout.current.x;
        const leftCol = Math.min(minStart, pStart);
        const DX = -Math.max(0, Math.min(2.5 * cl0, X0(leftCol) - 90));
        const SY = mainRemY + cl0 + 40;
        const curDigits = digitsOf(cur);
        const curAt = (c: number) => curDigits[c - (k - curDigits.length + 1)] ?? 0;
        const prodAt = (c: number) => product.cells[c]?.value ?? 0;
        const sTop: WorkRow = { id: id('r'), kind: 'rem', y: minRowY, cells: {}, dx: 0, move: true };
        for (let c = minStart; c <= k; c++) sTop.cells[c] = { value: curAt(c), id: id('d') };
        const sProd: WorkRow = { id: id('r'), kind: 'product', y: product.y, cells: {}, minusAt: pStart, dx: 0, move: true };
        for (let c = pStart; c <= k; c++) sProd.cells[c] = { value: prodAt(c), id: id('p') };
        rowsLocal.push(sTop, sProd);
        pushRows();
        onStatus(`We take ${cur} and ${prod} aside and subtract them there.`);
        if (!(await wait(80))) return;
        sTop.y = SY; sTop.dx = DX;
        sProd.y = SY + cl0 + 16; sProd.dx = DX;
        pushRows();
        if (!(await wait(900))) return;
        const sLine = { id: id('l'), y: sProd.y + cl0 + 8, from: leftCol, to: k, dx: DX };
        linesLocal.push(sLine);
        setLines([...linesLocal]);
        const remRow: WorkRow = { id: id('r'), kind: 'rem', y: sLine.y + 3 + 8, cells: {}, dx: DX };
        rowsLocal.push(remRow);
        const topY = sTop.y;
        let borrow = 0;
        for (let c = k; c >= minStart; c--) {
          setHl(new Set([`${sTop.id}:${c}`, `${sProd.id}:${c}`]));
          moveIncoming(c);
          if (!(await wait(1000))) return;
          const md = curAt(c);
          const pdd = prodAt(c);
          const raw = md - pdd - borrow;
          const next = raw < 0 ? 1 : 0;
          const digit = raw < 0 ? raw + 10 : raw;
          const left = borrow ? `${md} − 1` : `${md}`;
          const { x: X, cell: cl } = layout.current;
          // This digit lent 1 to the column on the right: the −1 drops from the borrow mark in its top-right corner
          // onto it, and it is crossed out with its new value above it (9 → 8). A 0 has nothing to give yet: it
          // borrows first (below), and becomes 9
          if (borrow) {
            setChips(prev => prev.map(ch => (ch.side === 'right' && !ch.fading ? { ...ch, fading: true } : ch)));
            dropFaded();
            const rx = X(c) + cl - 16 + DX + 0.6 * CARRY_CHIP, ry = topY - 12 + 0.6 * CARRY_CHIP;
            setHop({ x0: rx, y0: ry, x1: X(c) + DX + cl / 2, y1: topY + cl / 2, key: id('h'), value: '−1' });
            if (!(await wait(HOP_MS))) return;
            setHop(null);
            if (md > 0) {
              sTop.crossed = { ...sTop.crossed, [c]: String(md - 1) };
              pushRows();
              onStatus(`${md} lent 1 to the column on the right, so it is now ${md - 1}.`);
              if (!(await wait(1000))) return;
            }
          }
          onStatus(next ? `${left} is less than ${pdd} → borrow 10: ${md + 10 - borrow} − ${pdd} = ${digit}` : `${left} − ${pdd} = ${digit}`);
          if (next) {
            // The ten jumps from the digit on the left onto this one, which shows for a moment with the ten added
            // (just above the digit, so the digit itself stays readable); then the digit is crossed out with it above
            const cx = X(c) + DX + cl / 2, cy = topY - 16;
            setHop({ x0: X(c - 1) + DX + cl / 2, y0: topY + cl / 2, x1: cx, y1: cy, key: id('h') });
            if (!(await wait(HOP_MS))) return;
            setHop(null);
            const withTen = String(md - borrow + 10);
            setPop({ x: cx, y: cy, text: withTen, lead: withTen.length > 1 ? 1 : 0, splitting: false });
            if (!(await wait(1000))) return;
            setPop(prev => (prev ? { ...prev, splitting: true } : prev));
            sTop.crossed = { ...sTop.crossed, [c]: withTen };
            pushRows();
            if (!(await wait(600))) return;
            setPop(null);
          }
          remRow.cells[c] = { value: digit, id: id('d') };
          pushRows();
          if (!(await wait(next ? 700 : 900))) return;
          borrow = next;
          if (borrow) {
            // As the carry in addition: the borrow goes to the pair that made it, from its result digit up into this
            // column's top-left corner; at the next column it slides on into that column's corner, where it is used
            onStatus(`We borrowed 1 from the next digit on the left: we mark it.`);
            setHop({ x0: X(c) + DX + cl / 2, y0: remRow.y + cl / 2, x1: X(c) - 4 + DX + CARRY_CHIP / 2, y1: topY - 12 + CARRY_CHIP / 2, key: id('h'), value: 1 });
            if (!(await wait(HOP_MS))) return;
            setHop(null);
            addChip(c, topY, DX);
            if (!(await wait(700))) return;
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

        // The difference glides up into its place under the line; the copies aside fade away, and the frames go
        onStatus(`${cur} − ${prod} = ${rem}. It goes into its place.`);
        sTop.fading = true;
        sProd.fading = true;
        remRow.move = true;
        remRow.y = mainRemY;
        remRow.dx = 0;
        linesLocal.splice(linesLocal.indexOf(sLine), 1);
        setLines([...linesLocal]);
        pushRows();
        if (!(await wait(900))) return;
        rowsLocal.splice(rowsLocal.indexOf(sTop), 1);
        rowsLocal.splice(rowsLocal.indexOf(sProd), 1);
        remRow.move = false;
        pushRows();
        setFrames([]);
        if (!(await wait(400))) return;
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

  return () => { alive = false; setPop(null); setHop(null); setSide(null); setFrames([]); };
  // The board runs once, on mount; a reset remounts it (through `key`)
  // eslint-disable-next-line react-hooks/exhaustive-deps
}
