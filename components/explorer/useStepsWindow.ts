import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject, type TransitionEvent } from 'react';
import { REM_PX } from '../math/shared';

// The steps window can be closed (only a thin strip with its arrow stays) and resized by dragging its edge. Beside the
// board (wide desktops, the `desk` + lg layout) its width changes, with < (open) and > (closed); under the board
// (tablets, phones) its height, with ˅ (open) and ˄ (closed). Open/closed and both sizes are remembered
export const STEPS_STRIP = 30; // px: the closed window
const STEPS_SIDE_QUERY = '(min-width: 64rem) and (min-width: 48rem) and (min-height: 37.5rem)';
const readSteps = (): { open: boolean; w: number | null; h: number | null } => {
  try {
    const v = JSON.parse(localStorage.getItem('math-explorer-steps') ?? 'null');
    // (always closed when the page opens or reloads, Julian; the size it was dragged to is kept)
    if (v && typeof v === 'object') return { open: false, w: typeof v.w === 'number' ? v.w : null, h: typeof v.h === 'number' ? v.h : null };
  } catch { /* storage off: defaults */ }
  return { open: false, w: null, h: null };
};

// The steps window's state and behaviour: open / closed, its size (beside or under the board), the default width, the
// resize edge with its grip mark, the slide and bump when it opens or closes, and what that does to the boards' width
// (`tabsRef`: the operation tabs, its default width lines up with them; `viewWidth`: the board area's width, nominal px)
// `inFrame`: the window moved into the test frame (testing mode): a new element with a new parent, measured again
export function useStepsWindow(tabsRef: RefObject<HTMLElement | null>, viewWidth: number, inFrame = false) {
  // The steps window: open or closed, its width (beside the board) and height (under it); null = the layout's default
  const [stepsUi, setStepsUi] = useState<{ open: boolean; w: number | null; h: number | null }>({ open: false, w: null, h: null });
  const [stepsSide, setStepsSide] = useState(false);
  // How much wider than its usual width the steps window is (beside the board; its usual width is the layout's:
  // 30% of the row, between 16rem and 28rem). Measured on every size change, dragging included
  const [stepsExtra, setStepsExtra] = useState(0);
  // Default width beside the board (Julian): the window's left edge lines up with the left edge of the Addition tab
  // (row's right edge − the tab's left edge). null: not measurable (tabs elsewhere, or a width out of 200px … half the
  // row): the layout's default (30% of the row, between 16rem and 28rem)
  const [stepsDefaultW, setStepsDefaultW] = useState<number | null>(null);
  const stepsBoxRef = useRef<HTMLDivElement>(null);
  // The grip mark on the resize edge (80px long) is centred on the pointer: moved directly (no re-render of the page, so
  // it never lags behind), as soon as the pointer comes onto the edge and while it moves or drags. Kept 40px (half the
  // mark) inside the ends, so it never sticks out of the window
  const gripRef = useRef<HTMLSpanElement>(null);
  const placeGrip = (e: ReactPointerEvent<HTMLDivElement>) => {
    const mark = gripRef.current;
    if (!mark) return;
    const r = e.currentTarget.getBoundingClientRect();
    const side = r.height > r.width;
    const at = side ? e.clientY - r.top : e.clientX - r.left;
    const len = side ? r.height : r.width;
    mark.style[side ? 'top' : 'left'] = `${Math.max(40, Math.min(len - 40, at))}px`;
  };
  useEffect(() => {
    const box = stepsBoxRef.current;
    const row = box?.parentElement;
    if (!box || !row) return;
    const measure = () => {
      if (!stepsSide || !stepsUi.open) { setStepsExtra(0); return; }
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || REM_PX;
      const usual = stepsDefaultW ?? Math.min(28 * rem, Math.max(16 * rem, row.clientWidth * 0.3));
      setStepsExtra(Math.max(0, Math.round((box.getBoundingClientRect().width - usual) * (REM_PX / rem))));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    ro.observe(row);
    return () => ro.disconnect();
  }, [stepsSide, stepsUi.open, stepsDefaultW, inFrame]);
  useEffect(() => {
    const row = stepsBoxRef.current?.parentElement;
    const nav = tabsRef.current;
    if (!row || !nav) return;
    const measure = () => {
      const tab = nav.querySelector('button[data-op="addition"]');
      if (!stepsSide || !tab) { setStepsDefaultW(null); return; }
      const w = Math.round(row.getBoundingClientRect().right - tab.getBoundingClientRect().left);
      setStepsDefaultW(w >= 200 && w <= row.clientWidth * 0.5 ? w : null);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(row);
    ro.observe(nav);
    window.addEventListener('resize', measure);
    return () => { ro.disconnect(); window.removeEventListener('resize', measure); };
  }, [stepsSide, inFrame]);
  
  // The layout changed (beside / under the board): the mark starts again from the middle of the new edge
  useEffect(() => {
    const mark = gripRef.current;
    if (mark) { mark.style.top = ''; mark.style.left = ''; }
  }, [stepsSide]);
  useEffect(() => {
    const id = window.setTimeout(() => setStepsUi(readSteps()), 0);
    const mq = window.matchMedia(STEPS_SIDE_QUERY);
    const on = () => setStepsSide(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => { window.clearTimeout(id); mq.removeEventListener('change', on); };
  }, []);
  // Opening / closing the steps window (Julian): it slides smoothly, and when it gets there it gives a small shake, as
  // if it bumped into the edge. `bumpRef` marks that the next end of the width / height transition is such a slide
  const bumpRef = useRef(false);
  // The digits while the window opens / closes beside the board (Julian):
  // - window at its default width or narrower: the digits don't move at all — the boards keep the width they had with
  //   the window open (`frozenViewW`, nominal px) while it slides, and while it stays closed;
  // - window wider than its default: closing gives the digits room to grow (and to sit in the middle), opening takes it
  //   back — the boards get the final width at once and glide there with the window (`smoothFit`, 600ms), no jerk
  const [frozenViewW, setFrozenViewW] = useState<number | null>(null);
  // The width the board needs at full size (reported by the board): a wider window only matters when the board doesn't
  // fit beside it (Julian: with 2–3 digits the digits stay put even if the window was widened)
  const naturalWRef = useRef(0);
  const onNaturalWidth = useCallback((w: number) => { naturalWRef.current = w; }, []);
  // Closed after a window that did push the digits: they are centred on the page while it stays closed
  const [closedCentred, setClosedCentred] = useState(false);
  const [smoothFit, setSmoothFit] = useState(false);
  const smoothTimer = useRef<number | undefined>(undefined);
  const stepsWide = stepsSide && stepsUi.w !== null && stepsDefaultW !== null && stepsUi.w > stepsDefaultW + 1;
  const toggleSteps = () => {
    bumpRef.current = true;
    const opening = !stepsUi.open;
    if (stepsSide) {
      const box = stepsBoxRef.current, row = box?.parentElement;
      const k = (parseFloat(getComputedStyle(document.documentElement).fontSize) || REM_PX) / REM_PX;
      // the window's open width (px on screen) and how much narrower the board area is with it open than closed
      const openPx = stepsUi.w ?? stepsDefaultW ?? Math.min(28 * REM_PX * k, Math.max(16 * REM_PX * k, (row?.clientWidth ?? 0) * 0.3));
      const delta = (openPx - STEPS_STRIP) / k;
      const openViewW = opening ? viewWidth - delta : viewWidth;
      window.clearTimeout(smoothTimer.current);
      // the board fits beside the open window (with ~1px to spare): the window's width doesn't touch the digits
      const affected = stepsWide && naturalWRef.current > openViewW - 1;
      setClosedCentred(!opening && affected);
      if (!affected) {
        setSmoothFit(false);
        setFrozenViewW(openViewW);
        // opening: once it is open again the board area really is that wide
        if (opening) smoothTimer.current = window.setTimeout(() => setFrozenViewW(null), 650);
      } else {
        setFrozenViewW(opening ? openViewW : viewWidth + delta);
        setSmoothFit(true);
        smoothTimer.current = window.setTimeout(() => { setSmoothFit(false); setFrozenViewW(null); }, 650);
      }
    }
    saveSteps({ ...stepsUi, open: opening });
  };
  
  const onStepsSlideEnd = (e: TransitionEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget || (e.propertyName !== 'width' && e.propertyName !== 'height') || !bumpRef.current) return;
    bumpRef.current = false;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // the first move goes on in the slide's direction (closing: right / down; opening: left / up), then a damped wobble
    const dir = stepsUi.open ? -1 : 1;
    const t = (d: number) => (stepsSide ? `translateX(${d * dir}px)` : `translateY(${d * dir}px)`);
    // (Julian) slower and smoother: twice as long, a little softer, every swing eased in and out (sine-like)
    e.currentTarget.animate([0, 5, -3.2, 1.9, -0.9, 0.35, 0].map(d => ({ transform: t(d), easing: 'cubic-bezier(0.37, 0, 0.63, 1)' })), { duration: 850, easing: 'linear' });
  };
  const saveSteps = (v: { open: boolean; w: number | null; h: number | null }) => {
    setStepsUi(v);
    try { localStorage.setItem('math-explorer-steps', JSON.stringify(v)); } catch { /* storage off */ }
  };
  // Dragging the window's edge: beside the board, its left edge (left = wider); under it, its top edge (up = taller)
  const startStepsResize = (e: ReactPointerEvent<HTMLDivElement>) => {
    const box = stepsBoxRef.current;
    if (!box) return;
    e.preventDefault();
    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);
    const r = box.getBoundingClientRect();
    const start = { x: e.clientX, y: e.clientY, w: r.width, h: r.height };
    let last = stepsUi;
    // While dragging, the window's size is set directly on it: no 0.3s transition (that one is only for opening and
    // closing) and no re-render of the page, so the edge and its grip mark stay right under the pointer. The size is
    // saved (and React takes over again) when the pointer is released
    box.style.transition = 'none';
    if (stepsSide) { box.style.minWidth = '200px'; box.style.maxWidth = '70vw'; }
    const move = (ev: PointerEvent) => {
      if (stepsSide) {
        const w = Math.round(Math.min(window.innerWidth * 0.7, Math.max(200, start.w - (ev.clientX - start.x))));
        box.style.width = `${w}px`;
        last = { ...stepsUi, open: true, w };
      } else {
        const h = Math.round(Math.min(window.innerHeight * 0.7, Math.max(80, start.h - (ev.clientY - start.y))));
        box.style.height = `${h}px`;
        last = { ...stepsUi, open: true, h };
      }
    };
    const up = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      handle.removeEventListener('pointercancel', up);
      saveSteps(last);
      // React's style for the window applies again from the next frame (with the transition back)
      requestAnimationFrame(() => { box.style.transition = ''; });
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
  };

  return {
    stepsUi, stepsSide, stepsExtra, stepsDefaultW, stepsBoxRef, gripRef, placeGrip, frozenViewW, onNaturalWidth, closedCentred,
    smoothFit, toggleSteps, onStepsSlideEnd, saveSteps, startStepsResize,
  };
}
export type StepsWindowState = ReturnType<typeof useStepsWindow>;
