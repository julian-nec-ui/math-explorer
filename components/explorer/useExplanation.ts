import { useRef, useState } from 'react';
import { pace, pauseAll, resumeAll, seekStart, seekEnd } from '../math/shared';
import { useElapsedTimer } from './useElapsedTimer';

// The explanation under way: its steps (numbered as they come), the status line, running / paused, the board's key
// (a reset remounts it) and run flag, and the elapsed-time counter
// (Julian) only after an earlier explanation (the counter not at 0); at 0 it starts at once
const START_DELAY_MS = 1000;

export function useExplanation() {
  const [status, setStatus] = useState('');
  // History of the explanation steps of the current computation, oldest first
  const [steps, setSteps] = useState<string[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);
  // Multiplication and division have their own boards. A reset remounts them (new key), and `boardRun` starts their animation.
  const [boardKey, setBoardKey] = useState(0);
  // Division: how the decimal points are moved before dividing (see DivisionBoard)
  // Step delay: which of STEP_DELAYS_MS (0, 0.5, 1, 1.5, 2 s) is added after each explanation step; remembered
  // Pause / Resume of a running explanation (see pauseAll in shared)
  const [paused, setPaused] = useState(false);
  const { elapsed, timerStart, timerHold, timerGo, timerReset, timerSet } = useElapsedTimer();
  // Prev / Next (Julian): the step to stop at while the explanation runs again / on without waiting (null: not seeking)
  const seekTarget = useRef<number | null>(null);
  const [seeking, setSeeking] = useState(false);
  // Prev from the first step (Julian): back to the very beginning, the board as before Explain to Me (nothing lit,
  // no work), still paused; Next (or Resume) starts the explanation from there
  const [atStart, setAtStart] = useState(false);
  const runFromStart = () => { setAtStart(false); setBoardKey(k => k + 1); setBoardRun(true); };
  const togglePause = () => {
    if (!isAnimating || seeking) return;
    if (paused && atStart) { setPaused(false); timerGo(); runFromStart(); return; }
    if (paused) { resumeAll(); setPaused(false); timerGo(); } else { pauseAll(); setPaused(true); timerHold(); }
  };
  const [boardRun, setBoardRun] = useState(false);

  // `keepBoard` keeps the board mounted (used while turning a digit's drum,
  // so the tuning wheel keeps its drag and the rolling digits can animate)
  // Numbered explanation steps: during a computation each new explanation is shown as "Step N: …"
  // (the final "Done!" message is left unnumbered). The counter restarts with every reset.
  const stepRef = useRef(0);
  const announce = (text: string) => {
    let line = text;
    if (!text.startsWith('Done')) {
      stepRef.current += 1;
      line = `Step ${stepRef.current}: ${text}`;
      // Prev / Next: here is the step wanted, the explanation stops at its start (paused)
      if (seekTarget.current !== null && stepRef.current >= seekTarget.current) {
        seekTarget.current = null;
        seekEnd();
        pauseAll();
        setPaused(true);
        setSeeking(false);
      }
    }
    setSteps(prev => [...prev, line]);
    setStatus(line);
    // Step delay: the board's next pause is longer by the chosen time
    if (!text.startsWith('Done')) pace.owed = pace.stepMs;
  };
  
  // Explain to Me waits START_DELAY_MS after clearing (see begin): a reset or Stop in that time cancels the start
  const startRef = useRef(0);
  const resetResult = (keepBoard = false) => {
    window.clearTimeout(startRef.current);
    if (seekTarget.current !== null) { seekTarget.current = null; seekEnd(); setSeeking(false); }
    setAtStart(false);
    setStatus(''); setIsAnimating(false);
    pace.owed = 0;
    // A paused explanation that is stopped or reset: everything runs again (the board is cleared anyway)
    resumeAll();
    setPaused(false);
    timerReset();
    stepRef.current = 0;
    setSteps([]);
    // A board that already ran still shows its old work, so it is remounted (cleared) even when keeping it
    if (!keepBoard || boardRun) setBoardKey(k => k + 1);
    setBoardRun(false);
  };

  const stopComputation = () => {
    if (!isAnimating) return;
    resetResult();
    setStatus('Computation stopped.');
  };

  // Explain to Me: a fresh explanation starts (the board runs it), with the counter from 0
  // (Julian) The board is cleared and the counter set to 0 at once; the explanation and the counter start
  // START_DELAY_MS later, so the fresh start can be seen. With the counter already at 0 (nothing was explained yet)
  // there is nothing to clear, so it starts at once
  const begin = () => {
    const wait = elapsed > 0;
    resetResult();
    setIsAnimating(true);
    const start = () => {
      // (a fresh board, made with run = true: some boards read `run` only when they are made)
      setBoardKey(k => k + 1);
      setBoardRun(true);
      timerStart();
    };
    if (wait) startRef.current = window.setTimeout(start, START_DELAY_MS);
    else start();
  };
  // The board finished its explanation
  // (a Next that ran past the last step: the explanation is simply finished)
  const finish = () => {
    if (seekTarget.current !== null) { seekTarget.current = null; seekEnd(); setSeeking(false); setPaused(false); }
    timerHold(); setIsAnimating(false);
  };

  // Prev / Next (Julian): while paused, or when the explanation is finished, one step back (run again from the start,
  // without waiting, up to the start of the step before: so a child can go back) or on (to the start of the next one).
  // There it stays paused: Resume goes on normally from there. The counter keeps what it showed
  const numbered = steps.filter(l => l.startsWith('Step ')).length;
  const finished = !isAnimating && boardRun && numbered > 0;
  // (Julian) clickable only once the explanation is finished, or while it is paused; otherwise (running, before one,
  // after Stop) not
  const canPrev = !seeking && ((isAnimating && paused && !atStart && numbered > 0) || finished);
  const canNext = !seeking && isAnimating && paused;
  const prevStep = () => {
    if (!canPrev) return;
    const target = finished ? numbered : numbered - 1;
    const keep = elapsed;
    resetResult();
    timerSet(keep);
    setIsAnimating(true);
    setPaused(true);
    if (target < 1) { setAtStart(true); return; }
    seekTarget.current = target;
    setSeeking(true);
    seekStart();
    // (a fresh board, made with run = true, as in begin)
    setBoardKey(k => k + 1);
    setBoardRun(true);
  };
  const nextStep = () => {
    if (!canNext) return;
    seekTarget.current = stepRef.current + 1;
    setSeeking(true);
    seekStart();
    if (atStart) runFromStart();
    else resumeAll();
  };

  return { status, setStatus, steps, isAnimating, boardKey, boardRun, paused, elapsed, togglePause, announce, resetResult, stopComputation, begin, finish, canPrev, canNext, prevStep, nextStep, seeking };
}
