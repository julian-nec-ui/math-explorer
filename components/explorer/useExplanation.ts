import { useRef, useState } from 'react';
import { pace, pauseAll, resumeAll } from '../math/shared';
import { useElapsedTimer } from './useElapsedTimer';

// The explanation under way: its steps (numbered as they come), the status line, running / paused, the board's key
// (a reset remounts it) and run flag, and the elapsed-time counter
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
  
  const resetResult = (keepBoard = false) => {
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

  // Redo: back to the problem exactly as it was entered (signs and all), clearing the explanation and any rewrite
  const hasWork = isAnimating || steps.length > 0 || boardRun;

  const stopComputation = () => {
    if (!isAnimating) return;
    resetResult();
    setStatus('Computation stopped.');
  };

  // Explain to Me: a fresh explanation starts (the board runs it), with the counter from 0
  const begin = () => {
    resetResult();
    setIsAnimating(true);
    setBoardRun(true);
    timerStart();
  };
  // The board finished its explanation
  const finish = () => { timerHold(); setIsAnimating(false); };

  return { status, setStatus, steps, isAnimating, boardKey, boardRun, paused, elapsed, togglePause, announce, resetResult, hasWork, stopComputation, begin, finish };
}
