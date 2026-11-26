import type { Dispatch, RefObject, SetStateAction } from 'react';
import { paced, pausableTimeout, doneMessage } from '../../math/shared';
import { FR_HOP_MS, FR_HOP_PAUSE, FR_LAND_MS, type Frac, type Hop, MAX_MULTIPLES, MAX_WHOLE_PIECES, type Mark, listLength, listOf, powerText, showFrac } from './model';

// What the explanation works with: the board's props, state setters, refs and measurements
export interface FractionScript {
  run: boolean;
  ready: boolean;
  refs: RefObject<Record<string, HTMLElement | null>>;
  setHop: Dispatch<SetStateAction<Hop | null>>;
  valid: boolean;
  onStatus: (text: string) => void;
  onDone: () => void;
  f2: Frac;
  f1: Frac;
  setHl: Dispatch<SetStateAction<string>>;
  D: number;
  k1: number;
  k2: number;
  setFact: Dispatch<SetStateAction<{ rows: number; shown: number[]; power: boolean[]; pick: boolean; lcmRow: boolean; lcm: number; values: boolean; result: boolean; } | null>>;
  fRows: { d: number; pf: { p: number; e: number; }[]; flat: number[]; hasPower: boolean; }[];
  lcmPicks: { p: number; e: number; row: number; }[];
  setMultiples: Dispatch<SetStateAction<{ a: (number | null)[]; b: (number | null)[]; common: number | null; } | null>>;
  setAmp1: Dispatch<SetStateAction<Mark | null>>;
  setAmp2: Dispatch<SetStateAction<Mark | null>>;
  setLine2: Dispatch<SetStateAction<{ t1: boolean; t2: boolean; den: boolean; } | null>>;
  a1: number;
  a2: number;
  setLine3: Dispatch<SetStateAction<{ num: boolean; den: boolean; simp: Mark | null; } | null>>;
  N: number;
  setExtra: Dispatch<SetStateAction<"whole" | "mixed" | null>>;
  g: number;
  rn: number;
  rd: number;
  sN: 1 | -1;
  whole: number;
  setMix: Dispatch<SetStateAction<{ stage: 1 | 2 | 3; parts: number; den: boolean; wholes: number; fw: boolean; adding: boolean; sum: boolean; } | null>>;
  rem: number;
  showFractions: (id: string) => void;
}

// The explanation, started when `run` turns true
export function runFractions({ run, ready, refs, setHop, valid, onStatus, onDone, f2, f1, setHl, D, k1, k2, setFact, fRows, lcmPicks, setMultiples, setAmp1, setAmp2, setLine2, a1, a2, setLine3, N, setExtra, g, rn, rd, sN, whole, setMix, rem, showFractions }: FractionScript) {
  if (!run || !ready) return;
  let alive = true;
  let seq = 0;
  const wait = (ms: number) => new Promise<boolean>(resolve => pausableTimeout(() => resolve(alive), paced(ms)));
  const centre = (k: string) => {
    const r = refs.current[k]?.getBoundingClientRect();
    return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
  };
  // A number jumps slowly in an arc (like a carry) from one place to another, then a short pause
  // `land` shows what the number brings: FR_LAND_MS before the end, while the square fades out (crossfade)
  const jump = async (from: string, to: string, value: number | string, land: () => void) => {
    const a = centre(from);
    const b = centre(to);
    if (a && b) setHop({ x0: a.x, y0: a.y, x1: b.x, y1: b.y, value, key: `h${seq++}` });
    if (!(await wait(FR_HOP_MS - FR_LAND_MS))) return false;
    land();
    const ok = await wait(FR_LAND_MS);
    setHop(null);
    return ok && wait(FR_HOP_PAUSE);
  };

  (async () => {

    // React's strict mode (dev) mounts, cleans up and mounts again: let the throwaway run end here,

    // before it announces its first step (otherwise that step shows twice)

    await Promise.resolve();

    if (!alive) return;
    if (!valid) {
      onStatus('We can\'t divide by zero: a denominator can\'t be 0. Choose a different number for the red denominator, then try again.');
      onDone();
      return;
    }
    const second = f2.s < 0 ? `(${showFrac(f2)})` : showFrac(f2);
    onStatus(`We add the fractions ${showFrac(f1)} + ${second}.${f2.s < 0 ? ' Adding a negative fraction is the same as subtracting it.' : ''}`);
    if (!(await wait(2080))) return;

    if (f1.d === f2.d) {
      setHl('d');
      onStatus(`Both fractions have the denominator ${D}: their pieces are the same size, so we can add the numerators straight away.`);
      if (!(await wait(1800))) return;
    } else {
      setHl('d');
      const byFactors = listLength(f1.d, k1) > MAX_MULTIPLES || listLength(f2.d, k2) > MAX_MULTIPLES;
      onStatus(`The denominators ${f1.d} and ${f2.d} are different: the pieces have different sizes. We need a common denominator: the least common multiple (LCM) of ${f1.d} and ${f2.d}.`);
      if (!(await wait(1800))) return;
      if (byFactors) {
        // Prime factorization, row by row: the multiplication first, then the same written with powers
        onStatus(`The lists of multiples would be too long, so we break each denominator into prime factors: numbers that can't be split any more.`);
        if (!(await wait(2200))) return;
        const st = { rows: 0, shown: [0, 0], power: [false, false], pick: false, lcmRow: false, lcm: 0, values: false, result: false };
        const put = () => setFact({ ...st, shown: [...st.shown], power: [...st.power] });
        for (let r = 0; r < 2; r++) {
          const row = fRows[r];
          st.rows = r + 1;
          put();
          onStatus(row.d === 1 ? '1 has no prime factors.'
            : row.flat.length === 1 ? `${row.d} is a prime number: it can't be split into smaller factors.`
            : `${row.d} = ${row.flat.join(' × ')}.`);
          for (let i = 0; i < Math.max(1, row.flat.length); i++) {
            st.shown[r] = i + 1;
            put();
            if (!(await wait(450))) return;
          }
          if (row.hasPower) {
            const first = row.pf.find(x => x.e > 1) ?? row.pf[0];
            if (!(await wait(500))) return;
            st.power[r] = true;
            put();
            onStatus(`${Array(first.e).fill(first.p).join(' × ')} is written ${powerText(first.p, first.e)} (say: ${first.p} to the power of ${first.e}): ${first.p} multiplied by itself ${first.e} times. So ${row.d} = ${row.pf.map(x => powerText(x.p, x.e)).join(' × ')}.`);
            if (!(await wait(2800))) return;
          } else if (!(await wait(1200))) return;
        }
        onStatus(`For the LCM we take every prime factor once, with its biggest power: ${lcmPicks.map(k => `${powerText(k.p, k.e)} from ${fRows[k.row].d}`).join(' and ')}.`);
        st.pick = true;
        put();
        if (!(await wait(2200))) return;
        st.lcmRow = true;
        put();
        if (!(await wait(400))) return;
        for (let i = 0; i < lcmPicks.length; i++) {
          const k = lcmPicks[i];
          if (!(await jump(`pf${k.row}-${k.p}`, `lcm${i}`, powerText(k.p, k.e), () => { st.lcm = i + 1; put(); }))) return;
        }
        if (lcmPicks.some(k => k.e > 1)) {
          onStatus(`${lcmPicks.map(k => powerText(k.p, k.e)).join(' × ')} = ${lcmPicks.map(k => k.p ** k.e).join(' × ')} = ${D}.`);
          st.values = true;
          put();
          if (!(await wait(1800))) return;
        }
        st.result = true;
        put();
        onStatus(`${D} is the least common multiple (LCM) of ${f1.d} and ${f2.d}: our common denominator.`);
        if (!(await wait(2000))) return;
      } else {
      // The multiples of each denominator, one by one (see listOf)
      const A: (number | null)[] = [];
      const B: (number | null)[] = [];
      setMultiples({ a: [], b: [], common: null });
      for (const v of listOf(f1.d, k1)) {
        A.push(v);
        setMultiples({ a: [...A], b: [], common: null });
        if (!(await wait(380))) return;
      }
      for (const v of listOf(f2.d, k2)) {
        B.push(v);
        setMultiples({ a: [...A], b: [...B], common: null });
        if (!(await wait(380))) return;
      }
      setMultiples({ a: A, b: B, common: D });
      onStatus(`${D} is the first number in both lists: the least common multiple. It is our common denominator.`);
      if (!(await wait(1800))) return;
      }

      // Amplify each fraction whose denominator isn't D yet
      const steps: { f: Frac; k: number; set: (m: Mark | null) => void; id: string }[] = [
        { f: f1, k: k1, set: setAmp1, id: '1' },
        { f: f2, k: k2, set: setAmp2, id: '2' },
      ];
      for (const st of steps) {
        setHl(`f${st.id}`);
        // The LCM is found: back up to the fraction being amplified (Julian: on a phone held sideways the lists took the
        // screen, and the amplifying happened out of sight)
        if (st.k === 1) {
          showFractions(st.id);
          onStatus(`${showFrac(st.f)} already has the denominator ${D}: it stays as it is.`);
          if (!(await wait(1500))) return;
          continue;
        }
        onStatus(`${st.f.d} × ${st.k} = ${D}, so we multiply the numerator AND the denominator of ${showFrac(st.f)} by ${st.k}. The fraction keeps its value: the pieces just get smaller.`);
        st.set({ k: st.k, crossed: false, n: st.f.n * st.k, d: D });
        showFractions(st.id);
        if (!(await wait(2000))) return;
        onStatus(`${st.f.n} × ${st.k} = ${st.f.n * st.k}  and  ${st.f.d} × ${st.k} = ${D}.`);
        st.set({ k: st.k, crossed: true, n: st.f.n * st.k, d: D });
        showFractions(st.id);
        if (!(await wait(1800))) return;
      }
    }
    setHl('');
    // (the view follows the work again)
    showFractions('');

    // One fraction with a long line: the numerators with their signs on top, the common denominator below
    setLine2({ t1: false, t2: false, den: false });
    onStatus(`Now both fractions have the denominator ${D}. We write them as ONE fraction: a long line, the numerators with their signs on top, ${D} below.`);
    if (!(await wait(700))) return;
    if (!(await jump(k1 > 1 ? 'n1x' : 'n1', 't1', Math.abs(a1), () => setLine2({ t1: true, t2: false, den: false })))) return;
    if (!(await jump(k2 > 1 ? 'n2x' : 'n2', 't2', Math.abs(a2), () => setLine2({ t1: true, t2: true, den: false })))) return;
    if (!(await jump(k1 > 1 ? 'd1x' : 'd1', 'den', D, () => setLine2({ t1: true, t2: true, den: true })))) return;
    if (!(await wait(1300))) return;

    // The sum of the numerators; the denominator stays
    setLine3({ num: false, den: false, simp: null });
    onStatus(`${a1 < 0 ? '−' : ''}${Math.abs(a1)} ${a2 < 0 ? '−' : '+'} ${Math.abs(a2)} = ${N < 0 ? '−' : ''}${Math.abs(N)}. The denominator stays ${D}: we counted pieces of the same size.`);
    if (!(await wait(700))) return;
    if (!(await jump('top2', 'rn', Math.abs(N), () => setLine3({ num: true, den: false, simp: null })))) return;
    if (!(await jump('den', 'rd', D, () => setLine3({ num: true, den: true, simp: null })))) return;
    if (!(await wait(1500))) return;

    if (N === 0) {
      onStatus('The numerator is 0: no pieces at all, so the result is 0.');
      setExtra('whole');
      if (!(await wait(1500))) return;
    } else {
      if (g > 1) {
        onStatus(`${Math.abs(N)} and ${D} can both be divided by ${g}, so we simplify the fraction: top and bottom ÷ ${g}.`);
        setLine3({ num: true, den: true, simp: { k: g, crossed: false, n: rn, d: rd } });
        if (!(await wait(2000))) return;
        onStatus(`${Math.abs(N)} ÷ ${g} = ${rn}  and  ${D} ÷ ${g} = ${rd}.`);
        setLine3({ num: true, den: true, simp: { k: g, crossed: true, n: rn, d: rd } });
        if (!(await wait(1800))) return;
      }
      if (rd === 1) {
        onStatus(`The denominator is 1, so the result is the whole number ${sN < 0 ? '−' : ''}${rn}.`);
        setExtra('whole');
        if (!(await wait(1500))) return;
      } else if (rn > rd) {
        // How the whole in front is found: split the numerator into wholes (rd pieces each) and the rest
        const few = whole <= MAX_WHOLE_PIECES;
        const pieces = few ? whole + 1 : 2;
        const st = { stage: 1 as 1 | 2 | 3, parts: 0, den: false, wholes: 0, fw: false, adding: false, sum: false };
        setMix({ ...st });
        onStatus(few
          ? `${rn}/${rd} is more than a whole. One whole is ${rd}/${rd}: ${rd} pieces of ${rd}. So we split ${rn} into ${[...Array(whole).fill(rd), rem].join(' + ')}.`
          : `${rn}/${rd} is more than a whole. ${rn} ÷ ${rd} = ${whole} remainder ${rem}, so ${rn} = ${whole} × ${rd} + ${rem}.`);
        if (!(await wait(900))) return;
        // The first piece appears as the number lands; the others follow
        if (!(await jump(g > 1 ? 'rnx' : 'rn', 'm1top', rn, () => { st.parts = 1; setMix({ ...st }); }))) return;
        if (!(await wait(650))) return;
        for (let i = 2; i <= pieces; i++) {
          st.parts = i;
          setMix({ ...st });
          if (!(await wait(650))) return;
        }
        if (!(await jump(g > 1 ? 'rdx' : 'rd', 'm1den', rd, () => { st.den = true; setMix({ ...st }); }))) return;
        if (!(await wait(1600))) return;

        st.stage = 2;
        setMix({ ...st });
        onStatus(few
          ? `Each part goes over ${rd}: ${[...Array(whole).fill(`${rd}/${rd}`), `${rem}/${rd}`].join(' + ')}.`
          : `Each part goes over ${rd}: ${whole * rd}/${rd} + ${rem}/${rd}.`);
        if (!(await wait(2400))) return;

        st.stage = 3;
        setMix({ ...st });
        onStatus(few
          ? `${rd}/${rd} is one whole: ${rd} pieces of ${rd}. So ${rd}/${rd} = 1.`
          : `${whole * rd}/${rd} = ${whole * rd} ÷ ${rd} = ${whole} wholes.`);
        if (!(await wait(700))) return;
        for (let i = 0; i < (few ? whole : 1); i++) {
          if (!(await jump(`m2w${i}`, `m3w${i}`, few ? 1 : whole, () => { st.wholes = i + 1; setMix({ ...st }); }))) return;
        }
        if (!(await wait(1400))) return;

        // The wholes are added (Julian): the 1s flash, their sum shows up (highlighted) on the next line, and that sum is
        // what goes to the final result
        const addUp = few && whole > 1;
        if (addUp) {
          onStatus(`${Array(whole).fill(1).join(' + ')} = ${whole}: ${whole} wholes.`);
          for (const on of [true, false, true]) {
            st.adding = on;
            setMix({ ...st });
            if (!(await wait(on ? 450 : 250))) return;
          }
          if (!(await wait(500))) return;
          st.adding = false;
          st.sum = true;
          setMix({ ...st });
          if (!(await wait(1800))) return;
        }

        setExtra('mixed');
        onStatus(`${whole} + ${rem}/${rd} is written as the mixed number ${whole} ${rem}/${rd}: ${whole} whole${whole > 1 ? 's' : ''} and ${rem}/${rd}.`);
        if (!(await wait(700))) return;
        if (!(await jump(addUp ? 'm4w' : 'm3ws', 'fw', whole, () => { st.fw = true; setMix({ ...st }); }))) return;
        if (!(await wait(1800))) return;
      }
    }

    const sign = sN < 0 && N !== 0 ? '−' : '';
    const result = N === 0 ? '0' : rd === 1 ? `${sign}${rn}` : rn > rd ? `${sign}${whole} ${rem}/${rd}` : `${sign}${rn}/${rd}`;
    onStatus(doneMessage(result, rn > rd && rd > 1 ? `  (= ${sign}${rn}/${rd})` : ''));
    onDone();
  })();

  return () => { alive = false; };
  // The board is remounted (new key) for every new run, so it only depends on `run`
  // eslint-disable-next-line react-hooks/exhaustive-deps
}
