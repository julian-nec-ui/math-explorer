"use client";

// A digit cell in its colours (variants), and the editable operand digit that opens a steel drum

import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactElement } from 'react';
import type { DigitVariant } from './types';
import { CELL } from './layout';
import { RollingDigit } from './RollingDigit';
import { DigitDrum } from './Drum';
import { usePhone } from './OperandDrum';

const VARIANT: Record<DigitVariant, string> = {
  highlight: 'bg-linear-to-br from-yellow-400 to-orange-500 text-zinc-900 border-yellow-300 scale-110 shadow-[0_0_20px_rgba(250,204,21,0.6)] z-30',
  result: 'bg-linear-to-br from-cyan-400 to-blue-500 text-zinc-900 border-cyan-300 scale-105 shadow-[0_0_15px_rgba(34,211,238,0.5)]',
  computed: 'bg-linear-to-br from-slate-600 to-slate-800 text-slate-200 border-slate-500 shadow-inner',
  ghost: 'bg-transparent text-zinc-600 border-dashed border-zinc-700',
  // A placeholder 0 (added when a row moves left, or brought down after the last digit) in a highlighted column (Julian):
  // it stays a dashed placeholder, only its border takes the highlight's yellow
  ghostHighlight: 'bg-transparent text-zinc-600 border-dashed border-yellow-400 scale-110 z-30',
  idle: 'bg-zinc-800 text-zinc-400 border-zinc-700',
  // The operands' digits (N1, N2) before they are used: a blue gradient made like the result's (light at the top left,
  // darker at the bottom right), from #004d80 to #002e4d. Over it, so the whole button looks slightly domed (curved on
  // every side, not only one like the drum): a soft light at the top left and edges that darken all the way round
  input: 'bg-[image:radial-gradient(ellipse_75%_60%_at_35%_22%,rgba(255,255,255,0.28),transparent_70%),radial-gradient(ellipse_at_center,transparent_48%,rgba(0,0,0,0.42)_100%),linear-gradient(to_bottom_right,#004d80,#002e4d)] text-zinc-200 border-[#0a5d94]',
};

export const pickVariant = (s: { highlighted: boolean; computed: boolean; ghost: boolean }): DigitVariant =>
  s.highlighted ? (s.ghost ? 'ghostHighlight' : 'highlight') : s.ghost ? 'ghost' : s.computed ? 'computed' : 'input';

interface DigitProps {
  digit: number;
  variant: DigitVariant;
  isNum1?: boolean;
  onIncrement?: () => void;
  onDecrement?: () => void;
  hoverEditable?: boolean;
  operand?: boolean;
  // A smaller cell (36px everywhere) with a bigger digit (24px; 26px for a result), so the digit fills its square
  // better (fractions' calculations)
  compact?: boolean;
}

// A digit cell. An editable operand digit turns into a steel drum: with a mouse when the pointer is over it,
// on a phone or tablet when it is tapped (another tap outside it closes the drum)
export function Digit({ digit, variant, isNum1 = true, onIncrement, onDecrement, hoverEditable = false, operand = false, compact = false }: DigitProps): ReactElement {
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const closeTimer = useRef(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const clearClose = () => { window.clearTimeout(closeTimer.current); closeTimer.current = 0; };
  useEffect(() => () => clearClose(), []);
  const show = () => { clearClose(); setLeaving(false); setOpen(true); };
  const hide = () => { clearClose(); setLeaving(true); closeTimer.current = window.setTimeout(() => setOpen(false), 750); };

  const visible = open && !leaving;
  // A phone (Julian): a tap on the digit (or its dots) opens the drum and the digit grows to twice its size, over its
  // neighbours (they don't move), so it is easy to turn; it goes back 3 s after the last touch, or at once on a tap
  // outside it
  const phone = usePhone();
  const idleTimer = useRef(0);
  const arm = () => { window.clearTimeout(idleTimer.current); idleTimer.current = window.setTimeout(() => hide(), 3000); };
  useEffect(() => {
    if (!visible || !phone) return;
    arm();
    return () => window.clearTimeout(idleTimer.current);
  }, [visible, phone]);
  // Touch: a tap anywhere outside the open drum closes it
  useEffect(() => {
    if (!visible || !hoverEditable) return;
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' && rootRef.current && !rootRef.current.contains(e.target as Node)) hide();
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [visible, hoverEditable]);

  // Only a click (or a tap) on the three dots opens the drum; hovering does nothing. Once open, it stays open until
  // the pointer leaves the whole digit (or, on touch, until a tap outside it)
  const handlers = hoverEditable
    ? { onPointerLeave: (e: ReactPointerEvent<HTMLDivElement>) => { if (e.pointerType === 'mouse') hide(); } }
    : {};
  const dotHandlers = {
    onClick: () => { if (!visible) show(); },
  };
  const step = (dir: 1 | -1) => { if (phone) arm(); if (dir === 1) onIncrement?.(); else onDecrement?.(); };

  if (hoverEditable) {
    const frame = visible ? `${isNum1 ? 'border-cyan-500' : 'border-pink-500'} bg-zinc-900` : VARIANT[variant];
    const fade: CSSProperties = { transitionDuration: '750ms' };
    return (
      <div
        ref={rootRef}
        {...handlers}
        onClick={phone && !visible ? show : undefined}
        onPointerDown={phone && visible ? arm : undefined}
        className={`${CELL} shrink-0 relative rounded-md border-2 overflow-hidden shadow-[0_2px_6px_rgba(0,0,0,0.5)] transition-[border-color,background-color,transform] ease-in-out ${frame} ${phone && visible ? 'z-50' : ''}`}
        style={{ ...fade, ...(phone ? { transform: visible ? 'scale(2)' : 'scale(1)', transitionDuration: visible ? '250ms' : '750ms' } : {}) }}
      >
        <div className="absolute inset-0 rounded-sm overflow-hidden flex items-center justify-center font-extrabold text-[26px] md:text-[30px] transition-opacity ease-in-out" style={{ opacity: visible ? 0 : 1, ...fade }}>
          <span className="translate-y-1.75"><RollingDigit value={digit} /></span>
          {/* Three small steel dots: click them to change this digit. With a mouse only the dots themselves react (13×3 px,
              plus 1 px around them: 15×5 px); on a touch screen the area stays bigger (24×20 px), so a finger can hit it */}
          <div aria-hidden="true" {...dotHandlers} className="absolute top-[3px] right-[3px] w-[15px] h-[5px] flex justify-center items-center gap-0.5 cursor-pointer pointer-coarse:top-0 pointer-coarse:right-0 pointer-coarse:w-6 pointer-coarse:h-5 pointer-coarse:pt-1 pointer-coarse:pr-1 pointer-coarse:justify-end pointer-coarse:items-start">
            {[0, 1, 2].map(i => (
              <span key={i} className="block size-[3px] rounded-full bg-[radial-gradient(circle_at_35%_30%,#f4f7fa,#cfdae3_45%,#9aa9b5_85%,#6b7b88)] shadow-[0_0_1px_rgba(0,0,0,0.6)]" />
            ))}
          </div>
        </div>
        <div className={`absolute inset-0 rounded-sm overflow-hidden transition-opacity ease-in-out ${visible ? '' : 'pointer-events-none'}`} style={{ opacity: visible ? 1 : 0, ...fade }} inert={!visible}>
          <DigitDrum value={digit} onStep={step} open={visible} />
        </div>
      </div>
    );
  }

  return (
    <div {...handlers} className="shrink-0">
      <div className={`${compact ? 'w-9 h-9' : CELL} shrink-0 flex items-center justify-center rounded-md border-2 font-extrabold ${compact ? (variant === 'result' ? 'text-[26px]' : 'text-[24px]') : variant === 'result' ? 'text-[28px] md:text-[32px]' : operand ? 'text-[22px] md:text-[25px]' : 'text-lg md:text-xl'} transition-all duration-700 relative ${VARIANT[variant]}`}>
        <RollingDigit value={digit} />
      </div>
    </div>
  );
}
