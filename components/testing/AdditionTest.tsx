"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactElement } from 'react';
import SevenSeg, { formatElapsed } from '../math/SevenSeg';
import { carriesOf, carryBoxes, carryRight, carryText, dropsCarry, groupLabel, groupsOf, isRight, LEVELS, PER_GROUP, type Question } from './additionModel';
import { ResultChart } from './ResultChart';
import { MAX_MINUTES, MIN_MINUTES, type AdditionTest } from './useAdditionTest';

// The addition test inside the test frame (Julian): set up (level, timer, start) → the questions one by one → the
// result (score, every question; Retake / New Test). See useAdditionTest for the rules.

const PILL = 'px-3 py-1.5 rounded-lg border text-xs font-black uppercase tracking-[1.5px] cursor-pointer transition-colors disabled:cursor-default';
// 3D push buttons (Julian), like Pause: a left-to-right gradient (darker edges, a light band a little right of the
// middle), a light top edge, a dark bottom edge and a drop under it; pressed, it sinks 2px and its drop shrinks
const PUSH = 'whitespace-nowrap px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg border text-xs font-black uppercase tracking-[1px] sm:tracking-[1.5px] text-white text-shadow-[0_1px_1px_rgba(0,0,0,0.45)] cursor-pointer transition-[transform,box-shadow,filter] duration-150 ease-out shadow-[inset_0_1px_0_rgba(255,255,255,0.45),inset_0_-2px_0_rgba(0,0,0,0.25),0_3px_0_rgba(0,0,0,0.45),0_6px_12px_rgba(0,0,0,0.35)] hover:brightness-110 active:translate-y-0.5 active:scale-[0.97] active:shadow-[inset_0_1px_0_rgba(255,255,255,0.3),inset_0_-1px_0_rgba(0,0,0,0.25),0_1px_0_rgba(0,0,0,0.45),0_2px_5px_rgba(0,0,0,0.35)] disabled:opacity-40 disabled:cursor-default';
// Start test: #00994c (Julian)
const START = `${PUSH} border-[#00552a] bg-linear-[90deg,#006b35_0%,#00994c_35%,#3fc683_55%,#008a44_80%,#005e2e_100%]`;
// Cancel test: #c70050 (Julian)
const CANCEL = `${PUSH} border-[#6e002c] bg-linear-[90deg,#8f003a_0%,#c70050_35%,#ec4a85_55%,#b40048_80%,#800033_100%]`;
// Check, Retake: the amber of Pause, the same push
const PRIMARY = `${PUSH} border-[#7a5200] bg-linear-[90deg,#b07a00_0%,#d69a0a_35%,#f0bd3a_55%,#c88a00_80%,#946400_100%]`;
const SECONDARY = `${PILL} border-zinc-600 text-zinc-200 bg-zinc-800 hover:bg-zinc-700`;
// Wrong / right (Julian): his red #c80453 (also the wrong questions' background) and his green #00994c; a red ✗ only
// after a wrong answer in the review
const WRONG = '#c80453';
const RIGHT = '#00994c';
// « » beside "Question N / 18" (Julian): the Prev / Next buttons of the controls, without their text, in a lighter blue —
// the same 3D push (gradient, light top edge, drop; pressed it sinks 2px)
const NAV = 'flex items-center justify-center w-10 h-7 rounded-lg border border-[#12416e] bg-linear-[90deg,#1a5a96_0%,#2378c4_30%,#6aa8e0_55%,#2a82cc_78%,#185a94_100%] text-white cursor-pointer transition-[transform,box-shadow,filter] duration-150 ease-out shadow-[inset_0_1px_0_rgba(255,255,255,0.45),inset_0_-2px_0_rgba(0,0,0,0.25),0_3px_0_rgba(0,0,0,0.45),0_6px_12px_rgba(0,0,0,0.35)] hover:brightness-110 active:translate-y-0.5 active:scale-[0.97] active:shadow-[inset_0_1px_0_rgba(255,255,255,0.3),inset_0_-1px_0_rgba(0,0,0,0.25),0_1px_0_rgba(0,0,0,0.45),0_2px_5px_rgba(0,0,0,0.35)] disabled:opacity-40 disabled:cursor-default disabled:hover:brightness-100 disabled:active:translate-y-0 disabled:active:scale-100';
const Chevrons = ({ dir }: { dir: 'prev' | 'next' }) => (
  <svg viewBox="0 0 16 16" className="w-4 h-4" aria-hidden="true">
    <path d={dir === 'prev' ? 'M8 3.5 3.5 8 8 12.5M13 3.5 8.5 8l4.5 4.5' : 'M3 3.5 7.5 8 3 12.5M8 3.5 12.5 8 8 12.5'} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const NavButton = ({ dir, onClick, disabled }: { dir: 'prev' | 'next'; onClick: () => void; disabled: boolean }) => (
  <button type="button" aria-label={dir === 'prev' ? 'Previous question' : 'Next question'} title={dir === 'prev' ? 'Previous question' : 'Next question'} onClick={onClick} disabled={disabled} className={NAV}>
    <Chevrons dir={dir} />
  </button>
);
// the answer (and its ✓ / ✗) in the review
const ANS = 'text-[1.125rem] sm:text-[1.575rem]';
const LABEL = 'text-[10px] font-bold uppercase tracking-wider text-zinc-400';

const Stepper = ({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled: boolean; children: string }) => (
  <button type="button" aria-label={label} onClick={onClick} disabled={disabled} className="w-8 h-8 rounded-lg border border-zinc-600 bg-zinc-800 text-zinc-100 text-lg font-black leading-none cursor-pointer hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-default">{children}</button>
);

function Setup({ t }: { t: AdditionTest }): ReactElement {
  const groups = groupsOf(t.level);
  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      {/* (Julian) on a phone Start test comes right after the level and the timer, high enough to be seen at once; the list
          of the additions and the last results come after it */}
      <div className="flex flex-col gap-2">
        <span className={LABEL}>Level</span>
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2" role="radiogroup" aria-label="Level">
          {LEVELS.map(l => (
            <button key={l.id} type="button" role="radio" aria-checked={t.level === l.id} disabled={!l.ready} title={l.ready ? undefined : 'Coming soon'}
              onClick={() => t.setLevel(l.id)}
              className={`${PILL} ${t.level === l.id ? 'border-amber-500 text-amber-300 bg-amber-500/10' : 'border-zinc-700 text-zinc-300 bg-zinc-900'} disabled:opacity-40`}>
              {l.label}{!l.ready && <span className="hidden sm:inline ml-1.5 normal-case tracking-normal font-semibold text-zinc-500">soon</span>}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2 max-md:order-1">
        <span className={LABEL}>{groups.length * PER_GROUP} additions</span>
        <ol className="grid grid-cols-1 sm:grid-cols-[auto_auto] sm:justify-start gap-x-10 gap-y-1 text-sm text-zinc-300">
          {groups.map((g, i) => (
            <li key={i}><span className="text-amber-300 font-bold">{PER_GROUP} ×</span> {groupLabel(g)}</li>
          ))}
        </ol>
      </div>
      <div className="flex flex-col gap-2">
        <span className={LABEL}>Timer</span>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex rounded-lg border border-zinc-700 overflow-hidden" role="radiogroup" aria-label="Timer">
            {[false, true].map(on => (
              <button key={String(on)} type="button" role="radio" aria-checked={t.timerOn === on} onClick={() => t.setTimerOn(on)}
                className={`px-3 py-1.5 text-xs font-black uppercase tracking-[1.5px] cursor-pointer ${t.timerOn === on ? 'bg-amber-500/15 text-amber-300' : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200'}`}>
                {on ? 'Timer' : 'No time'}
              </button>
            ))}
          </div>
          {/* (Julian) the time is always shown, with its default (5 minutes); it can be changed with Timer on — with
              No time it is only shown, dimmed, and the test has no limit */}
          <div className={`flex items-center gap-2 transition-opacity ${t.timerOn ? '' : 'opacity-40'}`}>
            <Stepper label="One minute less" onClick={() => t.setMinutes(t.minutes - 1)} disabled={!t.timerOn || t.minutes <= MIN_MINUTES}>−</Stepper>
            <SevenSeg text={formatElapsed(t.minutes * 60_000)} label={`Time for the test: ${t.minutes} minute${t.minutes === 1 ? '' : 's'}`} />
            <Stepper label="One minute more" onClick={() => t.setMinutes(t.minutes + 1)} disabled={!t.timerOn || t.minutes >= MAX_MINUTES}>+</Stepper>
          </div>
        </div>
      </div>
      <div><button type="button" className={START} onClick={t.start}>Start test</button></div>
      {t.history.length > 0 && (
        <div className="flex flex-col gap-1 max-md:order-2">
          <span className={LABEL}>Last results</span>
          <ul className="text-xs text-zinc-400 flex flex-col gap-0.5">
            {t.history.slice(0, 5).map(h => (
              <li key={h.at}>{new Date(h.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} · {LEVELS.find(l => l.id === h.level)?.label} · <span className="text-zinc-200 font-bold">{h.score} / {h.total}</span> · {formatElapsed(h.ms)}{h.timeUp ? " · time's up" : ''}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// An addition written in a column, as on the board: the two numbers right-aligned, + before the second, a line under.
// `cols` (Julian): the numbers' column is as wide as the longest result of the whole test, for every question, so the
// column only grows to the left inside it and what is beside it (the answer box, the buttons, the text) never moves
// the numbers' right edge in line with the answer box's digits (its 1px border and 0.25rem padding)
const NUM = 'text-right tracking-[0.15em] pr-[calc(0.25rem+1px)]';
const numbersWidth = (cols: number): string => `calc(${cols}ch + ${cols * 0.15}em + 0.75rem)`;
export const widestResult = (qs: Question[]): number => Math.max(1, ...qs.map(q => String(q.a + q.b).length));
// The carry row above the first number (Julian): a small box above each column a carry goes into (the tens, the
// hundreds, …), each exactly over its column's digits. The row is always there (also without boxes), so the operation
// never moves from one question to the next. Box k sits over column k + 1: a digit's place, from the right, is the
// padding, the letter spacing after the last digit, then (1ch + 0.15em) for each column
const CarryRow = ({ n, box }: { n: number; box: (k: number) => ReactElement }) => (
  <span className="relative block h-[0.8em]">
    {Array.from({ length: n }, (_, k) => (
      <span key={k} className="absolute top-0 bottom-[0.08em] w-[1ch]" style={{ right: `calc(0.25rem + 1px + 0.15em + ${k + 1} * (1ch + 0.15em))` }}>{box(k)}</span>
    ))}
  </span>
);
const Column = ({ q, cols, answer, carry }: { q: Question; cols: number; answer?: ReactElement; carry?: ReactElement }) => (
  <div className="inline-grid gap-x-3 font-mono font-black text-[1.75rem] sm:text-[2rem] leading-none sm:leading-tight text-zinc-100 tabular-nums" style={{ gridTemplateColumns: `auto ${numbersWidth(cols)}` }}>
    {carry && <><span />{carry}</>}
    <span />
    <span className={NUM}>{q.a}</span>
    <span className="text-cyan-400">+</span>
    <span className={NUM}>{q.b}</span>
    {/* the line under the operation: 2px higher than my-1 (Julian), the answer stays where it was */}
    <span className="col-span-2 h-[3px] mt-[0.125rem] mb-[0.375rem] rounded-full bg-zinc-500" />
    <span />
    <span className="text-right">{answer}</span>
  </div>
);

function Running({ t }: { t: AdditionTest }): ReactElement {
  const q = t.questions[t.index];
  const [value, setValue] = useState('');
  const [last, setLast] = useState<{ n: number; q: Question; value: number; carry: string[] } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  // the carries of this question (Julian): written by hand in the boxes above — nothing jumps there by itself; a click
  // (a tap) or ↑ from the answer opens the box above the column being written, a digit typed there goes back to the answer
  const [carry, setCarry] = useState<string[]>([]);
  const carryInputs = useRef<(HTMLInputElement | null)[]>([]);
  const boxes = q ? carryBoxes(q) : 0;
  const givenCarry = t.carries[t.index];
  useEffect(() => { setCarry(Array.from({ length: boxes }, (_, k) => givenCarry?.[k] ?? '')); }, [t.index, givenCarry, boxes]);
  // 1 digit with carry (Julian): at Check the carry written above the tens turns green and comes down into the answer,
  // in front of the digit typed — then the answer (with it) is kept
  const drops = q ? dropsCarry(q) : false;
  const [drop, setDrop] = useState<string | null>(null);
  const dropEl = useRef<HTMLSpanElement>(null);
  const backToAnswer = () => { snapLeft.current = true; input.current?.focus({ preventScroll: true }); input.current?.setSelectionRange(0, 0); };
  const form = useRef<HTMLFormElement>(null);
  // The answer is written as in a column addition (Julian): from right to left, one column at a time — each new digit goes
  // in front of the ones typed so far (the units first, then the tens, …). The last column (the leftmost of the longer
  // number) can make two digits: those are typed as they read (8 + 3 + carry: "1", "2"). Where a digit goes is decided
  // here (`slot`); after each digit typed the caret jumps to the very left, in front of everything (Julian).
  // Corrections (Julian): the caret can be put anywhere in the answer (a click, a tap, the arrows) and Backspace / Delete
  // take off the digit beside it; a digit typed there goes in there (then the caret jumps to the left again). With the
  // caret at the left, Backspace takes off the last digit typed
  // (the columns: as many as the longer number has digits — the numbers may differ in length)
  const columns = q ? Math.max(String(q.a).length, String(q.b).length) : 1;
  const slot = (v: string, cols: number): number => Math.max(0, v.length - (cols - 1));
  const snapLeft = useRef(false);
  useLayoutEffect(() => {
    const el = input.current;
    if (!snapLeft.current || !el) return;
    snapLeft.current = false;
    el.setSelectionRange(0, 0);
  });
  const digitsRef = useRef(columns);
  useEffect(() => { digitsRef.current = columns; }, [columns]);
  useEffect(() => {
    const el = input.current;
    if (!el) return;
    const onBefore = (e: InputEvent) => {
      const cols = digitsRef.current;
      const from = el.selectionStart ?? 0, to = el.selectionEnd ?? from;
      const atLeft = from === 0 && to === 0;
      if (e.inputType === 'insertText' && e.data !== null) {
        e.preventDefault();
        const typed = e.data.replace(/\D/g, '');
        if (!typed) return;
        setValue(v => {
          // the caret put somewhere by hand (or digits selected): there; otherwise where the column rule says
          let out = atLeft ? v : v.slice(0, from) + v.slice(to);
          let at = atLeft ? -1 : from;
          for (const d of typed) {
            if (out.length >= cols + 1) break;
            const i = at >= 0 ? at : slot(out, cols);
            out = out.slice(0, i) + d + out.slice(i);
            if (at >= 0) at++;
          }
          return out;
        });
        snapLeft.current = true;
      } else if (e.inputType === 'deleteContentBackward' && atLeft) {
        // (the caret at the left: the last digit typed; elsewhere the browser takes off the digit before the caret)
        e.preventDefault();
        setValue(v => {
          const i = Math.max(0, slot(v, cols) - 1);
          return v.slice(0, i) + v.slice(i + 1);
        });
      }
    };
    el.addEventListener('beforeinput', onBefore);
    return () => el.removeEventListener('beforeinput', onBefore);
  }, []);
  // the carry coming down (see drops): green and a little bigger in its box, then down to the answer's tens, growing to
  // the answer's size (the box's digits are 0.55 of it); there it becomes the answer's first digit
  const commitRef = useRef<(v: string) => void>(() => {});
  const landTimer = useRef(0);
  useEffect(() => () => window.clearTimeout(landTimer.current), []);
  useEffect(() => { commitRef.current = (v: string) => { const n = Number(v); t.submit(n, carry); setLast({ n: t.index + 1, q: t.questions[t.index], value: n, carry }); }; });
  useLayoutEffect(() => {
    if (drop === null || drop === '') return;
    const el = dropEl.current, box = carryInputs.current[boxes - 1], ans = input.current;
    const v = drop + value;
    // (the answer with the carry in it stays in view a moment, then it is kept; the timer outlives this effect — setDrop(null) re-runs it)
    // ('' : landed — still nothing can be typed or checked until it is kept)
    const land = () => { setValue(v); setDrop(''); landTimer.current = window.setTimeout(() => { setDrop(null); commitRef.current(v); }, 450); };
    if (!el || !box || !ans) { land(); return; }
    const b = box.getBoundingClientRect(), a = ans.getBoundingClientRect();
    const dy = a.top + a.height / 2 - (b.top + b.height / 2);
    const anim = el.animate([
      { transform: 'translateY(0) scale(1)' },
      { transform: 'translateY(0) scale(1.35)', offset: 0.3 },
      { transform: `translateY(${dy}px) scale(${1 / 0.55})` },
    ], { duration: 1000, easing: 'cubic-bezier(.45,0,.3,1)', fill: 'forwards' });
    anim.onfinish = land;
    return () => { anim.onfinish = null; anim.cancel(); };
    // (only when a carry starts coming down)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drop]);
  // the answer box gets the keyboard; on a small screen the question, the box and the buttons are scrolled into view
  // (going back to a question: its answer is in the box again, to be changed — Julian)
  const given = t.answers[t.index];
  useEffect(() => { setValue(given === null || given === undefined ? '' : String(given)); }, [t.index, given]);
  useEffect(() => {
    input.current?.focus({ preventScroll: true });
    const show = () => form.current?.scrollIntoView({ block: 'nearest' });
    const id = window.setTimeout(show, 350);
    // (and again when the keyboard opens or closes: the page changes height)
    window.addEventListener('resize', show);
    return () => { window.clearTimeout(id); window.removeEventListener('resize', show); };
  }, [t.index]);
  if (!q) return <></>;
  const commit = (v: string) => {
    const n = Number(v);
    t.submit(n, carry);
    setLast({ n: t.index + 1, q, value: n, carry });
  };
  const send = () => {
    if (value === '' || drop !== null) return;
    const d = drops ? carry[boxes - 1] : '';
    if (d && value.length === columns) { setDrop(d); return; }
    commit(value);
  };
  const carryBox = (k: number) => (
    <>
    <input ref={el => { carryInputs.current[k] = el; }} readOnly={drop !== null} value={carry[k] ?? ''} inputMode="numeric" autoComplete="off" maxLength={2}
      aria-label={`Carry into the ${['tens', 'hundreds', 'thousands'][k] ?? 'next column'}`}
      onFocus={e => e.currentTarget.select()}
      onChange={e => {
        const d = e.target.value.replace(/\D/g, '').slice(-1);
        setCarry(c => c.map((x, j) => (j === k ? d : x)));
        if (d) backToAnswer();
      }}
      onKeyDown={e => {
        if (e.key === 'ArrowDown') { e.preventDefault(); backToAnswer(); }
        else if (e.key === 'ArrowLeft' && k + 1 < boxes) { e.preventDefault(); carryInputs.current[k + 1]?.focus(); }
        else if (e.key === 'ArrowRight' && k > 0) { e.preventDefault(); carryInputs.current[k - 1]?.focus(); }
      }}
      className={`block w-full h-full p-0 bg-zinc-950 border outline-none rounded-[0.12em] text-center font-mono font-black text-[0.55em] leading-none ${drop !== null && k === boxes - 1 ? 'border-[#00994c] text-transparent' : 'border-zinc-500 focus:border-amber-400 text-amber-300'}`} />
    {drop && k === boxes - 1 && (
      <span ref={dropEl} aria-hidden="true" className="absolute inset-0 z-10 flex items-center justify-center font-mono font-black text-[0.55em] leading-none pointer-events-none" style={{ color: RIGHT }}>{drop}</span>
    )}
    </>
  );
  return (
    // (Julian, phone) compact, so that everything fits above the keyboard: smaller gaps; the clocks on their own lines
    <div className="flex flex-col gap-2 sm:gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {/* (Julian) back and forth through the questions, to change an answer until Finish */}
          {/* (Julian) the question bigger (then 5% smaller again: 0.9975rem), 3px more between it and the «» (gap 0.5rem + 3px); the group 20% bigger (it showed at the 18px minimum font: 18 × 1.2) */}
          <div className="flex items-center gap-[0.6875rem]">
            <NavButton dir="prev" onClick={t.prev} disabled={!t.canPrev} />
            <span className="text-[0.9975rem] font-black text-zinc-100 whitespace-nowrap">Question {t.index + 1} / {t.questions.length}</span>
            <NavButton dir="next" onClick={t.next} disabled={!t.canNext} />
          </div>
          <span className="text-[0.98rem] text-amber-300 whitespace-nowrap">{groupLabel(q)}</span>
        </div>
        {t.remaining !== null && (
          <div className="max-md:hidden flex items-center gap-2">
            <span className={`${LABEL} whitespace-nowrap`}>Time left</span>
            <SevenSeg text={formatElapsed(t.remaining)} label={`Time left ${formatElapsed(t.remaining)}`} />
          </div>
        )}
      </div>
      {/* (phone) the frame covers the controls while the test runs, so the elapsed time is shown here (Julian: it must
          stay in view), and under it the time left when there is a timer; each on its own line, the digits a little smaller */}
      <div className="md:hidden flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <span className={`${LABEL} whitespace-nowrap`}>Time elapsed</span>
          <div className="[zoom:0.7]"><SevenSeg text={formatElapsed(t.elapsed)} label={`Elapsed time ${formatElapsed(t.elapsed)}`} /></div>
        </div>
        {t.remaining !== null && (
          <div className="flex items-center justify-between gap-2">
            <span className={`${LABEL} whitespace-nowrap`}>Time left</span>
            <div className="[zoom:0.7]"><SevenSeg text={formatElapsed(t.remaining)} label={`Time left ${formatElapsed(t.remaining)}`} /></div>
          </div>
        )}
      </div>
      <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden" aria-hidden="true">
        <div className="h-full bg-amber-500 transition-[width] duration-300" style={{ width: `${(t.answered / t.questions.length) * 100}%` }} />
      </div>
      {/* (from md up) every question: answered (amber) or not, the current one ringed; a click opens it */}
      <div className="max-md:hidden flex flex-wrap gap-1.5" role="list" aria-label="Questions">
        {t.questions.map((_, i) => (
          <button key={i} type="button" role="listitem" onClick={() => t.goTo(i)} aria-current={i === t.index || undefined}
            className={`w-8 h-8 rounded-md text-xs font-black cursor-pointer border ${t.answers[i] !== null ? 'border-amber-600 bg-amber-500/15 text-amber-300' : 'border-zinc-700 bg-zinc-900 text-zinc-500'} ${i === t.index ? 'ring-2 ring-amber-400' : ''}`}>
            {i + 1}
          </button>
        ))}
      </div>
      <form ref={form} className="flex flex-wrap items-end gap-x-3 sm:gap-x-4 gap-y-2 sm:gap-y-3" onSubmit={e => { e.preventDefault(); send(); }}>
        <Column q={q} cols={widestResult(t.questions)} carry={<CarryRow n={boxes} box={carryBox} />} answer={
          <input ref={input} value={value} readOnly={drop !== null} inputMode="numeric" autoComplete="off" aria-label={`${q.a} plus ${q.b} equals`}
            onKeyDown={e => {
              // ↑: the carry box above the column being written (the one after the digits typed so far)
              if (e.key === 'ArrowUp' && boxes > 0) { e.preventDefault(); carryInputs.current[Math.min(boxes - 1, Math.max(0, value.length - 1))]?.focus(); }
            }}
            onChange={e => { const d = e.target.value.replace(/\D/g, ''); setValue(d.length > columns + 1 ? value : d); }}
            className="w-full max-md:-ml-[0.625rem] max-md:w-[calc(100%+0.625rem)] bg-zinc-950 border border-zinc-600 focus:border-amber-400 outline-none rounded-md text-right font-mono font-black text-[1.75rem] sm:text-[2rem] leading-none sm:leading-normal py-1 sm:py-0 text-amber-200 px-1 tracking-[0.15em]" />
        } />
        <div className="flex items-center gap-1.5 sm:gap-3">
          <button type="submit" className={PRIMARY} disabled={value === '' || drop !== null}>Check</button>
          {/* (Julian) the test ends only here (or when the time is up) */}
          <button type="button" className={START} onClick={t.finishNow}>Finish</button>
          <button type="button" className={CANCEL} onClick={t.cancel}>Cancel<span className="max-sm:hidden"> test</span></button>
        </div>
      </form>
      <div className="min-h-6 text-sm" aria-live="polite">
        {/* (only kept: whether it is right is told at Finish, the answer can still be changed) */}
        {last && <span className="font-bold text-zinc-300">Saved: {last.n}. {last.q.a} + {last.q.b} = <span className="text-amber-200">{last.value}</span>{carryBoxes(last.q) > 0 && <> · carry <span className="text-amber-200">{carryText(last.q, last.carry)}</span></>}</span>}
      </div>
    </div>
  );
}

function Done({ t }: { t: AdditionTest }): ReactElement {
  const q = t.questions[t.review];
  const given = t.answers[t.review];
  const right = (i: number) => isRight(t.questions[i], t.answers[i], t.carries[i]);
  // (the result and the carries are judged each on its own line; the question is right only with both)
  const resultRight = given !== null && given !== undefined && q !== undefined && given === q.a + q.b;
  const cRight = q !== undefined && carryRight(q, t.carries[t.review]);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="text-2xl font-black text-zinc-100">Score {t.score} / {t.questions.length}</span>
        {t.timeUp && <span className="text-sm font-bold" style={{ color: WRONG }}>{"Time's up"}</span>}
        <span className="text-xs text-zinc-400">in {formatElapsed(t.elapsed)}</span>
      </div>
      <div className="flex flex-wrap gap-1.5" role="list" aria-label="Questions">
        {t.questions.map((_, i) => (
          <button key={i} type="button" role="listitem" onClick={() => t.setReview(i)} aria-current={i === t.review || undefined}
            className={`w-[2.4rem] h-[2.4rem] rounded-md text-[0.9rem] font-black cursor-pointer border ${right(i) ? 'border-emerald-600 bg-emerald-500/15 text-emerald-300' : t.answers[i] === null ? 'border-zinc-600 bg-zinc-800 text-zinc-400' : 'border-[#8f0339] bg-[#c80453] text-white'} ${i === t.review ? 'ring-2 ring-amber-400' : ''}`}>
            {i + 1}
          </button>
        ))}
      </div>
      {q && (
        <div className="flex flex-wrap items-end gap-6">
          <Column q={q} cols={widestResult(t.questions)} answer={<span className={`block ${NUM}`} style={{ color: RIGHT }}>{q.a + q.b}</span>}
            carry={<CarryRow n={carryBoxes(q)} box={k => (
              <span className="flex items-center justify-center w-full h-full border border-zinc-700 rounded-[0.12em] text-[0.55em] leading-none" style={{ color: RIGHT }}>{carriesOf(q)[k] ? '1' : ''}</span>
            )} />} />
          {/* (Julian) twice the size it was (on a phone a little less, so it doesn't break into many lines); a red ✗ after a wrong answer */}
          <div className="text-[1.25rem] sm:text-[1.75rem] leading-snug text-zinc-300 flex flex-col gap-1 pb-1">
            <span className="flex items-center gap-[0.6875rem] text-amber-300 text-[0.9rem] sm:text-[1.35rem]">
              <NavButton dir="prev" onClick={t.prev} disabled={!t.canPrev} />
              <span>Question {t.review + 1} · {groupLabel(q)}</span>
              <NavButton dir="next" onClick={t.next} disabled={!t.canNext} />
            </span>
            {/* (Julian) "Your answer" 20% smaller, the answer and its ✓ / ✗ 10% smaller (than 1.25rem / 1.75rem) */}
            <span className="whitespace-nowrap text-[1rem] sm:text-[1.4rem]">Your answer: <b className={ANS} style={{ color: resultRight ? RIGHT : WRONG }}>{given ?? '—'}</b>{resultRight ? <b className={ANS} style={{ color: RIGHT }}> ✓</b> : <b className={ANS} style={{ color: WRONG }}> ✗</b>}</span>
            {/* (Julian) the carries count too: written as in the boxes, the leftmost column first (– : an empty box) */}
            {carryBoxes(q) > 0 && (
              <span className="whitespace-nowrap text-[1rem] sm:text-[1.4rem]">Your carry: <b className={ANS} style={{ color: cRight ? RIGHT : WRONG }}>{carryText(q, t.carries[t.review])}</b>{cRight ? <b className={ANS} style={{ color: RIGHT }}> ✓</b> : <b className={ANS} style={{ color: WRONG }}> ✗</b>}</span>
            )}
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={PRIMARY} onClick={t.retake}>Retake</button>
        <button type="button" className={SECONDARY} onClick={t.newTest}>New test</button>
        <button type="button" className={SECONDARY} onClick={t.toSetup}>Change level</button>
      </div>
      {/* (Julian) the result as a 3D ring: correct and wrong answers, the score in the middle */}
      <ResultChart score={t.score} total={t.questions.length} />
    </div>
  );
}

export function AdditionTestView({ t }: { t: AdditionTest }): ReactElement {
  return t.phase === 'setup' ? <Setup t={t} /> : t.phase === 'running' ? <Running t={t} /> : <Done t={t} />;
}
