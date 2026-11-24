'use client';

// The elapsed-time readout (Julian), in digits drawn after his sketch: straight bars of one thickness, each digit 3 wide
// by 4 tall with equal halves, the 6 with its top bar and the 9 with its bottom bar, and every 90° corner — outer and
// inner — slightly rounded. A digit is given as its bars (in a 180 × 240 grid, bars 40 thick); their union is traced
// once into one outline with straight edges, and every corner of it gets a small curve (ROUND, 2% of the height).
// No filter: the edges stay straight and anti-aliased.
// Sizes in board px (rem): a digit is DIGIT_H tall; the separator's dots are 3px from the digits next to them.

import type { ReactElement } from 'react';

const W = 180, H = 240, T = 40, PAD = 12;
const ROUND = H * 0.02;            // corner rounding: 2% of the digit's height (Julian), in grid units
export const DIGIT_H = 22;          // board px
const K = DIGIT_H / H;              // board px per grid unit
const DIGIT_GAP = 3;                // board px between two digits
const COLON_GAP = 3;                // board px between a digit and the separator's dots (Julian)

type Bar = [number, number, number, number];
const top: Bar = [0, 0, W, T], mid: Bar = [0, (H - T) / 2, W, (H + T) / 2], bot: Bar = [0, H - T, W, H];
const UL: Bar = [0, 0, T, (H + T) / 2], UR: Bar = [W - T, 0, W, (H + T) / 2];
const LL: Bar = [0, (H - T) / 2, T, H], LR: Bar = [W - T, (H - T) / 2, W, H];
const mid3: Bar = [T, (H - T) / 2, W, (H + T) / 2], one: Bar = [(W - T) / 2, 0, (W + T) / 2, H];
// the 0's small rectangle in the middle of its hole (Julian): half a bar wide, a quarter of the digit tall
const dot0: Bar = [(W - T / 2) / 2, (H - H / 4) / 2, (W + T / 2) / 2, (H + H / 4) / 2];
const BARS: Record<string, Bar[]> = {
  '0': [top, bot, UL, LL, UR, LR, dot0], '1': [one], '2': [top, UR, mid, LL, bot], '3': [top, mid3, bot, UR, LR],
  '4': [UL, mid, UR, LR], '5': [top, UL, mid, LR, bot], '6': [top, UL, LL, mid, bot, LR], '7': [top, UR, LR],
  '8': [top, mid, bot, UL, UR, LL, LR], '9': [top, UL, UR, mid, LR, bot],
};

export const SEG_ON = '#58c7fe';

// The outline of a union of bars, as one path: the bars cut the grid into cells, each filled cell adds its sides that
// border an empty cell (clockwise), the sides are chained into loops (holes come out the other way round), straight runs
// are merged, and each corner is replaced by a short curve of size ROUND.
function outline(bars: Bar[]): string {
  const uniq = (v: number[]) => [...new Set(v)].sort((a, b) => a - b);
  const xs = uniq(bars.flatMap(b => [b[0], b[2]])), ys = uniq(bars.flatMap(b => [b[1], b[3]]));
  const filled = (i: number, j: number) => i >= 0 && j >= 0 && i < xs.length - 1 && j < ys.length - 1
    && bars.some(([x0, y0, x1, y1]) => xs[i] >= x0 && xs[i + 1] <= x1 && ys[j] >= y0 && ys[j + 1] <= y1);
  type P = [number, number];
  const next = new Map<string, P[]>();
  const key = (p: P) => `${p[0]},${p[1]}`;
  const edge = (a: P, b: P) => { const k = key(a); next.set(k, [...(next.get(k) ?? []), b]); };
  for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < ys.length - 1; j++) {
    if (!filled(i, j)) continue;
    const [x0, x1, y0, y1] = [xs[i], xs[i + 1], ys[j], ys[j + 1]];
    if (!filled(i, j - 1)) edge([x0, y0], [x1, y0]);
    if (!filled(i + 1, j)) edge([x1, y0], [x1, y1]);
    if (!filled(i, j + 1)) edge([x1, y1], [x0, y1]);
    if (!filled(i - 1, j)) edge([x0, y1], [x0, y0]);
  }
  const f = (n: number) => +n.toFixed(2);
  let d = '';
  for (const start of [...next.keys()]) {
    while ((next.get(start) ?? []).length) {
      const loop: P[] = [];
      let at = start.split(',').map(Number) as P;
      for (;;) {
        const outs = next.get(key(at)) ?? [];
        if (!outs.length) break;
        const to = outs.shift()!;
        loop.push(at);
        at = to;
      }
      // keep only the corners (where the direction changes)
      const pts = loop.filter((v, k) => {
        const a = loop[(k - 1 + loop.length) % loop.length], b = loop[(k + 1) % loop.length];
        return (v[0] - a[0]) * (b[1] - v[1]) !== (v[1] - a[1]) * (b[0] - v[0]);
      });
      pts.forEach((v, k) => {
        const a = pts[(k - 1 + pts.length) % pts.length], b = pts[(k + 1) % pts.length];
        const toward = (o: P): P => { const dx = o[0] - v[0], dy = o[1] - v[1], l = Math.hypot(dx, dy); return [v[0] + (dx / l) * ROUND, v[1] + (dy / l) * ROUND]; };
        const p = toward(a), q = toward(b);
        d += `${k === 0 ? 'M' : 'L'}${f(p[0])} ${f(p[1])}Q${f(v[0])} ${f(v[1])} ${f(q[0])} ${f(q[1])}`;
      });
      d += 'Z';
    }
  }
  return d;
}

const PATHS = new Map<Bar[], string>();
const pathOf = (bars: Bar[]) => { let d = PATHS.get(bars); if (d === undefined) { d = outline(bars); PATHS.set(bars, d); } return d; };

function Glyph({ bars, w }: { bars: Bar[]; w: number }): ReactElement {
  return (
    <svg
      viewBox={`${-PAD} ${-PAD} ${w + 2 * PAD} ${H + 2 * PAD}`}
      style={{ width: `${((w + 2 * PAD) * K) / 16}rem`, height: `${((H + 2 * PAD) * K) / 16}rem`, margin: `${(-PAD * K) / 16}rem` }}
      aria-hidden="true"
    >
      <path d={pathOf(bars)} fill={SEG_ON} fillRule="evenodd" />
    </svg>
  );
}

// The separator: two dots as thick as the bars, at 30% and 70% of the height
const COLON: Bar[] = [[0, H * 0.3 - T / 2, T, H * 0.3 + T / 2], [0, H * 0.7 - T / 2, T, H * 0.7 + T / 2]];

// "00:00:00:0" — hours, minutes, seconds, tenths of a second
export const formatElapsed = (ms: number): string => {
  const t = Math.floor(ms / 100);
  const tenths = t % 10, s = Math.floor(t / 10) % 60, m = Math.floor(t / 600) % 60, h = Math.min(99, Math.floor(t / 36000));
  const two = (n: number) => String(n).padStart(2, '0');
  return `${two(h)}:${two(m)}:${two(s)}:${tenths}`;
};

export default function SevenSeg({ text, label }: { text: string; label: string }): ReactElement {
  const chars = [...text];
  return (
    <div role="timer" aria-label={label} className="flex items-center drop-shadow-[0_0_4px_rgba(88,199,254,0.45)]">
      {chars.map((ch, i) => {
        // the space before this character: 3px next to a separator, DIGIT_GAP between two digits
        const before = i === 0 ? 0 : ch === ':' || chars[i - 1] === ':' ? COLON_GAP : DIGIT_GAP;
        return (
          <span key={i} className="flex" style={{ marginLeft: `${before / 16}rem` }}>
            {ch === ':' ? <Glyph bars={COLON} w={T} /> : <Glyph bars={BARS[ch] ?? []} w={W} />}
          </span>
        );
      })}
    </div>
  );
}
