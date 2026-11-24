import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { REM_PX, useCellSize, type NumberData } from '../../../math/shared';
import { ADD_MIN_FIT_DESK, ADD_SHIFT_MAX, ADD_EDGE_GAP, ADD_GROW_LEFT_FROM, ADD_MIN_FIT_SMALL, WIDE_QUERY, subscribeWide, G, COMMA_SLOT } from './model';

// Addition / subtraction's size and place on the board area (Julian's rules): the board's natural size, measured; how
// much it shrinks to fit (`fit`) and how far left of the centre it sits (`shift`), on a desktop, a tablet and a phone,
// with the steps window open or collapsed
export function useAddSubFit({ num1, num2, availableWidth, leftRoom, stepsClosed, pageMidX, onNaturalWidth }: { num1: NumberData; num2: NumberData; availableWidth?: number; leftRoom: number; stepsClosed: boolean; pageMidX?: number; onNaturalWidth?: (w: number) => void }) {
  // The board's natural size (offsetWidth / offsetHeight: not changed by the scaling, the same in every browser), so the
  // box around it can take the scaled size, and the scale (see ADD_MIN_FIT_DESK)
  const rootRef = useRef<HTMLDivElement>(null);
  // dl / dr: where the digits start and end inside it (the leftmost and rightmost digit cells), unscaled
  const [natural, setNatural] = useState<{ w: number; h: number; dl: number; dr: number } | null>(null);
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    // In nominal px (at a 16px root font size), the unit of availableWidth and leftRoom: with a bigger root font size
    // (browser font setting) the board's real px are bigger, and mixing the two shrank the board for nothing
    const measure = () => {
      const k = REM_PX / (parseFloat(getComputedStyle(document.documentElement).fontSize) || REM_PX);
      const w = el.offsetWidth * k, h = el.offsetHeight * k;
      const r = el.getBoundingClientRect();
      const scale = el.offsetWidth ? r.width / el.offsetWidth : 1;
      const cells = [...el.querySelectorAll('.rounded-md.border-2')].map(c => c.getBoundingClientRect());
      const dl = cells.length ? ((Math.min(...cells.map(c => c.left)) - r.left) / scale) * k : 0;
      const dr = cells.length ? ((Math.max(...cells.map(c => c.right)) - r.left) / scale) * k : w;
      const same = (a: number, b: number) => Math.abs(a - b) < 0.05;
      setNatural(prev => (prev && same(prev.w, w) && same(prev.h, h) && same(prev.dl, dl) && same(prev.dr, dr) ? prev : { w, h, dl, dr }));
    };
    measure();
    measureRef.current = measure;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Also measured after every render, before the browser paints: a digit added changes the board's width, and waiting
  // for the ResizeObserver would show one frame with the old width (the numbers jumping right, then back)
  const measureRef = useRef<() => void>(() => {});
  useLayoutEffect(() => { measureRef.current(); });
  const wide = useSyncExternalStore(subscribeWide, () => window.matchMedia(WIDE_QUERY).matches, () => true);
  // How much of the board fits in a width (1 = all of it). availableWidth keeps 16px; 8px of them may be used
  // (tablet / phone)
  const fitIn = (w: number) => (natural ? Math.min(1, (w + 8) / natural.w) : 1);
  // Desktop: the board area's width, plus the room on its left the board may move into
  // (minus ADD_EDGE_GAP: the last digit stops that far from the board area's edge, which is 2px from the steps window,
  // so 3px from the window in all, Julian)
  const viewW = (availableWidth ?? 0) + 16 - ADD_EDGE_GAP;
  const room = wide ? leftRoom : 0;
  // Desktop: always a little left of the centre, more the longer the numbers (0px with 1 digit … 20px with 11,
  // Julian); too long for the area: moved left at least enough to end inside it; never further left than `room`
  const longest = Math.max(num1.digits.length, num2.digits.length);
  const cellSize = useCellSize();
  const shiftFor = (w: number, want: number) => {
    const need = w - viewW;
    return need > 0 ? Math.min(room, Math.max(want, need)) : Math.min(want, room - need / 2);
  };
  // The board's left edge (from the area's left edge) for a width and a shift: centred, never past the area's left edge
  const leftFor = (w: number, sh: number) => Math.max(0, (viewW - w) / 2) - sh;
  // From 11 digits on the board grows only to the left (Julian): its right end stays where it was with 11 digits. The
  // width with 11 digits is remembered when it is seen; if it wasn't, estimated (a cell, a gap and a comma slot)
  const width11 = useRef<number | null>(null);
  useEffect(() => { if (natural && longest === ADD_GROW_LEFT_FROM) width11.current = natural.w; }, [natural, longest]);
  const right11 = (() => {
    if (!wide || !natural || longest <= ADD_GROW_LEFT_FROM) return null;
    const w11 = Math.min(viewW + room, width11.current ?? natural.w - (longest - ADD_GROW_LEFT_FROM) * (cellSize + G) - COMMA_SLOT - G);
    return leftFor(w11, shiftFor(w11, (ADD_SHIFT_MAX * 10) / 11)) + w11;
  })();
  // Normal size unless the board can't fit even moved left as far as `room` allows (and, past 11 digits, ending where
  // it ended with 11): then smaller, smoothly, down to 50%
  const fit = !natural || !availableWidth ? 1
    : wide ? Math.max(ADD_MIN_FIT_DESK, Math.min(1, (viewW + room) / natural.w, right11 === null ? 1 : (right11 + room) / natural.w))
    // tablet / phone: fit the screen
    : Math.max(ADD_MIN_FIT_SMALL, fitIn(availableWidth));
  const W = natural ? natural.w * fit : 0;
  // Steps window collapsed (Julian; desktop, tablet and phone): the numbers (from the first digit to the last) centred
  // on the middle of the page, as far as the room allows (not past 15px after the controls column — on a phone, not
  // past the area's left edge — and not past its right edge). A negative shift moves the board right
  const closedLeft = natural && pageMidX !== undefined
    ? Math.min(viewW - W, Math.max(-leftRoom, pageMidX - (fit * (natural.dl + natural.dr)) / 2))
    : 0;
  const shift = !natural ? 0
    : stepsClosed && pageMidX !== undefined ? Math.max(0, (viewW - W) / 2) - closedLeft
    : !wide ? 0
    : right11 === null ? shiftFor(W, (ADD_SHIFT_MAX * Math.max(0, longest - 1)) / 11)
    : Math.min(room, Math.max(0, W - viewW, Math.max(0, (viewW - W) / 2) + W - right11));
  useEffect(() => { if (natural) onNaturalWidth?.(natural.w); }, [natural, onNaturalWidth]);
  const fitRef = useRef(1);
  useEffect(() => { fitRef.current = fit; }, [fit]);
  return { rootRef, natural, fit, shift, fitRef };
}
