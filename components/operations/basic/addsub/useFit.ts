import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { LAND_FIT, REM_PX, drumExtra, solveFit, useCellSize, useLand, usePhone, usePhoneEdge, usePhoneSide, type NumberData } from '../../../math/shared';
import { ADD_MIN_FIT_DESK, ADD_SHIFT_MAX, ADD_EDGE_GAP, ADD_GROW_LEFT_FROM, ADD_MIN_FIT_SMALL, WIDE_QUERY, subscribeWide, G, COMMA_SLOT } from './model';

// Addition / subtraction's size and place on the board area (Julian's rules): the board's natural size, measured; how
// much it shrinks to fit (`fit`) and how far left of the centre it sits (`shift`), on a desktop, a tablet and a phone,
// with the steps window open or collapsed
export function useAddSubFit({ num1, num2, availableWidth, availableHeight, leftRoom, stepsClosed, pageMidX, onNaturalWidth }: { num1: NumberData; num2: NumberData; availableWidth?: number; availableHeight?: number; leftRoom: number; stepsClosed: boolean; pageMidX?: number; onNaturalWidth?: (w: number) => void }) {
  // The board's natural size (offsetWidth / offsetHeight: not changed by the scaling, the same in every browser), so the
  // box around it can take the scaled size, and the scale (see ADD_MIN_FIT_DESK)
  const rootRef = useRef<HTMLDivElement>(null);
  // dl / dr: where the digits start and end inside it (the leftmost and rightmost digit cells), unscaled
  const [natural, setNatural] = useState<{ w: number; h: number; dl: number; dr: number; yc: number; dw: number; tl: number | null } | null>(null);
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
      // The digit-count drums count by their place in the layout (their tags' box, `data-drumbox`): drawn bigger when the
      // board shrinks (see DrumZoom), they are allowed for below (dw: their width)
      const notDrum = (c: Element) => !c.closest('[data-drum]');
      const cells = [...el.querySelectorAll('.rounded-md.border-2')].filter(notDrum).map(c => c.getBoundingClientRect());
      const boxes = [...el.querySelectorAll('[data-drumbox]')].map(c => c.getBoundingClientRect());
      const dl = cells.length || boxes.length ? ((Math.min(...cells.map(c => c.left), ...boxes.map(c => c.left)) - r.left) / scale) * k : 0;
      const drum = el.querySelector<HTMLElement>('[data-drum]');
      const dw = drum ? drum.offsetWidth * k : 0;
      // tl: where the N1 / N2 tags start (the board is held by them, see `anchored`)
      const tags = [...el.querySelectorAll('[data-tag]')].map(c => c.getBoundingClientRect().left);
      const tl = tags.length ? ((Math.min(...tags) - r.left) / scale) * k : null;
      // yc: the middle of the first operand's row (the topmost cells), from the board's top, unscaled
      const top = cells.length ? cells.reduce((a, c) => (c.top < a.top ? c : a)) : null;
      const yc = top ? ((top.top + top.height / 2 - r.top) / scale) * k : 0;
      const dr = cells.length ? ((Math.max(...cells.map(c => c.right)) - r.left) / scale) * k : w;
      const same = (a: number, b: number) => Math.abs(a - b) < 0.05;
      setNatural(prev => (prev && same(prev.w, w) && same(prev.h, h) && same(prev.dl, dl) && same(prev.dr, dr) && same(prev.yc, yc) && same(prev.dw, dw) && (prev.tl === tl || (prev.tl !== null && tl !== null && Math.abs(prev.tl - tl) < 0.5)) ? prev : { w, h, dl, dr, yc, dw, tl }));
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
  const phone = usePhone();
  // (a phone held sideways: the board may be drawn bigger than normal, up to LAND_FIT)
  const land = useLand();
  // (and held sideways but narrower than md, Julian: bigger than upright, see usePhoneSide)
  const side = usePhoneSide();
  const cap = land || side ? LAND_FIT : 1;
  const edge = usePhoneEdge();
  // Desktop: the board area's width, plus the room on its left the board may move into
  // (minus ADD_EDGE_GAP: the last digit stops that far from the board area's edge, which is 2px from the steps window,
  // so 3px from the window in all, Julian)
  const viewW = (availableWidth ?? 0) + 16 - ADD_EDGE_GAP;
  const room = leftRoom;
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
  // Desktop with the steps window open (Julian): the board is held by its left end, the digit-count drums, at the far
  // left (15px from the controls column, where they are at full size), so they stay put while digits are added or
  // taken away: the numbers grow and shrink on their right. Only when they no longer fit up to the steps window does
  // the board shrink (from that same left end)
  // (whenever the controls column stands beside the board, md up, steps window open or not: Julian)
  // (held by the N1 / N2 tags: the drums hang to their left, and moving them moves nothing else)
  const anchored = !!natural && leftRoom !== 0 && natural.tl != null;
  // (the drums need `extra` more px on the left when the board shrinks: see DrumZoom)
  const fitW = !natural || !availableWidth ? 1
    : anchored ? Math.max(wide ? ADD_MIN_FIT_DESK : ADD_MIN_FIT_SMALL, Math.min(cap, (viewW + room) / Math.max(1, natural.w - (natural.tl ?? 0))))
    : wide ? Math.max(ADD_MIN_FIT_DESK, Math.min(cap, (viewW + room) / natural.w, right11 === null ? cap : (right11 + room) / natural.w))
    // tablet / phone: fit the screen
    : solveFit(natural.dw, extra => Math.max(ADD_MIN_FIT_SMALL, Math.min(cap, ((availableWidth ?? 0) + 8) / (natural.w + extra))), phone);
  // A phone: also as tall as the room above the open steps window, down to 40% (Julian: the sum mustn't run under it)
  // (held sideways, Julian: never below normal size because of the height there — the page scrolls)
  const fitH = natural && phone && availableHeight && natural.h ? Math.max(side ? 1 : 0.4, Math.min(cap, (availableHeight - 4) / natural.h))
    // (sideways: as tall as the room allows, up to LAND_FIT)
    : natural && land && availableHeight && natural.h ? Math.max(ADD_MIN_FIT_DESK, Math.min(cap, (availableHeight - 4) / natural.h)) : cap;
  const fit = Math.min(fitW, fitH);
  const W = natural ? natural.w * fit : 0;
  // Steps window collapsed (Julian; desktop, tablet and phone): the numbers (from the first digit to the last) centred
  // on the middle of the page, as far as the room allows (not past 15px after the controls column — on a phone, not
  // past the area's left edge — and not past its right edge). A negative shift moves the board right
  const closedLeft = natural && pageMidX !== undefined
    ? Math.min(viewW - W, Math.max(-leftRoom, pageMidX - (fit * (natural.dl + natural.dr)) / 2))
    : 0;
  const shift = !natural ? 0
    // (the outer box is centred in availableWidth + 16; the drawn part starts dl in)
    : anchored ? Math.max(0, ((availableWidth ?? 0) + 16 - W) / 2) + (natural.tl ?? 0) * fit + room
    // a phone: the drums (their left edge, drawn a little bigger when the board shrinks) at the area's left edge, in
    // line with the Explain to Me box (Julian)
    : phone ? Math.max(0, ((availableWidth ?? 0) + 16 - W) / 2) + (natural.dl - drumExtra(natural.dw, fit, phone)) * fit + edge
    : stepsClosed && pageMidX !== undefined ? Math.max(0, (viewW - W) / 2) - closedLeft
    : !wide ? 0
    : right11 === null ? shiftFor(W, (ADD_SHIFT_MAX * Math.max(0, longest - 1)) / 11)
    : Math.min(room, Math.max(0, W - viewW, Math.max(0, (viewW - W) / 2) + W - right11));
  useEffect(() => { if (natural) onNaturalWidth?.(natural.w); }, [natural, onNaturalWidth]);
  const fitRef = useRef(1);
  useEffect(() => { fitRef.current = fit; }, [fit]);
  // Shrunk on a desktop (Julian): the board comes down as it shrinks, so the first operand's row stays where it is at
  // full size, level with INTEGER / FLOAT, instead of rising with the scaling (made from the top-left corner)
  const drop = natural && wide ? (1 - fit) * natural.yc : 0;
  return { rootRef, natural, fit, shift, fitRef, drop };
}
