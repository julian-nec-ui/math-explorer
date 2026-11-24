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
    // Stored in nominal px (at a 16px root font size), the unit the boards compute their geometry in
    const ro = new ResizeObserver(entries => {
      const rootPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || REM_PX;
      setViewWidth(entries[0].contentRect.width * (REM_PX / rootPx));
      setViewHeight(entries[0].contentRect.height * (REM_PX / rootPx));
    });
    ro.observe(el);
    return () => ro.disconnect();
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
      setLeftRoom(Math.max(0, Math.floor((contentLeft - col.getBoundingClientRect().right - 15) * (REM_PX / rootPx))));
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
