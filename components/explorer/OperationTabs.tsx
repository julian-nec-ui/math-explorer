"use client";

import { useEffect, useState, type ReactElement, type RefObject } from 'react';
import type { MathOp } from '../math/shared';
import { OPERATIONS } from '../operations/registry';

// An SVG path through `pts` with rounded corners: radius r, or r(corner) per corner, smaller where a segment is short
const roundedPath = (pts: [number, number][], r: number | ((corner: [number, number]) => number)): string => {
  if (pts.length < 2) return '';
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i - 1], [x, y] = pts[i], [nx, ny] = pts[i + 1];
    const lin = Math.hypot(x - px, y - py), lout = Math.hypot(nx - x, ny - y);
    const k = Math.min(typeof r === 'number' ? r : r(pts[i]), lin / 2, lout / 2);
    const ax = x - ((x - px) / lin) * k, ay = y - ((y - py) / lin) * k;
    const bx = x + ((nx - x) / lout) * k, by = y + ((ny - y) / lout) * k;
    d += ` L${ax} ${ay} Q${x} ${y} ${bx} ${by}`;
  }
  const [lx, ly] = pts[pts.length - 1];
  return `${d} L${lx} ${ly}`;
};

// Operation tabs: five equal columns below lg (only the name, as on a tablet or desktop: no symbol on a phone, it saves room), one row on the right from lg up.
// The snake line (see `snake` above) is drawn over them, in an SVG the size of the tab row
// `hidden`: testing mode (Julian): not shown, but its room (and its width, which the steps window's lines up with) stays
export function OperationTabs({ navRef, activeOp, color, isAnimating, bandInline, onSelect, hidden = false }: { navRef: RefObject<HTMLElement | null>; activeOp: MathOp; color: string; isAnimating: boolean; bandInline: boolean; onSelect: (op: MathOp) => void; hidden?: boolean }): ReactElement {
  // Operation tabs as a "snake": one line that runs down the left edge of the first tab, along its bottom, up between
  // the first two tabs, along the top of the second, down again, along the bottom of the third, and so on, ending with
  // the right edge of the last tab. The active tab's stretch of the line (a U around it) is drawn in its colour.
  const [snake, setSnake] = useState<{ base: string; close: string; active: string; w: number; h: number } | null>(null);
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const measure = () => {
      const box = nav.getBoundingClientRect();
      const tabs = Array.from(nav.querySelectorAll<HTMLButtonElement>('button[data-op]')).map(b => b.getBoundingClientRect());
      if (tabs.length < 2) { setSnake(null); return; }
      const half = 0.75; // half the stroke, so the whole line stays visible
      const top = Math.min(...tabs.map(t => t.top)) - box.top + half;
      const bottom = Math.max(...tabs.map(t => t.bottom)) - box.top - half;
      // The verticals sit in the middle of the gaps between tabs; the two outer ones keep the same distance from the
      // first and last tab (half a gap), so Addition and Fractions look like the tabs in between
      const gap = tabs[1].left - tabs[0].right;
      const xs = [tabs[0].left - box.left - gap / 2];
      for (let i = 0; i < tabs.length - 1; i++) xs.push((tabs[i].right + tabs[i + 1].left) / 2 - box.left);
      xs.push(tabs[tabs.length - 1].right - box.left + gap / 2);
      // Tab i runs along the bottom when i is even, along the top when it's odd
      const edge = (i: number) => (i % 2 === 0 ? bottom : top);
      const other = (i: number) => (i % 2 === 0 ? top : bottom);
      const pts: [number, number][] = [[xs[0], other(0)]];
      tabs.forEach((_, i) => { pts.push([xs[i], edge(i)], [xs[i + 1], edge(i)]); });
      pts.push([xs[tabs.length], other(tabs.length - 1)]);
      // Every turn has the same, small radius, so each S between two tabs is symmetric
      const radius = 7;
      // The active tab's stretch: its two sides and its edge, plus the start of each turn onto the neighbouring tabs,
      // as far as the end of each curve (one radius), so its coloured ends follow the grey line and are the same on
      // both sides (the line's two ends stay straight)
      const a = OPERATIONS.findIndex(o => o.id === activeOp);
      let active = '';
      if (a >= 0) {
        const last = tabs.length - 1;
        const seg: [number, number][] = [];
        if (a > 0) seg.push([xs[a] - radius, other(a)]);
        seg.push([xs[a], other(a)], [xs[a], edge(a)], [xs[a + 1], edge(a)], [xs[a + 1], other(a)]);
        if (a < last) seg.push([xs[a + 1] + radius, other(a)]);
        active = roundedPath(seg, radius);
      }
      // The line closes every tab: on the side the snake leaves open (the top of tabs 1, 3, 5, the bottom of 2, 4),
      // with the same rounded turns, so each junction between tabs has a curve on both sides and every tab is framed
      const close = tabs.map((_, i) => roundedPath([[xs[i], edge(i)], [xs[i], other(i)], [xs[i + 1], other(i)], [xs[i + 1], edge(i)]], radius)).join(' ');
      setSnake({ base: roundedPath(pts, radius), close, active, w: box.width, h: box.height });
    };
    const ro = new ResizeObserver(measure);
    ro.observe(nav);
    nav.querySelectorAll('button[data-op]').forEach(b => ro.observe(b));
    measure();
    return () => ro.disconnect();
  }, [activeOp, navRef]);

  return (
    <nav ref={navRef} data-enter aria-hidden={hidden || undefined} inert={hidden} className={`${hidden ? 'invisible' : ''} relative order-2 ${bandInline ? 'lg:order-3' : ''} w-full lg:w-auto land:w-auto! px-0.5 grid grid-cols-5 gap-1 lg:flex lg:justify-end`} aria-label="Operations">
      {snake && (
        <svg className="pointer-events-none absolute inset-0 overflow-visible" width={snake.w} height={snake.h} aria-hidden="true">
          {/* The grey line: thin and close to the panel's background (#15161e), discreet but visible */}
          <path d={snake.base} fill="none" stroke="#353641" strokeWidth="1" strokeLinejoin="round" strokeLinecap="round" />
          <path d={snake.close} fill="none" stroke="#353641" strokeWidth="1" strokeLinejoin="round" strokeLinecap="round" />
          <path d={snake.active} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" className="drop-shadow-[0_0_4px_rgba(255,255,255,0.25)]" />
        </svg>
      )}
      {OPERATIONS.map(op => {
        const active = activeOp === op.id;
        return (
          <button
            key={op.id}
            data-op={op.id}
            type="button"
            disabled={isAnimating}
            onClick={() => onSelect(op.id)}
            aria-pressed={active}
            className={`relative min-w-0 flex flex-row items-center justify-center gap-0.5 sm:gap-1 px-0 sm:px-2.5 lg:px-2 rounded-md text-[9.5px] sm:text-[11px] font-semibold cursor-pointer transition-all hover:brightness-125 disabled:opacity-50 disabled:hover:brightness-100 py-1.5 bg-transparent ${active ? 'font-bold' : 'text-zinc-400 hover:text-zinc-200'}`}
            // No background: the active tab is shown by its stretch of the line and its name, both in its colour
            style={active ? { color: op.color } : undefined}
          >
            <span className="relative max-w-full truncate">{op.label}</span>
            {!op.board && <span className="relative hidden sm:inline text-[8px] font-bold uppercase tracking-wider px-1 py-px rounded bg-zinc-800 text-zinc-500 border border-zinc-700">Soon</span>}
          </button>
        );
      })}
    </nav>
  );
}
