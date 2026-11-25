"use client";

// How many digits a number has, turned on a steel drum right next to the number on the board (Julian): left of N1 and
// left of N2 (fractions: left of each fraction, its numerator's drum over its denominator's). The page gives the
// counts through `DigitDrums`; without it (nothing to change) no drum is drawn.
// The board is made anew for every new problem (every digit-count change), and a drum inside it would be made anew
// too, losing what it was doing: the white arrow of the cursor while counting, the wheel / trackpad gesture going on,
// a drag, the keyboard focus (Julian: the arrows stopped working). So the board only keeps a PLACE for each drum
// (`OperandDrum`, same size, moved and scaled with the board), and the real drums live in `DrumLayer`, made once by
// the page and drawn over their places, frame by frame

import { createContext, useContext, useEffect, useRef, useSyncExternalStore, type ReactElement, type RefObject } from 'react';
import { CountDrum } from './Drum';
import type { FracPart } from './types';

export interface DigitDrumsValue {
  value: (part: FracPart) => number;
  max: number;
  set: (part: FracPart, v: number) => void;
  disabled: boolean;
  label: (part: FracPart) => string;
  // the drums of the operation shown (n1, n2; fractions: n1, d1, n2, d2)
  parts: FracPart[];
}
export const DigitDrums = createContext<DigitDrumsValue | null>(null);

// A phone (narrower than md, the controls column above the board): the boards start at the area's left edge, so the
// digit-count drums line up with the left edge of the Explain to Me box (Julian), in every operation
const MD_QUERY = '(min-width: 48rem)';
const subscribeMd = (cb: () => void) => {
  const q = window.matchMedia(MD_QUERY);
  q.addEventListener('change', cb);
  return () => q.removeEventListener('change', cb);
};
export const usePhone = (): boolean => useSyncExternalStore(subscribeMd, () => !window.matchMedia(MD_QUERY).matches, () => false);
// How far the controls column (and so the Explain to Me box) sits left of the board area on a phone: EDGE_5 — 2px,
// 10px from sm (40rem) up. Nominal px
const SM_QUERY = '(min-width: 40rem)';
const subscribeSm = (cb: () => void) => {
  const q = window.matchMedia(SM_QUERY);
  q.addEventListener('change', cb);
  return () => q.removeEventListener('change', cb);
};
export const usePhoneEdge = (): number => useSyncExternalStore(subscribeSm, () => (window.matchMedia(SM_QUERY).matches ? 10 : 2), () => 2);

// When the board shrinks (a phone, or the steps window made wider), the drums shrink much less than the digits
// (Julian): not at all while the board is at 75% or more, then slowly, never below 80%
export const drumScaleFor = (fit: number): number => (fit >= 0.75 ? 1 : Math.max(0.8, 1 - (0.75 - fit) * 0.8));
// What the board gives its drums: their own scale over the board's (drawn from their right edge, so they grow to the
// left, away from the N1 / N2 tags). The boards keep room for that (see FitBoard and useAddSubFit)
export const DrumZoom = createContext(1);
// From a board's sign buttons (their left edge) to the drums' left edge: the tag (8px before the buttons, 32px wide),
// 15px, a drum (56px, w-14) — board px, at the drums' normal size
export const DRUM_W = 56;
export const DRUM_REACH = 8 + 32 + 15 + DRUM_W;
// The drums' extra width to the left when drawn `drumScaleFor(fit)` while the board is drawn `fit` (board px)
export const drumExtra = (drumW: number, fit: number): number => drumW * (drumScaleFor(fit) / fit - 1);
// The board's scale, found by trying: the room the drums need depends on the scale itself. `fitFor(extra)` is the
// scale for a board needing `extra` more px on the left
export const solveFit = (drumW: number, fitFor: (extra: number) => number): number => {
  let f = fitFor(0);
  if (!drumW) return f;
  for (let i = 0; i < 16; i++) f = fitFor(drumExtra(drumW, f));
  return f;
};

// The drum's place on the board (see above): as big as a count drum (w-14 × h-10), `dy`: moved up (negative) or down
// by that many px, the digits staying where they are; scaled with DrumZoom
export function OperandDrum({ part, dy = 0 }: { part: FracPart; dy?: number }): ReactElement | null {
  const c = useContext(DigitDrums);
  const zoom = useContext(DrumZoom);
  if (!c) return null;
  return (
    <div data-drum data-drumpart={part} aria-hidden="true" className="relative w-14 h-10 shrink-0 pointer-events-none" style={{ ...(dy ? { top: dy } : {}), ...(zoom !== 1 ? { transform: `scale(${zoom})`, transformOrigin: 'right center' } : {}) }} />
  );
}

// The real drums, made once by the page inside the board area (`host`, the area that scrolls), each drawn over its
// place on the board (position and scale read every frame, so it follows the board when it moves, shrinks or scrolls).
// Hidden while its place isn't on the board (e.g. addition while the rewritten problem is shown)
export function DrumLayer({ host }: { host: RefObject<HTMLDivElement | null> }): ReactElement | null {
  const c = useContext(DigitDrums);
  const els = useRef<Partial<Record<FracPart, HTMLDivElement | null>>>({});
  // A phone (Julian): like a digit, a touched drum grows (20% here) and goes back 3 s after the last touch, or at once
  // on a touch outside it. `grow`: each drum's extra scale now (eased towards its target every frame)
  const phone = usePhone();
  const grow = useRef<Partial<Record<FracPart, { now: number; target: number; timer: number }>>>({});
  const touch = (part: FracPart) => {
    const g = grow.current[part] ?? (grow.current[part] = { now: 1, target: 1, timer: 0 });
    g.target = 1.2;
    window.clearTimeout(g.timer);
    g.timer = window.setTimeout(() => { g.target = 1; }, 3000);
  };
  useEffect(() => {
    if (!phone) return;
    const onDown = (e: PointerEvent) => {
      for (const [part, g] of Object.entries(grow.current)) {
        const el = els.current[part as FracPart];
        if (g && g.target !== 1 && !(el && el.contains(e.target as Node))) { g.target = 1; window.clearTimeout(g.timer); }
      }
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [phone]);
  useEffect(() => () => Object.values(grow.current).forEach(g => g && window.clearTimeout(g.timer)), []);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const h = host.current;
      if (h) {
        const hr = h.getBoundingClientRect();
        const rootPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
        for (const [part, el] of Object.entries(els.current)) {
          if (!el) continue;
          const place = h.querySelector<HTMLElement>(`[data-drumpart="${part}"]`);
          if (!place) { el.style.visibility = 'hidden'; continue; }
          const r = place.getBoundingClientRect();
          const scale = r.width / ((DRUM_W / 16) * rootPx);
          const g = grow.current[part as FracPart];
          if (g) g.now += (g.target - g.now) * 0.25;
          const extra = g && Math.abs(g.now - 1) > 0.001 ? g.now : 1;
          // (grown from the middle of its left edge, so it stays whole inside the board area — it starts at the area's
          // left edge on a phone — and only reaches into the gap before N1 / N2; never above the area's top)
          const dx = 0;
          const dy = Math.min((r.height * (extra - 1)) / 2, Math.max(0, r.top - hr.top - 2));
          el.style.visibility = '';
          el.style.zIndex = extra > 1 ? '50' : '';
          el.style.transform = `translate(${r.left - hr.left + h.scrollLeft - dx}px, ${r.top - hr.top + h.scrollTop - dy}px) scale(${scale * extra})`;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [host]);
  if (!c) return null;
  return (
    <>
      {c.parts.map(part => {
        const v = c.value(part);
        return (
          <div key={part} ref={el => { els.current[part] = el; }} onPointerDownCapture={phone ? () => touch(part) : undefined} onWheelCapture={phone ? () => touch(part) : undefined} className="absolute left-0 top-0 z-20 origin-top-left" style={{ visibility: 'hidden' }}>
            <CountDrum value={v} min={1} max={c.max} onChange={x => c.set(part, x)} color={part.endsWith('1') ? 'cyan' : 'pink'} disabled={c.disabled} label={`${c.label(part)}: ${v}`} />
          </div>
        );
      })}
    </>
  );
}
