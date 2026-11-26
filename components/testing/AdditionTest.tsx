"use client";

import { useEffect, useRef, useState, type ReactElement } from 'react';
import SevenSeg, { formatElapsed } from '../math/SevenSeg';
import { groupLabel, groupsOf, LEVELS, PER_GROUP, type Question } from './additionModel';
import { MAX_MINUTES, MIN_MINUTES, type AdditionTest } from './useAdditionTest';

// The addition test inside the test frame (Julian): set up (level, timer, start) → the questions one by one → the
// result (score, every question; Retake / New Test). See useAdditionTest for the rules.

const PILL = 'px-3 py-1.5 rounded-lg border text-xs font-black uppercase tracking-[1.5px] cursor-pointer transition-colors disabled:cursor-default';
// 3D push buttons (Julian), like Pause: a left-to-right gradient (darker edges, a light band a little right of the
// middle), a light top edge, a dark bottom edge and a drop under it; pressed, it sinks 2px and its drop shrinks
const PUSH = 'whitespace-nowrap px-3 sm:px-4 py-2 rounded-lg border text-xs font-black uppercase tracking-[1.5px] text-white text-shadow-[0_1px_1px_rgba(0,0,0,0.45)] cursor-pointer transition-[transform,box-shadow,filter] duration-150 ease-out shadow-[inset_0_1px_0_rgba(255,255,255,0.45),inset_0_-2px_0_rgba(0,0,0,0.25),0_3px_0_rgba(0,0,0,0.45),0_6px_12px_rgba(0,0,0,0.35)] hover:brightness-110 active:translate-y-0.5 active:scale-[0.97] active:shadow-[inset_0_1px_0_rgba(255,255,255,0.3),inset_0_-1px_0_rgba(0,0,0,0.25),0_1px_0_rgba(0,0,0,0.45),0_2px_5px_rgba(0,0,0,0.35)] disabled:opacity-40 disabled:cursor-default';
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
    <div className="flex flex-col gap-5">
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
      <div className="flex flex-col gap-2">
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
        <div className="flex flex-col gap-1">
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
  <div className="inline-grid gap-x-3 font-mono font-black text-[2rem] leading-tight text-zinc-100 tabular-nums" style={{ gridTemplateColumns: `auto ${numbersWidth(cols)}` }}>
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
  useEffect(() => { input.current?.focus({ preventScroll: true }); }, [t.index]);
  if (!q) return <></>;
  const send = () => {
    if (value === '') return;
    const n = Number(value);
    const ok = t.submit(n);
    setLast({ ok, q, value: n });
    setValue('');
  };
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <span className="text-sm font-black text-zinc-100">Question {t.index + 1} / {t.questions.length}</span>
          <span className="text-xs text-amber-300">{groupLabel(q)}</span>
        </div>
        {t.remaining !== null && (
          <div className="flex items-center gap-2">
            <span className={LABEL}>Time left</span>
            <SevenSeg text={formatElapsed(t.remaining)} label={`Time left ${formatElapsed(t.remaining)}`} />
          </div>
        )}
      </div>
      <div className="h-1.5 rounded-full bg-zinc-800 overflow-hidden" aria-hidden="true">
        <div className="h-full bg-amber-500 transition-[width] duration-300" style={{ width: `${(t.index / t.questions.length) * 100}%` }} />
      </div>
      <form className="flex flex-wrap items-end gap-4" onSubmit={e => { e.preventDefault(); send(); }}>
        <Column q={q} cols={widestResult(t.questions)} answer={
          <input ref={input} value={value} inputMode="numeric" autoComplete="off" aria-label={`${q.a} plus ${q.b} equals`}
            onChange={e => setValue(e.target.value.replace(/\D/g, '').slice(0, q.digits + 1))}
            className="w-full bg-zinc-950 border border-zinc-600 focus:border-amber-400 outline-none rounded-md text-right font-mono font-black text-[2rem] text-amber-200 px-1 tracking-[0.15em]" />
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
    </div>
  );
}

export function AdditionTestView({ t }: { t: AdditionTest }): ReactElement {
  return t.phase === 'setup' ? <Setup t={t} /> : t.phase === 'running' ? <Running t={t} /> : <Done t={t} />;
}
