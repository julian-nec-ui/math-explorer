import { type BadgeKind } from '../../../math/shared';
export { GAP, COMMA_W, COMMA_NUDGE, DOT_ROOM, OP_MARK, OP_BAR } from '../geometry';

// A digit written on the board. `ghost` = placeholder zero in shifted partial products.
export interface Cell { value: number; id: string; ghost?: boolean; }

// A carry chip. `area` says which row it sits on: above N1 (top),
// above the partial products (sum), or moving toward a digit (free).
export interface Chip { id: string; area: 'top' | 'sum' | 'free'; col: number; side: 'left' | 'right'; x: number; y: number; value: number; kind: BadgeKind; fading: boolean; }

export const LEFT = 51; // operation sign column (40px) + the gap before the digits
