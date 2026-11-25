import { useEffect, useRef, useState, type RefObject } from 'react';
import { REM_PX, type MathOp } from '../math/shared';

type Ref<T extends HTMLElement> = RefObject<T | null>;

// Header: from lg up, the control band stays on the title's row as long as the title's slot (as wide as the
// longest title, MULTIPLICATION), the band and the tabs fit there; only then does it move under the tabs.
// Measured, so it reacts to the real widths, and the same for every operation, so the band never jumps when
// you change operation.
export function useHeaderBand(headerRef: Ref<HTMLDivElement>, titleSlotRef: Ref<HTMLDivElement>, bandRef: Ref<HTMLDivElement>, tabsRef: Ref<HTMLElement>): boolean {
  const [bandInline, setBandInline] = useState(true);
  useEffect(() => {
    const header = headerRef.current, slot = titleSlotRef.current, band = bandRef.current, tabs = tabsRef.current;
    if (!header || !slot || !band || !tabs) return;
    const lg = window.matchMedia('(min-width: 64rem)');
    const measure = () => {
      const gap = parseFloat(getComputedStyle(header).columnGap) || 0;
      // The three widths don't depend on where the band sits (all are their natural widths from lg up), so this can't flicker
      // The title's slot is as wide as the longest title (MULTIPLICATION), so the decision is the same for every operation
      const need = slot.offsetWidth + band.offsetWidth + tabs.offsetWidth + 2 * gap;
      setBandInline(lg.matches && need <= header.clientWidth);
    };
    const ro = new ResizeObserver(measure);
    [header, slot, band, tabs].forEach(el => ro.observe(el));
    lg.addEventListener('change', measure);
    measure();
    return () => { ro.disconnect(); lg.removeEventListener('change', measure); };
  }, []);
  return bandInline;
}

// The board area's size, stored in nominal px (at a 16px root font size), the unit the boards compute their geometry in
export function useViewSize(viewRef: Ref<HTMLDivElement>): { viewWidth: number; viewHeight: number } {
  const [viewWidth, setViewWidth] = useState(0);
  const [viewHeight, setViewHeight] = useState(0);
  useEffect(() => {
    const el = viewRef.current;
    if (!el) return;
    // Stored in nominal px (at a 16px root font size), the unit the boards compute their geometry in.
    // A phone (narrower than md; the page scrolls, the area is as tall as its board): the height is the room from the
    // area's top to the steps window's top (it sits on the screen's bottom edge), so with the steps window open the
    // boards shrink instead of running under it (Julian)
    const measure = () => {
      const rootPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || REM_PX;
      const k = REM_PX / rootPx;
      const cs = getComputedStyle(el);
      setViewWidth((el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)) * k);
      if (!window.matchMedia('(min-width: 48rem)').matches) {
        const steps = document.querySelector<HTMLElement>('div.sticky.bottom-0');
        const top = el.getBoundingClientRect().top + window.scrollY;
        const h = Math.round(Math.max(120, window.innerHeight - top - (steps?.offsetHeight ?? 0) - 8) * k);
        setViewHeight(prev => (prev === h ? prev : h));
      } else {
        setViewHeight((el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)) * k);
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    const steps = document.querySelector<HTMLElement>('div.sticky.bottom-0');
    if (steps) ro.observe(steps);
    // (what is above the area — the controls column on a phone, taller in division — moves its top without resizing it)
    const col = el.parentElement?.firstElementChild;
    if (col && col !== el) ro.observe(col);
    window.addEventListener('resize', measure);
    // A phone: checked every frame too (cheap, and only a change re-renders): what moves the area's top or resizes the
    // steps window doesn't always resize something observed, and a stale height let the board run under the window
    let raf = 0;
    const tick = () => { if (!window.matchMedia('(min-width: 48rem)').matches) measure(); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => { ro.disconnect(); window.removeEventListener('resize', measure); cancelAnimationFrame(raf); };
  }, []);
  return { viewWidth, viewHeight };
}

// The elapsed-time counter sits halfway between the title and the controls column: the gap between them (px on screen)
export function useTimerGap(titleRef: Ref<HTMLHeadingElement>, colRef: Ref<HTMLDivElement>, activeOp: MathOp, cell: number): number {
  const [timerGap, setTimerGap] = useState(0);
  useEffect(() => {
    const measure = () => {
      const t = titleRef.current?.getBoundingClientRect(), c = colRef.current?.getBoundingClientRect();
      if (t && c) setTimerGap(Math.max(0, Math.round(c.top - t.bottom)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (titleRef.current) ro.observe(titleRef.current);
    if (colRef.current) ro.observe(colRef.current);
    window.addEventListener('resize', measure);
    return () => { ro.disconnect(); window.removeEventListener('resize', measure); };
  }, [activeOp, cell]);
  return timerGap;
}

// Room on the left of the board area that a board may move into (desktop): the area's left padding (md:pl-60) minus
// the controls column on it, minus 15px kept free next to the column (Julian). 0 when the column is above the board
// The middle of the page, from the board area's left content edge (nominal px)
export function usePageRoom(viewRef: Ref<HTMLDivElement>, colRef: Ref<HTMLDivElement>): { leftRoom: number; pageMidX: number | undefined } {
  const [leftRoom, setLeftRoom] = useState(0);
  const [pageMidX, setPageMidX] = useState<number | undefined>(undefined);
  useEffect(() => {
    const view = viewRef.current, col = colRef.current;
    if (!view || !col) return;
    const measure = () => {
      const rootPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || REM_PX;
      const contentLeft = view.getBoundingClientRect().left + parseFloat(getComputedStyle(view).paddingLeft);
      setPageMidX(Math.round((document.documentElement.clientWidth / 2 - contentLeft) * (REM_PX / rootPx) * 10) / 10);
      if (getComputedStyle(col).position !== 'absolute') { setLeftRoom(0); return; }
      // The room up to where the N1 / N2 tags start. The boards hold the tags there (see FitBoard / useAddSubFit), so the
      // numbers never move, and the digit-count drums hang to the left of the tags (moving them moves nothing else)
      // (Julian, tablet / desktop) The drums start 10px after the right edge of the column's buttons (FLOAT, the step
      // delay's drum, Pause: the column's right edge + the 6px they reach out, EDGE_3), in each operation; the N1 / N2
      // tags 71 board px after that (15px gap + the 56px drum)
      const buttonsRight = col.getBoundingClientRect().right + 6;
      // (may be negative: a wide column on a narrow screen; 0 means "no column beside the board", so never exactly 0)
      const room = Math.round((contentLeft - buttonsRight - 10) * (REM_PX / rootPx) - 71);
      setLeftRoom(room === 0 ? 0.01 : room);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(view);
    ro.observe(col);
    window.addEventListener('resize', measure);
    return () => { ro.disconnect(); window.removeEventListener('resize', measure); };
  }, []);
  return { leftRoom, pageMidX };
}

// From md up the controls column floats over the board area (absolute), so the area is kept at least as tall as the column
export function useColBottom(colRef: Ref<HTMLDivElement>, cell: number): number {
  const [colBottom, setColBottom] = useState(0);
  useEffect(() => {
    const col = colRef.current;
    if (!col) return;
    const md = window.matchMedia('(min-width: 48rem)');
    const measure = () => setColBottom(md.matches ? Math.ceil(col.offsetTop + col.offsetHeight + 16) : 0);
    const ro = new ResizeObserver(measure);
    ro.observe(col);
    md.addEventListener('change', measure);
    measure();
    return () => { ro.disconnect(); md.removeEventListener('change', measure); };
  }, [cell]);
  return colBottom;
}

// While an explanation runs, the board area follows the newest row: only when something actually written on the
// board (a digit, a chip, a sign) goes below the bottom of the area, it scrolls down smoothly just enough to show it.
// (Julian: the boards keep room for the rows still to come, so scrolling to the very bottom hid the numbers
// at the top while the rows below were still empty.)
export function useScrollFollow(viewRef: Ref<HTMLDivElement>, isAnimating: boolean): void {
  const runningRef = useRef(false);
  useEffect(() => {
    runningRef.current = isAnimating;
    // when an explanation starts and the page itself scrolls (phones, phones held sideways), bring the board into view
    const el = viewRef.current;
    if (!isAnimating || !el || el.scrollHeight > el.clientHeight + 1) return;
    const page = document.scrollingElement ?? document.documentElement;
    if (page.scrollHeight <= window.innerHeight + 1) return;
    if (el.getBoundingClientRect().top > 8) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [isAnimating, viewRef]);
  useEffect(() => {
    const el = viewRef.current;
    const content = el?.firstElementChild;
    if (!el || !content) return;
    let frame = 0;
    const follow = () => {
      frame = 0;
      if (!runningRef.current) return;
      // the board scrolls inside its own frame (desk), or, when the frame grows with it (phones, phones held sideways),
      // the page scrolls instead
      const inFrame = el.scrollHeight > el.clientHeight + 1;
      const page = document.scrollingElement ?? document.documentElement;
      if (!inFrame && page.scrollHeight <= window.innerHeight + 1) return;
      // the lowest piece of text that can be seen (leaves with text, not faded out)
      let lowest = -Infinity;
      for (const node of content.querySelectorAll('*')) {
        if (node.childElementCount || !node.textContent?.trim()) continue;
        const r = node.getBoundingClientRect();
        if (!r.height || r.bottom <= lowest) continue;
        let hidden = false;
        for (let a: Element | null = node; a && a !== content; a = a.parentElement) {
          if (Number(getComputedStyle(a).opacity) < 0.05) { hidden = true; break; }
        }
        if (!hidden) lowest = r.bottom;
      }
      if (inFrame) {
        const over = lowest + 16 - el.getBoundingClientRect().bottom;
        if (over > 1) el.scrollBy({ top: over, behavior: 'smooth' });
        return;
      }
      const over = lowest + 16 - window.innerHeight;
      if (over > 1) window.scrollBy({ top: over, behavior: 'smooth' });
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(follow); };
    const ro = new ResizeObserver(schedule);
    ro.observe(content);
    const mo = new MutationObserver(schedule);
    mo.observe(content, { childList: true, subtree: true, characterData: true });
    return () => { ro.disconnect(); mo.disconnect(); if (frame) cancelAnimationFrame(frame); };
  });
}
