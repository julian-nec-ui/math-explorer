"use client";

import { useEffect, useRef, useState, type ReactElement } from 'react';
import { CarryChip, CarryHop, OperandTag, Digit, SumPop, ResultSign, ThousandsComma, commaAfter, pickVariant, toRem, useCellSize, lowerScale, lowerStyle } from '../../math/shared';
import { COMMA_NUDGE, COMMA_W, type Cell, type Chip, DOT_ROOM, type DivisionBoardProps, GAP, type Line, type Mover, type WorkRow, planDivision } from './division/model';
import { runDivision } from './division/script';
export type { DivisionResult, DivisionMethod } from './division/model';

// Long division: N1 : N2 = quotient, with the subtractions written under the dividend.
export default function DivisionBoard({ num1, num2, run, onStatus, onDone, renderSign, onCycleDigit, hoverEdit = false, method = 'classic', result = 'remainder', availableHeight }: DivisionBoardProps): ReactElement {
  const cell = useCellSize();
  const P = cell + GAP;
  // The numbers are shown as entered until the explanation moves their decimal points
  const [shifted, setShifted] = useState(false);
  const plan = planDivision(num1, num2, shifted ? method : 'none', result);
  const D = plan.Dt;                   // dividend columns (after moving the decimal point)
  const V = plan.Vt;                   // divisor digits (a whole number once the decimal points have moved)
  const cols = plan.endCol + 1;
  // Both numbers whole: decimals only in the result (see `result`)
  const wholeInputs = num1.decimalCount === 0 && num2.decimalCount === 0;        // dividend columns, including brought-down zeros after the last digit
  const n = V.length;
  const vInt = n - plan.vDec;          // the divisor's integer digits

  // Board coordinates (px). N1, then ":" and N2 under it, then "=" and the quotient, on every screen, all lined up by
  // place value: units under units, thousands separators under each other, decimal points under each other.
  // A digit's place value p is 0 for the units, 1 for the tens, …, −1 for the tenths, …
  // The quotient's digits sit under the dividend's columns they came from (so its decimal point is under the
  // dividend's), and the subtractions below use the dividend's columns too.
  const commaGap = COMMA_W + GAP;
  const S0 = 40 + GAP + 72; // operation-sign column, then room for the number signs
  const pD = (k: number): number => plan.intLen - 1 - k; // place value of dividend column k
  const pV = (t: number): number => vInt - 1 - t;        // place value of divisor digit t
  const pTop = Math.max(pD(0), pV(0));                   // the leftmost place value on the board
  const pBottom = Math.min(pD(Math.max(0, cols - 1)), pV(Math.max(0, n - 1)));
  // Left edge of the cell for place value p; a thousands separator follows the places 3, 6, 9, …
  const xp = (p: number): number => S0 + (pTop - p) * P + (Math.floor(Math.max(pTop, 0) / 3) - Math.floor(Math.max(p, 0) / 3)) * commaGap + (p < 0 && pTop >= 0 ? DOT_ROOM : 0);
  const x = (k: number): number => xp(pD(k));
  const xDiv = (t: number): number => xp(pV(t));
  // N1 starts 44px down, the same height as N1 in addition, subtraction and multiplication
  const yD = 44;
  const yV = yD + cell + 31;
  const yQ = yV + cell + 31;
  const yWork = yQ + cell + 8;
  // Like addition (Julian): the sign buttons 13px before the leftmost digit, "N1 ▶" / "N2 ▶" 8px before them, the ":"
  // and the "=" in the operation-sign column 50px before them (data-fit: see FitBoard)
  const signPos = (y: number) => ({ left: S0 - 45, top: y + (cell - 32) / 2 });
  const opLeft = S0 - 95;
  const colonPos = { left: opLeft + 7, top: (yD + cell + yV) / 2 - 12 };
  const eqPos = { left: opLeft + 2, top: (yV + cell + yQ) / 2 - cell / 2 };
  const qSignPos = { left: S0 - 53, top: yQ };
  const boardWidth = xp(pBottom) + cell + 4;

  const [rows, setRows] = useState<WorkRow[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [quot, setQuot] = useState<Cell[]>([]);
  const [hl, setHl] = useState<Set<string>>(new Set()); // `${row}:${column}`; "D" = dividend, "V" = divisor
  const [usedD, setUsedD] = useState<Set<number>>(new Set());
  const [chips, setChips] = useState<Chip[]>([]);
  // A borrow: the ten jumps from the digit on the left onto the digit that needs it (`hop`), which then shows for a
  // moment with the ten added, e.g. 13 (`pop`). Board px
  const [pop, setPop] = useState<{ x: number; y: number; text: string; lead: number; splitting: boolean } | null>(null);
  const [hop, setHop] = useState<{ x0: number; y0: number; x1: number; y1: number; key: string } | null>(null);
  const [mover, setMover] = useState<Mover | null>(null);
  const [fadingCells, setFadingCells] = useState<Set<string>>(new Set());
  const [qSign, setQSign] = useState<1 | -1 | null>(null);
  const [finalRow, setFinalRow] = useState<string | null>(null);

  // The animation reads the latest cell size through this ref; it is updated after every render
  const layout = useRef({ cell, yD, yWork, x });
  useEffect(() => {
    layout.current = { cell, yD, yWork, x };
  });

  useEffect(() => runDivision({ run, setChips, num1, num2, method, result, layout, setRows, onStatus, setShifted, setHl, setQuot, setLines, setHop, setPop, setFadingCells, setUsedD, setMover, setFinalRow, setQSign, onDone }), []);

  const bottom = Math.max(yWork, ...rows.map(r => r.y + cell), ...lines.map(l => l.y + 3));
  const width = boardWidth;
  // The subtractions shrink when the finished board would not fit the area's height (see lowerScale). Known in advance:
  // every quotient digit other than 0 writes a product, a line and a difference (16 + cell + 11 + 8 + cell px)
  const steps = planDivision(num1, num2, method, result).qcols.filter(q => q > 0).length;
  const finalBottom = yWork + steps * (2 * cell + 35);
  const ls = lowerScale(availableHeight, yWork, finalBottom + 16);
  // The box keeps the room for the rows still to come (like multiplication), so its height is the final one from the
  // start: the rows can't push it taller during the explanation, and FitBoard can fit the height in advance
  const height = yWork + (Math.max(bottom, finalBottom) + 16 - yWork) * ls;
  // Where something drawn at board px (x, y) in the work area ends up once it is shrunk (towards the top right corner)
  const lowX = (left: number) => width - (width - left) * ls;
  const lowY = (top: number) => yWork + (top - yWork) * ls;
  const glyph = 'absolute flex items-center justify-center text-3xl font-light text-cyan-500';
  // A decimal point in the gap after the cell at `left`
  const decimalPoint = (left: number, y: number, key: string) => (
    <div key={key} className="absolute z-20 w-1.5 h-1.5 rounded-full bg-cyan-300 shadow-[0_0_4px_rgba(103,232,249,0.9)]" style={toRem({ left: left + cell + (GAP + DOT_ROOM) / 2 - 3, top: y + cell - 9 })} />
  );
  const chipLeft = (c: Chip) => (c.side === 'left' ? x(c.col) - 4 : x(c.col) + cell - 16);
  // Borrows (in the corners of the top digits), the ten that jumps and the number it makes: in the work area (`low`,
  // drawn inside the shrinking layer) or on N1 itself, when the first subtraction is done right under the dividend
  const renderBorrows = (low: boolean) => (
    <>
      {chips.filter(c => (c.rowY >= yWork) === low).map(c => (
        <div
          key={c.id}
          className={`absolute z-40 origin-bottom-right transition-[left,opacity,scale] duration-650 ease-in-out ${c.fading ? 'opacity-0' : 'opacity-100'} ${c.side === 'right' ? 'scale-80' : 'scale-100'}`}
          style={toRem({ left: chipLeft(c), top: c.rowY - 12 })}
        >
          <CarryChip value={c.value} kind="borrow" />
        </div>
      ))}
      {pop && (pop.y >= yWork) === low && <SumPop x={pop.x} y={pop.y} text={pop.text} lead={pop.lead} kind="borrow" splitting={pop.splitting} />}
      {hop && (hop.y0 >= yWork) === low && <CarryHop key={hop.key} x0={hop.x0} y0={hop.y0} x1={hop.x1} y1={hop.y1} value={10} kind="borrow" />}
    </>
  );

  return (
    <div className="relative mx-auto" style={toRem({ width, height })}>
      {/* N1 (the dividend), after moving the decimal point. Zeros added for the shift, and the zeros brought down
          after its last digit, are drawn as ghost cells; only N1's own digits can be turned */}
      {Array.from({ length: cols }, (_, k) => {
        const own = k < num1.digits.length;
        // Whole numbers divided with decimals (Julian): N1 keeps no decimal point and no row of zeros after it; a zero
        // shows there only for the moment it is brought down
        if (!own && wholeInputs && !hl.has(`D:${k}`)) return null;
        return (
          <div key={`a${k}`} className="absolute" style={toRem({ left: x(k), top: yD })}>
            <Digit
              digit={k < D.length ? D[k] : 0}
              variant={pickVariant({ highlighted: hl.has(`D:${k}`), computed: own && usedD.has(k), ghost: !own })}
              isNum1
              onIncrement={() => onCycleDigit('n1', k, 1)}
              onDecrement={() => onCycleDigit('n1', k, -1)}
              hoverEditable={hoverEdit && own}
              operand
            />
          </div>
        );
      })}
      {cols > 0 && <div data-fit className="absolute" style={toRem(signPos(yD))}>{renderSign('n1', num1.sign)}</div>}
      {cols > 0 && <div data-fit className="absolute -translate-x-full -translate-y-1/2" style={toRem({ left: S0 - 53, top: yD + cell / 2 })}><OperandTag label="N1" color="text-cyan-400" /></div>}
      {Array.from({ length: plan.intLen }, (_, k) => commaAfter(k, plan.intLen) && <ThousandsComma key={`kd${k}`} left={x(k) + cell + GAP - COMMA_NUDGE} top={yD + cell - 28} />)}
      {cols > plan.intLen && !wholeInputs && decimalPoint(x(plan.intLen - 1), yD, 'pd')}
      {V.map((_, t) => t < vInt && commaAfter(t, vInt) && <ThousandsComma key={`kv${t}`} left={xDiv(t) + cell + GAP - COMMA_NUDGE} top={yV + cell - 28} />)}
      {plan.vDec > 0 && decimalPoint(xDiv(vInt - 1), yV, 'pv')}
      {quot.map((c, t) => t + 1 < quot.length && commaAfter(c.col ?? 0, plan.intLen) && <ThousandsComma key={`kq${t}`} left={x(c.col ?? 0) + cell + GAP - COMMA_NUDGE} top={yQ + cell - 28} />)}
      {quot.some(c => (c.col ?? 0) >= plan.intLen) && decimalPoint(x(plan.intLen - 1), yQ, 'pq')}

      {/* The division sign: two thick dots */}
      <svg data-fit className="absolute text-cyan-500" style={toRem({ ...colonPos, width: 10, height: 24 })} viewBox="0 0 10 24" aria-label="divided by">
        <circle cx="5" cy="5" r="4" fill="currentColor" />
        <circle cx="5" cy="19" r="4" fill="currentColor" />
      </svg>

      {/* N2 (the divisor) */}
      {n > 0 && <div data-fit className="absolute" style={toRem(signPos(yV))}>{renderSign('n2', num2.sign)}</div>}
      {n > 0 && <div data-fit className="absolute -translate-x-full -translate-y-1/2" style={toRem({ left: S0 - 53, top: yV + cell / 2 })}><OperandTag label="N2" color="text-pink-400" /></div>}
      {V.map((v: number, t: number) => {
        // Zeros added when the decimal points move (equalize) are ghost cells; only N2's own digits can be turned
        const own = t + plan.vOffset < num2.digits.length;
        return (
          <div key={`b${t}`} className="absolute" style={toRem({ left: xDiv(t), top: yV })}>
            <Digit
              digit={v}
              variant={pickVariant({ highlighted: hl.has('V'), computed: false, ghost: !own })}
              isNum1={false}
              onIncrement={() => onCycleDigit('n2', t + plan.vOffset, 1)}
              onDecrement={() => onCycleDigit('n2', t + plan.vOffset, -1)}
              hoverEditable={hoverEdit && own}
              operand
            />
          </div>
        );
      })}

      <div data-fit className={glyph} style={toRem({ ...eqPos, width: 20, height: cell })}>=</div>

      {/* The quotient */}
      {qSign !== null && (
        <div className="absolute flex items-center" style={toRem({ ...qSignPos, height: cell })}>
          <ResultSign sign={qSign} />
        </div>
      )}
      {quot.map(c => (
        <div key={c.id} className="absolute animate-pop-in" style={toRem({ left: x(c.col ?? 0), top: yQ })}>
          <Digit digit={c.value} variant="result" />
        </div>
      ))}

      {/* The work area under the quotient: drawn smaller towards the right when needed (ls, see above) */}
      <div className="absolute inset-0 pointer-events-none" style={lowerStyle(ls, width, yWork)}>
      {/* The subtractions */}
      {rows.map(r => (
        <div key={r.id}>
          {r.kind === 'product' && r.minusAt !== undefined && (
            <div className="absolute flex items-center justify-center text-2xl font-light text-zinc-400" style={toRem({ left: x(r.minusAt) - 30, top: r.y, width: 20, height: cell })}>−</div>
          )}
          {Object.entries(r.cells).map(([key, c]) => {
            const col = Number(key);
            const isFinal = finalRow === r.id;
            const variant = hl.has(`${r.id}:${col}`) ? 'highlight' : isFinal ? 'result' : r.kind === 'product' ? 'computed' : 'idle';
            return (
              <div key={c.id} className="absolute" style={toRem({ left: x(col), top: r.y })}>
                <div className={fadingCells.has(`${r.id}:${col}`) ? 'animate-fade-out' : 'animate-pop-in'}>
                  <Digit digit={c.value} variant={variant} />
                </div>
              </div>
            );
          })}
        </div>
      ))}
      {/* "Remainder ▶" on the left of what is left at the end, centred on its row (Julian); whole-number divisions only
          (with decimals the division goes on after the point instead) */}
      {(() => {
        const r = !plan.decimalMode && finalRow ? rows.find(w => w.id === finalRow) : undefined;
        const cs = r ? Object.keys(r.cells).map(Number) : [];
        return r && cs.length > 0 && (
          <div data-fit className="absolute -translate-x-full -translate-y-1/2 animate-pop-in" style={toRem({ left: x(Math.min(...cs)) - 13, top: r.y + cell / 2 })}>
            <OperandTag label="Remainder" color="text-amber-400" />
          </div>
        );
      })()}
      {lines.map(l => (
        <div key={l.id} className="absolute h-0.75 bg-zinc-600 rounded-full" style={toRem({ left: x(l.from) - 4, top: l.y, width: x(l.to) + cell - x(l.from) + 8 })} />
      ))}
      {renderBorrows(true)}
      </div>

      {/* The digit being brought down: from N1 (full size) down to its row, shrinking with the work area */}
      {mover && (() => {
        const low = mover.y >= yWork;
        return (
          <div
            className="absolute z-40 origin-top-left transition-[top,left,scale] duration-700 ease-in-out"
            style={{ ...toRem({ left: low ? lowX(x(mover.col)) : x(mover.col), top: low ? lowY(mover.y) : mover.y }), scale: String(low ? ls : 1) }}
          >
            <Digit digit={mover.value} variant="highlight" />
          </div>
        );
      })()}

      {renderBorrows(false)}
    </div>
  );
}
