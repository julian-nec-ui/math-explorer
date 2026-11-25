"use client";

// The page: header (title, control band, operation tabs), the controls column, the board area and the steps window.
// The parts live in ./explorer: the problem (useProblem), the explanation (useExplanation), the steps window
// (useStepsWindow, StepsWindow), the header (Title, OperationTabs, ActionButtons), the controls (ControlsColumn), the
// board's frame (BoardView) and the measurements that place them (useLayoutMeasures)

import { useRef, type ReactElement } from 'react';
import { DigitDrums, DrumLayer, FRAC_PARTS, cleanNumber, numberValue, useCellSize, type DigitDrumsValue, type FractionParts } from './math/shared';
import { OPERATIONS } from './operations/registry';
import { ActionButtons } from './explorer/ActionButtons';
import { BoardView } from './explorer/BoardView';
import { FRACTION_LABELS, FRACTION_MAX_DIGITS } from './explorer/problem';
import { ControlsColumn } from './explorer/ControlsColumn';
import { OperationTabs } from './explorer/OperationTabs';
import { PageStyles } from './explorer/PageStyles';
import { SignButton } from './explorer/SignButton';
import { StepsWindow } from './explorer/StepsWindow';
import { Title } from './explorer/Title';
import { useExplanation } from './explorer/useExplanation';
import { useColBottom, useHeaderBand, usePageRoom, useScrollFollow, useTimerGap, useViewSize } from './explorer/useLayoutMeasures';
import { useProblem } from './explorer/useProblem';
import { useStepDelay } from './explorer/useStepDelay';
import { useStepsWindow } from './explorer/useStepsWindow';

export default function MathExplorer(): ReactElement {
  const x = useExplanation();
  const { isAnimating } = x;
  const problem = useProblem({ isAnimating, resetResult: x.resetResult });
  const { activeOp, num1, num2, fracParts } = problem;
  const { stepDelay, setStepDelay } = useStepDelay();

  // Header: from lg up the control band stays on the title's row while it fits (see useHeaderBand)
  const headerRef = useRef<HTMLDivElement>(null);
  const titleSlotRef = useRef<HTMLDivElement>(null);
  const bandRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLElement>(null);
  const bandInline = useHeaderBand(headerRef, titleSlotRef, bandRef, tabsRef);

  const viewRef = useRef<HTMLDivElement>(null);
  const { viewWidth, viewHeight } = useViewSize(viewRef);
  const sw = useStepsWindow(tabsRef, viewWidth);
  const { stepsUi, stepsExtra, frozenViewW, onNaturalWidth, closedCentred, smoothFit } = sw;
  // The width the boards lay themselves out for
  const boardViewW = frozenViewW ?? viewWidth;
  useScrollFollow(viewRef, isAnimating);

  const activeConfig = OPERATIONS.find(o => o.id === activeOp) ?? OPERATIONS[0];
  // An operation is ready once it has a board
  const ready = !!activeConfig.board;
  // Numbers that can't be explained (a fraction with the denominator 0): Explain to Me and Redo stay disabled, with
  // the reason as their tooltip, until the numbers change
  const blocked = activeConfig.blocked?.({ num1, num2, fraction: fracParts }) ?? null;

  // Digit cell size (px), for placing the controls column next to the first operand
  const cell = useCellSize();
  // From md up the controls column floats over the board area (absolute), so the area is kept at least as tall as the column
  const colRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const timerGap = useTimerGap(titleRef, colRef, activeOp, cell);
  const { leftRoom, pageMidX } = usePageRoom(viewRef, colRef);
  const colBottom = useColBottom(colRef, cell);

  // Redo: back to the problem exactly as it was entered (signs and all), clearing the explanation and any rewrite
  const redo = () => {
    if (!x.hasWork || blocked) return;
    x.resetResult();
  };

  const startAnimation = () => {
    if (isAnimating || !ready || blocked || num1.digits.length === 0 || num2.digits.length === 0) return;
    
    const [, b] = problem.cleanOperands();
    // Fractions: leading zeros left by the drums go too (007 → 7), and the sliders follow the new lengths
    if (activeOp === 'fractions') {
      const cleaned = Object.fromEntries(FRAC_PARTS.map(k => [k, cleanNumber(fracParts[k])])) as FractionParts;
      problem.setFracParts(cleaned);
      problem.setFracCounts({ n1: cleaned.n1.digits.length, d1: cleaned.d1.digits.length, n2: cleaned.n2.digits.length, d2: cleaned.d2.digits.length });
    }
    if (activeOp === 'division' && numberValue(b) === 0) {
      x.setStatus('We can’t divide by zero. Change N2 first.');
      return;
    }
    // The active board runs its own explanation (see operations/registry)
    x.begin();
  };

  const explainLabel = isAnimating ? 'Processing...' : ready ? 'Explain to Me' : 'Coming soon';
  const actions = (wide: boolean) => (
    <ActionButtons
      wide={wide}
      label={explainLabel}
      busy={isAnimating}
      explainDisabled={isAnimating || !ready || !!blocked}
      title={blocked ?? undefined}
      onExplain={startAnimation}
      onNew={() => problem.regenerate(problem.digitCounts[activeOp].n1, problem.digitCounts[activeOp].n2, problem.numberTypes[activeOp])}
      onStop={x.stopComputation}
    />
  );

  const board = activeConfig.board?.({
    num1,
    num2,
    run: x.boardRun,
    onStatus: x.announce,
    onDone: x.finish,
    renderSign: (which, sign) => <SignButton which={which} sign={sign} disabled={isAnimating} onToggle={problem.toggleSign} />,
    onCycleDigit: problem.cycleDigit,
    hoverEdit: !isAnimating,
    availableWidth: Math.max(0, boardViewW - 16),
    smoothFit,
    availableHeight: viewHeight,
    stepsExtra,
    leftRoom,
    // centred on the page when closed only if the open window pushed the digits (see toggleSteps)
    stepsClosed: !stepsUi.open && closedCentred,
    onNaturalWidth,
    pageMidX,
    boardKey: x.boardKey,
    divisionMethod: problem.divisionMethod,
    divisionResult: problem.effectiveDivisionResult,
    fraction: fracParts,
    onCycleFractionDigit: problem.cycleFractionDigit,
  });

  // The digit-count drums, drawn on the board next to each number (see OperandDrum)
  const drums: DigitDrumsValue = activeOp === 'fractions'
    ? { value: k => problem.fracCounts[k], max: FRACTION_MAX_DIGITS, set: problem.handleFracCountChange, disabled: isAnimating, label: k => FRACTION_LABELS[k], parts: ['n1', 'd1', 'n2', 'd2'] }
    : { value: k => problem.digitCounts[activeOp][k === 'n1' || k === 'd1' ? 'n1' : 'n2'], max: 12, set: (k, v) => problem.handleDigitCountChange(k === 'n1' || k === 'd1' ? 'n1' : 'n2', v), disabled: isAnimating, label: k => `${k.toUpperCase()} Digits`, parts: ['n1', 'n2'] };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col md:flex-row font-sans">
      <PageStyles />

      <main className="flex-1 min-w-0 desk:py-[1.5vh] flex flex-col items-center justify-center">
        <div className="w-full desk:w-[99vw]">
          {/* Panel, background #15161e with a discreet gradient of close shades.
              Phone (also held sideways): fills the screen edge to edge and the page scrolls (header, board, then the steps);
              no padding at the bottom, so the steps window sits on the screen's bottom edge, open or closed (Julian).
              Tablet and desktop (`desk`: at least 48rem wide and 37.5rem tall, see globals.css): 99% of the screen width
              and 97% of its height; the board scrolls inside the middle area */}
          <div className="min-h-dvh desk:min-h-0 desk:h-[97vh] flex flex-col gap-3 2xl:gap-0 bg-linear-to-br from-[#191a23] via-[#15161e] to-[#111219] border-zinc-800 desk:border desk:rounded-3xl p-3 sm:p-5 md:p-6 lg:p-8 md:pr-2.5 lg:pr-2.5 phone:pb-0! backdrop-blur-xl shadow-2xl">
            {/* 3D title (same for every operation): metallic light-to-shade gradient on the letters, an extruded
                edge built from stacked 1px shadows that get darker downwards, and a soft cast shadow. Raised 5px */}
            {/* Header. The operation tabs always keep the same look (one row, full names) at the top right.
                From lg up: title, control band and tabs on one row while they fit (`bandInline`, measured above).
                Otherwise (narrower desktop, tablet, phone): title and tabs here, and the control band in the controls column */}
            <div ref={headerRef} className={`relative shrink-0 flex flex-wrap ${bandInline ? 'lg:flex-nowrap' : ''} items-center justify-between gap-x-4 gap-y-3`}>
            <Title slotRef={titleSlotRef} titleRef={titleRef} label={activeConfig.label} color={activeConfig.color} />
          {/* Control band: Explain to Me, New Numbers and Stop on their own background, with the same padding on both sides.
              On the title's row while it fits there (from lg up, `bandInline`). Otherwise it moves into the controls column,
              under the sliders and INTEGER / FLOAT / Redo (see below); this copy then stays invisible and out of the way,
              only so its width can still be measured */}
            <div ref={bandRef} aria-hidden={!bandInline || undefined} inert={!bandInline} className={`${bandInline ? 'lg:order-2' : 'invisible absolute top-0 left-0 pointer-events-none'} shrink-0 flex items-center bg-zinc-800/50 px-3 py-2 rounded-2xl border border-zinc-700`}>
              <div className="flex items-center gap-2.5">
                {actions(false)}
              </div>
            </div>
            <OperationTabs navRef={tabsRef} activeOp={activeOp} color={activeConfig.color} isAnimating={isAnimating} bandInline={bandInline} onSelect={problem.selectOp} />
            </div>
            {/* Middle area. Desk (tall enough) and lg up: the board on the left keeps its full height and the steps window
                sits on the right. Otherwise: the board on top and the steps window under it, full width */}
            <div className="flex flex-col gap-3 flex-1 desk:min-h-0 desk:lg:flex-row desk:lg:gap-0.5">
            <div className="relative flex flex-col md:flex-row flex-1 min-w-0 min-h-0" style={colBottom ? { minHeight: colBottom } : undefined}>
              <ControlsColumn
                colRef={colRef}
                cell={cell}
                timerGap={timerGap}
                elapsed={x.elapsed}
                problem={problem}
                isAnimating={isAnimating}
                paused={x.paused}
                hasWork={x.hasWork}
                blocked={blocked}
                stepDelay={stepDelay}
                setStepDelay={setStepDelay}
                onRedo={redo}
                onTogglePause={x.togglePause}
                band={bandInline ? null : (
                  <div className="mt-3 w-0 min-w-full bg-zinc-800/50 px-3 py-2.5 md:py-2 rounded-2xl border border-zinc-700">
                    <div className="grid grid-cols-3 md:grid-cols-2 gap-2">
                      {actions(true)}
                    </div>
                  </div>
                )}
              />
            {/* From md up, left padding = the width of the Integer / Float / Redo buttons (and, in division, the decimal
                method under them), so wide numbers never run into them.
                Numbers wider than the screen scroll sideways */}
            {/* steps-scroll: the same 8px #456175 scrollbars as the steps window */}
            <div ref={viewRef} className="steps-scroll relative flex-1 min-w-0 min-h-0 overflow-auto flex md:pl-60 md:-mt-[0.5625rem]">
              {/* The active operation's board (see operations/registry). Multiplication and division sit in a padded frame and
                  start near the top of the panel, just below the title, at the same height for every operation */}
              <DigitDrums.Provider value={drums}>
              <BoardView
                activeOp={activeOp}
                framed={!!activeConfig.framed}
                board={board}
                boardViewW={boardViewW}
                viewHeight={viewHeight}
                smoothFit={smoothFit}
                onNaturalWidth={onNaturalWidth}
                leftRoom={leftRoom}
                stepsClosed={!stepsUi.open && closedCentred}
                pageMidX={pageMidX}
                longest={Math.max(num1.digits.length, num2.digits.length)}
              />
              {/* The digit-count drums, made once and drawn over their places on the board (see OperandDrum) */}
              <DrumLayer host={viewRef} />
              </DigitDrums.Provider>
            </div>

            </div>
            <StepsWindow sw={sw} steps={x.steps} status={x.status} isAnimating={isAnimating} ready={ready} label={activeConfig.label} />
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
