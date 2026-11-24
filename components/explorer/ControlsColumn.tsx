"use client";

import type { ReactElement, ReactNode, RefObject } from 'react';
import { CountDrum, FRAC_PARTS, STEP_DELAYS_MS, toRem, type NumberType } from '../math/shared';
import SevenSeg, { formatElapsed } from '../math/SevenSeg';
import type { DivisionMethod, DivisionResult } from '../operations/basic/DivisionBoard';
import { BOARD_LIFT, COL_DROP, DRUM_BOX_H, EDGE_5 } from './constants';
import { FRACTION_LABELS, FRACTION_MAX_DIGITS } from './problem';
import type { Problem } from './useProblem';

// Integer / Float / Redo (+ the decimal method in division, + the decimal places for floats). From md up: on the line of the first operand (N1), aligned with the left edge of the canvas
// (N1's cells start 60px down the board area: 16px padding + 44px, so this is centred on them).
// On a phone: a normal row above the board (the inline `top` only applies when positioned)
export function ControlsColumn({ colRef, cell, timerGap, elapsed, problem, isAnimating, paused, hasWork, blocked, stepDelay, setStepDelay, onRedo, onTogglePause, band }: {
  colRef: RefObject<HTMLDivElement | null>; cell: number; timerGap: number; elapsed: number; problem: Problem; isAnimating: boolean;
  paused: boolean; hasWork: boolean; blocked: string | null; stepDelay: number; setStepDelay: (v: number) => void;
  onRedo: () => void; onTogglePause: () => void;
  // The control band, when it doesn't fit on the title's row (null otherwise)
  band: ReactNode;
}): ReactElement {
  const { activeOp, digitCounts, fracCounts, numberTypes, divisionMethod, effectiveDivisionResult, handleDigitCountChange, handleFracCountChange, effectiveDecimals, changeDecimals, chooseType, chooseDivisionMethod, chooseDivisionResult } = problem;
  return (
    <div ref={colRef} className={`flex flex-col gap-2 w-full md:w-max md:max-w-60 md:absolute md:left-0 ${EDGE_5} md:z-10`} style={toRem({ top: 60 - BOARD_LIFT + COL_DROP + (2 * cell + 34 - DRUM_BOX_H) / 2 })}>
      {/* The digit drums' box, INTEGER | FLOAT under it, Redo under them (as wide as both), then in division
          CLASSIC and EQUAL DECIMALS, each on its own row: everything as wide as the drums' box (Julian) */}
      {/* Elapsed time (Julian): halfway between the title and the drums' box, its right end in line with the column's
          (desktop: the column is placed absolutely, under the title) */}
      <div className="hidden md:flex absolute right-0 translate-y-1/2" style={{ bottom: `calc(100% + ${timerGap / 2}px - ${COL_DROP / 2 / 16}rem)` }}>
        <SevenSeg text={formatElapsed(elapsed)} label={`Elapsed time ${formatElapsed(elapsed)}`} />
      </div>
      {/* On a phone (under md) the column is a normal row above the board: the elapsed time on its own line, at the top,
          centred */}
      <div className="flex md:hidden justify-center">
        <SevenSeg text={formatElapsed(elapsed)} label={`Elapsed time ${formatElapsed(elapsed)}`} />
      </div>
      <div className="grid w-full md:w-max grid-cols-[auto_1fr] gap-2">
      {/* How many digits each number has: a steel drum per number (always open, no three dots; 1 to 12, fractions:
          one per numerator / denominator, 1 to 6), each after its label, in their own box (same background as
          the control band): the grid's first row, spanning both columns. From md up it is centred on the first
          operand's digits (N1); 20px down to INTEGER (the grid's 8px gap plus mb-3) */}
      <div className="col-span-2 mb-3">
        {/* One under the other, N1 first; 12px between the drums, the same as from the drums to the box's edges
            (Julian) */}
        <div className="flex flex-col gap-3 bg-zinc-800/50 p-3 rounded-2xl border border-zinc-700" role="group" aria-label={activeOp === 'fractions' ? 'Digits of the fractions' : 'Digits'}>
          {(activeOp === 'fractions'
            ? FRAC_PARTS.map(k => ({ key: k, label: FRACTION_LABELS[k], first: k.endsWith('1'), value: fracCounts[k], max: FRACTION_MAX_DIGITS, set: (v: number) => handleFracCountChange(k, v) }))
            : (['n1', 'n2'] as const).map(k => ({ key: k, label: `${k.toUpperCase()} Digits`, first: k === 'n1', value: digitCounts[activeOp][k], max: 12, set: (v: number) => handleDigitCountChange(k, v) }))
          ).map(d => (
            <div key={d.key} className="flex items-center justify-between gap-1.5">
              {/* The label on the drum's row, on one line */}
              <span className={`text-[8px] font-bold uppercase whitespace-nowrap ${d.first ? 'text-cyan-500' : 'text-pink-500'}`}>{d.label}</span>
              <CountDrum value={d.value} min={1} max={d.max} onChange={d.set} color={d.first ? 'cyan' : 'pink'} disabled={isAnimating} label={`${d.label}: ${d.value}`} />
            </div>
          ))}
        </div>
      </div>
      {(['integer', 'float'] as NumberType[]).map(t => {
        const active = numberTypes[activeOp] === t;
        return (
          <button
            type="button"
            // Fractions are made of whole numbers: INTEGER stays on, FLOAT can't be chosen
            disabled={isAnimating || activeOp === 'fractions'}
            title={activeOp === 'fractions' ? 'Fractions use whole numbers' : undefined}
            key={t}
            onClick={() => chooseType(t)}
            className={`whitespace-nowrap px-2 py-1 rounded-lg text-xs font-bold border cursor-pointer transition-all hover:-translate-y-px hover:shadow-[0_0_10px_rgba(6,182,212,0.35)] disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:shadow-none ${active ? 'bg-cyan-500/10 border-cyan-500 text-cyan-500 hover:bg-cyan-500/20' : 'border-zinc-700 text-zinc-500 hover:border-cyan-700 hover:text-cyan-300'}`}
          >
            {t.toUpperCase()}
          </button>
        );
      })}
      {/* Redo: under INTEGER and FLOAT, as wide as both together; same height; blue (like Explain to Me) when it can be used, like the other
          buttons when it can't. Shows the original problem again, as entered */}
      <button
        type="button"
        onClick={onRedo}
        disabled={isAnimating || !hasWork || !!blocked}
        title={blocked ?? 'Back to the problem as it was entered'}
        className="col-span-2 px-2 py-1 rounded-lg border text-xs font-bold leading-4 whitespace-nowrap transition-all text-white text-shadow-[0_1px_1px_rgba(0,0,0,0.3)] border-[#1b55b8] bg-linear-to-l from-[#22b8d6] to-[#1d5fd1] shadow-[inset_0_1px_0_rgba(255,255,255,0.22),inset_0_-1px_0_rgba(0,0,0,0.25),0_2px_5px_rgba(0,0,0,0.35)] hover:-translate-y-px hover:from-[#3cc8e4] hover:to-[#2a6fe0] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.28),inset_0_-1px_0_rgba(0,0,0,0.25),0_2px_10px_rgba(34,184,214,0.45)] active:translate-y-0 disabled:bg-none disabled:bg-transparent disabled:border-zinc-700 disabled:text-zinc-500 disabled:shadow-none disabled:text-shadow-none disabled:hover:translate-y-0 disabled:cursor-default"
      >
        Redo
      </button>
      {/* Step delay (Julian): extra time after each explanation step, 0 / 0.5 / 1 / 1.5 / 2 s, on a drum like the digit
          counts (it stops at 0 and 2); the label left-aligned with Redo, the drum right-aligned with FLOAT. Unlike
          the other controls it works while an explanation runs: the step under way finishes as it was, the
          next ones take the new delay */}
      <div className="col-span-2 mt-1 flex items-center justify-between" role="group" aria-label="Step delay">
        <span className="text-[8px] font-bold uppercase whitespace-nowrap text-cyan-500">Step delay</span>
        <div>
          <CountDrum
            value={stepDelay}
            min={0}
            max={STEP_DELAYS_MS.length - 1}
            onChange={setStepDelay}
            color="cyan"
            label={`Step delay: ${STEP_DELAYS_MS[stepDelay] / 1000} seconds`}
            format={i => String(STEP_DELAYS_MS[i] / 1000)}
            // The 2 alone looks smaller than 0.5 / 1.5 at the same size: 7% bigger (Julian)
            textStyle={i => (STEP_DELAYS_MS[i] === 2000 ? { fontSize: '26.75px' } : undefined)}
          />
        </div>
      </div>
      {/* Pause / Resume (Julian): freezes the explanation exactly where it is, and goes on from there. Amber
          (Pause) / green (Resume), darker, a metallic gradient from left to right, slightly 3D, with a shadow; pressed, it sinks in and springs
          back. Only while an explanation runs */}
      <button
        type="button"
        onClick={onTogglePause}
        disabled={!isAnimating}
        aria-pressed={paused}
        title={paused ? 'Go on from here' : 'Stop for a moment, exactly here'}
        className={`col-span-2 mt-1 flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-black uppercase tracking-[1.5px] text-white text-shadow-[0_1px_1px_rgba(0,0,0,0.45)] cursor-pointer transition-[transform,box-shadow,filter] duration-150 ease-out shadow-[inset_0_1px_0_rgba(255,255,255,0.45),inset_0_-2px_0_rgba(0,0,0,0.25),0_3px_0_rgba(0,0,0,0.45),0_6px_12px_rgba(0,0,0,0.35)] hover:brightness-110 active:translate-y-0.5 active:scale-[0.97] active:shadow-[inset_0_1px_0_rgba(255,255,255,0.3),inset_0_-1px_0_rgba(0,0,0,0.25),0_1px_0_rgba(0,0,0,0.45),0_2px_5px_rgba(0,0,0,0.35)] disabled:opacity-40 disabled:cursor-default disabled:hover:brightness-100 disabled:active:translate-y-0 disabled:active:scale-100 ${paused ? 'border-[#145c2a] bg-linear-[90deg,#1d7a3c_0%,#2a9a4e_35%,#4fbf6f_55%,#23864a_80%,#165f30_100%]' : 'border-[#7a5200] bg-linear-[90deg,#b07a00_0%,#d69a0a_35%,#f0bd3a_55%,#c88a00_80%,#946400_100%]'}`}
      >
        {paused ? (
          <svg viewBox="0 0 12 12" className="w-3 h-3" aria-hidden="true"><path d="M3 1.5 10.5 6 3 10.5z" fill="currentColor" /></svg>
        ) : (
          <svg viewBox="0 0 12 12" className="w-3 h-3" aria-hidden="true"><rect x="2.5" y="1.5" width="2.5" height="9" rx="0.6" fill="currentColor" /><rect x="7" y="1.5" width="2.5" height="9" rx="0.6" fill="currentColor" /></svg>
        )}
        {paused ? 'Resume' : 'Pause'}
      </button>
      {/* Division only: how the decimal points are moved before dividing (the grid's second row) */}
      {activeOp === 'division' ? (
        <div className="contents" role="group" aria-label="Decimal method">
          {([
            ['classic', 'CLASSIC', 'Move the decimal point by the divisor’s decimal places, so the divisor becomes a whole number'],
            ['equalize', 'EQUAL DECIMALS', 'Give both numbers the same number of decimal places, so both become whole numbers'],
          ] as [DivisionMethod, string, string][]).map(([m, label, hint]) => {
            const active = divisionMethod === m;
            return (
              <button
                type="button"
                key={m}
                disabled={isAnimating}
                title={hint}
                aria-pressed={active}
                onClick={() => chooseDivisionMethod(m)}
                className={`col-span-2 whitespace-nowrap px-2 py-1 rounded-lg text-xs font-bold border cursor-pointer transition-all hover:-translate-y-px hover:shadow-[0_0_10px_rgba(6,182,212,0.35)] disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:shadow-none ${active ? 'bg-cyan-500/10 border-cyan-500 text-cyan-500 hover:bg-cyan-500/20' : 'border-zinc-700 text-zinc-500 hover:border-cyan-700 hover:text-cyan-300'}`}
              >
                {label}
              </button>
            );
          })}
          {/* The result: with a remainder or with decimals (Julian), side by side */}
          {([
            ['remainder', 'REMAINDER', 'Stop at the units: the quotient is a whole number and what is left over is the remainder'],
            ['decimals', 'DECIMALS', 'Go on after the decimal point: the quotient gets up to 3 decimal places'],
          ] as [DivisionResult, string, string][]).map(([r, label, hint]) => {
            const active = effectiveDivisionResult === r;
            const locked = r === 'remainder' && numberTypes.division === 'float';
            return (
              <button
                type="button"
                key={r}
                disabled={isAnimating || locked}
                title={locked ? 'Numbers with decimals always give a result with decimals' : hint}
                aria-pressed={active}
                onClick={() => chooseDivisionResult(r)}
                className={`whitespace-nowrap px-2 py-1 rounded-lg text-xs font-bold border cursor-pointer transition-all hover:-translate-y-px hover:shadow-[0_0_10px_rgba(6,182,212,0.35)] disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:shadow-none mt-2 ${active ? 'bg-cyan-500/10 border-cyan-500 text-cyan-500 hover:bg-cyan-500/20' : 'border-zinc-700 text-zinc-500 hover:border-cyan-700 hover:text-cyan-300'}`}
              >
                {label}
              </button>
            );
          })}
        </div>
      ) : null}
      </div>
      {/* FLOAT: how many decimal places each number gets (0 to 4); 5px of extra space above */}
      {numberTypes[activeOp] === 'float' && (
        <div className="mt-1.25 flex flex-col gap-1.5" role="group" aria-label="Decimal places">
          {(['n1', 'n2'] as const).map(w => {
            const d = effectiveDecimals(w);
            const step = 'w-6.5 h-6.5 flex items-center justify-center rounded-lg border border-zinc-700 text-zinc-300 text-sm font-bold leading-none transition-all hover:-translate-y-px hover:border-cyan-700 hover:text-cyan-300 disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:border-zinc-700 disabled:hover:text-zinc-300';
            return (
              <div key={w} className="flex items-center gap-2">
                {/* 5px more between the label and the − button (mr-1.25 on top of the row's 8px gap) */}
                <span className={`w-22 shrink-0 mr-1.25 text-[8px] font-bold uppercase whitespace-nowrap ${w === 'n1' ? 'text-cyan-500' : 'text-pink-500'}`}>{w.toUpperCase()} Decimals</span>
                <button type="button" className={step} onClick={() => changeDecimals(w, -1)} disabled={isAnimating || d <= 0} aria-label={`Fewer decimal places in ${w.toUpperCase()}`}>−</button>
                <span className={`w-6.5 text-center text-xs font-bold ${w === 'n1' ? 'text-cyan-400' : 'text-pink-400'}`} aria-live="polite">{d}</span>
                <button type="button" className={step} onClick={() => changeDecimals(w, 1)} disabled={isAnimating || d >= 4} aria-label={`More decimal places in ${w.toUpperCase()}`}>+</button>
              </div>
            );
          })}
        </div>
      )}
      {/* The control band, when it doesn't fit on the title's row: under the controls, 20px apart (the 8px gap
          plus mt-3), exactly as wide as they are (w-0 min-w-full: it takes the column's width, never widens it). Phone: one row of three. From md up: Explain to Me on its own row,
          New Numbers and Stop under it */}
      {band}
    </div>
  );
}
