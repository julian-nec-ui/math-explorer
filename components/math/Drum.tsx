"use client";

// The steel drums: DigitDrum turns a digit (or a count), CountDrum is the always-open one for how many digits a number
// has and for the step delay

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactElement } from 'react';
import { RollingDigit } from './RollingDigit';

// ---------- The steel drum used to change a digit ----------

const MAX_ANGLE = 90;
// Degrees between rows of holes: 13, so the arrows' tip rows (±6, at 78°) are on the visible front too (Julian: one
// more dot at the head of each arrow)
const HOLE_STEP = 13;
// How far from the middle the rows reach (% of the drum's height): 39.5, so the last dot stays clear of the top and
// bottom edges (Julian: ~4px; it was 42, then one more pixel each way)
const HOLE_REACH = 39.5;
const HOLE_COLS = 4;

// Hole pattern on the drum: green rows above the middle (count up, #00e600), red rows below (count down, #ff0f6f).
// Only the arrows' shafts are holes; their heads are drawn as a V of two straight lines (see ARROW_HEAD, Julian: like
// the steps window's open / close arrow)
// The shaft: 4 rows of 2 holes right up to the V: the 4th stops a hair before the V's outer (dark) edge, never under
// it (Julian; measured 0.4–0.5px, at right angles to the line, in his Chrome). The two shafts are about one dot
// further apart in the middle than before (Julian), so the rows are a little closer together
const SHAFT_ROWS = [1.21, 2.09, 2.98, 3.86];
const SHAFT_COLS = [1, 2];
// The V: from the outer columns at row ±4 to the middle at row ±6 (the tip)
const ARROW_HEAD = { base: 4, tip: 6 };
const HEAD_COLOR: Record<'green' | 'red', { stroke: string; glow: string; light: string }> = {
  green: { stroke: '#1fe61f', glow: 'rgba(0, 230, 0, 0.9)', light: '#d6ffd6' },
  red: { stroke: '#ff1a76', glow: 'rgba(255, 15, 111, 0.9)', light: '#ffd6e6' },
};
type HoleColor = 'green' | 'red' | 'blue';
const glowOf = (row: number) => Math.min(1, Math.abs(row) / 6);

const HOLE_BG: Record<HoleColor, string> = {
  green: 'radial-gradient(circle at 35% 30%, #f0fff0, #66ff66 22%, #00e600 48%, #007a00 85%)',
  red: 'radial-gradient(circle at 35% 30%, #fff0f6, #ff6ba6 22%, #ff0f6f 48%, #a3003f 85%)',
  blue: 'radial-gradient(circle at 35% 30%, #eaf6ff, #5cc2ff 22%, #0a8dff 48%, #0046b3 85%)',
};
const HOLE_SHADOW: Record<HoleColor, string> = {
  green: '0 0 0 0.5px rgba(0, 0, 0, 0.7), 0 0 4px 0.5px rgba(0, 230, 0, 1)',
  red: '0 0 0 0.5px rgba(0, 0, 0, 0.7), 0 0 4px 0.5px rgba(255, 15, 111, 1)',
  blue: '0 0 0 0.5px rgba(0, 0, 0, 0.7), 0 0 4px 0.5px rgba(10, 141, 255, 1)',
};
const HOLE_BG_HOT: Record<'green' | 'red', string> = {
  green: 'radial-gradient(circle at 35% 30%, #dcffdc, #1aff1a 25%, #00d600 50%, #005c00 88%)',
  red: 'radial-gradient(circle at 35% 30%, #ffd9e8, #ff1a76 25%, #e6005c 50%, #6b0027 88%)',
};
const holeStyle = (row: number, color: HoleColor): CSSProperties => {
  if (color === 'blue') return { background: HOLE_BG.blue, boxShadow: HOLE_SHADOW.blue, filter: 'none' };
  const g = glowOf(row);
  const rgb = color === 'green' ? '0, 230, 0' : '255, 15, 111';
  return {
    background: g >= 0.8 ? HOLE_BG_HOT[color] : HOLE_BG[color],
    boxShadow: `0 0 0 0.5px rgba(0, 0, 0, 0.75), 0 0 ${2 + 2 * g}px ${0.3 + 0.5 * g}px rgba(${rgb}, ${0.6 + 0.4 * g})`,
    filter: `saturate(${0.75 + 0.9 * g}) brightness(${0.8 + 0.35 * g})`,
  };
};

// Mouse cursor while counting: a copy of the system's up/down cursor (two black triangles with a white edge), where the
// triangle of the direction being counted is filled with a bright metallic white. Drawn at 1x and 2x (retina).
// Same bases (10px wide, 4px apart); the tips are 7% higher, so the triangles are a little taller and sharper
const cursorPair = (active: 1 | -1, scale: 1 | 2): string => {
  const fill = (on: boolean) => (on ? 'url(#m)' : '#000');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${24 * scale}" height="${24 * scale}" viewBox="0 0 24 24">`
    + '<defs><linearGradient id="m" x1="0" y1="0" x2="0.6" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="0.45" stop-color="#f2f5f8"/><stop offset="0.8" stop-color="#c3cdd6"/><stop offset="1" stop-color="#a7b3bd"/></linearGradient>'
    + '<filter id="s" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="0.6" stdDeviation="0.6" flood-color="#000" flood-opacity="0.45"/></filter></defs>'
    + '<g filter="url(#s)" stroke="#fff" stroke-width="1.6" stroke-linejoin="round">'
    + `<path d="M12 2.5 17 10H7Z" fill="${fill(active === 1)}"/><path d="M7 14H17L12 21.5Z" fill="${fill(active === -1)}"/></g></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
};
const cursorFor = (active: 1 | -1) =>
  `-webkit-image-set(${cursorPair(active, 1)} 1x, ${cursorPair(active, 2)} 2x) 12 12, ${active === 1 ? 'n-resize' : 's-resize'}`;
const CURSOR_UP = cursorFor(1);
const CURSOR_DOWN = cursorFor(-1);

// How far the holes turn, at most: a fifth of the drum's angle, up to 8°, so an arrow moves a little but never
// leaves the frame
const HOLES_MAX_TURN = 8;

// The rows of holes on the front of the drum. Green (count up) and red (count down) are drawn on two layers:
// while counting in one direction (`dir`), only that arrow is shown; both are back when the mouse is released
// fadeUp / fadeDown: that arrow is pale (a count drum at its highest / lowest value: that way does nothing)
// Where a row is (% of the drum's height), with the drum turned by `angle`: half the drum's curve, half even steps, so
// the rows near the edges don't crowd together as much
const rowTop = (row: number, angle: number): number => {
  const a = ((row * HOLE_STEP - angle) * Math.PI) / 180;
  return 50 + HOLE_REACH * (0.5 * Math.sin(a) + (0.5 * (a * 180) / Math.PI) / (6 * HOLE_STEP));
};
const colLeft = (col: number): number => 14 + (col * 72) / (HOLE_COLS - 1);

function DrumHoles({ angle: drumAngle, dir, fadeUp = false, fadeDown = false }: { angle: number; dir: 0 | 1 | -1; fadeUp?: boolean; fadeDown?: boolean }): ReactElement {
  const angle = Math.max(-HOLES_MAX_TURN, Math.min(HOLES_MAX_TURN, drumAngle / 5));
  const out: Record<'green' | 'red', ReactElement[]> = { green: [], red: [] };
  for (const row of SHAFT_ROWS.flatMap(r => [-r, r])) {
    const color: 'green' | 'red' = row < 0 ? 'green' : 'red';
    const a = ((row * HOLE_STEP - angle) * Math.PI) / 180;
    const depth = Math.cos(a);
    if (depth <= 0.08) continue;
    const top = rowTop(row, angle);
    for (const col of SHAFT_COLS) {
      out[color].push(
        <div
          key={`${row}:${col}`}
          className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ left: `${colLeft(col)}%`, top: `${top}%`, width: '0.18rem', height: `${0.15 * (0.35 + 0.65 * depth)}rem`, opacity: 0.55 + 0.45 * depth, ...holeStyle(row, color) }}
        />,
      );
    }
  }
  // The arrow heads: two straight lines meeting at the tip, round joins and ends (the join doesn't show)
  for (const color of ['green', 'red'] as const) {
    const sign = color === 'green' ? -1 : 1;
    const yb = rowTop(sign * ARROW_HEAD.base, angle), yt = rowTop(sign * ARROW_HEAD.tip, angle);
    const { stroke, glow } = HEAD_COLOR[color];
    out[color].push(
      // A dark edge under it, the colour, and a thin light line along the middle: sharper and more like a lit tube
      <svg key="head" className="absolute inset-0 w-full h-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" shapeRendering="geometricPrecision" style={{ filter: `drop-shadow(0 0 1px ${glow})` }}>
        {[['rgba(0,0,0,0.6)', 3.6], [stroke, 2.2], [HEAD_COLOR[color].light, 0.7]].map(([c, w]) => (
          <polyline key={String(w)} points={`${colLeft(0)},${yb} ${colLeft(1.5)},${yt} ${colLeft(3)},${yb}`} fill="none" stroke={String(c)} strokeWidth={Number(w)} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        ))}
      </svg>,
    );
  }
  const layer = (color: 'green' | 'red', hidden: boolean, faded: boolean) => (
    <div className="absolute inset-0 transition-opacity duration-200 ease-out" style={{ opacity: hidden ? 0 : faded ? 0.45 : 1 }}>{out[color]}</div>
  );
  return <>{layer('green', dir === -1, fadeUp)}{layer('red', dir === 1, fadeDown)}</>;
}

// ---------- Turning the drum with a mouse wheel or a two-finger swipe on a trackpad (Mac and Windows) ----------

// Both send `wheel` events. A gesture = wheel events with less than WHEEL_GAP_MS between them (a trackpad's inertia
// included). The drum takes a gesture only if it began at least WHEEL_ARM_MS after the drum opened, so a page scroll
// that carries a digit under the pointer keeps scrolling the page, to its end
const WHEEL_GAP_MS = 220;
const WHEEL_ARM_MS = 300;
const WHEEL_STEP_PX = 40;   // trackpad: the swipe distance for one step
const WHEEL_NOTCH_PX = 50;  // a gesture starting with a jump this big (or counted in lines/pages) is a mouse wheel
const WHEEL_MIN_MS = 70;
const NUDGE_HOLD_MS = 450; // after a wheel or keyboard step the white arrow of the cursor stays this long    // at most one step every 70 ms, so a fast flick can't spin through every digit
// When the current gesture began, for the whole page: measured before any drum sees the event (capture phase)
const wheelClock = { last: 0, start: 0, on: false };
const startWheelClock = () => {
  if (wheelClock.on || typeof window === 'undefined') return;
  wheelClock.on = true;
  window.addEventListener('wheel', () => {
    const t = performance.now();
    if (t - wheelClock.last > WHEEL_GAP_MS) wheelClock.start = t;
    wheelClock.last = t;
  }, { capture: true, passive: true });
};
const isMac = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);
// Which way a wheel gesture counts. deltaY > 0 = the page content would move up.
// Mac (Julian's choice): scrolling up counts up, down counts down, with the trackpad and the mouse (deltaY < 0 = up
// with natural scrolling, the default; Safari says when it is off and the sign is turned around).
// Windows / Linux: fingers up on a precision touchpad (natural scrolling, their default) and the wheel rolled away
// from you on a mouse count up
const wheelDirection = (deltaSign: 1 | -1, notch: boolean, e: WheelEvent): 1 | -1 => {
  const natural = (e as WheelEvent & { webkitDirectionInvertedFromDevice?: boolean }).webkitDirectionInvertedFromDevice;
  if (isMac()) return (natural === false ? deltaSign : -deltaSign) as 1 | -1;
  if (notch) return -deltaSign as 1 | -1;
  return deltaSign;
};

// Press the top of the holes to count up, the bottom to count down; hold or drag to keep counting; or turn it with
// the mouse wheel / two fingers on a trackpad while it is open
// `ends`: a count drum (it stops at min / max, and the arrow that can't go further is pale); `text`: what it shows
// `textSize`: one size for every value of a count drum (decided by its longest text), so 0, 0.5 and 1 look alike
// `textStyle`: an extra style for one value's text (the step delay's 2 is 7% bigger: alone it looks smaller)
export function DigitDrum({ value, onStep, open = false, min = 0, max = 9, label, ends = false, text, textSize = '', textStyle }: { value: number; onStep: (dir: 1 | -1) => void; open?: boolean; min?: number; max?: number; label?: string; ends?: boolean; text?: string; textSize?: string; textStyle?: CSSProperties }): ReactElement {
  const [angle, setAngleState] = useState(0);
  const angleRef = useRef(0);
  // The direction being counted (1 up, -1 down, 0 none): only that arrow is shown, and the cursor points that way
  const [dir, setDir] = useState<0 | 1 | -1>(0);
  const stepRef = useRef(onStep);
  const dragRef = useRef<{ startY: number; base: number } | null>(null);
  const repeatRef = useRef(0);
  const rafRef = useRef(0);
  useEffect(() => { stepRef.current = onStep; });
  const setAngle = (a: number) => { angleRef.current = a; setAngleState(a); };
  const stopSpring = () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); rafRef.current = 0; };
  const stopRepeat = () => { window.clearTimeout(repeatRef.current); repeatRef.current = 0; };
  useEffect(() => () => { stopSpring(); stopRepeat(); }, []);
  // One step with the drum turned a little that way, then back (keyboard arrows and the wheel). The arrow of that
  // direction (and the white triangle of the cursor) stays at least NUDGE_HOLD_MS after the last step
  const holdRef = useRef(0);
  const nudge = (d: 1 | -1) => {
    stepRef.current(d);
    stopSpring();
    setDir(d);
    setAngle(d * 30);
    holdRef.current = performance.now() + NUDGE_HOLD_MS;
    springBack();
  };
  const nudgeRef = useRef(nudge);
  useEffect(() => { nudgeRef.current = nudge; });

  // The wheel: only while the drum is open, and only for a gesture that began after it opened (see WHEEL_ARM_MS)
  const rootRef = useRef<HTMLDivElement>(null);
  const openRef = useRef(open);
  const openedAt = useRef(0);
  useEffect(() => {
    openRef.current = open;
    if (open) openedAt.current = performance.now();
  }, [open]);
  useEffect(() => {
    startWheelClock();
    const el = rootRef.current;
    if (!el) return;
    const w = { gesture: -1, acc: 0, notch: false, first: false, lastStep: 0 };
    const onWheel = (e: WheelEvent) => {
      // Pinch-zoom (sent as ctrl + wheel) and sideways swipes stay with the page; so does a drag in progress
      if (!openRef.current || dragRef.current || e.ctrlKey || e.deltaY === 0 || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      if (wheelClock.start < openedAt.current + WHEEL_ARM_MS) return;
      e.preventDefault(); // the page doesn't scroll while the drum turns
      e.stopPropagation();
      const px = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
      if (w.gesture !== wheelClock.start) {
        w.gesture = wheelClock.start;
        w.acc = 0;
        w.notch = e.deltaMode !== 0 || Math.abs(px) >= WHEEL_NOTCH_PX;
        w.first = true; // the first movement of a gesture counts at once
      }
      w.acc += px;
      const now = performance.now();
      if (!(w.first || w.notch || Math.abs(w.acc) >= WHEEL_STEP_PX) || now - w.lastStep < WHEEL_MIN_MS) return;
      const sign: 1 | -1 = (w.notch ? px : w.acc) > 0 ? 1 : -1;
      w.first = false;
      w.acc = 0;
      w.lastStep = now;
      nudgeRef.current(wheelDirection(sign, w.notch, e));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Springs back to the rest position after release
  const springBack = () => {
    stopSpring();
    let a = angleRef.current, v = 0;
    const tick = () => {
      v += -0.16 * a - 0.24 * v;
      a += v;
      if (Math.abs(a) < 0.3 && Math.abs(v) < 0.3 && performance.now() >= holdRef.current) { setAngle(0); setDir(0); rafRef.current = 0; return; }
      setAngle(a);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };
  const dirOf = (a: number): 0 | 1 | -1 => (a > 8 ? 1 : a < -8 ? -1 : 0);
  // While held, keeps counting; the further the drum is turned, the faster
  const repeat = () => {
    if (!dragRef.current) return;
    const d = dirOf(angleRef.current);
    if (d) stepRef.current(d);
    repeatRef.current = window.setTimeout(repeat, Math.max(70, 330 - Math.abs(angleRef.current) * 2.9));
  };
  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    stopSpring();
    stopRepeat();
    const r = e.currentTarget.getBoundingClientRect();
    const dir: 1 | -1 = e.clientY < r.top + r.height / 2 ? 1 : -1;
    dragRef.current = { startY: e.clientY, base: dir * 40 };
    setDir(dir);
    setAngle(dir * 40);
    stepRef.current(dir);
    repeatRef.current = window.setTimeout(repeat, 450);
  };
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const a = Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, d.base + (d.startY - e.clientY) * 1.5));
    setAngle(a);
    // Dragged past the middle the other way: the other arrow (and cursor) takes over
    const nd = dirOf(a);
    if (nd) setDir(nd);
  };
  // Released: both arrows come back
  const onUp = () => { dragRef.current = null; stopRepeat(); setDir(0); springBack(); };

  return (
    <div
      ref={rootRef}
      role="spinbutton"
      tabIndex={0}
      aria-label={label ?? 'Press the top of the holes to count up and the bottom to count down; hold to keep counting, or scroll'}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      onKeyDown={e => {
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
        e.preventDefault();
        nudge(e.key === 'ArrowUp' ? 1 : -1);
      }}
      onClick={e => e.stopPropagation()}
      // The up/down cursor over the whole drum (the digit too), not only over the holes: its arrow of the direction
      // being counted is filled white while pressing, dragging or scrolling, and both are black again when it stops
      className="absolute inset-0 rounded-sm cursor-ns-resize select-none overflow-hidden focus-visible:outline-2 focus-visible:outline-cyan-400"
      style={dir ? { cursor: dir === 1 ? CURSOR_UP : CURSOR_DOWN } : undefined}
    >
      <div className="absolute inset-0 bg-linear-to-b from-zinc-950 via-zinc-600 to-zinc-900" />
      <div className="absolute inset-0 bg-linear-[180deg,transparent_14%,rgba(255,255,255,0.32)_28%,transparent_38%,rgba(0,0,0,0.3)_55%,rgba(255,255,255,0.22)_70%,transparent_82%]" />
      <div className="absolute -left-1 top-0 bottom-0 w-2 rounded-[50%] bg-linear-to-r from-zinc-900 to-zinc-500 shadow-[inset_-1px_0_1px_rgba(255,255,255,0.6)]" />
      <div className="absolute inset-y-0 left-1 w-[62%] bg-linear-to-r from-zinc-300/0 via-zinc-300/20 to-zinc-300/0" />
      <div className="absolute inset-y-[18%] left-1 w-[62%] bg-linear-to-b from-transparent via-white/14 to-transparent blur-[1px]" />
      <div className="absolute inset-y-0 left-1 w-[58%] flex items-center justify-center text-2xl font-black text-zinc-950 text-shadow-[0_1px_0_rgba(255,255,255,0.45)]">
        {/* A count drum's number in the middle of the grey part (Julian): a 1em box, no line box around it (the text's
            line height pushed it up) */}
        <span className={`${textSize} ${ends ? 'flex items-center leading-none' : ''}`} style={textStyle}><RollingDigit value={value} text={text} /></span>
      </div>
      <div onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} className={`absolute inset-y-0 right-0 w-[38%] touch-none ${dir === 1 ? 'cursor-n-resize' : dir === -1 ? 'cursor-s-resize' : 'cursor-ns-resize'}`} style={dir ? { cursor: dir === 1 ? CURSOR_UP : CURSOR_DOWN } : undefined}>
        <DrumHoles angle={angle} dir={dir} fadeUp={ends && value >= max} fadeDown={ends && value <= min} />
      </div>
    </div>
  );
}

// How many digits a number gets (instead of a slider): the same steel drum as a digit, always open (no three dots),
// in the frame of an open digit (the number's colour, dark background). min … max, never past them. Wider when it can
// show two digits (10 to 12)
// `format`: what it shows for a value (the step delay: 0, 0.5, 1, 1.5); the drum is as wide as its longest text.
// At min the red (down) arrow is pale, at max the green one (Julian)
export function CountDrum({ value, min, max, onChange, color, disabled = false, label, format = String, textStyle }: { value: number; min: number; max: number; onChange: (v: number) => void; color: 'cyan' | 'pink'; disabled?: boolean; label: string; format?: (v: number) => string; textStyle?: (v: number) => CSSProperties | undefined }): ReactElement {
  // The longest text of ALL its values (not only min and max: 0 … 2 has 0.5 and 1.5 in between)
  let longest = 0;
  for (let v = min; v <= max; v++) longest = Math.max(longest, format(v).length);
  const step = (dir: 1 | -1) => {
    const v = Math.max(min, Math.min(max, value + dir));
    if (v !== value) onChange(v);
  };
  return (
    <div
      className={`relative ${longest >= 3 ? 'w-16' : longest === 2 ? 'w-14' : 'w-11'} h-10 shrink-0 rounded-md border-2 overflow-hidden bg-zinc-900 shadow-[0_2px_6px_rgba(0,0,0,0.5)] transition-opacity ${color === 'cyan' ? 'border-cyan-500' : 'border-pink-500'} ${disabled ? 'opacity-40 pointer-events-none' : ''}`}
      inert={disabled}
    >
      <div className="absolute inset-0 rounded-sm overflow-hidden">
        <DigitDrum value={value} onStep={step} open={!disabled} min={min} max={max} label={label} ends text={format(value)} textSize={longest >= 3 ? 'text-[25px]' : ''} textStyle={textStyle?.(value)} />
      </div>
    </div>
  );
}
