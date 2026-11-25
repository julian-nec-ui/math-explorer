"use client";

import { useEffect, useRef, type CSSProperties, type ReactElement } from 'react';
import { STEPS_STRIP, type StepsWindowState } from './useStepsWindow';

// The open / close arrow: a chevron whose arms are 120° apart, pointing where the window will go: beside the board
// < when closed (it opens to the left) and > when open (it closes to the right); under the board ˄ closed, ˅ open
const StepsChevron = ({ dir }: { dir: 'left' | 'right' | 'up' | 'down' }): ReactElement => (
  // Each arm 60° from the axis (8.5 up, 4.9 across), so the arms are 120° apart; the box is as tight as the stroke
  <svg viewBox="0 0 7.5 20" aria-hidden="true" className="w-[7.5px] h-5 overflow-visible" style={{ transform: `rotate(${{ left: 0, right: 180, up: 90, down: -90 }[dir]}deg)` }}>
    <path d="M6.2 1.5 1.3 10l4.9 8.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// Inline so the 3D look doesn't depend on how a Tailwind build handles long arbitrary values
// Explanation steps: #fb8c69 with a soft gradient from right (lighter) to left (deeper)
const STEP_TEXT: CSSProperties = {
  backgroundImage: 'linear-gradient(270deg, #fdbca6 0%, #fb8c69 50%, #d9653f 100%)',
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
};

// The step being explained now (the newest line) and its arrow: one plain colour (Julian)
const CURRENT_STEP = '#58c7fe';
const CURRENT_STEP_TEXT: CSSProperties = { color: CURRENT_STEP };
// The last line, "Done! Result = …" (the result of the explanation): three shades from left to right (Julian) — dark at
// the start (#1e958b), light in the middle (#2ad4c6), a little darker again at the end (a quarter of the way back to the
// dark one). Its arrow goes from the dark to the light one
export const RESULT_GRADIENT = ['#1e958b', '#2ad4c6', '#27c4b7'];
// …with a touch of white where it is lightest (Julian): a soft shine in the middle (the light shade, 65% towards white)
const RESULT_SHINE = '#b4f2ec';
const RESULT_STEP = 'url(#resultArrowGrad)';
const RESULT_STEP_TEXT: CSSProperties = {
  backgroundImage: `linear-gradient(90deg, ${RESULT_GRADIENT[0]} 0%, ${RESULT_GRADIENT[1]} 35%, ${RESULT_SHINE} 50%, ${RESULT_GRADIENT[1]} 65%, ${RESULT_GRADIENT[2]} 100%)`,
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
  fontWeight: 700,
};
// …and a little bigger than the other steps (its arrow grows with it: it is sized in em)
const RESULT_STEP_SIZE: CSSProperties = { fontSize: '1.25em' };

// Arrow head in front of each step (no shaft), about as tall as the capital letters (0.9em)
const StepArrow = ({ color }: { color?: string }): ReactElement => (
  <svg viewBox="0 0 10 12" className="mt-[0.35em] h-[0.9em] w-auto shrink-0" aria-hidden="true">
    <path d="M0 0 10 6 0 12z" fill={color ?? 'url(#stepArrowGrad)'} />
  </svg>
);

// Steps window: the history of the current computation (Step 1, Step 2, …), newest at the bottom and kept
// in view. Metallic green bevelled border on the top, right and bottom that thins out towards the left.
// On a phone it sticks to the bottom of the screen (with its own background), so the explanation stays
// in view while the board scrolls under it; on a very short screen (a phone held sideways) it is lower
export function StepsWindow({ sw, steps, status, isAnimating, ready, label }: { sw: StepsWindowState; steps: string[]; status: string; isAnimating: boolean; ready: boolean; label: string }): ReactElement {
  const { stepsUi, stepsSide, stepsDefaultW, stepsBoxRef, gripRef, placeGrip, toggleSteps, onStepsSlideEnd, saveSteps, startStepsResize } = sw;
  const stepsRef = useRef<HTMLDivElement>(null);
  // Keep the newest step in view as the history grows
  useEffect(() => {
    const el = stepsRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [steps.length]);
  return (
    <div
      ref={stepsBoxRef}
      onTransitionEnd={onStepsSlideEnd}
      className="sticky bottom-0 z-30 desk:relative desk:z-auto shrink-0 w-full h-40 [@media(max-height:30rem)]:h-24 desk:h-52 desk:lg:h-auto desk:lg:w-[30%] desk:lg:min-w-64 desk:lg:max-w-md rounded-r-2xl bg-[#15161e]/95 backdrop-blur-md desk:bg-transparent desk:backdrop-blur-none transition-[width,height] duration-600 ease-[cubic-bezier(0.22,1,0.36,1)]"
      // Closed: a thin strip. Resized: the width (beside the board) or the height (under it) that was dragged
      style={stepsSide
        ? (!stepsUi.open ? { width: STEPS_STRIP, minWidth: STEPS_STRIP } : stepsUi.w ? { width: stepsUi.w, minWidth: 200, maxWidth: '70vw' } : stepsDefaultW ? { width: stepsDefaultW, minWidth: 200, maxWidth: '70vw' } : undefined)
        : (!stepsUi.open ? { height: STEPS_STRIP } : stepsUi.h ? { height: stepsUi.h } : undefined)}
    >
      {/* Resize: drag the edge facing the board (the left edge beside it, the top edge under it) */}
      {stepsUi.open && (
        <div
          role="separator"
          aria-orientation={stepsSide ? 'vertical' : 'horizontal'}
          aria-label="Resize the explanation window"
          onPointerDown={startStepsResize}
          // Double click: back to the default size (beside the board: in line with the Addition tab)
          onDoubleClick={() => saveSteps(stepsSide ? { ...stepsUi, w: null } : { ...stepsUi, h: null })}
          // The grip mark follows the pointer along the edge, from the first moment and while dragging
          onPointerEnter={placeGrip}
          onPointerMove={placeGrip}
          className={`absolute z-20 touch-none ${stepsSide ? '-left-1.5 top-0 bottom-0 w-3 cursor-col-resize' : 'left-0 right-0 -top-1.5 h-3 cursor-row-resize'} group`}
        >
          {/* shown at once (no fade) on hover, and while the edge is being dragged. Beside the board: 2px right of the
              window's edge (Julian); the edge itself and the resizing are unchanged */}
          <span
            ref={gripRef}
            className={`absolute rounded-full bg-[#456175] opacity-0 group-hover:opacity-100 group-active:opacity-100 ${stepsSide ? 'left-[calc(50%+2px)] top-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-20' : 'top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2 h-1 w-20'}`}
          />
        </div>
      )}
      {/* Open / close: < and > beside the board, ˅ and ˄ under it */}
      <button
        type="button"
        onClick={toggleSteps}
        aria-expanded={stepsUi.open}
        aria-label={stepsUi.open ? 'Close the explanation window' : 'Open the explanation window'}
        title={stepsUi.open ? 'Close the explanation window' : 'Open the explanation window'}
        // Closed: the arrow 8px from the green border on the right (which is 3px wide) beside the board, 13px from the
        // edge under it (both 5px further in than at first, Julian); open: at the top left (beside) / top right (under)
        className={`absolute z-30 w-5 h-7 flex items-center ${stepsSide && !stepsUi.open ? 'justify-end' : 'justify-center'} rounded-md text-[#55b58e] hover:text-[#7fd6b0] hover:bg-white/5 cursor-pointer ${stepsSide ? (stepsUi.open ? 'top-2 left-1' : 'top-2 right-[13px]') : (stepsUi.open ? 'top-1 right-2' : 'top-1/2 -translate-y-1/2 right-[15px]')}`}
      >
        <StepsChevron dir={stepsSide ? (stepsUi.open ? 'right' : 'left') : (stepsUi.open ? 'down' : 'up')} />
      </button>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-r-2xl border-y-[3px] border-r-[3px] border-l-0 border-t-[#55b58e] border-r-[#42a07c] border-b-[#2f7f61] shadow-[inset_0_1px_0_rgba(255,255,255,0.18),inset_-1px_0_0_rgba(255,255,255,0.1),0_3px_8px_rgba(0,0,0,0.55)] mask-[linear-gradient(90deg,transparent_0%,black_35%)]"
      />
      {/* Closed (Julian): the window still shows, small, its latest line ("Ready to explain...", the step under way, the
          result) on one line — across the strip under the board, down the strip beside it; a click opens it */}
      {!stepsUi.open && (() => {
        const last = steps.length > 0 ? steps[steps.length - 1] : (status || (isAnimating ? '' : ready ? 'Ready to explain...' : `${label} is not available yet.`));
        const style = steps.length === 0 ? STEP_TEXT : last.startsWith('Done') ? { ...RESULT_STEP_TEXT, fontWeight: 600 } : CURRENT_STEP_TEXT;
        return last ? (
          <button
            type="button"
            onClick={toggleSteps}
            tabIndex={-1}
            aria-hidden="true"
            className={`absolute overflow-hidden whitespace-nowrap text-ellipsis text-left font-medium text-[11px] tracking-[1px] leading-none cursor-pointer ${stepsSide ? 'top-11 bottom-3 left-0 right-[3px] flex justify-start items-center [writing-mode:vertical-rl]' : 'inset-y-0 left-3 right-11 flex items-center'}`}
          >
            <span className="overflow-hidden text-ellipsis" style={style}>{last}</span>
          </button>
        ) : null;
      })()}
      <div
        ref={stepsRef}
        role="log"
        aria-live="polite"
        // Room for the open / close arrow: on the left beside the board, at the top under it
        className={`steps-scroll absolute inset-0 overflow-y-auto py-3 pr-4 font-medium text-[14px] tracking-[1px] md:text-[16px] md:tracking-[2px] lg:text-[17px] lg:tracking-[2.5px] leading-relaxed ${stepsUi.open ? '' : 'hidden'} ${stepsSide ? 'pl-8' : 'pl-2 pt-7'}`}
      >
        {steps.length > 0 ? (
          <ol className="space-y-0.5">
            {steps.map((line, i) => (
              <li key={i} className="flex items-start gap-2" style={line.startsWith('Done') ? RESULT_STEP_SIZE : undefined}>
                {(() => {
                  const result = line.startsWith('Done'), current = i === steps.length - 1;
                  return (
                    <>
                      <StepArrow color={result ? RESULT_STEP : current ? CURRENT_STEP : undefined} />
                      <span style={result ? RESULT_STEP_TEXT : current ? CURRENT_STEP_TEXT : STEP_TEXT}>{line}</span>
                    </>
                  );
                })()}
              </li>
            ))}
          </ol>
        ) : (
          <p style={STEP_TEXT}>
            {status || (isAnimating ? '' : ready ? 'Ready to explain...' : `${label} is not available yet.`)}
          </p>
        )}
      </div>
    </div>
  );
}
