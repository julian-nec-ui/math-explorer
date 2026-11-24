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
// Desktop (64rem and wider): normal size while it fits in the board area, a little left of the centre (0px with
// 1 digit … 20px with 11 or more). Too long: first it moves left, into the free room up to 15px from the controls
// column (`leftRoom`), its right end ~3px from the steps window; only when that room is used up does it shrink,
// smoothly, down to 50%; then the window comes over it and the area scrolls. Steps window collapsed: centred on the
// middle of the page, as far as the room allows. Tablet / phone: shrink to fit, down to 45%.

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactElement, type ReactNode } from 'react';
import { REM_PX, toRem } from './shared';

const MIN_FIT_DESK = 0.5;
// Height (Julian): when the board is still too tall with what is under its operands already at 70% (see lowerScale),
// the whole board, operands too, shrinks to fit the area's height, down to 85%; past that the area scrolls
const MIN_FIT_HEIGHT = 0.85;
const MIN_FIT_SMALL = 0.45;
const SHIFT_MAX = 20;
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

export default function FitBoard({ children, availableWidth, leftRoom = 0, stepsClosed = false, pageMidX, longest, availableHeight, smooth = false, onNaturalWidth }: FitBoardProps): ReactElement {
  const rootRef = useRef<HTMLDivElement>(null);
  // The board's natural size and where the drawn content starts (cl), unscaled, nominal px
  const [natural, setNatural] = useState<{ w: number; h: number; cl: number } | null>(null);
  const measureRef = useRef<() => void>(() => {});
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const measure = () => {
      const k = REM_PX / (parseFloat(getComputedStyle(document.documentElement).fontSize) || REM_PX);
      const w = el.offsetWidth * k, h = el.offsetHeight * k;
      const r = el.getBoundingClientRect();
      const scale = el.offsetWidth ? r.width / el.offsetWidth : 1;
      const lefts = [...el.querySelectorAll('.rounded-md.border-2, [data-fit]')].map(c => c.getBoundingClientRect().left);
      const cl = lefts.length ? Math.max(0, ((Math.min(...lefts) - r.left) / scale) * k) : 0;
      const same = (a: number, b: number) => Math.abs(a - b) < 0.05;
      setNatural(prev => (prev && same(prev.w, w) && same(prev.h, h) && same(prev.cl, cl) ? prev : { w, h, cl }));
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
  const viewW = (availableWidth ?? 0) + 16 - EDGE_GAP;
  const room = wide ? leftRoom : 0;
  // The drawn part: from its left edge to the board's right edge
  const Wn = natural ? Math.max(1, natural.w - natural.cl) : 0;
  // The width the finished board needs (the boards keep room for the rows still to come), so whether the steps window
  // gets in the way is judged by the final board, not by what is drawn so far (Julian)
  useEffect(() => { if (natural) onNaturalWidth?.(natural.w); }, [natural, onNaturalWidth]);
  const fitW = !natural || !availableWidth ? 1
    : wide ? Math.max(MIN_FIT_DESK, Math.min(1, (viewW + room) / Wn))
    : Math.max(MIN_FIT_SMALL, Math.min(1, ((availableWidth ?? 0) + 8) / Wn));
  // natural.h is the board's final height (the boards keep room for the rows to come), so this is known from the start
  const fitH = !natural || !availableHeight || !natural.h ? 1
    : Math.max(MIN_FIT_HEIGHT, Math.min(1, Math.floor(((availableHeight - 4) / natural.h) * 100) / 100));
  const fit = Math.min(fitW, fitH);
  const Wc = Wn * fit;
  // Where the drawn part starts, from the board area's left content edge (negative: into the room on its left)
  const centred = Math.max(0, (viewW - Wc) / 2);
  let left = centred;
  if (natural) {
    if (stepsClosed && pageMidX !== undefined) {
      left = Math.min(viewW - Wc, Math.max(-leftRoom, pageMidX - Wc / 2));
    } else if (wide) {
      const need = Wc - viewW;
      const want = (SHIFT_MAX * Math.min(10, Math.max(0, longest - 1))) / 11;
      const shift = need > 0 ? Math.min(room, Math.max(want, need)) : Math.min(want, room - need / 2);
      left = centred - shift;
    }
  }

  return (
    // The outer box ends where the board ends (so the area scrolls only when it really is too wide); the board starts
    // `cl` before its drawn part, which may be off to the left (empty room, kept for rows still to come)
    <div
      className={`${natural ? 'mr-auto' : 'mx-auto'} mb-auto shrink-0`}
      style={natural ? toRem({ width: Math.max(0, left + Wc), height: natural.h * fit }) : undefined}
    >
      <div
        ref={rootRef}
        className={`w-max ${smooth ? 'transition-[transform,margin-left] duration-600 ease-[cubic-bezier(0.22,1,0.36,1)]' : ''}`}
        style={natural ? { transform: `scale(${fit})`, transformOrigin: 'top left', ...toRem({ marginLeft: left - natural.cl * fit }) } : undefined}
      >
        {children}
      </div>
    </div>
  );
}
