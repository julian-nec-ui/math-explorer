// Placement constants shared by the page's parts (header, controls column)

// The title and the controls column sit 10px from the panel's left edge (Julian: first 5px, then 5px back to the right),
// whatever its left padding (p-3 / sm:p-5 / md:p-6 / lg:p-8 = 12 / 20 / 24 / 32px): pulled left by the padding minus 10px
// The controls column (drums, buttons) and the elapsed-time counter above it sit 3px lower (Julian), in every tab
export const COL_DROP = 3;
export const EDGE_5 = '-ml-[0.125rem] sm:-ml-[0.625rem] md:-ml-[0.875rem] lg:-ml-[1.375rem]';

// The digit drums' box (two 40px drums 12px apart, p-3, 1px border: 118px) centred on the board's two numbers (Julian):
// N1's cells start 60px down the board area and N2's end cell + 34 + cell further (addition / subtraction)
export const DRUM_BOX_H = 2 * 40 + 12 + 2 * 12 + 2;
// Everything on the board, and the controls column with it, sits 25px higher than it used to (Julian, to save room):
// the boards lost their 16px top padding and, from md up, the board area moves 9px up into the gap under the header
// (it can't all come from the padding: the fraction labels above the numerators need the room)
export const BOARD_LIFT = 25;
