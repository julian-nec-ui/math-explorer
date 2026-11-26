// Sizes and geometry: the digit cells, board px written as rem (so a board scales with the font), the cell size in px
// for the current screen, and how much the lower part of a tall board shrinks to fit

import { useSyncExternalStore, type CSSProperties } from 'react';

// Digit cells: 36px on phones, 43px from the md breakpoint (48rem) up
export const CELL_W = 'w-9 md:w-10.75';
export const CELL = 'w-9 h-9 md:w-10.75 md:h-10.75';
export const GAP = 11;
export const REM_PX = 16;

export const COMMA_W = 20;

// Pixel geometry written as rem, so the boards scale with the root font size
// What is under the operands (multiplication: the partial products and the sum; division: the subtractions) is drawn
// smaller when the whole board would not fit the board area's height (Julian): only as much as needed, never below 70%;
// past that it stays at 70% and the area scrolls. `top` is where the smaller part starts, `bottom` where the board ends
// at full size (board px). Worked out from the board's final height, so the digits keep one size for the whole explanation.
// 16 = the frame's bottom padding (pb-4)
export const MIN_LOWER_SCALE = 0.7;
export const lowerScale = (available: number | undefined, top: number, bottom: number): number => {
  if (!available || bottom <= top) return 1;
  const s = (available - 16 - top) / (bottom - top);
  return Math.max(MIN_LOWER_SCALE, Math.min(1, Math.floor(s * 100) / 100));
};
// The transform that shrinks that part towards its top right corner (`right`, `top`): the units stay under the units
export const lowerStyle = (s: number, right: number, top: number): CSSProperties => (s < 1
  ? { transform: `scale(${s})`, transformOrigin: `${right / REM_PX}rem ${top / REM_PX}rem` }
  : {});

export const toRem = (style: Record<string, number>): CSSProperties => {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(style)) out[k] = `${v / REM_PX}rem`;
  return out as CSSProperties;
};

// The cell size in px follows the same breakpoint as CELL (md = 48rem)
const MD_QUERY = '(min-width: 48rem)';
const subscribeMd = (cb: () => void) => {
  const mq = window.matchMedia(MD_QUERY);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
};
const isMd = () => window.matchMedia(MD_QUERY).matches;
const isMdServer = () => false;
export function useCellSize(): number {
  return useSyncExternalStore(subscribeMd, isMd, isMdServer) ? 43 : 36;
}

// Bring a band of a board (screen px, `top` to `bottom`) into view, smoothly: the board area scrolls when it scrolls itself
// (desk), else the page does (phones; the steps window sits on the screen's bottom edge, over the page). Too tall for
// the room: its top is shown
export function revealBand(from: Element, top: number, bottom: number): void {
  const area = from.closest('.steps-scroll');
  if (area && area.scrollHeight > area.clientHeight + 1 && getComputedStyle(area).overflowY !== 'visible') {
    const r = area.getBoundingClientRect();
    const by = top < r.top ? top - r.top : bottom > r.bottom ? Math.min(bottom - r.bottom, top - r.top) : 0;
    if (Math.abs(by) > 1) area.scrollBy({ top: by, behavior: 'smooth' });
  } else {
    const steps = document.querySelector<HTMLElement>('div.sticky.bottom-0');
    const low = window.innerHeight - (steps?.offsetHeight ?? 0);
    const by = top < 0 ? top : bottom > low ? Math.min(bottom - low, top) : 0;
    if (Math.abs(by) > 1) window.scrollBy({ top: by, behavior: 'smooth' });
  }
}
