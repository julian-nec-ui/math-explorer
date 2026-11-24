// Board geometry shared by the basic boards (board px)

// The same room as in addition / subtraction (Julian): 6px between digits, 12px for a thousands comma (the shared
// comma glyph is 20px wide, so it is drawn 4px before its slot to stay centred in it)
export const GAP = 6;
export const COMMA_W = 12;
export const COMMA_NUDGE = 4;
// Extra room where a decimal point sits between two digits (Julian): the 6px point then has 3px on each side
// (Julian chose 3px over 2px)
export const DOT_ROOM = 6;

// The + / − between two digits of a column being worked on: a square of two flat bars, board px
export const OP_MARK = 15;
export const OP_BAR = 3.5;
