import { useCallback, useEffect, useRef, useState } from 'react';
import { carryBoxes, carryText, carryExpectedText, isRight, makeTest, type Level, type Question } from './additionModel';

// The addition test's state (Julian):
// - setup: the level, and the timer — No time, or a countdown set in whole minutes (60 s steps);
// - running: one question at a time; the answer is checked when it is given (Enter or Check), then the next one comes;
//   the time since the start runs in TIME ELAPSED, and with a timer the time left counts down to zero (then the test
//   ends: what wasn't answered counts as wrong);
// - done: the score, every question with the answer given; Prev / Next go through them (`review`); Retake: the same
//   numbers again; New Test: new numbers at random, same level.
// The last results are kept in the browser (`history`, newest first, at most 10).
export type Phase = 'setup' | 'running' | 'done';
export type TestResult = { at: number; level: Level; score: number; total: number; ms: number; timeUp: boolean };

const HISTORY_KEY = 'math-explorer-test-history';
const readHistory = (): TestResult[] => {
  try {
    const v = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]');
    return Array.isArray(v) ? v.slice(0, 10) : [];
  } catch { return []; }
};

export const MIN_MINUTES = 1;
export const MAX_MINUTES = 60;

export function useAdditionTest() {
  const [level, setLevel] = useState<Level>('beginner');
  const [timerOn, setTimerOn] = useState(false);
  const [minutes, setMinutesRaw] = useState(5);
  const setMinutes = (m: number) => setMinutesRaw(Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, Math.round(m))));
  const [phase, setPhase] = useState<Phase>('setup');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  // the carries written for each question (see additionModel: one box per column the carry goes into)
  const [carries, setCarries] = useState<string[][]>([]);
  const [index, setIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [timeUp, setTimeUp] = useState(false);
  const [review, setReview] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const [history, setHistory] = useState<TestResult[]>([]);
  useEffect(() => { const id = window.setTimeout(() => setHistory(readHistory()), 0); return () => window.clearTimeout(id); }, []);
  const startAt = useRef(0);
  const limit = timerOn ? minutes * 60_000 : null;

  const begin = useCallback((qs: Question[]) => {
    setQuestions(qs);
    setAnswers(qs.map(() => null));
    setCarries(qs.map(q => Array.from({ length: carryBoxes(q) }, () => '')));
    setIndex(0);
    setElapsed(0);
    setTimeUp(false);
    setReview(0);
    setLog([]);
    startAt.current = performance.now();
    setPhase('running');
  }, []);

  const finish = useCallback((given: (number | null)[], carried: string[][], up: boolean) => {
    const ms = performance.now() - startAt.current;
    const final = limit !== null ? Math.min(ms, limit) : ms;
    setElapsed(final);
    setTimeUp(up);
    setPhase('done');
    setReview(0);
    const score = questions.filter((q, i) => isRight(q, given[i], carried[i])).length;
    // (only now is it said what was right: while the test runs the answers can still be changed, Julian)
    setLog([
      ...questions.map((q, i) => {
        const c = carryBoxes(q) > 0 ? ` · carry ${carryText(q, carried[i])}` : '';
        const ok = isRight(q, given[i], carried[i]);
        return `${i + 1}. ${q.a} + ${q.b} = ${given[i] ?? '—'}${c} ${ok ? '✓' : `(correct: ${q.a + q.b}${c ? ` · carry ${carryExpectedText(q)}` : ''})`}`;
      }),
      ...(up ? ["Time's up."] : []),
      `Done! Score ${score} / ${questions.length}`,
    ]);
    const result: TestResult = { at: Date.now(), level, score, total: questions.length, ms: final, timeUp: up };
    setHistory(h => {
      const next = [result, ...h].slice(0, 10);
      try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); } catch { /* storage off */ }
      return next;
    });
  }, [limit, questions, level]);

  // the clock while the test runs (and the end when the time is up)
  const answersRef = useRef(answers);
  const carriesRef = useRef(carries);
  useEffect(() => { answersRef.current = answers; carriesRef.current = carries; }, [answers, carries]);
  useEffect(() => {
    if (phase !== 'running') return;
    const id = window.setInterval(() => {
      const ms = performance.now() - startAt.current;
      if (limit !== null && ms >= limit) { window.clearInterval(id); finish(answersRef.current, carriesRef.current, true); return; }
      setElapsed(ms);
    }, 100);
    return () => window.clearInterval(id);
  }, [phase, limit, finish]);

  const start = () => begin(makeTest(level));
  const retake = () => begin(questions);
  const newTest = () => begin(makeTest(level));
  const toSetup = () => { setPhase('setup'); setElapsed(0); setLog([]); };
  // Cancel test (Julian): stops the test under way, back to the setup; nothing is scored or kept
  const cancel = () => { setPhase('setup'); setElapsed(0); setLog(['Test cancelled.']); };
  const reset = useCallback(() => { setPhase('setup'); setElapsed(0); setLog([]); setQuestions([]); setAnswers([]); setCarries([]); }, []);

  // The answer to the current question (Julian: a history to go back to — any question can be opened again and its
  // answer changed until Finish). It is kept, then the next question without an answer comes (after this one, else from
  // the start); when all have one, it stays. Nothing says yet whether it is right
  const submit = (value: number, carry: string[]) => {
    if (phase !== 'running') return;
    const given = answers.map((v, i) => (i === index ? value : v));
    const carried = carries.map((c, i) => (i === index ? carry : c));
    setAnswers(given);
    setCarries(carried);
    setLog(questions.flatMap((q, i) => (given[i] === null ? [] : [`${i + 1}. ${q.a} + ${q.b} = ${given[i]}${carryBoxes(q) > 0 ? ` · carry ${carryText(q, carried[i])}` : ''}`])));
    const n = questions.length;
    for (let k = 1; k < n; k++) {
      const j = (index + k) % n;
      if (given[j] === null) { setIndex(j); return; }
    }
  };
  const goTo = (i: number) => { if (phase === 'running' && i >= 0 && i < questions.length) setIndex(i); };
  // Finish (Julian): the test ends here — the questions without an answer count as wrong
  const finishNow = () => { if (phase === 'running') finish(answers, carries, false); };
  const answered = answers.filter(v => v !== null).length;

  const score = questions.filter((q, i) => isRight(q, answers[i], carries[i])).length;
  const remaining = limit !== null ? Math.max(0, limit - elapsed) : null;
  // Prev / Next: through the questions while the test runs (to change an answer), through the results after it
  const canPrev = (phase === 'running' && index > 0) || (phase === 'done' && review > 0);
  const canNext = (phase === 'running' && index < questions.length - 1) || (phase === 'done' && review < questions.length - 1);
  const prev = () => { if (!canPrev) return; if (phase === 'running') setIndex(index - 1); else setReview(review - 1); };
  const next = () => { if (!canNext) return; if (phase === 'running') setIndex(index + 1); else setReview(review + 1); };

  return {
    level, setLevel, timerOn, setTimerOn, minutes, setMinutes, phase, questions, answers, carries, index, elapsed, remaining, timeUp,
    review, setReview, log, history, score, start, retake, newTest, toSetup, cancel, reset, submit, goTo, finishNow, answered, canPrev, canNext, prev, next,
  };
}
export type AdditionTest = ReturnType<typeof useAdditionTest>;
