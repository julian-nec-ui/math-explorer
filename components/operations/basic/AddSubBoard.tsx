"use client";

// Addition and subtraction, column by column, with carries and borrows that move where you can see them.
// One board for both tabs (`op`): a subtraction is an addition with the second number's sign turned round, and
// negative numbers are first rewritten as the operation really done on the digits (e.g. 3 − 8 = −(8 − 3)).
// Like the other boards it starts when `run` turns true, reports each step with `onStatus` and calls `onDone` at the
// end; the page remounts it (new key) to clear it.

import { useContext, useState, useEffect, useRef, Fragment, type CSSProperties, type ReactElement, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CELL, CELL_W, REM_PX, OperandTag, OperandDrum, DigitDrums, DrumZoom, drumScaleFor, DRUM_REACH, DRUM_W, CarryHop, Digit, SumPop, OpIcon, ResultSign, toRem, useCellSize, intLength, CARRY_CHIP, BORROW_CHIP, chipSize, pickVariant, type NumberData, type BadgeKind } from '../../math/shared';
import { type AddSubBoardProps, type Badge, COMMA_SLOT, CommaSeparator, type CustomCSSProperties, DOT_OUTER, DecimalPoint, type DotState, EmptyCell, type ExprFly, type FlightData, G, type ResultDigit, type RewrittenView, digitAt } from './addsub/model';
import { runAddSub } from './addsub/script';
import { useAddSubFit } from './addsub/useFit';
import { OP_BAR, OP_MARK } from './geometry';

export default function AddSubBoard({ op, num1, num2, run, onStatus, onDone, renderSign, onCycleDigit, hoverEdit = false, availableWidth, availableHeight, leftRoom = 0, stepsClosed = false, pageMidX, smoothFit = false, onNaturalWidth }: AddSubBoardProps): ReactElement {
  // The digit-count drums sit left of the N1 / N2 tags: the board keeps room for them too (see OperandDrum)
  const hasDrums = !!useContext(DigitDrums);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const { rootRef, natural, fit, shift, fitRef, drop } = useAddSubFit({ num1, num2, availableWidth, availableHeight, leftRoom, stepsClosed, pageMidX, onNaturalWidth });
  const [result, setResult] = useState<Record<number, ResultDigit>>({});
  const [resultSign, setResultSign] = useState<1 | -1 | null>(null);
  const [currentColumn, setCurrentColumn] = useState(-1);
  const [computedColumns, setComputedColumns] = useState<Set<number>>(new Set());
  const [badges, setBadges] = useState<Badge[]>([]);
  // The operation's sign between the two digits being worked on (Julian): + or −, in the yellow / orange of the
  // highlighted digits, moving from column to column with the work (columns with a 0 for a missing digit too)
  const [opMark, setOpMark] = useState<{ col: number; sub: boolean } | null>(null);
  // The 0 standing in for a missing digit (Julian): where one number has no digit in the column being worked on, a big
  // 0 chip (green in addition, red in subtraction) sits in that number's empty cell; one chip, hopping left from
  // column to column as the work moves on, and fading at the end
  const [zero, setZero] = useState<{ col: number; row: 'top' | 'bottom'; sub: boolean; fading: boolean } | null>(null);
  const zeroRef = useRef<HTMLDivElement>(null);
  const zeroCol = zero?.col;
  const zeroSeen = useRef(false);
  useEffect(() => {
    if (zeroCol === undefined) { zeroSeen.current = false; return; }
    // the first time it pops in; after that every move is a hop (an arc up and down while it slides left)
    if (zeroSeen.current) zeroRef.current?.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-60%)' }, { transform: 'translateY(0)' }], { duration: 700, easing: 'ease-in-out' });
    zeroSeen.current = true;
  }, [zeroCol]);
  const [fadingCols, setFadingCols] = useState<Set<number>>(new Set());
  const [flight, setFlight] = useState<FlightData | null>(null);
  // Addition, a column that makes 10 or more: its sum is shown for a moment where the result goes (`sumChip`),
  // then the units stay there and the tens (the carry) jumps in an arc to the next column's corner (`hop`)
  // Subtraction, a column that has to borrow: the ten jumps from the top digit on the left onto this column's top digit,
  // which then shows for a moment with the ten added (e.g. 13)
  const [sumChip, setSumChip] = useState<{ x: number; y: number; text: string; lead: number; kind: BadgeKind; splitting: boolean } | null>(null);
  // The column's calculation on the result row (Julian, like multiplication): "a + b =" (or "a − b =") just left of the
  // result's cell, the result in the cell. The two digits and the sign first come down from the column (`fly`: copies
  // from where they are to where they go in the line); then, in addition, the carry is added on the same line —
  // "s + [ ] =", the green carry chip itself flying into the gap (`chip`). Screen px (drawn over the page, like the
  // carry chips). `size`: the font size, scaled with the board
  const [expr, setExpr] = useState<{
    key: string; right: number; y: number; cx: number; size: number;
    parts: string[]; slot: boolean; shown: boolean; eq: boolean; result: string | null; fly: ExprFly[]; landed: boolean;
  } | null>(null);
  const exprPartRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const exprSlotRef = useRef<HTMLSpanElement>(null);
  const opMarkRef = useRef<HTMLDivElement>(null);
  const [hop, setHop] = useState<{ x0: number; y0: number; x1: number; y1: number; value: number | string; kind: BadgeKind; key: string } | null>(null);
  // Subtraction, like on paper: a top digit whose value changed (it lent 1 to the right, or got a borrowed ten) is
  // crossed out in red and its new value written small above it (column → new value). They fade when the result is done
  const [crossed, setCrossed] = useState<Record<number, string>>({});
  const [crossedFading, setCrossedFading] = useState(false);
  // The rewritten problem shown on the board while (and after) explaining it; null = the numbers as entered
  const [view, setView] = useState<RewrittenView | null>(null);
  // While true, the two operand rows slide past each other (swap places); `swapDist` is how far, in px
  const [swapping, setSwapping] = useState(false);
  const [swapDist, setSwapDist] = useState(0);
  // How long the rows take to swap (ms): 700, or 30% less while the problem is being rewritten at the start
  const [swapMs, setSwapMs] = useState(700);
  const row1Ref = useRef<HTMLDivElement>(null);
  const row2Ref = useRef<HTMLDivElement>(null);

  const carryRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const resultRefs = useRef<Record<number, HTMLDivElement | null>>({});
  // The top row's cells (for the borrowed ten's jump)
  const topRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const bottomRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const lineRef = useRef<HTMLDivElement>(null);

  // Shared grid for all rows, with one column reserved for the final carry
  const layoutDec = Math.max(num1.decimalCount, num2.decimalCount);
  const layoutInt = Math.max(intLength(num1), intLength(num2), 1) + 1;

  // Left edge (px) of each column's slot inside a row, computed from the same widths the rows use:
  // the 40px first column, digit cells, 12px commas, the decimal point (DOT_OUTER), and the gap between them
  const cell = useCellSize();
  const slotLeft: Record<number, number> = {};
  {
    let pos = 40 + G;
    for (let j = layoutInt - 1; j >= 0; j--) {
      slotLeft[layoutDec + j] = pos;
      pos += cell + G;
      if (j > 0 && j % 3 === 0) pos += COMMA_SLOT + G;
    }
    if (layoutDec > 0) {
      pos += DOT_OUTER + G;
      for (let col = layoutDec - 1; col >= 0; col--) {
        slotLeft[col] = pos;
        pos += cell + G;
      }
    }
  }

  // The explanation, started when `run` turns true. Stopping (or any reset) remounts the board, which ends it
  useEffect(() => runAddSub({ run, num1, num2, op, setView, row1Ref, row2Ref, setSwapDist, fitRef, setSwapMs, setSwapping, onStatus, setBadges, setZero, setCrossedFading, setCrossed, resultRefs, setExpr, exprPartRefs, carryRefs, exprSlotRef, setCurrentColumn, setOpMark, topRefs, setHop, zeroRef, opMarkRef, bottomRefs, setSumChip, setResult, setComputedColumns, lineRef, setFlight, setFadingCols, setResultSign, onDone }), [run]);

  // Draws a row's slots on the shared grid: integer digits (with commas), point, decimals
  const renderSlots = (key: string, cell: (col: number) => ReactNode, commaVisible: (col: number) => boolean, dot: DotState) => {
    const out: ReactNode[] = [];
    for (let j = layoutInt - 1; j >= 0; j--) {
      const col = layoutDec + j;
      out.push(<Fragment key={`${key}-c${col}`}>{cell(col)}</Fragment>);
      if (j > 0 && j % 3 === 0) out.push(<CommaSeparator key={`${key}-comma${col}`} visible={commaVisible(col)} />);
    }
    if (layoutDec > 0) {
      out.push(<DecimalPoint key={`${key}-dot`} state={dot} />);
      for (let col = layoutDec - 1; col >= 0; col--) out.push(<Fragment key={`${key}-c${col}`}>{cell(col)}</Fragment>);
    }
    return out;
  };

  const renderNumberRow = (n: NumberData, isNum1: boolean) => {
    const which = isNum1 ? 'n1' : 'n2';
    // While the rows swap places, every cell of the top row slides down and every cell of the bottom row slides up
    const move: CSSProperties | undefined = swapping
      ? { transform: `translateY(${isNum1 ? swapDist : -swapDist}px)`, transition: `transform ${swapMs}ms ease-in-out` }
      : undefined;
    return renderSlots(
      which,
      col => (
        <div ref={(el: HTMLDivElement | null) => { (isNum1 ? topRefs : bottomRefs).current[col] = el; }} className="relative shrink-0" style={move}>
          {numberCell(n, isNum1, which, col)}
          {/* Crossed out in red, the new value written small above it (subtraction, see `crossed`).
              (These cells are positioned, so the +/− sign buttons sit above them with z-20, or they would cover them) */}
          {isNum1 && crossed[col] !== undefined && (
            <div aria-hidden="true" className={`pointer-events-none absolute inset-0 z-30 transition-opacity duration-1000 ${crossedFading ? 'opacity-0' : 'opacity-100'}`}>
              <svg className="absolute inset-0 w-full h-full animate-pop-in" viewBox="0 0 100 100" preserveAspectRatio="none">
                <line x1="22" y1="80" x2="78" y2="20" stroke="#f87171" strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              </svg>
              {/* Moved a little right while a borrow mark (a 0 one too) sits in this column's top-left corner, so it isn't
                  covered */}
              <span className={`absolute ${badges.some(x => x.col === col && x.side === 'left' && !x.fading) ? 'left-[66%]' : 'left-1/2'} -translate-x-1/2 -top-5 text-[15px] font-black leading-none text-red-400 drop-shadow-[0_0_6px_rgba(248,113,113,0.6)] transition-[left] duration-300 animate-pop-in`}>{crossed[col]}</span>
            </div>
          )}
        </div>
      ),
      col => digitAt(n, col, layoutDec) !== null,
      n.decimalCount > 0 ? 'on' : layoutDec > 0 ? 'dim' : 'hidden',
    );
  };

  const numberCell = (n: NumberData, isNum1: boolean, which: 'n1' | 'n2', col: number) => {
        const d = digitAt(n, col, layoutDec);
        if (!d) return <EmptyCell />;
        const variant = pickVariant({ highlighted: col === currentColumn, computed: computedColumns.has(col), ghost: d.index < 0 });
        const digit = (
          <Digit
            digit={d.value}
            variant={variant}
            isNum1={isNum1}
            onIncrement={() => onCycleDigit(which, d.index, 1)}
            onDecrement={() => onCycleDigit(which, d.index, -1)}
            hoverEditable={hoverEdit && !view && d.index >= 0}
            operand
          />
        );
        return digit;
  };

  const renderCarryRow = () => renderSlots(
    'carry',
    col => (
      <div ref={(el: HTMLDivElement | null) => { carryRefs.current[col] = el; }} className={`${CELL_W} h-7 shrink-0`} />
    ),
    () => false,
    'hidden',
  );

  // Carry chips live in a shared layer over the carry row, positioned
  // by their column's slot, so they can slide from one column to another.
  const badgeLeft = (x: Badge): number => {
    const left = slotLeft[x.col] ?? 0;
    return x.side === 'left' ? left + 1 : left + cell - (x.kind === 'borrow' ? BORROW_CHIP : CARRY_CHIP) - 1;
  };

  // The 0 chip in a row's empty cell (see `zero`): twice a carry chip (40px, 20px digit), centred in the cell
  // The + / − between the rows (see `opMark`): centred in the 31px between N1's and N2's cells, in the column's slot
  // the +/− between the highlighted pair: OP_MARK square, OP_BAR thick (nominal px; the gap between the rows is ~31)
  const renderOpMark = () => opMark && (
    <div
      ref={opMarkRef}
      aria-hidden="true"
      className="pointer-events-none absolute z-30 flex items-center justify-center transition-[left] duration-500 ease-in-out"
      style={toRem({ left: slotLeft[opMark.col] ?? 0, top: -31 / 2 - 12 + 2, width: cell, height: 24 })}
    >
      {/* drawn as two flat bars (no font glyph): sharp, no shadow, and big enough to read in the gap between the rows */}
      <span className="relative block animate-pop-in" style={toRem({ width: OP_MARK, height: OP_MARK })}>
        <span className="absolute left-0 bg-amber-400" style={toRem({ top: (OP_MARK - OP_BAR) / 2, width: OP_MARK, height: OP_BAR })} />
        {!opMark.sub && <span className="absolute top-0 bg-amber-400" style={toRem({ left: (OP_MARK - OP_BAR) / 2, width: OP_BAR, height: OP_MARK })} />}
      </span>
    </div>
  );

  const renderZero = (row: 'top' | 'bottom') => zero && zero.row === row && (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute bottom-0 z-30 flex items-center justify-center transition-[left,opacity] duration-700 ease-in-out ${zero.fading ? 'opacity-0' : 'opacity-100'}`}
      style={toRem({ left: slotLeft[zero.col] ?? 0, width: cell, height: cell })}
    >
      <div ref={zeroRef} className={`w-10 h-10 flex items-center justify-center text-[20px] font-black text-white shadow-[0_0_10px_rgba(0,0,0,0.35)] border-2 rounded-lg animate-pop-in ${zero.sub ? 'bg-red-600 border-red-400' : 'bg-green-600 border-green-400'}`}>
        0
      </div>
    </div>
  );

  const renderCarryBadges = () => badges.map(x => (
    // The outer container handles sliding and fading, the inner one handles appearing
    <div
      key={x.id}
      className={`absolute -bottom-2.25 z-40 origin-bottom-right transition-[left,opacity,scale] duration-800 ease-in-out ${x.fading ? 'opacity-0' : 'opacity-100'} ${x.side === 'right' ? 'scale-80' : 'scale-100'}`}
      style={toRem({ left: badgeLeft(x) })}
    >
      <div className={`${chipSize(x.kind)} flex items-center justify-center font-black shadow-[0_0_10px_rgba(0,0,0,0.35)] border animate-pop-in ${x.kind === 'borrow' ? 'bg-red-600 border-red-400 text-white' : 'bg-green-600 border-green-400 text-white'}`}>
        {x.value}
      </div>
    </div>
  ));

  const resultHasDot = layoutDec > 0 && (computedColumns.has(layoutDec - 1) || resultSign !== null);

  const resultLeadCol = Math.max(-1, ...Object.keys(result).map(Number));

  // All signs share one vertical line: 32px left of the leftmost first digit among the operands
  // (the result's sign moves further left only when the result is longer than both operands)
  const operandLead = layoutDec + Math.max(intLength(num1), intLength(num2)) - 1;
  // A sign button (32px) 13px before the number's first digit (was 32px, then 16: Julian; the N1 / N2 tags move with it)
  const signLeft = (col: number): number => (slotLeft[col] ?? 0) - 32 - 13;
  const operandSignLeft = signLeft(operandLead);
  const resultSignLeft = signLeft(Math.max(operandLead, resultLeadCol));

  const renderResultRow = () => renderSlots(
    'res',
    col => {
      const r = result[col];
      return (
        <div ref={(el: HTMLDivElement | null) => { resultRefs.current[col] = el; }} className={`${CELL} shrink-0 relative`}>
          {r && (
            <div key={r.id} className={fadingCols.has(col) ? 'animate-fade-out' : 'animate-pop-in'}>
              <Digit digit={r.value} variant="result" />
            </div>
          )}
        </div>
      );
    },
    col => !!result[col] && !fadingCols.has(col),
    resultHasDot ? 'on' : 'hidden',
  );

  // −( … ) layout, in px from the left edge of the board's rows: the rows move right by OUTER_PAD to make room for
  // the pink minus and the opening bracket (12px before the operation sign, as before); the closing bracket sits
  // 12px after the last digit; the dividing line then runs exactly from the minus to the closing bracket
  const OUTER_PAD = 58;
  const outerRight = OUTER_PAD + (slotLeft[0] ?? 0) + cell + 12 + 12; // right edge of the closing bracket

  // The moving carry / borrow chips are drawn over the whole page (fixed, measured in screen px), outside any
  // ancestor that would change what `fixed` means (the panel's backdrop blur)
  const overlays = (
    <>
      {flight && (
        <div
          className={`fixed z-100 pointer-events-none animate-carry-flight flex items-center justify-center ${chipSize('carry')} font-black text-white shadow-[0_0_10px_rgba(0,0,0,0.35)] border bg-green-600 border-green-400`}
          style={{
            left: `calc(${flight.startX}px - ${CARRY_CHIP / 2 / 16}rem)`,
            top: `calc(${flight.startY}px - ${CARRY_CHIP / 2 / 16}rem)`,
            '--tx': `${flight.endX - flight.startX}px`,
            '--ty': `${flight.endY - flight.startY}px`,
          } as CustomCSSProperties}
        >
          {flight.value}
        </div>
      )}

      {/* The column's calculation on the result row (see `expr`): the line, ending just left of the result's cell (hidden
          while its parts are still coming down), the result in the cell, and the parts / the carry chip flying in */}
      {expr && (
        <>
          <div
            key={`${expr.key}l`}
            className="fixed z-100 pointer-events-none whitespace-nowrap leading-none font-black text-[#58c7fe] flex items-center"
            style={{ left: expr.right, top: expr.y, transform: 'translate(-100%, -50%)', fontSize: expr.size, opacity: expr.shown ? 1 : 0 }}
          >
            {expr.parts.map((p, i) => (
              <span key={i} ref={el => { exprPartRefs.current[i] = el; }} className={i === 1 ? 'mx-[0.3em]' : ''}>{p}</span>
            ))}
            {expr.slot && (
              <span ref={exprSlotRef} className="inline-block mx-[0.3em]" style={{ width: CARRY_CHIP * fitRef.current / 16 + 'rem', height: CARRY_CHIP * fitRef.current / 16 + 'rem' }} />
            )}
            <span className={`ml-[0.3em] ${expr.eq ? 'opacity-100' : 'opacity-0'}`}>=</span>
          </div>
          {expr.result !== null && (
            <div
              key={`${expr.key}r${expr.result}`}
              className="fixed z-100 pointer-events-none whitespace-nowrap leading-none font-black text-[#58c7fe] animate-pop-in"
              style={{ left: expr.cx, top: expr.y, translate: '-50% -50%', fontSize: expr.size }}
            >
              {expr.result}
            </div>
          )}
          {expr.fly.map((f, i) => (f.chip ? (
            <div
              key={`${expr.key}f${i}`}
              className={`fixed z-100 pointer-events-none flex items-center justify-center ${chipSize('carry')} font-black text-white shadow-[0_0_10px_rgba(0,0,0,0.35)] border bg-green-600 border-green-400 transition-[left,top] duration-800 ease-in-out`}
              style={{ left: (f.to ?? f.from).x, top: (f.to ?? f.from).y, translate: '-50% -50%', scale: String(fitRef.current) }}
            >
              {f.text}
            </div>
          ) : (
            <div
              key={`${expr.key}f${i}`}
              className={`fixed z-100 pointer-events-none whitespace-nowrap leading-none font-black text-[#58c7fe] transition-[left,top] duration-650 ease-in-out ${expr.shown ? 'opacity-0' : ''}`}
              style={{ left: (f.to ?? f.from).x, top: (f.to ?? f.from).y, translate: '-50% -50%', fontSize: expr.size }}
            >
              {f.text}
            </div>
          )))}
        </>
      )}

      {/* Addition: the column's sum (the carry in green). Subtraction: the top digit with the borrowed ten (in red) */}
      {sumChip && <SumPop fixed x={sumChip.x} y={sumChip.y} text={sumChip.text} lead={sumChip.lead} kind={sumChip.kind} splitting={sumChip.splitting} />}
      {hop && <CarryHop key={hop.key} fixed x0={hop.x0} y0={hop.y0} x1={hop.x1} y1={hop.y1} value={hop.value} kind={hop.kind} />}

    </>
  );

  return (
    <DrumZoom.Provider value={drumScaleFor(fit) / fit}>
    {/* Scaled to fit: the outer box takes the scaled size (so the page lays it out at that size), the board inside is
        drawn at its natural size and scaled from its top-left corner */}
    {/* Moved left (desktop): the outer box is `shift` narrower and the board starts `shift` before it, so the page lays
        out (and scrolls) only what is really there (a transform would still count the old place for the scrollbar) */}
    {/* Centred as if it were its full width (margin = half the room left), then the board moved `shift` to the left */}
    {/* Centred in the width the board is laid out for (availableWidth + its 16px), not in the area's live width: while the
        steps window slides open or closed the area's width changes every frame, and the digits must not follow it
        (Julian; see toggleSteps in MathExplorer). With `smoothFit` they glide to their new place instead */}
    <div
      className={`${natural ? 'mr-auto' : 'mx-auto'} mb-auto shrink-0 ${smoothFit ? 'transition-[margin-left,width,height] duration-600 ease-[cubic-bezier(0.22,1,0.36,1)]' : ''}`}
      style={natural ? { ...toRem({ width: Math.max(0, natural.w * fit - shift), height: natural.h * fit + drop }), marginLeft: `max(0px, calc((${availableWidth ? `${(availableWidth + 16) / REM_PX}rem` : '100%'} - ${(natural.w * fit) / REM_PX}rem) / 2))` } : undefined}
    >
    <div ref={rootRef} className={`relative w-max flex flex-col gap-4 pb-4 ${smoothFit ? 'transition-[padding,transform,margin-left,margin-top] duration-600 ease-[cubic-bezier(0.22,1,0.36,1)]' : 'transition-[padding] duration-500'} ${view?.outerMinus ? 'pr-2 pl-[3.625rem] max-sm:pr-8' : hasDrums ? 'pl-[8.1875rem]' : 'pl-14'}`} style={{ transform: `scale(${fit})`, transformOrigin: 'top left', ...(shift ? toRem({ marginLeft: -shift }) : {}), ...(drop ? toRem({ marginTop: drop }) : {}) }}>
      {/* −( … ): when the result takes a minus in front, a pink minus and a pair of brackets around both numbers,
          all of it above the dividing line and inside its length */}
      {view?.outerMinus && (() => {
        const top = 60 - 6;
        const bottom = 60 + cell + 31 + Math.max(cell, cell >= 43 ? 48 : 40) + 6;
        const bracket = (left: number, d: string) => (
          <svg className="absolute text-pink-400 animate-pop-in" style={toRem({ left, top, width: 12, height: bottom - top })} viewBox="0 0 12 100" preserveAspectRatio="none" aria-hidden="true">
            <path d={d} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </svg>
        );
        return (
          <>
            <div className="absolute flex items-center justify-center w-6 text-[40px] leading-none font-bold text-pink-400 animate-pop-in" style={toRem({ left: 4, top: (top + bottom) / 2 - 22, height: 40 })} aria-hidden="true">−</div>
            {bracket(OUTER_PAD - 24, 'M10 2 Q1 50 10 98')}
            {bracket(outerRight - 12, 'M2 2 Q11 50 2 98')}
            <span className="sr-only">The result takes a minus sign.</span>
          </>
        );
      })()}
      <div className="flex items-end gap-1.5 h-7 relative">
        <div className="w-10 shrink-0" />
        {renderCarryRow()}
        {renderCarryBadges()}
      </div>

      <div ref={row1Ref} className="flex items-end gap-1.5 relative">
        <div className="w-10 shrink-0" />
        {/* Sign buttons and digit counts belong to the numbers as entered, so they hide while the board shows the rewritten problem */}
        {!view && num1.digits.length > 0 && <div className="absolute z-20 top-1/2 -translate-y-1/2" style={toRem({ left: operandSignLeft })}>{renderSign('n1', num1.sign)}</div>}
        {/* N1 ▶ / N2 ▶: on the left of its sign button, 8px from it (no column on the right any more, so the digits can
            use the whole width); the board keeps room for it on the left (pl-14) */}
        {!view && num1.digits.length > 0 && <div className="absolute z-20 top-1/2 -translate-y-1/2 -translate-x-full flex items-center gap-[0.9375rem]" data-drumbox style={toRem({ left: operandSignLeft - 8 })}><OperandDrum part="n1" dy={-2} /><OperandTag label="N1" color="text-cyan-400" fixed /></div>}
        {renderNumberRow(view ? view.top : num1, true)}
        {renderZero('top')}
      </div>

      <div ref={row2Ref} className="flex items-end gap-1.5 mt-3.75 relative">
        {!view && num2.digits.length > 0 && <div className="absolute z-20 top-1/2 -translate-y-1/2" style={toRem({ left: operandSignLeft })}>{renderSign('n2', num2.sign)}</div>}
        {/* The operation sign: left edge aligned with the start of the dividing line,
            raised to halfway between the signs of N1 and N2
            (half the row height + the gap between rows: 16px + 15px) */}
        {/* (Julian) It stays put between the two digit-count drums, just right of them, like × in multiplication: placed
            from the N1 / N2 tags (so it moves only with them), not from the row's start. Its 40px slot still holds the
            row's place (no taller than the digits: N2 31px under N1, as in every operation) */}
        <div className="w-10 shrink-0 self-center" />
          <div className="absolute z-10 top-1/2 -translate-y-1/2 text-cyan-500" style={toRem({ left: operandSignLeft - 50, marginTop: -(cell + 31) / 2 })}>
            <OpIcon op={view ? view.op : op} />
            <span className="sr-only">{view ? (view.op === 'addition' ? 'Addition' : 'Subtraction') : (op === 'addition' ? 'Addition' : 'Subtraction')}</span>
          </div>
        {!view && num2.digits.length > 0 && <div className="absolute z-20 top-1/2 -translate-y-1/2 -translate-x-full flex items-center gap-[0.9375rem]" data-drumbox style={toRem({ left: operandSignLeft - 8 })}><OperandDrum part="n2" dy={2} /><OperandTag label="N2" color="text-pink-400" fixed /></div>}
        {renderNumberRow(view ? view.bottom : num2, false)}
        {renderZero('bottom')}
        {renderOpMark()}
      </div>

      {/* With −( … ) the line runs from the minus (4px in) to the closing bracket, so the whole group sits above it */}
      <div ref={lineRef} data-opline className={`h-1 bg-zinc-700 my-2 rounded-full ${view?.outerMinus ? 'self-start' : ''}`}
        style={view?.outerMinus ? toRem({ marginLeft: 4 - OUTER_PAD, width: outerRight })
          // (Julian) It reaches left under the digit-count drums too (drawn bigger when the board shrinks: DrumZoom)
          : hasDrums && !view ? toRem({ marginLeft: Math.min(0, operandSignLeft - DRUM_REACH - DRUM_W * (drumScaleFor(fit) / fit - 1)) }) : undefined} />

      <div className="flex items-end gap-1.5 relative">
        <div className="w-10 shrink-0" />
        {resultSign === 1 && resultLeadCol >= 0 && (
          <div className="absolute top-1/2 -translate-y-1/2" style={toRem({ left: resultSignLeft })}>
            <ResultSign sign={resultSign} />
          </div>
        )}
        {/* A negative result: the same pink minus as the one in front of −( … ), right before the result's first digit,
            so it clearly belongs to the number */}
        {resultSign === -1 && resultLeadCol >= 0 && (
          <div
            className="absolute top-1/2 -translate-y-1/2 flex items-center justify-center w-6 text-[40px] leading-none font-bold text-pink-400 animate-pop-in"
            style={toRem({ left: (slotLeft[resultLeadCol] ?? 0) - 12 - 24, height: 40 })}
          >
            −<span className="sr-only">minus</span>
          </div>
        )}
        {renderResultRow()}
      </div>
    </div>
    </div>
    {/* (after the first render only: the server has no page body, so the first render must match its HTML) */}
    {mounted && createPortal(<div data-mx-overlays>{overlays}</div>, document.body)}
    </DrumZoom.Provider>
  );
}
