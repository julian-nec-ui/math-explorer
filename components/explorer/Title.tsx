"use client";

import type { CSSProperties, ReactElement, ReactNode, RefObject } from 'react';
import { EDGE_5 } from './constants';

// Each operation's title is tinted with its tab's colour, fading from left to right
// The title's colours come from its tab (OPERATIONS[].color): from a lighter tint of it on the left to the colour itself
const tint = (hex: string, amount: number): string => {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amount).toString(16).padStart(2, '0');
  return `#${mix((n >> 16) & 255)}${mix((n >> 8) & 255)}${mix(n & 255)}`;
};

const TITLE_3D: CSSProperties = {
  // Letter face: bright at the top, clearly shaded towards the bottom (the colour layer is added per operation)
  backgroundImage: 'linear-gradient(180deg, #ffffff 0%, #ececf2 38%, #a9a9b5 74%, #74747f 100%)',
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
  filter: [
    'drop-shadow(0 -1px 0 rgba(255, 255, 255, 0.95))',  // bright light on the top edge
    // extruded side: eight layers going down and slightly right (depth), each darker than the last
    ...['#9b9ba7', '#898995', '#777783', '#666671', '#55555e', '#45454d', '#36363d', '#28282e']
      .map(c => `drop-shadow(0.3px 1px 0 ${c})`),
    'drop-shadow(2px 12px 10px rgba(0, 0, 0, 0.8))',    // shadow cast on the panel
  ].join(' '),
};

// 3D title (same for every operation): metallic light-to-shade gradient on the letters, an extruded
// edge built from stacked 1px shadows that get darker downwards, and a soft cast shadow. Raised 5px
// `slotRef`: from lg up a slot as wide as the longest title (MULTIPLICATION), so the control band doesn't move between operations
// `under`: what sits 20px under the name, aligned with it on the left (the learning / testing switch, Julian): in the flow on
// a phone; from desk up hanging under the title's row, so nothing else moves
export function Title({ slotRef, titleRef, label, color, under }: { slotRef: RefObject<HTMLDivElement | null>; titleRef: RefObject<HTMLHeadingElement | null>; label: string; color: string; under?: ReactNode }): ReactElement {
  return (
    <div ref={slotRef} className="relative order-1 shrink-0 lg:w-[24rem] 2xl:w-[27.5rem]">
    <h1
      ref={titleRef}
      // 10px from the panel's left edge (Julian; see EDGE_5)
      className={`w-max -mt-1.25 ${EDGE_5} text-[32px] sm:text-[39px] md:text-[43px] 2xl:text-[50px] land:text-[34px]! font-black tracking-[calc(-0.05em+3px)]`}
      style={{
        ...TITLE_3D,
        // Light and shade from top to bottom (keeps the 3D look) over the operation's colours from left to right
        backgroundImage: `linear-gradient(180deg, rgba(255, 255, 255, 0.6) 0%, rgba(255, 255, 255, 0.15) 40%, rgba(0, 0, 0, 0.3) 100%), linear-gradient(90deg, ${tint(color, 0.45)}, ${color})`,
      }}
    >
      {label.toUpperCase()}
    </h1>
    {under && <div className={`${EDGE_5} mt-5 desk:absolute desk:mt-0 desk:left-0 desk:top-[calc(100%+1.25rem)] desk:z-30`}>{under}</div>}
    </div>
  );
}
