"use client";

import type { ReactElement } from 'react';
import { RESULT_GRADIENT } from './StepsWindow';

// The page's own CSS (keyframes of the boards' animations, the steps window's scrollbar) and the SVG gradients the
// arrows use
export function PageStyles(): ReactElement {
  return (
    <>
      <style>{`
        @keyframes popIn {
          0% { opacity: 0; transform: scale(0.3); }
          70% { opacity: 1; transform: scale(1.1); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes fadeOut {
          from { opacity: 1; transform: scale(1); }
          to { opacity: 0; transform: scale(0.5); }
        }
        @keyframes carryFlight {
          0% { transform: translate(0, 0) scale(1); animation-timing-function: ease-in-out; }
          40% { transform: translate(var(--tx), 0) scale(1); animation-timing-function: linear; }
          100% { transform: translate(var(--tx), var(--ty)) scale(1.4); }
        }
        @keyframes rollUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes rollDown {
          from { transform: translateY(-100%); }
          to { transform: translateY(0); }
        }
        .animate-roll-up { animation: rollUp 0.16s cubic-bezier(0.2, 0.8, 0.3, 1.2); }
        .animate-roll-down { animation: rollDown 0.16s cubic-bezier(0.2, 0.8, 0.3, 1.2); }
        .animate-pop-in { animation: popIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
        /* Steps window scrollbar: 8px, no track, a rounded #456175 thumb, always shown once the steps overflow. The track keeps
           16px clear at the top and bottom, so it stops where the window's rounded corners begin */
        .steps-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
        .steps-scroll::-webkit-scrollbar-corner { background: transparent; }
        .steps-scroll::-webkit-scrollbar-track { background: transparent; margin: 16px 0; }
        .steps-scroll::-webkit-scrollbar-thumb { background: #456175; border-radius: 9999px; }
        @supports (-moz-appearance: none) {
          .steps-scroll { scrollbar-width: thin; scrollbar-color: #456175 transparent; }
        }
        .animate-fade-out { animation: fadeOut 1s ease-out forwards; }
        .animate-carry-flight { animation: carryFlight 1.4s forwards; }
        @media (prefers-reduced-motion: reduce) {
          .animate-pop-in, .animate-fade-out, .animate-carry-flight, .animate-roll-up, .animate-roll-down { animation-duration: 1ms; }
        }
      `}</style>
      
      <svg width="0" height="0" className="absolute" aria-hidden="true">
        <defs>
          <linearGradient id="upArrowGrad" x1="0" y1="1" x2="0" y2="0"><stop offset="0%" stopColor="#ecfccb" /><stop offset="30%" stopColor="#86efac" /><stop offset="60%" stopColor="#22c55e" /><stop offset="100%" stopColor="#14532d" /></linearGradient>
          <linearGradient id="stepArrowGrad" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#d9653f" /><stop offset="100%" stopColor="#fdbca6" /></linearGradient>
          <linearGradient id="resultArrowGrad" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor={RESULT_GRADIENT[0]} /><stop offset="100%" stopColor={RESULT_GRADIENT[1]} /></linearGradient>
          <linearGradient id="downArrowGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#fee2e2" /><stop offset="30%" stopColor="#fca5a5" /><stop offset="60%" stopColor="#ef4444" /><stop offset="100%" stopColor="#7f1d1d" /></linearGradient>
        </defs>
      </svg>
    </>
  );
}
