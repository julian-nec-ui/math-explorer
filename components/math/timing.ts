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
interface PausableTimer { fire: () => void; due: number; remaining: number; id: number; gen: number }
const timers = new Set<PausableTimer>();
const frozen = new Set<Animation>();
export const pauseState = { paused: false };

// Prev / Next (Julian): going to another step runs the explanation again (or on, for Next) without waiting — every
// pause is skipped and every CSS transition / animation takes no time (html.mx-seek, see globals.css) — until the
// page stops it at the step wanted (seekEnd), paused there
export const seek = { active: false };
let seekGen = 0;
// (a timer armed again replaces its old call: `gen`)
const arm = (t: PausableTimer, ms: number) => {
  window.clearTimeout(t.id);
  const g = ++t.gen;
  t.due = performance.now() + ms;
  if (seek.active) {
    const ch = new MessageChannel();
    ch.port1.onmessage = () => { ch.port1.close(); if (t.gen === g) t.fire(); };
    ch.port2.postMessage(0);
  } else {
    t.id = window.setTimeout(() => { if (t.gen === g) t.fire(); }, ms);
  }
};
export const pausableTimeout = (fn: () => void, ms: number): void => {
  const t: PausableTimer = { fire: fn, due: performance.now() + ms, remaining: ms, id: 0, gen: 0 };
  t.fire = () => { timers.delete(t); fn(); };
  timers.add(t);
  if (!pauseState.paused) arm(t, ms);
};
export const pauseAll = (): void => {
  if (pauseState.paused) return;
  pauseState.paused = true;
  const now = performance.now();
  timers.forEach(t => { window.clearTimeout(t.id); t.gen++; t.remaining = Math.max(0, t.due - now); });
  document.getAnimations().forEach(a => { if (a.playState === 'running') { a.pause(); frozen.add(a); } });
};
export const resumeAll = (): void => {
  if (!pauseState.paused) return;
  pauseState.paused = false;
  timers.forEach(t => arm(t, t.remaining));
  frozen.forEach(a => { try { a.play(); } catch { /* gone */ } });
  frozen.clear();
};
export const seekStart = (): void => {
  seek.active = true;
  seekGen++;
  document.documentElement.classList.add('mx-seek');
  frozen.forEach(a => { try { a.finish(); } catch { /* gone or endless */ } });
  frozen.clear();
  if (!pauseState.paused) timers.forEach(t => arm(t, 0));
};
export const seekEnd = (): void => {
  if (!seek.active) return;
  seek.active = false;
  // what was still moving ends where it was going
  document.getAnimations().forEach(a => {
    try { if (Number.isFinite(Number(a.effect?.getComputedTiming().endTime))) a.finish(); } catch { /* endless */ }
  });
  const g = seekGen;
  requestAnimationFrame(() => requestAnimationFrame(() => { if (g === seekGen && !seek.active) document.documentElement.classList.remove('mx-seek'); }));
};
