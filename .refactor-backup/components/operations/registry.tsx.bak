// The operations the app offers, grouped in categories. Each operation is drawn by its own board component; the page
// (MathExplorer) only knows this list. To add an operation, write its board and add a line here; to move one to
// another category, change its `category`.

import type { ReactElement } from 'react';
import type { BoardProps, FracPart, FractionParts, MathOp, NumberData } from '../math/shared';
import AddSubBoard from './basic/AddSubBoard';
import MultiplicationBoard from './basic/MultiplicationBoard';
import DivisionBoard, { type DivisionMethod, type DivisionResult } from './basic/DivisionBoard';
import FractionBoard, { hasZeroDenominator } from './fractions/FractionBoard';

export type CategoryId = 'basic' | 'fractions';

export const CATEGORIES: { id: CategoryId; label: string }[] = [
  { id: 'basic', label: 'Basic math' },
  { id: 'fractions', label: 'Fractions' },
];

// What the page gives every board: the common board props, plus the key that clears it (a new key remounts it) and
// the page's options that some boards use
export interface BoardContext extends BoardProps {
  boardKey: number;
  divisionMethod: DivisionMethod;
  divisionResult: DivisionResult;
  // Fractions: the two numerators and denominators, and turning one of their digits
  fraction: FractionParts;
  onCycleFractionDigit: (part: FracPart, index: number, direction: 1 | -1) => void;
}

export interface OperationConfig {
  id: MathOp;
  label: string;
  icon: string;
  color: string; // the tab's colour (also the title's)
  category: CategoryId;
  // Draws the operation's board; an operation without one isn't ready yet (its tab shows "Soon")
  board?: (ctx: BoardContext) => ReactElement;
  // Drawn inside the page's padded frame (multiplication, division); addition/subtraction lay themselves out
  framed?: boolean;
  // When the numbers can't be explained (e.g. a fraction with the denominator 0): the reason, and the page disables
  // Explain to Me and Redo until the numbers change. Everything that can fix it (digits, signs, New Numbers) stays on
  blocked?: (c: { num1: NumberData; num2: NumberData; fraction: FractionParts }) => string | null;
}

const props = (c: BoardContext): BoardProps => ({
  num1: c.num1,
  num2: c.num2,
  run: c.run,
  onStatus: c.onStatus,
  onDone: c.onDone,
  renderSign: c.renderSign,
  onCycleDigit: c.onCycleDigit,
  hoverEdit: c.hoverEdit,
  availableWidth: c.availableWidth,
  stepsExtra: c.stepsExtra,
  leftRoom: c.leftRoom,
  stepsClosed: c.stepsClosed,
  pageMidX: c.pageMidX,
  availableHeight: c.availableHeight,
  smoothFit: c.smoothFit,
  onNaturalWidth: c.onNaturalWidth,
});

export const OPERATIONS: OperationConfig[] = [
  { id: 'addition', label: 'Addition', icon: '+', color: '#00cccc', category: 'basic',
    board: c => <AddSubBoard key={`addition-${c.boardKey}`} op="addition" {...props(c)} /> },
  { id: 'subtraction', label: 'Subtraction', icon: '-', color: '#ff0066', category: 'basic',
    board: c => <AddSubBoard key={`subtraction-${c.boardKey}`} op="subtraction" {...props(c)} /> },
  { id: 'multiplication', label: 'Multiplication', icon: '×', color: '#009900', category: 'basic', framed: true,
    board: c => <MultiplicationBoard key={`multiplication-${c.boardKey}`} {...props(c)} /> },
  // The division board is also remounted when the decimal method changes
  { id: 'division', label: 'Division', icon: '÷', color: '#5feded', category: 'basic', framed: true,
    board: c => <DivisionBoard key={`division-${c.divisionMethod}-${c.divisionResult}-${c.boardKey}`} {...props(c)} method={c.divisionMethod} result={c.divisionResult} /> },
  { id: 'fractions', label: 'Fractions', icon: '/', color: '#cc0052', category: 'fractions', framed: true,
    board: c => <FractionBoard key={`fractions-${c.boardKey}`} {...props(c)} fraction={c.fraction} onCycleFractionDigit={c.onCycleFractionDigit} />,
    blocked: c => (hasZeroDenominator(c.fraction) ? 'We can’t divide by zero: change the denominator 0 first.' : null) },
];
