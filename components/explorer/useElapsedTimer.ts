import { useEffect, useRef, useState } from 'react';

// Elapsed time of the explanation (Julian): from Explain to Me to the end; it stops while paused and goes on at Resume;
// Stop (and anything that clears the board) sets it back to 0. `acc`: the time counted so far, `start`: when the
// current stretch began (null: not counting)
export function useElapsedTimer() {
  const timer = useRef<{ acc: number; start: number | null }>({ acc: 0, start: null });
  const [elapsed, setElapsed] = useState(0);
  const [timing, setTiming] = useState(false);
  const timerStart = () => { timer.current = { acc: 0, start: performance.now() }; setElapsed(0); setTiming(true); };
  const timerHold = () => {
    const t = timer.current;
    if (t.start !== null) { t.acc += performance.now() - t.start; t.start = null; }
    setElapsed(t.acc); setTiming(false);
  };
  const timerGo = () => { if (timer.current.start === null) { timer.current.start = performance.now(); setTiming(true); } };
  const timerReset = () => { timer.current = { acc: 0, start: null }; setElapsed(0); setTiming(false); };
  useEffect(() => {
    if (!timing) return;
    const id = window.setInterval(() => {
      const t = timer.current;
      setElapsed(t.acc + (t.start !== null ? performance.now() - t.start : 0));
    }, 50);
    return () => window.clearInterval(id);
  }, [timing]);
  return { elapsed, timerStart, timerHold, timerGo, timerReset };
}
