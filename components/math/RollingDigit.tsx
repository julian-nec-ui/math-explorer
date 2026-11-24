"use client";

import { useState, type ReactElement } from 'react';

// A digit that rolls up or down (the shorter way round) when its value changes
// `text`: what to show instead of the value itself (the step delay drum shows 0.5 for its value 1, …)
export function RollingDigit({ value, text }: { value: number; text?: string }): ReactElement {
  const [shown, setShown] = useState({ value, dir: 0 });
  if (shown.value !== value) setShown({ value, dir: (value - shown.value + 10) % 10 <= 5 ? 1 : -1 });
  const anim = shown.dir === 1 ? 'animate-roll-up' : shown.dir === -1 ? 'animate-roll-down' : '';
  return (
    <span className="relative inline-block h-[1em] overflow-hidden leading-none">
      <span key={`${shown.value}-${shown.dir}`} className={`block ${anim}`}>{text ?? shown.value}</span>
    </span>
  );
}
