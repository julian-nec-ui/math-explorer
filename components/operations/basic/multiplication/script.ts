import type { Dispatch, RefObject, SetStateAction } from 'react';
import { paced, pausableTimeout, HOP_MS, doneMessage, formatNumber, CARRY_CHIP } from '../../../math/shared';
import type { NumberData } from '../../../math/shared';
import { type Cell, type Chip } from './model';

// What the explanation works with: the board's props, state setters, refs and measurements
export interface MultiplicationScript {
  run: boolean;
  layout: RefObject<{ x: (col: number) => number; yP: (i: number) => number; ySum: number; cell: number; chipX: (col: number, side: "left" | "right") => number; chipY: { top: (row: number) => number; }; yLine2: number; }>;
  setChips: Dispatch<SetStateAction<Chip[]>>;
  setPop: Dispatch<SetStateAction<{ x: number; y: number; text: string; lead: number; splitting: boolean; extra?: string; key?: string; } | null>>;
  setHop: Dispatch<SetStateAction<{ x0: number; y0: number; x1: number; y1: number; value: number; key: string; duration?: number; } | null>>;
  num1: NumberData;
  num2: NumberData;
  m: number;
  n: number;
  setPartials: Dispatch<SetStateAction<Record<number, Cell>[]>>;
  onStatus: (text: string) => void;
  multi: boolean;
  setHl2: Dispatch<SetStateAction<number>>;
  setDone1: Dispatch<SetStateAction<Set<number>>>;
  setHl1: Dispatch<SetStateAction<number>>;
  setMulExpr: Dispatch<SetStateAction<{ row: number; col: number; text: string; result: string; key: string; slot?: boolean; tail?: boolean; } | null>>;
  slotRef: RefObject<HTMLSpanElement | null>;
  setDone2: Dispatch<SetStateAction<Set<number>>>;
  setSumCol: Dispatch<SetStateAction<number>>;
  setColAdd: Dispatch<SetStateAction<{ col: number; top: number; bottom: number; plus: number[]; label: string | null; } | null>>;
  setZeroFlash: Dispatch<SetStateAction<{ col: number; rows: number[]; key: string; } | null>>;
  setSum: Dispatch<SetStateAction<Record<number, Cell>>>;
  setFading: Dispatch<SetStateAction<Set<number>>>;
  setResultDec: Dispatch<SetStateAction<number>>;
  setResultSign: Dispatch<SetStateAction<1 | -1 | null>>;
  onDone: () => void;
}

// The explanation, started when `run` turns true
export function runMultiplication({ run, layout, setChips, setPop, setHop, num1, num2, m, n, setPartials, onStatus, multi, setHl2, setDone1, setHl1, setMulExpr, slotRef, setDone2, setSumCol, setColAdd, setZeroFlash, setSum, setFading, setResultDec, setResultSign, onDone }: MultiplicationScript) {
  if (!run) return;
  let alive = true;
  const wait = (ms: number) => new Promise<boolean>(resolve => pausableTimeout(() => resolve(alive), paced(ms)));
  const lay = () => layout.current;
  let seq = 0;

  const dropFaded = () => window.setTimeout(() => { if (alive) setChips(prev => prev.filter(c => !c.fading)); }, 900);
  // New carry in the top-left corner; the used one (top-right) fades out
  const addChip = (area: 'top' | 'sum', col: number, value: number, row = 0) => {
    const L = lay();
    const id = `c${seq++}`;
    setChips(prev => [
      ...prev.map(c => (c.area === area && c.side === 'right' ? { ...c, fading: true } : c)),
      { id, area, col, side: 'left', x: L.chipX(col, 'left'), y: L.chipY.top(row), value, kind: 'carry', fading: false },
    ]);
    dropFaded();
  };
  // The carry from the previous column slides into the top-right corner of the current column
  // (`row`: when adding, the chip also moves up or down to the top row of the new column)
  const moveIncoming = (area: 'top' | 'sum', col: number, row?: number) => {
    const L = lay();
    setChips(prev => prev.map(c => {
      if (c.fading || c.area !== area) return c;
      if (c.side === 'right') return { ...c, fading: true };
      return { ...c, col, side: 'right', x: L.chipX(col, 'right'), ...(row !== undefined ? { y: L.chipY.top(row) } : {}) };
    }));
    dropFaded();
  };
  const fadeArea = (area: 'top' | 'sum') => {
    setChips(prev => prev.map(c => (c.area === area ? { ...c, fading: true } : c)));
    dropFaded();
  };
  // The whole number (e.g. 56) where the digit goes, then: the units are written (`write`) and the tens jump to
  // the carry corner, where they become the usual chip
  // `shown`: the number is already on the board (multiplication with a carry), go straight to the split
  const showAndHop = async (cx: number, cy: number, total: number, carry: number, chipX: number, chipY: number, write: () => void, shown = false) => {
    const text = String(total);
    const lead = text.length - 1;
    if (!shown) {
      setPop({ x: cx, y: cy, text, lead, splitting: false });
      if (!(await wait(900))) return false;
    }
    setPop(prev => (prev ? { ...prev, splitting: true } : prev));
    write();
    setHop({ x0: cx - 0.3 * lay().cell, y0: cy, x1: chipX + CARRY_CHIP / 2, y1: chipY + CARRY_CHIP / 2, value: carry, key: `h${seq++}` });
    if (!(await wait(HOP_MS))) return false;
    setPop(null);
    setHop(null);
    return true;
  };

  (async () => {

    // React's strict mode (dev) mounts, cleans up and mounts again: let the throwaway run end here,

    // before it announces its first step (otherwise that step shows twice)

    await Promise.resolve();

    if (!alive) return;
    const A = num1.digits;
    const B = num2.digits;
    const a = (col: number) => A[m - 1 - col];
    const b = (col: number) => B[n - 1 - col];
    const parts: Record<number, Cell>[] = [];
    const pushParts = () => setPartials(parts.map(r => ({ ...r })));

    onStatus(multi ? 'We multiply N1 by each digit of N2, from right to left, then add the results.' : `We multiply each digit of N1 by ${b(0)}, from right to left.`);
    // Start: 30% longer (1600 → 2080 ms, and the first row 1000 → 1300 ms)
    if (!(await wait(2080))) return;

    for (let i = 0; i < n; i++) {
      const d = b(i);
      const row: Record<number, Cell> = {};
      for (let g = 0; g < i; g++) row[g] = { value: 0, id: `p${i}-${g}`, ghost: true };
      parts.push(row);
      pushParts();
      setHl2(i);
      setDone1(new Set());
      onStatus(i === 0
        ? `Multiply N1 by ${d}.`
        : `Multiply N1 by ${d}. This row starts ${i} place${i > 1 ? 's' : ''} to the left, so the empty place${i > 1 ? 's get' : ' gets'} a 0.`);
      if (!(await wait(i ? 1800 : 1300))) return;

      let carry = 0;
      for (let j = 0; j < m; j++) {
        // A 0 in either digit (Julian): the same steps, at half the time (the carry's jump too)
        const zero = a(j) === 0 || d === 0;
        const quick = (ms: number) => wait(zero ? ms / 2 : ms);
        setHl1(j);
        moveIncoming('top', i + j);
        if (!(await quick(1000))) return;
        const pr = a(j) * d;
        const p = pr + carry;
        const digit = p % 10;
        const next = Math.floor(p / 10);
        onStatus(`${a(j)} × ${d}${carry ? ` + ${carry}` : ''} = ${p} → write ${digit}${next ? `, carry ${next}` : ''}`);
        const writeDigit = () => { row[i + j] = { value: digit, id: `p${i}-${i + j}` }; pushParts(); };
        // The product on the board where its result is written (N1's digit × N2's digit: the one that stays put on
        // the right); from there it goes on as before
        setMulExpr({ row: i, col: i + j, text: `${a(j)} × ${d} =`, result: String(pr), key: `mx${seq++}` });
        if (!(await quick(1300))) return;
        if (carry) {
          // With a carry (Julian): on the same line, the product plus the carry — "42 +", and the green carry chip itself
          // moves from its corner into the line; then "= 45" with the total in the cell; the chip goes (used up), and
          // the total is written and split as before (units stay, tens jump to the corner as the new carry)
          const mk = `mx${seq++}`;
          setMulExpr({ row: i, col: i + j, text: `${pr} +`, result: '', key: mk, slot: true });
          await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
          const L = lay();
          const slot = slotRef.current, label = slot?.parentElement;
          if (slot && label) {
            // The slot's centre in board px, from layout sizes (not from the screen: the line is still popping in, scaled).
            // The line ends 6px before the result's cell (it is drawn right-aligned there) and is centred on the row
            const k = (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16) / 16;
            const sx = L.x(i + j) - 6 - label.offsetWidth / k + (slot.offsetLeft + slot.offsetWidth / 2) / k;
            const sy = L.yP(i) + L.cell / 2;
            setChips(prev => prev.map(c => (c.area === 'top' && c.side === 'right' && !c.fading
              ? { ...c, area: 'free', side: 'left', x: sx - CARRY_CHIP / 2, y: sy - CARRY_CHIP / 2 } : c)));
          }
          if (!(await quick(900))) return;
          setMulExpr({ row: i, col: i + j, text: `${pr} +`, result: String(p), key: mk, slot: true, tail: true });
          if (!(await quick(1300))) return;
          setChips(prev => prev.map(c => (c.area === 'free' && !c.fading ? { ...c, fading: true } : c)));
          dropFaded();
        }
        setMulExpr(null);
        if (carry) {
          const L = lay();
          const cx = L.x(i + j) + L.cell / 2, cy = L.yP(i) + L.cell / 2;
          const total = String(p);
          setPop({ x: cx, y: cy, text: total, lead: next ? total.length - 1 : 0, splitting: false, key: `pt${seq++}` });
          if (!(await quick(800))) return;
          if (next) {
            if (!(await showAndHop(cx, cy, p, next, L.chipX(i + j, 'left'), L.chipY.top(i), writeDigit, true))) return;
            setDone1(prev => new Set(prev).add(j));
            carry = next;
            addChip('top', i + j, carry, i);
            if (!(await quick(600))) return;
          } else {
            setPop(prev => (prev ? { ...prev, splitting: true } : prev));
            writeDigit();
            if (!(await quick(500))) return;
            setPop(null);
            setDone1(prev => new Set(prev).add(j));
            carry = 0;
            if (!(await quick(400))) return;
          }
        } else if (next) {
          const L = lay();
          if (!(await showAndHop(L.x(i + j) + L.cell / 2, L.yP(i) + L.cell / 2, p, next, L.chipX(i + j, 'left'), L.chipY.top(i), writeDigit))) return;
          setDone1(prev => new Set(prev).add(j));
          carry = next;
          addChip('top', i + j, carry, i);
          if (!(await quick(600))) return;
        } else {
          writeDigit();
          if (!(await quick(900))) return;
          setDone1(prev => new Set(prev).add(j));
          carry = next;
        }
      }
      setHl1(-1);

      // The row's last carry: slides left, then drops down and becomes the first digit of the partial product
      if (carry) {
        const L = lay();
        const target = i + m;
        onStatus(`The last carry, ${carry}, is written in front.`);
        setChips(prev => prev.map(c => {
          if (c.area === 'top' && c.side === 'right') return { ...c, fading: true };
          if (c.area === 'top' && c.side === 'left' && !c.fading) return { ...c, area: 'free', x: L.x(target) + (L.cell - CARRY_CHIP) / 2 };
          return c;
        }));
        dropFaded();
        if (!(await wait(650))) return;
        setChips(prev => prev.map(c => (c.area === 'free' ? { ...c, y: L.yP(i) + (L.cell - CARRY_CHIP) / 2 } : c)));
        if (!(await wait(650))) return;
        setChips(prev => prev.filter(c => c.area !== 'free'));
        row[target] = { value: carry, id: `p${i}-${target}` };
        pushParts();
        if (!(await wait(700))) return;
      }
      fadeArea('top');
      setDone2(prev => new Set(prev).add(i));
      setHl2(-1);
      if (!(await wait(700))) return;
    }

    // Adding the partial products (only when N2 has more than one digit)
    let final: Record<number, Cell>;
    if (!multi) {
      final = parts[0];
    } else {
      onStatus('Now we add the partial products, column by column.');
      if (!(await wait(1500))) return;
      const maxCol = Math.max(...parts.flatMap(r => Object.keys(r).map(Number)));
      const s: Record<number, Cell> = {};
      let carry = 0;
      // While adding, a carry sits at the height of the topmost row that has a digit in its column (Julian),
      // in that digit's corner, like while multiplying; past the last digits it stays on the bottom row
      const topRow = (col: number) => { const i = parts.findIndex(r => r[col]); return i < 0 ? n - 1 : i; };
      for (let col = 0; col <= maxCol || carry > 0; col++) {
        setSumCol(col);
        moveIncoming('sum', col, topRow(col));
        if (!(await wait(1000))) return;
        const terms = parts.filter(r => r[col]).map(r => r[col].value);
        const total = terms.reduce((acc, v) => acc + v, 0) + carry;
        const digit = total % 10;
        const next = Math.floor(total / 10);
        const expr = [...terms.map(String), ...(carry ? [String(carry)] : [])].join(' + ');
        // Step by step (Julian): the column's own digits (not the placeholder zeros) from the top, two at a time, then
        // the carry. A single digit with no carry goes straight down
        const real = parts.map((r, i) => (r[col] && !r[col].ghost ? i : -1)).filter(i => i >= 0);
        const stepwise = real.length >= 2 || (real.length === 1 && carry > 0);
        if (stepwise) {
          const v = (i: number) => parts[i][col].value;
          let acc = v(real[0]);
          const frame = { col, top: real[0], bottom: real[0], plus: [] as number[], label: null as string | null };
          const show = () => setColAdd({ ...frame, plus: [...frame.plus] });
          if (real.length >= 2) {
            // Down the column, a digit at a time; two or more 0s in a row are taken in one go (Julian: the frame goes down
            // to where the 0s end, and it is "+ 0" once), then on as before
            let first = true;
            for (let p = 1; p < real.length;) {
              let q = p;
              if (v(real[p]) === 0) while (q + 1 < real.length && v(real[q + 1]) === 0) q++;
              const group = real.slice(p, q + 1);
              const zeros = group.length > 1;
              const add = group.reduce((t, r) => t + v(r), 0);
              const terms = group.map(r => String(v(r))).join(' + ');
              frame.bottom = real[q];
              frame.plus.push(...group);
              if (zeros) setZeroFlash({ col, rows: group, key: `zf${seq++}` });
              if (first) {
                show();
                if (!(await wait(zeros ? 1700 : 800))) return;
                onStatus(`${v(real[0])} + ${terms} = ${acc + add}`);
              } else {
                // the running sum moves under the frame and the digit (or the 0s, as one 0) is added to it
                frame.label = `${acc} + ${zeros ? 0 : v(real[p])}`;
                show();
                if (!(await wait(zeros ? 1700 : 1000))) return;
                onStatus(`${acc} + ${terms} = ${acc + add}`);
              }
              setZeroFlash(null);
              acc += add;
              frame.label = `= ${acc}`;
              show();
              if (!(await wait(1200))) return;
              first = false;
              p = q + 1;
            }
          } else {
            show();
            if (!(await wait(700))) return;
          }
          if (carry > 0) {
            // The carry, last (Julian): it comes down from its corner to the sum under the frame, and is added to it
            // there (so it is used up: no fading out later, and the new carry goes up from the column as before)
            const L = lay();
            const gap = frame.bottom < n - 1 ? L.yP(frame.bottom + 1) - L.yP(frame.bottom) - L.cell : L.yLine2 - L.yP(frame.bottom) - L.cell;
            const ly = L.yP(frame.bottom) + L.cell + gap / 2;
            setChips(prev => prev.map(c => (c.area === 'sum' && c.side === 'right' && !c.fading
              ? { ...c, x: L.x(col) + L.cell / 2 - CARRY_CHIP / 2, y: ly - CARRY_CHIP / 2 } : c)));
            if (!(await wait(750))) return;
            setChips(prev => prev.filter(c => !(c.area === 'sum' && c.side === 'right' && !c.fading)));
            frame.label = `${acc} + ${carry}`;
            show();
            if (!(await wait(1000))) return;
            onStatus(`${acc} + ${carry} (the carry) = ${acc + carry}`);
            acc += carry;
            frame.label = `= ${acc}`;
            show();
            if (!(await wait(1200))) return;
          }
          setColAdd(null);
        }
        onStatus(stepwise
          ? `The column gives ${total} → write ${digit}${next ? `, carry ${next}` : ''}`
          : `${expr} = ${total} → write ${digit}${next ? `, carry ${next}` : ''}`);
        const writeDigit = () => { s[col] = { value: digit, id: `s${col}` }; setSum({ ...s }); };
        if (next) {
          const L = lay();
          if (!(await showAndHop(L.x(col) + L.cell / 2, L.ySum + L.cell / 2, total, next, L.chipX(col, 'left'), L.chipY.top(topRow(col)), writeDigit))) return;
          carry = next;
          addChip('sum', col, carry, topRow(col));
          if (!(await wait(600))) return;
        } else {
          writeDigit();
          if (!(await wait(900))) return;
          carry = next;
        }
      }
      setSumCol(-1);
      fadeArea('sum');
      final = s;
    }

    const writeFinal = () => (multi ? setSum({ ...final }) : pushParts());

    // Decimal point: the product has as many decimal places as both factors together
    const dec = num1.decimalCount + num2.decimalCount;
    let topCol = Math.max(...Object.keys(final).map(Number));
    if (topCol < dec) {
      for (let c = topCol + 1; c <= dec; c++) final[c] = { value: 0, id: `z${c}` };
      writeFinal();
      topCol = dec;
      if (!(await wait(700))) return;
    }

    // Leading zeros disappear (the integer part keeps at least one digit)
    const fadeCols = new Set<number>();
    for (let c = topCol; c > dec; c--) {
      if (final[c].value === 0) fadeCols.add(c); else break;
    }
    if (fadeCols.size > 0) {
      onStatus('Leading zeros are removed.');
      setFading(fadeCols);
      if (!(await wait(1000))) return;
      fadeCols.forEach(c => { delete final[c]; });
      writeFinal();
      setFading(new Set());
    }

    const allZero = Object.values(final).every(c => c.value === 0);
    setResultDec(dec);
    setResultSign(allZero ? 1 : ((num1.sign * num2.sign) as 1 | -1));
    const productDigits = Object.keys(final).map(Number).sort((p, q) => q - p).map(c => final[c].value).join('');
    const productSign = (allZero ? 1 : num1.sign * num2.sign) as 1 | -1;
    onStatus(doneMessage(
      formatNumber(productDigits, dec, productSign),
      dec ? ` (the factors have ${dec} decimal place${dec > 1 ? 's' : ''} together, so the result has ${dec} too)` : '',
    ));
    onDone();
  })();

  return () => { alive = false; setPop(null); setHop(null); };
  // The board runs once, on mount; a reset remounts it (through `key`)
  // eslint-disable-next-line react-hooks/exhaustive-deps
}
