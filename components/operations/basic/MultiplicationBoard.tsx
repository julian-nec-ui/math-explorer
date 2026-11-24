"use client";

import { useEffect, useRef, useState, type ReactElement } from 'react';
import { CarryChip, OperandTag, CarryHop, Digit, SumPop, OpIcon, ResultSign, ThousandsComma, commasBefore, pickVariant, toRem, useCellSize, lowerScale, lowerStyle, CARRY_CHIP, type BoardProps } from '../../math/shared';
import { COMMA_NUDGE, COMMA_W, type Cell, type Chip, DOT_ROOM, GAP, LEFT, OP_BAR, OP_MARK } from './multiplication/model';
import { runMultiplication } from './multiplication/script';

// Long multiplication: N1 is multiplied by each digit of N2 in turn (from the right),
// each partial product is shifted one place to the left, then the partial products are added.
export default function MultiplicationBoard({ num1, num2, run, onStatus, onDone, renderSign, onCycleDigit, hoverEdit = false, availableHeight }: BoardProps): ReactElement {
  const cell = useCellSize();
  const P = cell + GAP;
  const m = num1.digits.length;
  const n = num2.digits.length;
  const C = Math.max(1, m + n); // the product has at most m + n digits
  const multi = n > 1;

  // Board coordinates (px). Columns are counted from the right: 0 = units.
  // Thousands separators add a fixed gap every 3 columns (counted from the units), like in addition.
  // With decimals the rows have different decimal points, so grouping is used only for whole numbers.
  const grouped = num1.decimalCount + num2.decimalCount === 0;
  const commaGap = COMMA_W + GAP;
  // Every place where some row has its decimal point (N1, N2, the product) gets DOT_ROOM more, in all rows, so the
  // columns stay lined up
  const dotCols = [...new Set([num1.decimalCount, num2.decimalCount, num1.decimalCount + num2.decimalCount])].filter(d => d > 0);
  const x = (col: number): number => LEFT + (C - 1 - col) * P + (grouped ? commasBefore(C - 1 - col, C) * commaGap : 0) + DOT_ROOM * dotCols.filter(b => col < b).length;
  // N1 3px lower than in the other operations (further from the buttons above) and N1–N2 40% closer than the 31px
  // there (Julian, multiplication only: it saves room for the rows below)
  const yN1 = 44 + 3;
  const yN2 = yN1 + cell + 19;
  const yLine1 = yN2 + cell + 24;
  // While a partial product row is being written, its carry sits on that row: in the top corner of the
  // digit just written, overlapping it a little, and it slides horizontally along the row from digit to digit.
  // CARRY_BAND is the extra room above each row for the part of the chip that sticks out above the digit.
  const CARRY_BAND = 12;
  const yP0 = yLine1 + 4 + 8 + CARRY_BAND + 8;
  const yP = (i: number) => yP0 + i * (cell + 8 + CARRY_BAND + 8);
  const yLine2 = yP(n - 1) + cell + 24;
  const ySum = yLine2 + 4 + 24;
  const yFinal = multi ? ySum : yP(0);
  // Right edge right after the units column (the size rule keeps the last digit ~3px from the steps window)
  const width = x(0) + cell + 1;
  const fullHeight = yFinal + cell + 12;
  // Everything under the first line (partial products, sum, carries) shrinks when the board would not fit the area's
  // height (see lowerScale); the board's box takes the height it is drawn at, so the area doesn't scroll for nothing
  const lowTop = yLine1 + 4;
  const ls = lowerScale(availableHeight, lowTop, fullHeight);
  const height = lowTop + (fullHeight - lowTop) * ls;
  // Chip tops: on partial row `row` while it is being multiplied (12px above the digit's top edge, so
  // the 20px chip overlaps its corner by 8px); while adding, on the topmost row that has a digit in the column
  // (carry chips are CARRY_CHIP = 30px: still 8px over the digit's top, sticking 22px out above it)
  const chipY = { top: (row: number) => yP(row) - (CARRY_CHIP - 8) };
  const chipX = (col: number, side: 'left' | 'right') => (side === 'left' ? x(col) + 1 : x(col) + cell - CARRY_CHIP - 1);

  // The animation reads the latest geometry through this ref; it is updated after every render
  const layout = useRef({ x, yP, ySum, cell, chipX, chipY, yLine2 });
  useEffect(() => {
    layout.current = { x, yP, ySum, cell, chipX, chipY, yLine2 };
  });

  const [hl1, setHl1] = useState(-1);
  const [hl2, setHl2] = useState(-1);
  const [done1, setDone1] = useState<Set<number>>(new Set());
  const [done2, setDone2] = useState<Set<number>>(new Set());
  const [partials, setPartials] = useState<Record<number, Cell>[]>([]);
  const [sumCol, setSumCol] = useState(-1);
  const [sum, setSum] = useState<Record<number, Cell>>({});
  const [chips, setChips] = useState<Chip[]>([]);
  // A product (or a column sum) of 10 or more is shown for a moment where its digit goes (`pop`); then the units stay
  // and the tens (the carry) jump in an arc to their corner (`hop`). Board px
  const [pop, setPop] = useState<{ x: number; y: number; text: string; lead: number; splitting: boolean; extra?: string; key?: string } | null>(null);
  const [hop, setHop] = useState<{ x0: number; y0: number; x1: number; y1: number; value: number; key: string; duration?: number } | null>(null);
  const [fading, setFading] = useState<Set<number>>(new Set());
  // The multiplication of the two highlighted digits, written on the board right where its result goes (Julian): the
  // result in the cell of row `row`, column `col`, and "a × d =" just left of it, over the row's cells still empty
  // `slot`: the carry being added — "pr + [slot] =" — the green carry chip itself moves into the slot; `tail`: the " ="
  // and the result show (the " =" is always there, hidden, so the slot doesn't move when it appears)
  const [mulExpr, setMulExpr] = useState<{ row: number; col: number; text: string; result: string; key: string; slot?: boolean; tail?: boolean } | null>(null);
  const slotRef = useRef<HTMLSpanElement>(null);
  // Adding a column step by step (Julian): a frame around the digits added so far (rows `top`..`bottom`), a + above each
  // digit that joined it (`plus`: in the gap above that row), and the running sum (`label`) in the gap under the frame.
  // Two or more 0s in a row being added in one go: they flash a darker yellow, then are the usual highlight again (Julian)
  const [zeroFlash, setZeroFlash] = useState<{ col: number; rows: number[]; key: string } | null>(null);
  const [colAdd, setColAdd] = useState<{ col: number; top: number; bottom: number; plus: number[]; label: string | null } | null>(null);
  const [resultSign, setResultSign] = useState<1 | -1 | null>(null);
  const [resultDec, setResultDec] = useState(0);

  useEffect(() => runMultiplication({ run, layout, setChips, setPop, setHop, num1, num2, m, n, setPartials, onStatus, multi, setHl2, setDone1, setHl1, setMulExpr, slotRef, setDone2, setSumCol, setColAdd, setZeroFlash, setSum, setFading, setResultDec, setResultSign, onDone }), []);

  const finalRow = multi ? sum : partials[0] ?? {};
  const finalCols = Object.keys(finalRow).map(Number).filter(c => !fading.has(c));
  const finalLead = finalCols.length ? Math.max(...finalCols) : -1;
  // Like addition (Julian): both sign buttons on one vertical line, 13px before the leftmost first digit among the
  // operands; "N1 ▶" / "N2 ▶" 8px before them; the × 50px before them, between the two rows. Everything that is drawn
  // carries data-fit, so FitBoard sizes the board by what is on it, not by the room kept for the rows to come
  const operandLead = Math.max(m, n) - 1;
  const signLeft = x(operandLead) - 45;
  const opLeft = signLeft - 50;
  // The partial products' + and the lines start at the × or, once wider rows are written, before their first digit
  const leftCol = Math.max(operandLead, ...partials.flatMap(r => Object.keys(r).map(Number)), ...Object.keys(sum).map(Number));
  const lineLeft = Math.min(opLeft, x(leftCol) - 95);

  // Thousands separators of one row: every 3 integer digits, counted from the row's own decimal point (`dec`
  // digits from the right), when the row has digits on both sides. Whole numbers get extra room for each comma
  // (`grouped`); with decimals the rows' points differ, so the comma sits in the normal gap between two digits.
  const rowCommas = (cols: number[], y: number, key: string, dec = 0) => {
    const has = new Set(cols);
    return cols
      .filter(col => col - dec > 0 && (col - dec) % 3 === 0 && has.has(col - 1))
      .map(col => (
        <ThousandsComma
          key={`${key}${col}`}
          left={grouped ? x(col) + cell + GAP - COMMA_NUDGE : x(col) + cell + GAP / 2 - 10}
          top={y + cell - 28}
        />
      ));
  };

  const dot = (y: number, decimals: number, key: string) => decimals > 0 && (
    <div key={key} className="absolute z-20 w-1.5 h-1.5 rounded-full bg-cyan-300 shadow-[0_0_4px_rgba(103,232,249,0.9)]" style={toRem({ left: x(decimals - 1) - (GAP + DOT_ROOM) / 2 - 3, top: y + cell - 9 })} />
  );

  return (
    <div className="relative mx-auto" style={toRem({ width, height })}>
      {/* The operation sign, halfway between N1 and N2 */}
      <div data-fit className="absolute -translate-y-1/2 text-cyan-500" style={toRem({ left: opLeft, top: (yN1 + yN2 + cell) / 2 })}>
        <OpIcon op="multiplication" />
      </div>

      {/* N1 */}
      {num1.digits.map((v: number, idx: number) => {
        const col = m - 1 - idx;
        return (
          <div key={`a${idx}`} className="absolute" style={toRem({ left: x(col), top: yN1 })}>
            <Digit
              digit={v}
              variant={pickVariant({ highlighted: hl1 === col, computed: done1.has(col), ghost: false })}
              isNum1
              onIncrement={() => onCycleDigit('n1', idx, 1)}
              onDecrement={() => onCycleDigit('n1', idx, -1)}
              hoverEditable={hoverEdit}
              operand
            />
          </div>
        );
      })}
      {m > 0 && <div data-fit className="absolute" style={toRem({ left: signLeft, top: yN1 + (cell - 32) / 2 })}>{renderSign('n1', num1.sign)}</div>}
      {m > 0 && <div data-fit className="absolute -translate-x-full -translate-y-1/2" style={toRem({ left: signLeft - 8, top: yN1 + cell / 2 })}><OperandTag label="N1" color="text-cyan-400" /></div>}
      {dot(yN1, num1.decimalCount, 'd1')}
      {rowCommas(num1.digits.map((_, idx) => m - 1 - idx), yN1, 'k1-', num1.decimalCount)}

      {/* N2 */}
      {num2.digits.map((v: number, idx: number) => {
        const col = n - 1 - idx;
        return (
          <div key={`b${idx}`} className="absolute" style={toRem({ left: x(col), top: yN2 })}>
            <Digit
              digit={v}
              variant={pickVariant({ highlighted: hl2 === col, computed: done2.has(col), ghost: false })}
              isNum1={false}
              onIncrement={() => onCycleDigit('n2', idx, 1)}
              onDecrement={() => onCycleDigit('n2', idx, -1)}
              hoverEditable={hoverEdit}
              operand
            />
          </div>
        );
      })}
      {n > 0 && <div data-fit className="absolute" style={toRem({ left: signLeft, top: yN2 + (cell - 32) / 2 })}>{renderSign('n2', num2.sign)}</div>}
      {n > 0 && <div data-fit className="absolute -translate-x-full -translate-y-1/2" style={toRem({ left: signLeft - 8, top: yN2 + cell / 2 })}><OperandTag label="N2" color="text-pink-400" /></div>}
      {dot(yN2, num2.decimalCount, 'd2')}
      {rowCommas(num2.digits.map((_, idx) => n - 1 - idx), yN2, 'k2-', num2.decimalCount)}

      {/* The line under the operands keeps the operands' length (Julian): wider partial rows don't stretch it while the
          explanation runs (only the + of the partial products and the second line follow them) */}
      <div className="absolute h-1 bg-zinc-700 rounded-full transition-[left,width] duration-500" style={toRem({ left: opLeft, top: yLine1, width: width - opLeft })} />

      {/* Under the first line: drawn smaller towards the units column when needed (ls, see above) */}
      <div className="absolute inset-0 pointer-events-none" style={lowerStyle(ls, width, lowTop)}>
      {/* The partial products */}
      {partials.map((row, i) => Object.entries(row).map(([k, c]) => {
        const col = Number(k);
        const isFinal = !multi;
        const variant = sumCol === col ? (c.ghost ? 'ghostHighlight' : 'highlight') : c.ghost ? 'ghost' : isFinal ? 'result' : 'computed';
        return (
          <div key={c.id} className="absolute" style={toRem({ left: x(col), top: yP(i) })}>
            <div className={isFinal && fading.has(col) ? 'animate-fade-out' : 'animate-pop-in'}>
              <Digit digit={c.value} variant={variant} />
            </div>
          </div>
        );
      }))}

      {partials.map((row, i) => rowCommas(Object.keys(row).map(Number).filter(col => !(i === 0 && !multi && fading.has(col))), yP(i), `kp${i}-`, i === 0 && !multi ? resultDec : 0))}

      {multi && (
        <>
          {rowCommas(Object.keys(sum).map(Number).filter(col => !fading.has(col)), ySum, 'ks-', resultDec)}
          <div data-fit className="absolute -translate-y-1/2 text-cyan-500 transition-[left] duration-500" style={toRem({ left: lineLeft, top: (yP(0) + yP(n - 1) + cell) / 2 })}>
            <OpIcon op="addition" />
          </div>
          <div className="absolute h-1 bg-zinc-700 rounded-full transition-[left,width] duration-500" style={toRem({ left: lineLeft, top: yLine2, width: width - lineLeft })} />
          {Object.entries(sum).map(([k, c]) => {
            const col = Number(k);
            return (
              <div key={c.id} className="absolute" style={toRem({ left: x(col), top: ySum })}>
                <div className={fading.has(col) ? 'animate-fade-out' : 'animate-pop-in'}>
                  <Digit digit={c.value} variant="result" />
                </div>
              </div>
            );
          })}
        </>
      )}

      {resultSign !== null && finalLead >= 0 && (
        <div className="absolute flex items-center" style={toRem({ left: x(Math.max(finalLead, operandLead)) - 53, top: yFinal, height: cell })}>
          <ResultSign sign={resultSign} />
        </div>
      )}
      {resultSign !== null && dot(yFinal, resultDec, 'df')}

      {/* The product of the highlighted digits, where its result goes: the result in its cell, "a × d =" left of it */}
      {mulExpr && (
        <>
          <div
            key={`${mulExpr.key}t`}
            className="absolute z-40 -translate-x-full -translate-y-1/2 whitespace-nowrap text-[22px] leading-none font-black text-[#58c7fe] animate-pop-in"
            style={toRem({ left: x(mulExpr.col) - 6, top: yP(mulExpr.row) + cell / 2 })}
          >
            {mulExpr.text}
            {mulExpr.slot && (
              <>
                <span ref={slotRef} className="inline-block align-middle mx-1.5" style={toRem({ width: CARRY_CHIP, height: CARRY_CHIP })} />
                <span className={mulExpr.tail ? 'opacity-100' : 'opacity-0'}>=</span>
              </>
            )}
          </div>
          {mulExpr.result && (
            <div
              key={`${mulExpr.key}r`}
              className="absolute z-40 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-[22px] leading-none font-black text-[#58c7fe] animate-pop-in"
              style={toRem({ left: x(mulExpr.col) + cell / 2, top: yP(mulExpr.row) + cell / 2 })}
            >
              {mulExpr.result}
            </div>
          )}
        </>
      )}

      {/* The 0s added in one go flash a darker yellow (a darkening layer over the highlighted cells, twice) */}
      {zeroFlash && zeroFlash.rows.map(r => (
        <div
          key={`${zeroFlash.key}-${r}`}
          ref={el => {
            if (el && !el.dataset.flashed) {
              el.dataset.flashed = '1';
              el.animate([{ opacity: 0 }, { opacity: 1 }, { opacity: 0.25 }, { opacity: 1 }, { opacity: 0 }], { duration: 1600, easing: 'ease-in-out', fill: 'forwards' });
            }
          }}
          className="absolute z-20 rounded-md pointer-events-none bg-[#c27c00] mix-blend-multiply opacity-0"
          style={toRem({ left: x(zeroFlash.col), top: yP(r), width: cell, height: cell })}
        />
      ))}

      {/* Adding a column step by step: the frame (#ff005c, Julian), the +s and the running sum (blue for now) */}
      {colAdd && (() => {
        const gapUnder = (r: number) => (r < n - 1 ? yP(r + 1) - yP(r) - cell : yLine2 - yP(r) - cell);
        const cx = x(colAdd.col) + cell / 2;
        return (
          <>
            <div
              key={`frame${colAdd.col}`}
              className="absolute z-30 rounded-xl border-[5px] border-[#ff005c] animate-pop-in transition-[height] duration-500 ease-in-out pointer-events-none"
              style={toRem({ left: x(colAdd.col) - 5, top: yP(colAdd.top) - 5, width: cell + 10, height: yP(colAdd.bottom) + cell - yP(colAdd.top) + 10 })}
            />
            {colAdd.plus.map(r => (
              <span key={`plus${colAdd.col}-${r}`} className="absolute z-30 block animate-pop-in" style={toRem({ left: cx - OP_MARK / 2, top: yP(r) - (yP(r) - yP(r - 1) - cell) / 2 - OP_MARK / 2, width: OP_MARK, height: OP_MARK })}>
                <span className="absolute left-0 bg-[#58c7fe]" style={toRem({ top: (OP_MARK - OP_BAR) / 2, width: OP_MARK, height: OP_BAR })} />
                <span className="absolute top-0 bg-[#58c7fe]" style={toRem({ left: (OP_MARK - OP_BAR) / 2, width: OP_BAR, height: OP_MARK })} />
              </span>
            ))}
            {colAdd.label && (
              <div
                key={`label${colAdd.col}-${colAdd.bottom}-${colAdd.label}`}
                className="absolute z-30 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap text-[20px] leading-none font-black text-[#58c7fe] animate-pop-in"
                style={toRem({ left: cx, top: yP(colAdd.bottom) + cell + gapUnder(colAdd.bottom) / 2 })}
              >
                {colAdd.label}
              </div>
            )}
          </>
        );
      })()}

      {/* The carry chips */}
      {chips.map(c => (
        <div
          key={c.id}
          className={`absolute z-40 origin-bottom-right transition-[left,top,opacity,scale] duration-650 ease-in-out ${c.fading ? 'opacity-0' : 'opacity-100'} ${c.side === 'right' && c.area !== 'free' ? 'scale-80' : 'scale-100'}`}
          style={toRem({ left: c.x, top: c.y })}
        >
          <CarryChip value={c.value} kind={c.kind} />
        </div>
      ))}
      {pop && <SumPop key={pop.key} x={pop.x} y={pop.y} text={pop.text} lead={pop.lead} splitting={pop.splitting} extra={pop.extra} />}
      {hop && <CarryHop key={hop.key} x0={hop.x0} y0={hop.y0} x1={hop.x1} y1={hop.y1} value={hop.value} duration={hop.duration} />}
      </div>
    </div>
  );
}
