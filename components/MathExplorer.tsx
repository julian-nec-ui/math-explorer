"use client";

// The page: header (title, control band, operation tabs), the controls column, the board area and the steps window.
// The parts live in ./explorer: the problem (useProblem), the explanation (useExplanation), the steps window
// (useStepsWindow, StepsWindow), the header (Title, OperationTabs, ActionButtons), the controls (ControlsColumn), the
// board's frame (BoardView) and the measurements that place them (useLayoutMeasures)

import { useEffect, useLayoutEffect, useRef, useState, type ReactElement } from 'react';
import { DigitDrums, DrumLayer, useGrownLock, FRAC_PARTS, cleanNumber, numberValue, useCellSize, type DigitDrumsValue, type FractionParts } from './math/shared';
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
import { ModeToggle, type Mode } from './explorer/ModeToggle';
import { TestWindow } from './explorer/TestWindow';
import { AdditionTestView } from './testing/AdditionTest';
import { useAdditionTest } from './testing/useAdditionTest';
import { useExplanation } from './explorer/useExplanation';
import { useColBottom, useHeaderBand, usePageRoom, useScrollFollow, useTimerGap, useViewSize } from './explorer/useLayoutMeasures';
import { useProblem } from './explorer/useProblem';
import { useStepDelay } from './explorer/useStepDelay';
import { useStepsWindow } from './explorer/useStepsWindow';

// A phone held upright in testing mode (Julian): the panel is exactly the screen's height and the test frame fills what
// is left under the controls, so nothing scrolls and its closed "Ready to test..." strip stays on the screen
const PHONE_TEST_FIT = (testing: boolean, cls: string): string => (testing ? cls : '');

// Every operation's name (the test frame keeps clear of the widest title)
const OP_LABELS = OPERATIONS.map(o => o.label);

export default function MathExplorer(): ReactElement {
  const x = useExplanation();
  const { isAnimating } = x;
  const problem = useProblem({ isAnimating, resetResult: x.resetResult });
  const { activeOp, num1, num2, fracParts } = problem;
  const { stepDelay, setStepDelay } = useStepDelay();
  // Learning mode / testing mode (Julian). Testing: no operation tabs, no Explain to Me / New Numbers / Stop, no numbers
  // on the board (a test window instead); the title, the steps window and the controls column stay (Prev / Next off
  // until a test is over)
  const [mode, setMode] = useState<Mode>('learning');
  const testing = mode === 'testing';
  // (switching clears what the last explanation left: its steps, the counter, the board)
  // Back to learning (Julian): the test frame doesn't vanish at once, it closes towards the right and fades (TestWindow
  // `leaving`), over the board that is already back; then it is gone
  // The addition test (Julian; the other operations: later). A fresh test (setup) each time testing mode is entered or
  // the operation changes
  const test = useAdditionTest();
  const testOp = activeOp === 'addition';
  const resetTest = test.reset;
  useEffect(() => { if (testing) resetTest(); }, [testing, activeOp, resetTest]);
  const testContent = testOp ? <AdditionTestView t={test} /> : undefined;
  // A test under way (Julian, phone): the frame covers the panel, which is then exactly the visible height whichever way
  // the screen is — with the keyboard open a phone held upright is wider than tall ("landscape" for media queries)
  const testCover = testOp && test.phase === 'running';
  const [testLeaving, setTestLeaving] = useState(false);
  // …and learning comes in (Julian): nothing of it shows at first; when the frame is half closed, the numbers fade in
  // exactly where they will stay ("f": they don't move — the board places its digits from measured positions, a moving
  // area would put them off and they would jump back at the end), what is on the left (step delay, Pause, …) slides in
  // slowly from the left and what is on the right (the tabs, the steps
  // window) from the right, fading in, while the frame fades away. `entering`: the panel's data-entering, and each
  // [data-enter] element gets its side (data-enter-dir: "l" given, or by where its centre is in the panel); the slide
  // itself is CSS (PageStyles: enterFromLeft / enterFromRight)
  const [entering, setEntering] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const changeMode = (m: Mode) => {
    x.resetResult();
    const back = mode === 'testing' && m === 'learning';
    setTestLeaving(back);
    setEntering(back);
    setMode(m);
  };
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!entering || !panel) return;
    const p = panel.getBoundingClientRect();
    const mid = p.left + p.width / 2;
    const els = [...panel.querySelectorAll<HTMLElement>('[data-enter]')];
    for (const el of els) {
      const r = el.getBoundingClientRect();
      el.dataset.enterDir = ['l', 'r', 'f'].includes(el.dataset.enter ?? '') ? el.dataset.enter : r.left + r.width / 2 < mid - 1 ? 'l' : 'r';
    }
    // done (0.75s wait + 0.75s slide = 1.5s, as long as the frame's own entrance and exit, Julian): measured layouts that saw the moving boxes measure again
    const id = window.setTimeout(() => { setEntering(false); window.dispatchEvent(new Event('resize')); }, 1700);
    return () => { window.clearTimeout(id); for (const el of els) delete el.dataset.enterDir; };
  }, [entering]);

  // Header: from lg up the control band stays on the title's row while it fits (see useHeaderBand)
  const headerRef = useRef<HTMLDivElement>(null);
  const titleSlotRef = useRef<HTMLDivElement>(null);
  const bandRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLElement>(null);
  const bandInline = useHeaderBand(headerRef, titleSlotRef, bandRef, tabsRef);

  const viewRef = useRef<HTMLDivElement>(null);
  const { viewWidth, viewHeight } = useViewSize(viewRef);
  const sw = useStepsWindow(tabsRef, viewWidth, testing);
  const { stepsUi, stepsExtra, frozenViewW, onNaturalWidth, closedCentred, smoothFit } = sw;
  // The width the boards lay themselves out for
  const boardViewW = frozenViewW ?? viewWidth;
  useScrollFollow(viewRef, isAnimating);

  const activeConfig = OPERATIONS.find(o => o.id === activeOp) ?? OPERATIONS[0];
  // An operation is ready once it has a board
  const ready = !!activeConfig.board;
  // Numbers that can't be explained (a fraction with the denominator 0): Explain to Me stays disabled, with
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

  // (Julian) phone: a digit or a drum grown to be turned: the three buttons are off meanwhile (see setGrown)
  const grownLock = useGrownLock();
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
      locked={grownLock}
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
    <div className="min-h-dvh bg-zinc-950 text-zinc-100 flex flex-col md:flex-row font-sans">
      {/* min-h-dvh, not min-h-screen (Julian's phone): on a real phone 100vh is the height with the browser's address bar
          hidden, taller than what is shown; the panel (min-h-dvh) was centred in it, leaving a dark gap above it. And on a
          phone / tablet the panel starts at the top (justify-start) */}
      <PageStyles />

      <main className="flex-1 min-w-0 desk:py-[1.5vh] flex flex-col items-center justify-start desk:justify-center">
        <div className="w-full desk:w-[99vw]">
          {/* Panel, background #15161e with a discreet gradient of close shades.
              Phone (also held sideways): fills the screen edge to edge and the page scrolls (header, board, then the steps);
              no padding at the bottom, so the steps window sits on the screen's bottom edge, open or closed (Julian).
              The panel's rounded border shows on a phone too, its top at the screen's top and its bottom at the screen's
              bottom (min-h-dvh, border included): the page only scrolls when the content is taller (Julian).
              Tablet and desktop (`desk`: at least 48rem wide and 37.5rem tall, see globals.css): 99% of the screen width
              and 97% of its height; the board scrolls inside the middle area */}
          <div ref={panelRef} data-panel data-entering={entering || undefined} className={`${PHONE_TEST_FIT(testing, 'max-md:portrait:h-dvh max-md:portrait:overflow-hidden')} ${testCover ? 'max-md:h-dvh max-md:overflow-hidden' : ''} relative min-h-dvh desk:min-h-0 desk:h-[97vh] flex flex-col gap-3 2xl:gap-0 bg-linear-to-br from-[#191a23] via-[#15161e] to-[#111219] border-zinc-800 border rounded-2xl phone:overflow-clip p-3 sm:p-5 md:p-6 lg:p-8 md:pr-2.5 lg:pr-2.5 land:pt-3! phone:pb-0! backdrop-blur-xl shadow-2xl`}>
            {/* 3D title (same for every operation): metallic light-to-shade gradient on the letters, an extruded
                edge built from stacked 1px shadows that get darker downwards, and a soft cast shadow. Raised 5px */}
            {/* Header. The operation tabs always keep the same look (one row, full names) at the top right.
                From lg up: title, control band and tabs on one row while they fit (`bandInline`, measured above).
                Otherwise (narrower desktop, tablet, phone): title and tabs here, and the control band in the controls column */}
            <div ref={headerRef} className={`relative shrink-0 flex flex-wrap ${bandInline ? 'lg:flex-nowrap' : ''} items-center justify-between gap-x-4 gap-y-3`}>
            <Title slotRef={titleSlotRef} titleRef={titleRef} label={activeConfig.label} color={activeConfig.color} under={<ModeToggle mode={mode} onChange={changeMode} disabled={isAnimating} />} />
          {/* Control band: Explain to Me, New Numbers and Stop on their own background, with the same padding on both sides.
              On the title's row while it fits there (from lg up, `bandInline`). Otherwise it moves into the controls column,
              under INTEGER / FLOAT (see below); this copy then stays invisible and out of the way,
              only so its width can still be measured */}
            <div ref={bandRef} data-enter aria-hidden={!bandInline || testing || undefined} inert={!bandInline || testing} className={`${bandInline ? `lg:order-2 ${testing ? 'invisible' : ''}` : 'invisible absolute top-0 left-0 pointer-events-none'} shrink-0 flex items-center bg-zinc-800/50 px-3 py-2 rounded-2xl border border-zinc-700`}>
              <div className="flex items-center gap-2.5">
                {actions(false)}
              </div>
            </div>
            <OperationTabs navRef={tabsRef} activeOp={activeOp} color={activeConfig.color} isAnimating={isAnimating} bandInline={bandInline} onSelect={problem.selectOp} hidden={testing} />
            </div>
            {/* Middle area. Desk (tall enough) and lg up: the board on the left keeps its full height and the steps window
                sits on the right. Otherwise: the board on top and the steps window under it, full width */}
            {/* (desk: room for the learning / testing switch hanging under the title, 20px under it, and as much again under
                the switch: everything below moves down by that much, Julian) */}
            <div className={`flex flex-col gap-3 flex-1 desk:min-h-0 desk:mt-[2.875rem] desk:lg:flex-row desk:lg:gap-0.5 ${PHONE_TEST_FIT(testing, 'max-md:portrait:min-h-0')}`}>
            <div className="relative flex flex-col md:flex-row flex-1 min-w-0 min-h-0" style={colBottom && !testing ? { minHeight: colBottom } : undefined}>
              <ControlsColumn
                colRef={colRef}
                cell={cell}
                timerGap={timerGap}
                elapsed={testing ? (testOp ? test.elapsed : 0) : x.elapsed}
                problem={problem}
                isAnimating={isAnimating}
                paused={x.paused}
                stepDelay={stepDelay}
                setStepDelay={setStepDelay}
                onTogglePause={x.togglePause}
                canPrev={testing ? testOp && test.canPrev : x.canPrev}
                canNext={testing ? testOp && test.canNext : x.canNext}
                onPrev={testing ? test.prev : x.prevStep}
                onNext={testing ? test.next : x.nextStep}
                seeking={x.seeking}
                testing={testing}
                band={bandInline || testing ? null : (
                  <div data-enter className="phone:-mt-[0.5px] desk:mt-3 w-0 min-w-full bg-zinc-800/50 px-3 py-2.5 desk:py-2 rounded-2xl border border-zinc-700 phone:bg-transparent phone:border-0 phone:p-0 phone:rounded-none">
                    {/* (Julian) on a phone no box: three separate buttons, 7.5px under Pause / Prev / Next (half the 15px it was), Explain to
                        Me under Pause's left edge, Stop ending under the Fractions tab, equal gaps between them; the board under it follows */}
                    <div className="grid grid-cols-3 desk:grid-cols-2 gap-2 phone:flex phone:justify-between">
                      {actions(true)}
                    </div>
                  </div>
                )}
              />
            {/* From md up, left padding = the width of the Integer / Float buttons (and, in division, the decimal
                method under them), so wide numbers never run into them.
                Numbers wider than the screen scroll sideways */}
            {/* steps-scroll: the same 8px #456175 scrollbars as the steps window */}
            {/* A phone (narrower than md): the area reaches as far left as the controls column (EDGE_5), so the digit-count
                drums, in line with INTEGER / Pause / Explain to Me, aren't cut by its edge (Julian). Held sideways: it is as
                tall as its board (bigger there, see usePhoneSide; pb-5: room for what the scaled board draws below its box, none
                in testing: the test frame keeps 3px to the bottom, Julian; and in testing under md it reaches over the panel's
                right padding (p-3 / sm:p-5), so the frame ends 3px from the panel's edge, like on desktop) and
                doesn't scroll itself (the rows kept for later in multiplication / division would make it): the page scrolls */}
            <div ref={viewRef} data-enter="f" className={`steps-scroll relative flex-1 min-w-0 min-h-0 overflow-auto flex md:pl-60 md:-mt-[0.5625rem] land:pl-[23.5rem]! max-md:-ml-[0.125rem] max-md:pl-[0.125rem] sm:max-md:-ml-[0.625rem] sm:max-md:pl-[0.625rem] max-md:landscape:min-h-fit max-md:landscape:pb-5 max-md:landscape:overflow-visible ${testing ? 'max-md:landscape:pb-0! overflow-hidden! max-md:-mr-3 sm:max-md:-mr-5' : ''}`}>
              {/* The active operation's board (see operations/registry). Multiplication and division sit in a padded frame and
                  start near the top of the panel, just below the title, at the same height for every operation */}
              {testing ? (
                <TestWindow label={activeConfig.label} color={activeConfig.color} labels={OP_LABELS} content={testContent} cover={testCover}>
                  {/* Testing (Julian): the explanation window inside the test frame */}
                  <StepsWindow sw={sw} steps={testOp ? test.log : []} status="" isAnimating={false} ready label={activeConfig.label} idle="Ready to test..." inFrame />
                </TestWindow>
              ) : (
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
              )}
              {!testing && testLeaving && (
                <TestWindow label={activeConfig.label} color={activeConfig.color} labels={OP_LABELS} content={testContent} leaving onLeft={() => setTestLeaving(false)} />
              )}
            </div>

            </div>
            {!testing && <StepsWindow sw={sw} steps={x.steps} status={x.status} isAnimating={isAnimating} ready={ready} label={activeConfig.label} />}
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}
