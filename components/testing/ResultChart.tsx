"use client";

import { useId, type ReactElement } from 'react';

// The test's result as a 3D ring (Julian): correct answers in green, wrong ones in red (each with a left-to-right 3D
// gradient, a lighter top and a darker extruded side), the score in the middle of the ring, a legend beside it.
// Drawn as an ellipse tilted towards the viewer: the top faces, the outer side of the front half and the inner side of
// the back half (seen through the hole). Wrong includes the questions left without an answer (time's up)

const RIGHT = { top: ['#006b35', '#00994c', '#3fc683', '#00994c', '#005e2e'], side: ['#004722', '#00602f', '#00451f'] };
const WRONG = { top: ['#8f003a', '#c80453', '#ec4a85', '#c80453', '#800033'], side: ['#5e0026', '#83023a', '#55001f'] };

const W = 240, H = 170;
const CX = W / 2, CY = 70;
const RX = 108, RY = 56;      // the ring's outer edge, tilted
const IRX = 52, IRY = 27;     // its inner edge (the hole)
const DEPTH = 22;             // how thick it is

const pt = (rx: number, ry: number, t: number, dy = 0): [number, number] => [CX + rx * Math.cos(t), CY + ry * Math.sin(t) + dy];
const f = (n: number) => n.toFixed(2);

// pieces of at most a quarter turn (so every arc is a small one)
function pieces(a0: number, a1: number): [number, number][] {
  const out: [number, number][] = [];
  for (let a = a0; a < a1 - 1e-9; a += Math.PI / 2) out.push([a, Math.min(a1, a + Math.PI / 2)]);
  return out;
}
// the overlap of [a0, a1] with [b0, b1]
const overlap = (a0: number, a1: number, b0: number, b1: number): [number, number] | null => {
  const s = Math.max(a0, b0), e = Math.min(a1, b1);
  return e - s > 1e-6 ? [s, e] : null;
};

const topPath = (t0: number, t1: number) => {
  const [ox0, oy0] = pt(RX, RY, t0), [ox1, oy1] = pt(RX, RY, t1), [ix1, iy1] = pt(IRX, IRY, t1), [ix0, iy0] = pt(IRX, IRY, t0);
  return `M${f(ox0)} ${f(oy0)}A${RX} ${RY} 0 0 1 ${f(ox1)} ${f(oy1)}L${f(ix1)} ${f(iy1)}A${IRX} ${IRY} 0 0 0 ${f(ix0)} ${f(iy0)}Z`;
};
const wallPath = (rx: number, ry: number, t0: number, t1: number) => {
  const [x0, y0] = pt(rx, ry, t0), [x1, y1] = pt(rx, ry, t1);
  return `M${f(x0)} ${f(y0)}A${rx} ${ry} 0 0 1 ${f(x1)} ${f(y1)}L${f(x1)} ${f(y1 + DEPTH)}A${rx} ${ry} 0 0 0 ${f(x0)} ${f(y0 + DEPTH)}Z`;
};

export function ResultChart({ score, total }: { score: number; total: number }): ReactElement {
  const id = useId().replace(/:/g, '');
  const wrong = Math.max(0, total - score);
  const start = -Math.PI / 2; // from the top, clockwise
  const split = start + (total > 0 ? (score / total) : 0) * Math.PI * 2;
  const slices = [
    { from: start, to: split, c: 'r' as const },
    { from: split, to: start + Math.PI * 2, c: 'w' as const },
  ].filter(s => s.to - s.from > 1e-6);
  // the parts in view: the outer side of the front half (0 … π), the inner side of the back half (π … 2π, i.e. also −π/2 … 0)
  const outerWalls = slices.flatMap(s => { const o = overlap(s.from, s.to, 0, Math.PI); return o ? pieces(o[0], o[1]).map(p => ({ p, c: s.c })) : []; });
  const innerWalls = slices.flatMap(s => [overlap(s.from, s.to, Math.PI, Math.PI * 1.5), overlap(s.from, s.to, -Math.PI / 2, 0)]
    .filter((o): o is [number, number] => o !== null)
    .flatMap(o => pieces(o[0], o[1]).map(p => ({ p, c: s.c }))));
  const tops = slices.flatMap(s => pieces(s.from, s.to).map(p => ({ p, c: s.c })));
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
  const grad = (stops: string[], key: string) => (
    // (across the whole ring, so the pieces of one slice join without seams)
    <linearGradient id={`${id}${key}`} gradientUnits="userSpaceOnUse" x1={CX - RX} y1="0" x2={CX + RX} y2="0">
      {stops.map((c, i) => <stop key={i} offset={`${(i / (stops.length - 1)) * 100}%`} stopColor={c} />)}
    </linearGradient>
  );
  const fill = (c: 'r' | 'w', part: 'top' | 'side') => `url(#${id}${c}${part})`;
  return (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-3 max-md:flex-col max-md:items-start max-md:gap-y-[0.3125rem] max-md:-mt-[0.75rem]">
      {/* (phone, Julian) the legend first, 4px under the buttons and in line with Retake on the left, the ring 5px under it */}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-[18rem] max-w-full h-auto drop-shadow-[0_10px_14px_rgba(0,0,0,0.55)]" role="img" aria-label={`${score} correct and ${wrong} wrong answers out of ${total}`}>
        <defs>
          {grad(RIGHT.top, 'rtop')}{grad(RIGHT.side, 'rside')}{grad(WRONG.top, 'wtop')}{grad(WRONG.side, 'wside')}
          {/* light from above on the top faces */}
          <linearGradient id={`${id}shine`} gradientUnits="userSpaceOnUse" x1="0" y1={CY - RY} x2="0" y2={CY + RY}>
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.35" />
            <stop offset="55%" stopColor="#ffffff" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.15" />
          </linearGradient>
        </defs>
        {/* a soft shadow on the ground */}
        <ellipse cx={CX} cy={CY + DEPTH + 14} rx={RX * 0.95} ry={RY * 0.45} fill="#000" opacity="0.35" />
        {innerWalls.map(({ p, c }, i) => <path key={`i${i}`} d={wallPath(IRX, IRY, p[0], p[1])} fill={fill(c, 'side')} stroke={fill(c, 'side')} strokeWidth="0.6" />)}
        {outerWalls.map(({ p, c }, i) => <path key={`o${i}`} d={wallPath(RX, RY, p[0], p[1])} fill={fill(c, 'side')} stroke={fill(c, 'side')} strokeWidth="0.6" />)}
        {tops.map(({ p, c }, i) => <path key={`t${i}`} d={topPath(p[0], p[1])} fill={fill(c, 'top')} stroke={fill(c, 'top')} strokeWidth="0.6" />)}
        {tops.map(({ p }, i) => <path key={`s${i}`} d={topPath(p[0], p[1])} fill={`url(#${id}shine)`} />)}
        {/* the line between the two colours, on the top */}
        {slices.length > 1 && [start, split].map((a, i) => {
          const [x0, y0] = pt(IRX, IRY, a), [x1, y1] = pt(RX, RY, a);
          return <line key={i} x1={x0} y1={y0} x2={x1} y2={y1} stroke="#ffffff" strokeOpacity="0.35" strokeWidth="1" />;
        })}
        {/* the score, in the middle of the ring */}
        <text x={CX} y={CY + 6} textAnchor="middle" className="font-black" fontSize="17" fill="#f4f4f5">{score}/{total}</text>
      </svg>
      <ul className="flex flex-col gap-2.5 text-sm sm:text-base max-md:order-first">
        <li className="flex items-center gap-2.5 whitespace-nowrap">
          <span className="w-5 h-5 rounded-[6px] shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_2px_3px_rgba(0,0,0,0.5)]" style={{ background: `linear-gradient(90deg, ${RIGHT.top.join(', ')})` }} />
          <span className="text-zinc-300">Correct answers</span>
          <b style={{ color: '#00994c' }}>{score}</b>
          <span className="text-zinc-500">· {pct(score)}%</span>
        </li>
        <li className="flex items-center gap-2.5 whitespace-nowrap">
          <span className="w-5 h-5 rounded-[6px] shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_2px_3px_rgba(0,0,0,0.5)]" style={{ background: `linear-gradient(90deg, ${WRONG.top.join(', ')})` }} />
          <span className="text-zinc-300">Wrong answers</span>
          <b style={{ color: '#c80453' }}>{wrong}</b>
          <span className="text-zinc-500">· {pct(wrong)}%</span>
        </li>
      </ul>
    </div>
  );
}
