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
// Next plays at the normal speed up to its place (a target without seek); Prev runs again without waiting (seek).
// Where an explanation is, for Prev / Next (Julian: a step is shown whole — its last pause running — before the next
// one starts): the step announced (`step`), the board's pauses counted (`fired`, `base`: as many when it was announced,
// `created`: made since), and how many pauses each step made (`perStep`, learnt as the explanation runs). A place is
// { step, fired }: that step, with `fired` of its pauses over, the next one just made. `target`: where a seek stops
// (`onStop`). `gen`: a new board's run (the old board's pauses no longer count)
export interface NavPlace { step: number; fired: number }
export const nav = {
  gen: 0, step: 0, base: 0, fired: 0, created: 0,
  perStep: [] as number[],
  target: null as NavPlace | null,
  onStop: null as (() => void) | null,
  // Prev (Julian: backwards the way it went forwards): what the board's script registers to play a step backwards,
  // from where that step is shown whole to where the step before was (`undoDone`: from the end to the last step)
  undo: {} as Record<number, () => Promise<void>>,
  undoDone: null as (() => Promise<void>) | null,
  // The elapsed time (Julian: Prev / Next set the clock to it): the page's clock (`clock`, `timing` while it runs), when
  // each step began (`timeAt`, learnt while the explanation runs) and at the end (`timeDone`)
  clock: (() => 0) as () => number,
  timing: false,
  timeAt: [] as number[],
  timeDone: null as number | null,
};
// (for checking in the browser's console)
if (typeof window !== 'undefined') (window as unknown as { __mxNav: typeof nav }).__mxNav = nav;
// (the old board's pauses are dropped: its explanation must not go on while the new board is made — its script
// simply never wakes up again)
export const navReset = (): void => { timers.forEach(t => { window.clearTimeout(t.id); t.gen++; }); timers.clear(); nav.gen++; nav.step = 0; nav.base = 0; nav.fired = 0; nav.created = 0; nav.target = null; nav.undo = {}; nav.undoDone = null; };
// The page, at every numbered step
export const navAnnounce = (step: number): void => {
  nav.perStep[nav.step] = nav.created;
  if (nav.timing) nav.timeAt[step] = nav.clock();
  nav.step = step; nav.base = nav.fired; nav.created = 0;
  // (a step with no pause of its own stops where it is announced)
  if (nav.target && nav.target.step === step && nav.target.fired < 0) { nav.target = null; nav.onStop?.(); }
};
// The page, when the explanation is finished (the last step's pauses)
export const navFinish = (): void => {
  nav.perStep[nav.step] = nav.created;
  if (nav.timing) nav.timeDone = nav.clock();
};
// The place where a step is shown whole: all its pauses over but the last (-1: none, stop where it is announced)
export const navEnd = (step: number): NavPlace => ({ step, fired: (nav.perStep[step] ?? 0) - 1 });
export const navHere = (): NavPlace => ({ step: nav.step, fired: nav.fired - nav.base });

export const pausableTimeout = (fn: () => void, ms: number): void => {
  // Prev / Next: the place wanted is reached when this pause is made, so everything stops here (it waits, paused)
  const tg = nav.target;
  if (tg && tg.fired >= 0 && tg.step === nav.step && nav.fired - nav.base === tg.fired) { nav.target = null; nav.onStop?.(); }
  nav.created++;
  const g0 = nav.gen;
  const t: PausableTimer = { fire: fn, due: performance.now() + ms, remaining: ms, id: 0, gen: 0 };
  t.fire = () => { timers.delete(t); if (g0 === nav.gen) nav.fired++; fn(); };
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
