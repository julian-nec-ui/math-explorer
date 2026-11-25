import { useRef, useState } from 'react';
import { pace, pauseAll, resumeAll, seekStart, seekEnd, nav, navReset, navAnnounce, navFinish, navEnd, navHere, type NavPlace } from '../math/shared';
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
  // Prev / Next (Julian): while the explanation runs again / on without waiting to a place (see nav in timing)
  const [seeking, setSeeking] = useState(false);
  const seekingRef = useRef(false);
  const stopSeek = () => { nav.target = null; nav.onStop = null; seekingRef.current = false; seekEnd(); setSeeking(false); };
  // (there: everything stops, paused). `fast`: without waiting (Prev, under a still copy of the board); otherwise at
  // the normal speed (Next: the way it goes forwards)
  const coverRef = useRef<((fade: boolean) => void) | null>(null);
  const seekTo = (place: NavPlace | null, fast: boolean, fadeCover = false) => {
    nav.target = place;
    nav.onStop = () => { stopSeek(); pauseAll(); setPaused(true); uncover(fadeCover); };
    seekingRef.current = true;
    setSeeking(true);
    if (fast) seekStart();
  };
  const uncover = (fade: boolean) => { const c = coverRef.current; coverRef.current = null; c?.(fade); };
  // A still copy of the board area and its overlays, over them, while the board is made again underneath
  const makeCover = () => {
    uncover(false);
    const area = document.querySelector<HTMLElement>('.steps-scroll');
    if (!area) return;
    const r = area.getBoundingClientRect();
    const wrap = document.createElement('div');
    wrap.className = 'mx-cover-clone';
    Object.assign(wrap.style, { position: 'fixed', left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`, zIndex: '5', overflow: 'hidden' });
    const copy = area.cloneNode(true) as HTMLElement;
    Object.assign(copy.style, { width: '100%', height: '100%', margin: '0' });
    wrap.appendChild(copy);
    const parts: HTMLElement[] = [wrap];
    document.querySelectorAll('[data-mx-overlays]').forEach(o => {
      const oc = o.cloneNode(true) as HTMLElement;
      oc.removeAttribute('data-mx-overlays');
      oc.classList.add('mx-cover-clone');
      parts.push(oc);
    });
    parts.forEach(p => document.body.appendChild(p));
    copy.scrollTop = area.scrollTop; copy.scrollLeft = area.scrollLeft;
    document.documentElement.classList.add('mx-covered');
    coverRef.current = (fade: boolean) => {
      const done = () => parts.forEach(p => p.remove());
      requestAnimationFrame(() => requestAnimationFrame(() => {
        document.documentElement.classList.remove('mx-covered');
        if (!fade) { done(); return; }
        parts.forEach(p => p.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 450, easing: 'ease-in-out', fill: 'forwards' }));
        window.setTimeout(done, 470);
      }));
    };
  };
  // Prev from the first step (Julian): back to the very beginning, the board as before Explain to Me (nothing lit,
  // no work), still paused; Next (or Resume) starts the explanation from there
  const [atStart, setAtStart] = useState(false);
  // How far the explanation has really gone (Julian): Next only goes back over steps already seen, up to there (the
  // last step reached, and whether it was finished); at that point there is nothing ahead yet, so Next is off
  // (`live`: where it was paused in its last step, when not finished)
  type Frontier = { step: number; done: boolean; live: NavPlace | null };
  const frontierRef = useRef<Frontier>({ step: 0, done: false, live: null });
  const [frontier, setFrontierState] = useState<Frontier>({ step: 0, done: false, live: null });
  const setFrontier = (f: Frontier) => { frontierRef.current = f; setFrontierState(f); };
  const runFromStart = () => { setAtStart(false); setBoardKey(k => k + 1); setBoardRun(true); };
  const togglePause = () => {
    if (!isAnimating || seeking) return;
    if (paused && atStart) { setPaused(false); timerGo(); runFromStart(); return; }
    if (paused) { resumeAll(); setPaused(false); timerGo(); return; }
    pauseAll(); setPaused(true); timerHold();
    // paused in the furthest step: Next will come back exactly here
    const f = frontierRef.current;
    if (!f.done && nav.step === f.step) setFrontier({ ...f, live: navHere() });
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
      if (stepRef.current > frontierRef.current.step) setFrontier({ step: stepRef.current, done: false, live: null });
      line = `Step ${stepRef.current}: ${text}`;
      navAnnounce(stepRef.current);
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
    if (!keepBoard) uncover(false);
    if (seekingRef.current) stopSeek();
    navReset();
    nav.perStep = [];
    setAtStart(false);
    setStatus(''); setIsAnimating(false);
    pace.owed = 0;
    // A paused explanation that is stopped or reset: everything runs again (the board is cleared anyway)
    resumeAll();
    setPaused(false);
    timerReset();
    stepRef.current = 0;
    setFrontier({ step: 0, done: false, live: null });
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
    if (seekingRef.current) { stopSeek(); setPaused(false); }
    navFinish();
    setFrontier({ step: frontierRef.current.step, done: true, live: null });
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
  const ahead = atStart ? frontier.step > 0 || frontier.done : numbered < frontier.step || (numbered === frontier.step && frontier.done);
  const canNext = !seeking && isAnimating && paused && ahead;
  // A step's place: shown whole (see navEnd); the furthest step, when not finished: where it was paused
  const placeOf = (step: number): NavPlace => {
    const f = frontierRef.current;
    return !f.done && step === f.step && f.live ? f.live : navEnd(step);
  };
  // Prev (Julian): the step is first played backwards on the board as it is (the script's own backward moves, see
  // nav.undo), then the board is made again up to the step before, without waiting, under a still copy of it. Where
  // there is no backward play (paused in the middle of a step, other boards), the copy fades into the step before
  const prevStep = async () => {
    if (!canPrev) return;
    const target = finished ? numbered : numbered - 1;
    const whole = !finished && nav.step === numbered && nav.fired - nav.base === (nav.perStep[numbered] ?? 0) - 1;
    const back = finished ? nav.undoDone : whole ? nav.undo[numbered] : null;
    const keep = elapsed;
    seekingRef.current = true;
    setSeeking(true);
    if (back) { try { await back(); } catch { /* the board is made again anyway */ } }
    makeCover();
    const reached = frontierRef.current, learnt = nav.perStep;
    resetResult(true);
    setBoardKey(k => k + 1);
    setFrontier(reached);
    nav.perStep = learnt;
    timerSet(keep);
    setIsAnimating(true);
    setPaused(true);
    if (target < 1) {
      setAtStart(true);
      seekingRef.current = false;
      setSeeking(false);
      uncover(!back);
      return;
    }
    seekTo(placeOf(target), true, !back);
    // (a fresh board, made with run = true, as in begin)
    setBoardRun(true);
  };
  const nextStep = () => {
    if (!canNext) return;
    const f = frontierRef.current;
    const target = atStart ? 1 : numbered + 1;
    // past the last step: on to the end
    seekTo(f.done && target > f.step ? null : placeOf(target), false);
    if (atStart) runFromStart();
    else resumeAll();
  };

  return { status, setStatus, steps, isAnimating, boardKey, boardRun, paused, elapsed, togglePause, announce, resetResult, stopComputation, begin, finish, canPrev, canNext, prevStep, nextStep, seeking };
}
