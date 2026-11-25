'use client';

// The size and place rule of the addition / subtraction board (Julian), for the multiplication and division boards:
// a box around a board that scales it and moves it, measured the same way. See AddSubBoard for the reasoning (and
// NOTES-CLAUDE.md, "Size and place rule"). Not here: the "from 11 digits on, grow only to the left" rule.
//
// What has to fit is what is on the board now: from the leftmost digit cell or marked element (`data-fit`: the
// N1 / N2 tags, the sign buttons, the operation signs) to the board's right edge. These boards keep empty room on the
// left for the rows still to come; that room doesn't count until something is drawn in it, so while nothing runs
// the numbers keep their normal size like in addition, and during an explanation the board shrinks smoothly as wider
// rows appear (Julian's choice A).
//
// Desktop (64rem and wider): held by its left end (the digit-count drums) at the far left, 15px from the controls
// column (`leftRoom`), so the drums stay put while digits change (Julian); normal size while it fits up to ~3px from
// the steps window; only when it doesn't does it shrink,
// smoothly, down to 50%; then the window comes over it and the area scrolls. Steps window collapsed: centred on the
// middle of the page, as far as the room allows. Tablet / phone: shrink to fit, down to 45%.

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactElement, type ReactNode } from 'react';
import { DrumZoom, REM_PX, drumExtra, drumScaleFor, solveFit, toRem, usePhone, usePhoneEdge } from './shared';

const MIN_FIT_DESK = 0.5;
// Height (Julian): when the board is still too tall with what is under its operands already at 70% (see lowerScale),
// the whole board, operands too, shrinks to fit the area's height, down to 85%; past that the area scrolls
const MIN_FIT_HEIGHT = 0.85;
const MIN_FIT_SMALL = 0.45;
const EDGE_GAP = 1;
const WIDE_QUERY = '(min-width: 64rem)';
const subscribeWide = (cb: () => void) => {
  const mq = window.matchMedia(WIDE_QUERY);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
};

interface FitBoardProps {
  children: ReactNode;
  // In nominal px (at a 16px root font size), like everything below
  availableWidth?: number;
  leftRoom?: number;
  stepsClosed?: boolean;
  pageMidX?: number;
  // How many digits the longest number has (for the small move left)
  longest: number;
  // The board area's height (nominal px)
  availableHeight?: number;
  // Glide to the new size / place (the steps window opening or closing)
  smooth?: boolean;
  // Reports the width the drawn part needs at full size (nominal px)
  onNaturalWidth?: (w: number) => void;
}

export default function FitBoard({ children, availableWidth, leftRoom = 0, stepsClosed = false, pageMidX, availableHeight, smooth = false, onNaturalWidth }: FitBoardProps): ReactElement {
  const rootRef = useRef<HTMLDivElement>(null);
  // The board's natural size and where the drawn content starts (cl), unscaled, nominal px
  const [natural, setNatural] = useState<{ w: number; h: number; cl: number; yc: number; dw: number; tl: number | null; hd: number } | null>(null);
  const measureRef = useRef<() => void>(() => {});
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const measure = () => {
      const k = REM_PX / (parseFloat(getComputedStyle(document.documentElement).fontSize) || REM_PX);
      const w = el.offsetWidth * k, h = el.offsetHeight * k;
      const r = el.getBoundingClientRect();
      const scale = el.offsetWidth ? r.width / el.offsetWidth : 1;
      // (the digit-count drums by their place in the layout, i.e. their tags' box: drawn bigger, see DrumZoom, they are
      // allowed for below)
      const notDrum = (c: Element) => !c.closest('[data-drum]');
      const lefts = [...el.querySelectorAll('.rounded-md.border-2, [data-fit]')].filter(notDrum).map(c => c.getBoundingClientRect().left);
      const drum = el.querySelector<HTMLElement>('[data-drum]');
      const dw = drum ? drum.offsetWidth * k : 0;
      // tl: where the N1 / N2 tags start (the board is held by them, see `anchored`)
      const tags = [...el.querySelectorAll('[data-tag]')].map(c => c.getBoundingClientRect().left);
      const tl = tags.length ? ((Math.min(...tags) - r.left) / scale) * k : null;
      // (negative when something drawn sticks out on the left, like the digit-count drums next to N1 / N2: it counts too)
      const cl = lefts.length ? ((Math.min(...lefts) - r.left) / scale) * k : 0;
      // yc: the middle of the first operand's row (the topmost cells), from the board's top, unscaled
      const cells = [...el.querySelectorAll('.rounded-md.border-2')].filter(notDrum).map(c => c.getBoundingClientRect());
      // hd: how far down something is drawn now (digits, signs, lines; not the room kept for rows still to come)
      const drawn = [...el.querySelectorAll('.rounded-md.border-2, [data-fit], [data-opline], [data-drum]')].map(c => c.getBoundingClientRect().bottom);
      const hd = drawn.length ? ((Math.max(...drawn) - r.top) / scale) * k : h;
      const top = cells.length ? cells.reduce((a, c) => (c.top < a.top ? c : a)) : null;
      const yc = top ? ((top.top + top.height / 2 - r.top) / scale) * k : 0;
      const same = (a: number, b: number) => Math.abs(a - b) < 0.05;
      setNatural(prev => (prev && same(prev.w, w) && same(prev.h, h) && same(prev.cl, cl) && same(prev.yc, yc) && same(prev.dw, dw) && prev.tl === tl && Math.abs(prev.hd - hd) < 1 ? prev : { w, h, cl, yc, dw, tl, hd }));
    };
    measure();
    measureRef.current = measure;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Also after every render, before paint (new digits or rows never show a frame at the old size)
  useLayoutEffect(() => { measureRef.current(); });

  const wide = useSyncExternalStore(subscribeWide, () => window.matchMedia(WIDE_QUERY).matches, () => true);
  const phone = usePhone();
  const edge = usePhoneEdge();
  const viewW = (availableWidth ?? 0) + 16 - EDGE_GAP;
  // Held by its left end (the digit-count drums) whenever the controls column stands beside the board (md up: it gives
  // `leftRoom`), steps window open or not (Julian: the drums never move while digits change)
  const room = leftRoom;
  const anchored = leftRoom > 0 && natural?.tl != null;
  const tl = natural?.tl ?? 0;
  // The drawn part: from its left edge to the board's right edge
  const Wn = natural ? Math.max(1, natural.w - natural.cl) : 0;
  // The width the finished board needs (the boards keep room for the rows still to come), so whether the steps window
  // gets in the way is judged by the final board, not by what is drawn so far (Julian)
  useEffect(() => { if (natural) onNaturalWidth?.(natural.w); }, [natural, onNaturalWidth]);
  // (the drums need `extra` more px on the left when the board shrinks: see DrumZoom)
  const fitW = !natural || !availableWidth ? 1
    // held by its N1 / N2 tags: what has to fit is from the tags to the right end (the drums hang to their left)
    : anchored ? Math.max(wide ? MIN_FIT_DESK : MIN_FIT_SMALL, Math.min(1, (viewW + room) / Math.max(1, natural.w - tl)))
    : solveFit(natural.dw, extra => wide ? Math.max(MIN_FIT_DESK, Math.min(1, (viewW + room) / (Wn + extra)))
      : Math.max(MIN_FIT_SMALL, Math.min(1, ((availableWidth ?? 0) + 8) / (Wn + extra))));
  // A phone: the height scale only goes down while the board lives (the board is made anew for every problem), so the
  // drawn height and the scale can't chase each other (the work area under the operands is scaled from it too)
  // (it starts again when the room changes: the steps window opened or closed, the phone turned)
  const phoneMin = useRef({ f: 1, room: 0 });
  const phoneFitH = (f: number) => {
    const m = phoneMin.current;
    if (Math.abs((availableHeight ?? 0) - m.room) > 2) { m.room = availableHeight ?? 0; m.f = 1; }
    if (f < m.f) m.f = f;
    return m.f;
  };
  // natural.h is the board's final height (the boards keep room for the rows to come), so this is known from the start
  const fitH = !natural || !availableHeight || !natural.h ? 1
    // (a phone: down to 40%, so nothing runs under the open steps window, Julian)
    // A phone (Julian: nothing may run under the open steps window): what is drawn so far has to fit, and the board
    // keeps shrinking as rows appear, down to 40%; the room kept for rows to come doesn't count (it isn't laid out)
    : phone ? phoneFitH(Math.max(0.4, Math.min(1, Math.floor(((availableHeight - 4) / Math.max(1, natural.hd + 16)) * 100) / 100)))
    : Math.max(MIN_FIT_HEIGHT, Math.min(1, Math.floor(((availableHeight - 4) / natural.h) * 100) / 100));
  const fit = Math.min(fitW, fitH);
  // The drums' extra room on the left at this scale (board px)
  const ext = natural ? drumExtra(natural.dw, fit) : 0;
  const Wc = (Wn + ext) * fit;
  // Shrunk on a desktop (Julian): the board comes down as it shrinks, so the first operand's row stays where it is at
  // full size, level with INTEGER / FLOAT, instead of rising with the scaling (made from the top-left corner)
  const drop = natural && wide ? (1 - fit) * natural.yc : 0;
  // Where the drawn part starts, from the board area's left content edge (negative: into the room on its left)
  const centred = Math.max(0, (viewW - Wc) / 2);
  let left = centred;
  if (natural) {
    if (anchored) {
      left = -room - (tl - natural.cl + ext) * fit;
    } else if (wide) {
      // Held by its left end, the digit-count drums, at the far left (15px from the controls column), so they stay put
      // while digits are added or taken away (Julian): the numbers grow and shrink on their right
      left = -room;
    } else if (phone) {
      // a phone: the drums at the area's left edge, in line with the Explain to Me box (Julian)
      left = -edge;
    } else if (stepsClosed && pageMidX !== undefined) {
      left = Math.min(viewW - Wc, Math.max(-leftRoom, pageMidX - Wc / 2));
    }
  }

  return (
    // The outer box ends where the board ends (so the area scrolls only when it really is too wide); the board starts
    // `cl` before its drawn part, which may be off to the left (empty room, kept for rows still to come)
    <div
      className={`${natural ? 'mr-auto' : 'mx-auto'} mb-auto shrink-0`}
      style={natural ? toRem({ width: Math.max(0, left + Wc), height: phone ? (natural.hd + 16) * fit : natural.h * fit + drop }) : undefined}
    >
      <div
        ref={rootRef}
        className={`w-max ${smooth ? 'transition-[transform,margin-left,margin-top] duration-600 ease-[cubic-bezier(0.22,1,0.36,1)]' : ''}`}
        style={natural ? { transform: `scale(${fit})`, transformOrigin: 'top left', ...toRem({ marginLeft: left - (natural.cl - ext) * fit, marginTop: drop }) } : undefined}
      >
        <DrumZoom.Provider value={drumScaleFor(fit) / fit}>{children}</DrumZoom.Provider>
      </div>
    </div>
  );
}
