"use client";

import { useEffect, useLayoutEffect, useRef, useState, type AnimationEvent, type CSSProperties, type ReactElement, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

// Testing mode (Julian): the board area shows the test instead of the numbers. For now an empty window with its name;
// the test itself comes next. `children`: the explanation window, inside the frame (see StepsWindow `inFrame`): on the
// right beside the board (desk + lg, the same query as the steps window's), at the bottom otherwise.
//
// Where the frame sits (Julian):
// - from md up (the controls column on the left): it fills the panel — 3px from the panel's top, right and bottom
//   edges (inside its border), its left edge 7px left of the board area's content (10px + 5px further left than the
//   old 8px margin), or further right if the widest title needs it (see `labels`). Drawn in the panel (portal, absolute; the board area scrolls and would cut it), its left edge
//   measured from the board area;
// - phone (narrower than md, the controls above): it fills the board area, 3px from its top, right and bottom, 2px
//   left of it (the area's left padding is only 2px, more would be cut)
const WIDE = '(min-width: 48rem)';
const GAP = 0.1875; // rem: 3px nominal
const LEFT_OUT = 0.4375; // rem: 7px nominal

// `labels`: every operation's name; the frame's left edge clears the widest of them as a title (MULTIPLICATION) by
// TITLE_GAP, so it sits at the same place for every operation and never covers the name (Julian)
const TITLE_GAP = 1.25; // rem: 20px nominal

// `leaving` (back to learning): the closing animation (testOut) over the board, then `onLeft`. On a phone the frame closes
// exactly where it was (`phoneBox`, its place in the panel, kept while it was shown), drawn in the panel: the board area
// moves down when learning comes back (Explain to Me / New Numbers / Stop above it), the closing frame doesn't
let phoneBox: { top: number; left: number; width: number; height: number } | null = null;

export function TestWindow({ label, color, labels, leaving = false, onLeft, children }: { label: string; color: string; labels: string[]; leaving?: boolean; onLeft?: () => void; children?: ReactNode }): ReactElement {
  const markRef = useRef<HTMLDivElement>(null);
  const [wide, setWide] = useState(false);
  const [panel, setPanel] = useState<HTMLElement | null>(null);
  const [left, setLeft] = useState<number | null>(null);
  useLayoutEffect(() => {
    const mq = window.matchMedia(WIDE);
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener('change', on);
    setPanel(markRef.current?.closest<HTMLElement>('[data-panel]') ?? null);
    return () => mq.removeEventListener('change', on);
  }, []);
  useLayoutEffect(() => {
    const view = markRef.current?.parentElement;
    if (!wide || !panel || !view) { setLeft(null); return; }
    const measure = () => {
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const v = view.getBoundingClientRect();
      const p = panel.getBoundingClientRect();
      let x = v.left + parseFloat(getComputedStyle(view).paddingLeft) - LEFT_OUT * rem - (p.left + panel.clientLeft);
      // the widest title: a hidden copy of the title with each name in turn (the title's size changes with the screen)
      const h1 = panel.querySelector('h1');
      if (h1?.parentElement) {
        const copy = h1.cloneNode(false) as HTMLElement;
        copy.style.position = 'absolute';
        copy.style.visibility = 'hidden';
        copy.style.left = '0';
        copy.style.top = '0';
        h1.parentElement.appendChild(copy);
        let w = 0;
        for (const l of labels) { copy.textContent = l.toUpperCase(); w = Math.max(w, copy.getBoundingClientRect().width); }
        copy.remove();
        x = Math.max(x, h1.getBoundingClientRect().left + w + TITLE_GAP * rem - (p.left + panel.clientLeft));
      }
      // in rem, so it follows the root font size (Julian's rule: board distances in rem)
      setLeft((prev) => (prev !== null && Math.abs(prev - x / rem) < 0.01 ? prev : x / rem));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(view);
    ro.observe(panel);
    window.addEventListener('resize', measure);
    return () => { ro.disconnect(); window.removeEventListener('resize', measure); };
  }, [wide, panel, labels]);
  // gone when the animation ends (and in any case a little after it: no animation, a hidden tab)
  const leftRef = useRef(onLeft);
  useEffect(() => { leftRef.current = onLeft; });
  useEffect(() => {
    if (!leaving) return;
    const id = window.setTimeout(() => leftRef.current?.(), 1300);
    return () => window.clearTimeout(id);
  }, [leaving]);
  const phoneRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = phoneRef.current;
    if (leaving || !el || !panel) return;
    // its real box, not the one its opening animation is scaling (scaled about its centre: the centre stays put)
    const r = el.getBoundingClientRect(), p = panel.getBoundingClientRect();
    const w = el.offsetWidth, h = el.offsetHeight;
    phoneBox = { top: r.top + r.height / 2 - h / 2 - p.top - panel.clientTop, left: r.left + r.width / 2 - w / 2 - p.left - panel.clientLeft, width: w, height: h };
  });
  const onEnd = (e: AnimationEvent<HTMLDivElement>) => { if (leaving && e.target === e.currentTarget) onLeft?.(); };
  const body = (
    <>
      <div className="flex-1 min-w-0 p-5 flex flex-col gap-2">
        <div className="text-xs font-black uppercase tracking-[0.2em]" style={{ color }}>{label} · Test</div>
        <div className="text-sm text-zinc-400">The test will appear here.</div>
      </div>
      {children}
    </>
  );
  const look = `border border-zinc-700 bg-zinc-900/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] flex flex-col desk:lg:flex-row ${leaving ? 'animate-test-out' : 'animate-test-in'}`;
  return (
    <>
      <div ref={markRef} className="w-0 shrink-0" aria-hidden="true" />
      {wide && panel ? (left !== null && createPortal(
        // concentric with the panel's corners (1.5rem) at 3px in
        <div data-test-frame onAnimationEnd={onEnd} className={`absolute z-10 rounded-[1.3125rem] ${look}`} style={{ top: `${GAP}rem`, right: `${GAP}rem`, bottom: `${GAP}rem`, left: `${left}rem`, '--test-r': '1.3125rem' } as CSSProperties}>
          {body}
        </div>,
        panel,
      )) : leaving ? (panel && phoneBox && createPortal(
        <div data-test-frame onAnimationEnd={onEnd} className={`absolute z-10 rounded-2xl ${look}`} style={{ top: phoneBox.top, left: phoneBox.left, width: phoneBox.width, height: phoneBox.height, '--test-r': '1rem' } as CSSProperties}>
          {body}
        </div>,
        panel,
      )) : (
        <div ref={phoneRef} data-test-frame onAnimationEnd={onEnd} style={{ '--test-r': '1rem' } as CSSProperties} className={`mt-[0.1875rem] mb-[0.1875rem] mr-[0.1875rem] -ml-[0.125rem] flex-1 min-w-0 self-stretch min-h-[12rem] rounded-2xl ${look}`}>
          {body}
        </div>
      )}
    </>
  );
}
