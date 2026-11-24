// Time in an explanation: the step delay chosen on the page, and the timers every board waits with, which Pause / Resume
// stop and start again (with every running animation on the page)

// Step delay (Julian): extra time after each step of an explanation (each new line in the steps window), chosen on
// the page (0, 0.5, 1, 1.5 or 2 s). The page adds it to `owed` when it shows a step; the board's next pause takes it
// (`paced`), so the step stays on screen that much longer; the animations themselves keep their speed
export const STEP_DELAYS_MS = [0, 500, 1000, 1500, 2000];
export const pace = { stepMs: 0, owed: 0 };
export const paced = (ms: number): number => {
  const extra = pace.owed;
  pace.owed = 0;
  return ms + extra;
};

// Pause / Resume (Julian): every board's pauses go through `pausableTimeout`; pausing stops those timers (keeping what
// was left of each) and freezes every running animation on the page (CSS animations and transitions, and the
// Web Animations of the hops), exactly where they are; resuming starts them all again from there
interface PausableTimer { fn: () => void; due: number; remaining: number; id: number }
const timers = new Set<PausableTimer>();
const frozen = new Set<Animation>();
export const pauseState = { paused: false };
export const pausableTimeout = (fn: () => void, ms: number): void => {
  const t: PausableTimer = { fn, due: performance.now() + ms, remaining: ms, id: 0 };
  const fire = () => { timers.delete(t); fn(); };
  t.fn = fire;
  if (!pauseState.paused) t.id = window.setTimeout(fire, ms);
  timers.add(t);
};
export const pauseAll = (): void => {
  if (pauseState.paused) return;
  pauseState.paused = true;
  const now = performance.now();
  timers.forEach(t => { window.clearTimeout(t.id); t.remaining = Math.max(0, t.due - now); });
  document.getAnimations().forEach(a => { if (a.playState === 'running') { a.pause(); frozen.add(a); } });
};
export const resumeAll = (): void => {
  if (!pauseState.paused) return;
  pauseState.paused = false;
  const now = performance.now();
  timers.forEach(t => { t.due = now + t.remaining; t.id = window.setTimeout(t.fn, t.remaining); });
  frozen.forEach(a => { try { a.play(); } catch { /* gone */ } });
  frozen.clear();
};
