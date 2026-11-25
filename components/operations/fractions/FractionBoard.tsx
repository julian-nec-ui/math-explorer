"use client";

import { Fragment, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactElement } from 'react';
import { CarryHop, Digit, OpIcon, OperandDrum, commaAfter, drumScaleFor, numberValue, usePhoneEdge, type DigitVariant, type FracPart } from '../../math/shared';
import { Bracket, Crossable, FracComma, EXPR_GAP, Eq, FR_HOP_END, FR_HOP_MS, FR_LAND_MS, FactorChip, type Frac, FracView, type FractionBoardProps, type Hop, MAX_WHOLE_PIECES, type Mark, Mul, Num, Paren, SignMark, SmallEq, Times, WarningIcon, gcd, lcm, primeFactors } from './model';
import { runFractions } from './script';
export { hasZeroDenominator } from './model';

const MD_QUERY = '(min-width: 48rem)';
const subscribeMd = (cb: () => void) => {
  const q = window.matchMedia(MD_QUERY);
  q.addEventListener('change', cb);
  return () => q.removeEventListener('change', cb);
};
let lastFit = 1;
const FIT_MS = 600;

export default function FractionBoard({ num1, num2, run, onStatus, onDone, renderSign, hoverEdit = false, availableWidth, fraction, onCycleFractionDigit }: FractionBoardProps): ReactElement {
  const f1: Frac = { n: numberValue(fraction.n1), d: numberValue(fraction.d1), s: num1.sign };
  const f2: Frac = { n: numberValue(fraction.n2), d: numberValue(fraction.d2), s: num2.sign };
  const ready = (['n1', 'd1', 'n2', 'd2'] as const).every(k => fraction[k].digits.length > 0);

  // The numbers of the whole explanation (valid only when both denominators are > 0)
  const valid = f1.d > 0 && f2.d > 0;
  const D = valid ? lcm(f1.d, f2.d) : 1;
  const k1 = D / (f1.d || 1);
  const k2 = D / (f2.d || 1);
  const a1 = f1.s * f1.n * k1; // amplified numerators, with their signs
  const a2 = f2.s * f2.n * k2;
  const N = a1 + a2;
  const g = gcd(Math.abs(N), D) || 1;
  const rn = Math.abs(N) / g;
  const rd = D / g;
  const sN: 1 | -1 = N < 0 ? -1 : 1;
  const whole = Math.floor(rn / rd);
  const rem = rn % rd;

  const [hl, setHl] = useState('');
  // The lists of multiples; null = "…" (the multiples of 1 are shortened: 1 … 5)
  const [multiples, setMultiples] = useState<{ a: (number | null)[]; b: (number | null)[]; common: number | null } | null>(null);
  const [amp1, setAmp1] = useState<Mark | null>(null);
  const [amp2, setAmp2] = useState<Mark | null>(null);
  const [line2, setLine2] = useState<{ t1: boolean; t2: boolean; den: boolean } | null>(null);
  const [line3, setLine3] = useState<{ num: boolean; den: boolean; simp: Mark | null } | null>(null);
  const [extra, setExtra] = useState<'whole' | 'mixed' | null>(null);
  // The mixed number explained, e.g. 15/8: 1 = (8 + 7)/8, 2 = 8/8 + 7/8, 3 = 1 + 7/8, then the mixed number 1 7/8.
  // parts / den / wholes / fw: what has already appeared (the jumps land on hidden places that then show up)
  const [mix, setMix] = useState<{ stage: 1 | 2 | 3; parts: number; den: boolean; wholes: number; fw: boolean } | null>(null);
  const [hop, setHop] = useState<Hop | null>(null);

  // The LCM by prime factorization (when a list of multiples would be longer than MAX_MULTIPLES): each denominator as
  // a product of primes (8 = 2 × 2 × 2), then with powers (= 2³), then every prime once with its biggest power (green),
  // which jump into the LCM row: 2³ × 3² = 8 × 9 = 72
  const fRows = [f1.d, f2.d].map(d => {
    const pf = primeFactors(d);
    return { d, pf, flat: pf.flatMap(({ p, e }) => Array<number>(e).fill(p)), hasPower: pf.some(x => x.e > 1) };
  });
  const lcmPicks = (() => {
    const best = new Map<number, { e: number; row: number }>();
    fRows.forEach((r, row) => r.pf.forEach(({ p, e }) => {
      const cur = best.get(p);
      if (!cur || e > cur.e) best.set(p, { e, row });
    }));
    return [...best.entries()].sort((a, b) => a[0] - b[0]).map(([p, { e, row }]) => ({ p, e, row }));
  })();
  const picked = (row: number, p: number) => lcmPicks.some(k => k.row === row && k.p === p);
  const [fact, setFact] = useState<{ rows: number; shown: number[]; power: boolean[]; pick: boolean; lcmRow: boolean; lcm: number; values: boolean; result: boolean } | null>(null);

  // The division-by-zero warning can be closed (its X, or a click anywhere outside it). Explain to Me and Redo stay
  // disabled while a denominator is 0; when a denominator becomes 0 again (or the other one does too), it comes back
  const zeroKey = `${f1.d === 0}-${f2.d === 0}`;
  const [closedFor, setClosedFor] = useState<string | null>(null);
  const [lastZeroKey, setLastZeroKey] = useState(zeroKey);
  if (lastZeroKey !== zeroKey) {
    setLastZeroKey(zeroKey);
    setClosedFor(null);
  }
  const alertRef = useRef<HTMLDivElement>(null);
  const alertOpen = (f1.d === 0 || f2.d === 0) && closedFor !== zeroKey;
  useEffect(() => {
    if (!alertOpen) return;
    const onDown = (e: PointerEvent) => {
      if (alertRef.current && !alertRef.current.contains(e.target as Node)) setClosedFor(zeroKey);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [alertOpen, zeroKey]);

  // Elements the jumps start from and land on, by name
  const refs = useRef<Record<string, HTMLElement | null>>({});
  const reg = (k: string) => (el: HTMLElement | null) => { refs.current[k] = el; };

  useEffect(() => runFractions({ run, ready, refs, setHop, valid, onStatus, onDone, f2, f1, setHl, D, k1, k2, setFact, fRows, lcmPicks, setMultiples, setAmp1, setAmp2, setLine2, a1, a2, setLine3, N, setExtra, g, rn, rd, sN, whole, setMix, rem }), [run]);

  // Fit: when the row of the calculations is wider than the board area, everything shrinks evenly (CSS zoom: digits,
  // signs, lines, chips, brackets) until it fits, down to 40%. Measured
  // after every render, at the natural size (the measured widths divided by the current zoom)
  const contentRef = useRef<HTMLDivElement>(null);
  // (the board is made anew for every new problem: it starts at the last scale, so it doesn't jump)
  const [fit, setFitState] = useState(() => lastFit);
  // A new scale is reached gently (Julian: slower), over FIT_MS, frame by frame (CSS zoom itself can't be animated);
  // the measurements use the scale drawn at that moment, so the target stays the same while it glides
  const fitAnim = useRef<{ target: number; raf: number }>({ target: lastFit, raf: 0 });
  const fitNow = useRef(fit);
  fitNow.current = fit;
  const setFit = (f: number) => {
    const a = fitAnim.current;
    if (Math.abs(a.target - f) < 0.01) return;
    a.target = f;
    lastFit = f;
    cancelAnimationFrame(a.raf);
    const from = fitNow.current, t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / FIT_MS), e = 1 - Math.pow(1 - k, 3);
      setFitState(from + (f - from) * e);
      if (k < 1) a.raf = requestAnimationFrame(step);
    };
    a.raf = requestAnimationFrame(step);
  };
  useEffect(() => () => cancelAnimationFrame(fitAnim.current.raf), []);
  // From md up (Julian): the fractions start 6.0625rem in from the board area's left edge and their digit-count drums
  // stay put (place and size: their own zoom undoes the board's, see drumZoom); the numbers grow to the right, and the
  // board only shrinks when it would reach the steps window (3px before it), as in addition / subtraction
  // (read at once, not after the first paint: the board is made anew for every new problem, and one frame without the
  // margin made the fractions jump left and back)
  const mdUp = useSyncExternalStore(subscribeMd, () => window.matchMedia(MD_QUERY).matches, () => false);
  // a phone: the drums in line with the Explain to Me box's left edge (the frame's 8px and the drums' own 4.5px taken
  // back, plus the column's edge, see usePhoneEdge)
  const edge = usePhoneEdge();
  useLayoutEffect(() => {
    const el = contentRef.current, row = el?.querySelector<HTMLElement>('[data-expr]');
    if (!el || !row || !availableWidth) return;
    const items = [...row.children] as HTMLElement[];
    // the drums' column: the same size on screen at any zoom
    const dW = el.querySelector<HTMLElement>('[data-fracdrums]')?.getBoundingClientRect().width ?? 0;
    const S = items.reduce((w, c) => w + c.getBoundingClientRect().width, 0);
    const rest = (S - dW) / fit + EXPR_GAP * Math.max(0, items.length - 1);
    const area = el.closest('.steps-scroll')?.getBoundingClientRect();
    const start = el.parentElement?.getBoundingClientRect().left ?? 0;
    const margin = parseFloat(getComputedStyle(el).marginLeft) * fit || 0;
    // the room on screen: up to 3px before the steps window (the board area's right edge); else as before
    const room = mdUp && area ? area.right - 3 - start - margin : (availableWidth - 16);
    // (down to 40%, not MIN_FIT: on a phone 12 digits must still fit, drums included, or the drums went off the screen —
    // Julian; the drums themselves shrink much less, see drumZoom)
    const next = Math.max(0.4, Math.min(1, (room - dW) / Math.max(1, rest * 1.01)));
    setFit(next);
  });
  // The drums' own zoom: back to their normal size (as in the other operations, they shrink only a little, late)
  const drumZoom = drumScaleFor(fit) / fit;

  if (!ready) return <div />;
  const editable = hoverEdit && !run;
  const variantOf = (key: string, part: 'n' | 'd'): DigitVariant => (hl === key || (hl === 'd' && part === 'd') ? 'highlight' : 'input');

  // A denominator of 0 can be chosen, but it is circled in red and the board warns under the problem
  const zero1 = f1.d === 0;
  const zero2 = f2.d === 0;
  const zeroWhere = zero1 && zero2 ? 'both fractions' : zero1 ? 'the first fraction' : 'the second fraction';

  // A numerator or denominator of the problem (1 to 6 digits), each digit turned with its steel drum while nothing runs
  const operand = (which: 'n1' | 'n2', part: 'n' | 'd', value: number) => {
    const key: FracPart = `${part}${which === 'n1' ? '1' : '2'}` as FracPart;
    return (
      // While the explanation runs (the digits can't be changed) the input digits are 15% bigger
      // (zoom, not scale: the brackets, the line, the chips and the sign make room for the bigger digits)
      <div ref={reg(key)} className={`flex gap-2.5 ${run ? '[zoom:1.15]' : ''} ${part === 'd' && value === 0 ? 'rounded-md ring-2 ring-red-500 ring-offset-2 ring-offset-zinc-950 shadow-[0_0_14px_rgba(239,68,68,0.75)] transition-shadow' : ''}`}>
        {fraction[key].digits.map((dg, i, all) => (
          <Fragment key={i}>
          <Digit
            digit={dg}
            variant={variantOf(which === 'n1' ? 'f1' : 'f2', part)}
            isNum1={which === 'n1'}
            operand
            hoverEditable={editable}
            onIncrement={() => onCycleFractionDigit(key, i, 1)}
            onDecrement={() => onCycleFractionDigit(key, i, -1)}
          />
          {/* Thousands separator (Julian): a comma after every third digit from the right */}
          {commaAfter(i, all.length) && <FracComma />}
          </Fragment>
        ))}
      </div>
    );
  };

  const problemFrac = (which: 'n1' | 'n2', f: Frac, amp: Mark | null) => {
    const id = which === 'n1' ? '1' : '2';
    return (
      <FracView
        roomForChip={!!amp}
        chip={amp ? { text: `×${amp.k}`, kind: 'times' } : undefined}
        top={<Crossable crossed={!!amp?.crossed} value={amp?.n ?? 0} refFn={reg(`n${id}x`)}>{operand(which, 'n', f.n)}</Crossable>}
        bottom={<Crossable crossed={!!amp?.crossed} value={amp?.d ?? 0} below refFn={reg(`d${id}x`)}>{operand(which, 'd', f.d)}</Crossable>}
      />
    );
  };

  const simp = line3?.simp ?? null;
  const sign = sN;

  return (
    // The jumping square stays outside the zoomed part (it is placed in screen pixels)
    <div className="flex flex-col items-start">
    {/* Zoomed to fit (see `fit`), and at most as wide as the board area, so the rows wrap (the second fraction under
        the first) instead of scrolling */}
    <div ref={contentRef} className="flex flex-col items-start" style={{ zoom: fit, marginLeft: mdUp ? `${6.0625 / fit}rem` : `${-(edge + 4) / 16 / fit}rem`, maxWidth: mdUp ? undefined : availableWidth ? Math.max(320, availableWidth - 16) / fit : undefined }}>
      <div data-expr className="flex flex-wrap items-center justify-start gap-x-5 gap-y-4">
        {/* The problem (Julian): the second fraction under the first, both starting at the same place, each with its
            sign in round brackets and its digit-count drums on its left (half as far from the bracket as before); the
            + between them on the right, outside the brackets, centred on the right bracket (of the wider fraction) */}
        <div className="grid grid-cols-[auto_auto] items-center">
          <div className="flex items-stretch gap-2">
            {/* How many digits its numerator and denominator have (see OperandDrum) */}
            <div data-fracdrums className="relative right-[0.28125rem] flex flex-col justify-center gap-3 mr-1" style={{ zoom: drumZoom }}><OperandDrum part="n1" /><OperandDrum part="d1" /></div>
            <Bracket side="left" />
            <div className="flex items-center gap-2">{renderSign('n1', num1.sign)}{problemFrac('n1', f1, amp1)}</div>
            <Bracket side="right" />
          </div>
          <span />
          <span />
          <span className="text-cyan-500 -ml-[1.1875rem]"><OpIcon op="addition" /></span>
          <div className="flex items-stretch gap-2">
            {/* How many digits its numerator and denominator have (see OperandDrum) */}
            <div data-fracdrums className="relative right-[0.28125rem] flex flex-col justify-center gap-3 mr-1" style={{ zoom: drumZoom }}><OperandDrum part="n2" /><OperandDrum part="d2" /></div>
            <Bracket side="left" />
            <div className="flex items-center gap-2">{renderSign('n2', num2.sign)}{problemFrac('n2', f2, amp2)}</div>
            <Bracket side="right" />
          </div>
          <span />
        </div>

        {/* One fraction, one long line under the numerators and their signs */}
        {line2 && (
          <div className="flex items-center gap-4">
            <Eq />
            <FracView
              topRef={reg('top2')}
              top={(
                <>
                  {a1 < 0 && <SignMark s={-1} hidden={!line2.t1} />}
                  <Num value={a1} variant="computed" refFn={reg('t1')} hidden={!line2.t1} />
                  <SignMark s={a2 < 0 ? -1 : 1} hidden={!line2.t2} />
                  <Num value={a2} variant="computed" refFn={reg('t2')} hidden={!line2.t2} />
                </>
              )}
              bottom={<Num value={D} variant="computed" refFn={reg('den')} hidden={!line2.den} />}
            />
          </div>
        )}

        {/* The sum of the numerators over the common denominator (then simplified) */}
        {line3 && (
          <div className="flex items-center gap-4">
            <Eq />
            <FracView
              roomForChip={!!simp}
              chip={simp ? { text: `÷${simp.k}`, kind: 'divide' } : undefined}
              top={(
                <>
                  {sign < 0 && <SignMark s={-1} hidden={!line3.num} />}
                  <Crossable crossed={!!simp?.crossed} value={simp?.n ?? 0} refFn={reg('rnx')}><Num value={N} variant="result" refFn={reg('rn')} hidden={!line3.num} /></Crossable>
                </>
              )}
              bottom={<Crossable crossed={!!simp?.crossed} value={simp?.d ?? 0} below refFn={reg('rdx')}><Num value={D} variant="result" refFn={reg('rd')} hidden={!line3.den} /></Crossable>}
            />
          </div>
        )}

        {/* A whole number, or a mixed number */}
        {extra === 'whole' && (
          <div className="flex items-center gap-4">
            <Eq />
            {sign < 0 && N !== 0 && <SignMark s={-1} />}
            <Num value={N === 0 ? 0 : rn} variant="result" />
          </div>
        )}
        {/* The mixed number explained: (8 + 7)/8 = 8/8 + 7/8 = 1 + 7/8 (wholes ringed in green) */}
        {mix && (() => {
          const few = whole <= MAX_WHOLE_PIECES;
          const ring = 'rounded-md ring-2 ring-green-400/80 shadow-[0_0_10px_rgba(74,222,128,0.45)]';
          const neg = sign < 0;
          return (
            <>
              <div className="flex items-center gap-4">
                <Eq />
                {neg && <SignMark s={-1} />}
                <FracView
                  topRef={reg('m1top')}
                  top={few ? (
                    <>
                      {[...Array(whole).fill(rd), rem].map((v: number, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          {i > 0 && <SignMark s={1} hidden={mix.parts <= i} />}
                          <div className={i < whole && mix.parts > i ? `${ring} p-1` : 'p-1'}><Num value={v} variant="computed" hidden={mix.parts <= i} /></div>
                        </div>
                      ))}
                    </>
                  ) : (
                    <>
                      <div className={`flex items-center gap-1.5 transition-opacity duration-500 ${mix.parts >= 1 ? `opacity-100 ${ring} p-1` : 'opacity-0'}`}>
                        <Num value={whole} variant="computed" /><Times /><Num value={rd} variant="computed" />
                      </div>
                      <SignMark s={1} hidden={mix.parts < 2} />
                      <Num value={rem} variant="computed" hidden={mix.parts < 2} />
                    </>
                  )}
                  bottom={<Num value={rd} variant="computed" refFn={reg('m1den')} hidden={!mix.den} />}
                />
              </div>
              {mix.stage >= 2 && (
                <div className="flex items-center gap-3 animate-pop-in">
                  <Eq />
                  {neg && <SignMark s={-1} />}
                  {neg && <Paren ch="(" />}
                  {(few ? [...Array(whole).keys()] : [0]).map(i => (
                    <div key={i} className="flex items-center gap-3">
                      {i > 0 && <SignMark s={1} />}
                      {/* the ring hugs the fraction: its own top/bottom room (py-7) is taken away inside the ring */}
                      <div ref={reg(`m2w${i}`)} className={`${ring} px-1 [&_.frac-col]:py-1`}>
                        <FracView top={<Num value={few ? rd : whole * rd} variant="computed" />} bottom={<Num value={rd} variant="computed" />} />
                      </div>
                    </div>
                  ))}
                  <SignMark s={1} />
                  <FracView top={<Num value={rem} variant="computed" />} bottom={<Num value={rd} variant="computed" />} />
                  {neg && <Paren ch=")" />}
                </div>
              )}
              {mix.stage >= 3 && (
                <div className="flex items-center gap-3 animate-pop-in">
                  <Eq />
                  {neg && <SignMark s={-1} />}
                  {neg && <Paren ch="(" />}
                  <div ref={reg('m3ws')} className="flex items-center gap-3">
                    {(few ? [...Array(whole).keys()] : [0]).map(i => (
                      <div key={i} className="flex items-center gap-3">
                        {i > 0 && <SignMark s={1} hidden={mix.wholes <= i} />}
                        <Num value={few ? 1 : whole} variant="result" refFn={reg(`m3w${i}`)} hidden={mix.wholes <= i} />
                      </div>
                    ))}
                  </div>
                  <SignMark s={1} />
                  <FracView top={<Num value={rem} variant="computed" />} bottom={<Num value={rd} variant="computed" />} />
                  {neg && <Paren ch=")" />}
                </div>
              )}
            </>
          );
        })()}
        {extra === 'mixed' && (
          <div className="flex items-center gap-4">
            <Eq />
            <div className="flex items-center gap-2">
              {sign < 0 && <SignMark s={-1} hidden={!mix?.fw} />}
              <Num value={whole} variant="result" refFn={reg('fw')} hidden={!mix?.fw} />
              <FracView top={<Num value={rem} variant="result" />} bottom={<Num value={rd} variant="result" />} />
            </div>
          </div>
        )}
      </div>

      {/* Division by zero: the warning stays until the red denominator is changed. Red plate (#e73131), light text
          (#f2f2f2), and a warning triangle in its top-left corner: the triangle in the text's colour, the "!" in the
          plate's colour, with a soft shadow */}
      {alertOpen && (
        <div ref={alertRef} role="alert" className="relative mt-2 max-w-md rounded-xl border border-[#ff7a7a]/50 bg-[#e73131] py-2.5 pl-12 pr-9 text-center text-[#f2f2f2] shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_4px_14px_rgba(231,49,49,0.45)] animate-pop-in">
          <WarningIcon />
          {/* Close: only the X, no circle or frame; on hover it gets bolder (2 → 3) so it stands out */}
          <button type="button" onClick={() => setClosedFor(zeroKey)} aria-label="Close the warning" className="group absolute right-2 top-2 p-1 text-[#f2f2f2] opacity-85 transition-opacity hover:opacity-100 focus-visible:outline-2 focus-visible:outline-[#f2f2f2] rounded-sm cursor-pointer">
            <svg viewBox="0 0 12 12" aria-hidden="true" className="block w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M2 2l8 8M10 2l-8 8" className="transition-[stroke-width] duration-150 group-hover:stroke-3" /></svg>
          </button>
          <div className="text-sm font-black">We can&apos;t divide by zero!</div>
          <div className="text-[13px] font-semibold">The denominator (the bottom number) can&apos;t be 0. Choose a different number, from 1 to 9, for {zeroWhere}.</div>
        </div>
      )}

      {/* The LCM by prime factorization: "Prime factors of 8:  2 × 2 × 2 = 2³", one row per denominator, then
          "LCM:  2³ × 3² = 8 × 9 = 72". Same grid as the multiples (labels on the left, stacked on phones) */}
      {fact && (
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-[auto_auto] items-center gap-x-3 gap-y-1 sm:gap-y-2">
          {fRows.slice(0, fact.rows).map((row, r) => (
            <div key={r} className="contents">
              <span className="whitespace-nowrap text-left text-xs font-bold text-zinc-400 mt-1 sm:mt-0">Prime factors of {row.d}:</span>
              <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
                {row.flat.length === 0 ? <FactorChip p={1} hidden={fact.shown[r] < 1} /> : row.flat.map((p, i) => {
                  const firstOfP = row.flat.indexOf(p) === i;
                  return (
                    <Fragment key={i}>
                      {i > 0 && <Mul hidden={fact.shown[r] <= i} />}
                      <FactorChip p={p} hidden={fact.shown[r] <= i} pick={fact.pick && !row.hasPower && firstOfP && picked(r, p)} refFn={!row.hasPower && firstOfP ? reg(`pf${r}-${p}`) : undefined} />
                    </Fragment>
                  );
                })}
                {row.hasPower && fact.power[r] && (
                  <>
                    <SmallEq />
                    {row.pf.map(({ p, e }, i) => (
                      <Fragment key={p}>
                        {i > 0 && <Mul />}
                        <FactorChip p={p} e={e} pick={fact.pick && picked(r, p)} refFn={reg(`pf${r}-${p}`)} />
                      </Fragment>
                    ))}
                  </>
                )}
              </div>
            </div>
          ))}
          {fact.lcmRow && (
            <div className="contents">
              <span className="whitespace-nowrap text-left text-xs font-bold text-zinc-400 mt-1 sm:mt-0">LCM:</span>
              <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
                {lcmPicks.map((k, i) => (
                  <Fragment key={k.p}>
                    {i > 0 && <Mul hidden={fact.lcm <= i} />}
                    <FactorChip p={k.p} e={k.e} hidden={fact.lcm <= i} refFn={reg(`lcm${i}`)} />
                  </Fragment>
                ))}
                {fact.values && (
                  <>
                    <SmallEq />
                    {lcmPicks.map((k, i) => (
                      <Fragment key={k.p}>
                        {i > 0 && <Mul />}
                        <FactorChip p={k.p ** k.e} />
                      </Fragment>
                    ))}
                  </>
                )}
                {fact.result && <><SmallEq /><FactorChip p={D} pick /></>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Looking for the common denominator: a grid of two columns. The labels ("Multiples of 6:") start on the left,
          one under the other, colons aligned, never wrapping; the numbers are aligned to the right, so the common
          multiple (green) is in the same column on every row. On narrow screens (under 640px) each label goes on its own
          line, above its numbers, and the cells get smaller, so 9 multiples still fit on a phone */}
      {multiples && (
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-[auto_auto] items-center gap-x-3 gap-y-1 sm:gap-y-2">
          {[{ d: f1.d, list: multiples.a, id: 'a' }, { d: f2.d, list: multiples.b, id: 'b' }].map(row => (
            <div key={row.id} className="contents">
              <span className="whitespace-nowrap text-left text-xs font-bold text-zinc-400 mt-1 sm:mt-0">Multiples of {row.d}:</span>
              <div className="flex justify-end gap-1 sm:gap-1.5">
                {row.list.map(v => (v === null ? (
                  <span key="dots" aria-label="and so on" className="min-w-6.5 h-6.5 sm:min-w-8 sm:h-7 flex items-center justify-center text-sm sm:text-base font-black tracking-wider text-zinc-500 animate-pop-in">…</span>
                ) : (
                  <span key={v} className={`min-w-6.5 h-6.5 px-1 text-xs sm:min-w-8 sm:h-7 sm:px-1.5 sm:text-sm flex items-center justify-center rounded-md border font-black animate-pop-in transition-colors duration-500 ${multiples.common === v ? 'bg-green-600 border-green-400 text-white shadow-[0_0_12px_rgba(74,222,128,0.6)]' : 'bg-zinc-800 border-zinc-700 text-zinc-300'}`}>
                    {v}
                  </span>
                )))}
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
      {hop && <CarryHop key={hop.key} fixed duration={FR_HOP_MS} endScale={FR_HOP_END} fadeOutMs={FR_LAND_MS} wide x0={hop.x0} y0={hop.y0} x1={hop.x1} y1={hop.y1} value={hop.value} />}
    </div>
  );
}
