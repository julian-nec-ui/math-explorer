import { useRef, useState } from 'react';
import { pace, pauseAll, resumeAll } from '../math/shared';
import { useElapsedTimer } from './useElapsedTimer';

// The explanation under way: its steps (numbered as they come), the status line, running / paused, the board's key
// (a reset remounts it) and run flag, and the elapsed-time counter
const START_DELAY_MS = 150;

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
  const { elapsed, timerStart, timerHold, timerGo, timerReset } = useElapsedTimer();
  const togglePause = () => {
    if (!isAnimating) return;
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
  // START_DELAY_MS later, so the fresh start can be seen
  const begin = () => {
    resetResult();
    setIsAnimating(true);
    startRef.current = window.setTimeout(() => {
      // (a fresh board, made with run = true: some boards read `run` only when they are made)
      setBoardKey(k => k + 1);
      setBoardRun(true);
      timerStart();
    }, START_DELAY_MS);
  };
  // The board finished its explanation
  const finish = () => { timerHold(); setIsAnimating(false); };

  return { status, setStatus, steps, isAnimating, boardKey, boardRun, paused, elapsed, togglePause, announce, resetResult, stopComputation, begin, finish };
}
