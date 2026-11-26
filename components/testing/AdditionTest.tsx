"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactElement } from 'react';
import SevenSeg, { formatElapsed } from '../math/SevenSeg';
import { groupLabel, groupsOf, LEVELS, PER_GROUP, type Question } from './additionModel';
import { ResultChart } from './ResultChart';
import { MAX_MINUTES, MIN_MINUTES, type AdditionTest } from './useAdditionTest';

// The addition test inside the test frame (Julian): set up (level, timer, start) → the questions one by one → the
// result (score, every question; Retake / New Test). See useAdditionTest for the rules.

const PILL = 'px-3 py-1.5 rounded-lg border text-xs font-black uppercase tracking-[1.5px] cursor-pointer transition-colors disabled:cursor-default';
// 3D push buttons (Julian), like Pause: a left-to-right gradient (darker edges, a light band a little right of the
// middle), a light top edge, a dark bottom edge and a drop under it; pressed, it sinks 2px and its drop shrinks
const PUSH = 'whitespace-nowrap px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg border text-xs font-black uppercase tracking-[1.5px] text-white text-shadow-[0_1px_1px_rgba(0,0,0,0.45)] cursor-pointer transition-[transform,box-shadow,filter] duration-150 ease-out shadow-[inset_0_1px_0_rgba(255,255,255,0.45),inset_0_-2px_0_rgba(0,0,0,0.25),0_3px_0_rgba(0,0,0,0.45),0_6px_12px_rgba(0,0,0,0.35)] hover:brightness-110 active:translate-y-0.5 active:scale-[0.97] active:shadow-[inset_0_1px_0_rgba(255,255,255,0.3),inset_0_-1px_0_rgba(0,0,0,0.25),0_1px_0_rgba(0,0,0,0.45),0_2px_5px_rgba(0,0,0,0.35)] disabled:opacity-40 disabled:cursor-default';
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
          {t.timerOn && (
            <div className="flex items-center gap-2">
              <Stepper label="One minute less" onClick={() => t.setMinutes(t.minutes - 1)} disabled={t.minutes <= MIN_MINUTES}>−</Stepper>
              <SevenSeg text={formatElapsed(t.minutes * 60_000)} label={`Time for the test: ${t.minutes} minute${t.minutes === 1 ? '' : 's'}`} />
              <Stepper label="One minute more" onClick={() => t.setMinutes(t.minutes + 1)} disabled={t.minutes >= MAX_MINUTES}>+</Stepper>
            </div>
          )}
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
const Column = ({ q, cols, answer }: { q: Question; cols: number; answer?: ReactElement }) => (
  <div className="inline-grid gap-x-3 font-mono font-black text-[1.75rem] sm:text-[2rem] leading-none sm:leading-tight text-zinc-100 tabular-nums" style={{ gridTemplateColumns: `auto ${numbersWidth(cols)}` }}>
    <span />
    <span className={NUM}>{q.a}</span>
    <span className="text-cyan-400">+</span>
    <span className={NUM}>{q.b}</span>
    <span className="col-span-2 h-[3px] my-1 rounded-full bg-zinc-500" />
    <span />
    <span className="text-right">{answer}</span>
  </div>
);

function Running({ t }: { t: AdditionTest }): ReactElement {
  const q = t.questions[t.index];
  const [value, setValue] = useState('');
  const [last, setLast] = useState<{ ok: boolean; q: Question; value: number } | null>(null);
  const input = useRef<HTMLInputElement>(null);
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
  // the answer box gets the keyboard; on a small screen the question, the box and the buttons are scrolled into view
  useEffect(() => {
    input.current?.focus({ preventScroll: true });
    const show = () => form.current?.scrollIntoView({ block: 'nearest' });
    const id = window.setTimeout(show, 350);
    // (and again when the keyboard opens or closes: the page changes height)
    window.addEventListener('resize', show);
    return () => { window.clearTimeout(id); window.removeEventListener('resize', show); };
  }, [t.index]);
  if (!q) return <></>;
  const send = () => {
    if (value === '') return;
    const n = Number(value);
    const ok = t.submit(n);
    setLast({ ok, q, value: n });
    setValue('');
  };
  return (
    // (Julian, phone) compact, so that everything fits above the keyboard: smaller gaps; the clocks on their own lines
    <div className="flex flex-col gap-2 sm:gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <span className="text-sm font-black text-zinc-100 whitespace-nowrap">Question {t.index + 1} / {t.questions.length}</span>
          <span className="text-xs text-amber-300 whitespace-nowrap">{groupLabel(q)}</span>
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
        <div className="h-full bg-amber-500 transition-[width] duration-300" style={{ width: `${(t.index / t.questions.length) * 100}%` }} />
      </div>
      <form ref={form} className="flex flex-wrap items-end gap-x-3 sm:gap-x-4 gap-y-2 sm:gap-y-3" onSubmit={e => { e.preventDefault(); send(); }}>
        <Column q={q} cols={widestResult(t.questions)} answer={
          <input ref={input} value={value} inputMode="numeric" autoComplete="off" aria-label={`${q.a} plus ${q.b} equals`}
            onChange={e => { const d = e.target.value.replace(/\D/g, ''); setValue(d.length > columns + 1 ? value : d); }}
            className="w-full max-md:-ml-[0.625rem] max-md:w-[calc(100%+0.625rem)] bg-zinc-950 border border-zinc-600 focus:border-amber-400 outline-none rounded-md text-right font-mono font-black text-[1.75rem] sm:text-[2rem] leading-none sm:leading-normal py-1 sm:py-0 text-amber-200 px-1 tracking-[0.15em]" />
        } />
        <div className="flex items-center gap-2 sm:gap-3">
          <button type="submit" className={PRIMARY} disabled={value === ''}>Check</button>
          <button type="button" className={CANCEL} onClick={t.cancel}>Cancel test</button>
        </div>
      </form>
      <div className="min-h-6 text-sm" aria-live="polite">
        {last && (last.ok
          ? <span className="font-bold" style={{ color: RIGHT }}>✓ {last.q.a} + {last.q.b} = {last.value}</span>
          : <span className="font-bold text-zinc-300">{last.q.a} + {last.q.b} = <span style={{ color: RIGHT }}>{last.q.a + last.q.b}</span>, not <span style={{ color: WRONG }}>{last.value}</span></span>)}
      </div>
    </div>
  );
}

function Done({ t }: { t: AdditionTest }): ReactElement {
  const q = t.questions[t.review];
  const given = t.answers[t.review];
  const right = (i: number) => t.answers[i] !== null && t.answers[i] === t.questions[i].a + t.questions[i].b;
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
          <Column q={q} cols={widestResult(t.questions)} answer={<span className={`block ${NUM}`} style={{ color: RIGHT }}>{q.a + q.b}</span>} />
          {/* (Julian) twice the size it was (on a phone a little less, so it doesn't break into many lines); a red ✗ after a wrong answer */}
          <div className="text-[1.25rem] sm:text-[1.75rem] leading-snug text-zinc-300 flex flex-col gap-1 pb-1">
            <span className="text-amber-300 text-[1rem] sm:text-[1.5rem]">Question {t.review + 1} · {groupLabel(q)}</span>
            <span className="whitespace-nowrap">Your answer: <b style={{ color: right(t.review) ? RIGHT : WRONG }}>{given ?? '—'}</b>{right(t.review) ? <b style={{ color: RIGHT }}> ✓</b> : <b style={{ color: WRONG }}> ✗</b>}</span>
            <span className="text-[0.9rem] sm:text-[1.5rem] text-zinc-500">Prev / Next go through the questions</span>
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
