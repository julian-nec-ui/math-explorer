import { useEffect, useRef, useState } from 'react';
import { nav } from '../math/shared';

// Elapsed time of the explanation (Julian): from Explain to Me to the end; it stops while paused and goes on at Resume;
// Stop (and anything that clears the board) sets it back to 0. `acc`: the time counted so far, `start`: when the
// current stretch began (null: not counting)
export function useElapsedTimer() {
  const timer = useRef<{ acc: number; start: number | null }>({ acc: 0, start: null });
  const [elapsed, setElapsed] = useState(0);
  const [timing, setTiming] = useState(false);
  // (Prev / Next: the explanation reads the clock as it goes, see nav.timeAt)
  nav.clock = () => { const t = timer.current; return t.acc + (t.start !== null ? performance.now() - t.start : 0); };
  nav.timing = timing;
  const timerStart = () => { timer.current = { acc: 0, start: performance.now() }; nav.timing = true; setElapsed(0); setTiming(true); };
  const timerHold = () => {
    const t = timer.current;
    if (t.start !== null) { t.acc += performance.now() - t.start; t.start = null; }
    nav.timing = false;
    setElapsed(t.acc); setTiming(false);
  };
  const timerGo = () => { if (timer.current.start === null) { timer.current.start = performance.now(); nav.timing = true; setTiming(true); } };
  const timerReset = () => { timer.current = { acc: 0, start: null }; nav.timing = false; setElapsed(0); setTiming(false); };
  // (Prev: the explanation is run again from the start, the counter keeps what it showed, stopped)
  const timerSet = (ms: number) => { timer.current = { acc: ms, start: null }; nav.timing = false; setElapsed(ms); setTiming(false); };
  useEffect(() => {
    if (!timing) return;
    const id = window.setInterval(() => {
      const t = timer.current;
      setElapsed(t.acc + (t.start !== null ? performance.now() - t.start : 0));
    }, 50);
    return () => window.clearInterval(id);
  }, [timing]);
  return { elapsed, timerStart, timerHold, timerGo, timerReset, timerSet };
}
