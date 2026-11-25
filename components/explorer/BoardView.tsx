"use client";

import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { REM_PX, toRem, usePhone, type MathOp } from '../math/shared';
import FitBoard from '../math/FitBoard';

// The frame of the boards that have no size rule of their own (fractions): centred in the width the board is laid out
// for (`viewW`, nominal px; not the area's live width, which changes every frame while the steps window slides), gliding
// with `smooth`, and reporting its width (like the other boards: see toggleSteps)
// `anchored` (md up, the controls column beside the board): not centred but held at the area's left edge, so the
// fractions and their drums stay put while digits change (Julian; the board places itself from there)
function FramedBoard({ viewW, smooth, onNaturalWidth, anchored, children }: { viewW: number; smooth: boolean; onNaturalWidth: (w: number) => void; anchored: boolean; children: ReactNode }): ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const k = REM_PX / (parseFloat(getComputedStyle(document.documentElement).fontSize) || REM_PX);
      setW(el.offsetWidth * k);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => { if (w) onNaturalWidth(w); }, [w, onNaturalWidth]);
  return (
    <div
      ref={ref}
      className={`w-max shrink-0 mb-auto px-2 pb-4 ${w || anchored ? '' : 'mx-auto'} ${smooth ? 'transition-[margin-left] duration-600 ease-[cubic-bezier(0.22,1,0.36,1)]' : ''}`}
      style={anchored ? undefined : w && viewW ? toRem({ marginLeft: Math.max(0, (viewW - w) / 2) }) : undefined}
    >
      {children}
    </div>
  );
}

// The active operation's board in its frame. Multiplication and division: the same size and place rule as addition /
// subtraction (Julian), in a FitBoard; fractions in a FramedBoard; addition / subtraction size themselves
export function BoardView({ activeOp, framed, board, boardViewW, viewHeight, smoothFit, onNaturalWidth, leftRoom, stepsClosed, pageMidX, longest }: { activeOp: MathOp; framed: boolean; board: ReactNode; boardViewW: number; viewHeight: number; smoothFit: boolean; onNaturalWidth: (w: number) => void; leftRoom: number; stepsClosed: boolean; pageMidX: number | undefined; longest: number }): ReactElement {
  // (a phone: fractions start at the area's left edge too, see FramedBoard and FractionBoard)
  const phone = usePhone();
  if (activeOp === 'multiplication' || activeOp === 'division') {
    return (
      <FitBoard availableWidth={Math.max(0, boardViewW - 16)} availableHeight={viewHeight} smooth={smoothFit} onNaturalWidth={onNaturalWidth} leftRoom={leftRoom} stepsClosed={stepsClosed} pageMidX={pageMidX} longest={longest}>
        <div className="w-max pb-4">{board}</div>
      </FitBoard>
    );
  }
  return framed
    ? <FramedBoard viewW={boardViewW} smooth={smoothFit} onNaturalWidth={onNaturalWidth} anchored={leftRoom > 0 || phone}>{board}</FramedBoard>
    : <>{board}</>;
}
