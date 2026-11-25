# Notes for Claude: math-explorer

Read this file first in a new conversation. It replaces the long history of the earlier ones.

## Project
- Path on Julian's Mac: `/Users/julian/react/nextjs/math-explorer`
- Next.js 15 (app router), React 19, Tailwind CSS 4, TypeScript strict (`noUnusedLocals`, `noUnusedParameters`), pnpm.
- An animated, step-by-step explainer for written arithmetic ("Explain to Me"), for children.
- Julian writes in Romanian; answer in Romanian.

## How Julian wants to work
- Julian's app runs at http://localhost:3000 (dev server, his Chrome; earlier notes said 3001). With Claude in Chrome connected, check
  layout changes there (his font size, window and saved steps width), not only in the headless build.
- **Write every changed file directly into the project on disk.** Then run `npx tsc --noEmit -p .` in the project
  (device shell) and fix any error before saying it's done.
  After writing, **check that the file on disk really has the new content** (md5sum or grep): once a file copied to the
  Mac kept its old content, tsc still passed, and Julian saw the old version in the app.
- **Show only the files changed in THIS iteration** in the explorer page (an artifact) — see "Pagina de modificări pe
  iterații" below. A file that didn't change since the previous iteration is not shown (it is simply on disk).
- The explorer page looks like VS Code: a narrow left column with the folder tree of the changed files only (folder
  icon on every folder, file icon on every file, changed files in red with N = new / M = modified, and a "double
  square" copy button beside each file that turns green once clicked). Clicking a file shows its code on the right,
  top half (changed lines marked green, the Romanian notes above the code, scrolled to the first change); the bottom
  half is a working copy of the app's board (plain HTML/JS, same steps and timings) so the change can be tried there.
  A draggable bar splits code and app. Republish the same artifact (slug 6629d7ad-6f05-4fdb-8095-e2a9aaef32fd,
  "math-explorer — Fractions") instead of making a new one.
- **The explorer page's bottom pane runs the REAL app** (`app.html`, a second file of the same artifact, shown in an
  iframe as a 1600 × 950 screen scaled to the pane, with a link to open it alone). Built in the cloud workspace, not in
  the project: stage the 7 component files + `app/globals.css` + React 19 / react-dom / scheduler production CJS files +
  `tailwindcss/dist/lib.js` and its CSS files + `typescript/lib/typescript.js` from node_modules; transpile the TSX with
  `ts.transpileModule` (CommonJS, react-jsx), bundle them with a tiny `require()` map, generate the CSS with Tailwind's
  `compile(globals.css).build(candidates)` (candidates = the tokens of the sources), render `<MathExplorer />`. Check it
  with headless Chrome (sliders: set the input's value with the native setter + an `input` event) before publishing.
- The device shell can't run the Next.js app (no `next` in node_modules there, no network for eslint). Visual checks
  are done on the board copy in the explorer page, with a headless browser in the cloud workspace.
- Before changing something visual, check it with a screenshot (yourself), not by asking him.
- If a change isn't liked, he says "revert": restore the previous version exactly (keep a copy before every change).
- When a request is ambiguous (which element?), ask, or ask for a screenshot. One question, not several.

## Structure
```
app/page.tsx, app/layout.tsx, app/globals.css   (globals.css defines the `desk` variant: ≥48rem wide and ≥37.5rem tall)
components/
  MathExplorer.tsx            the page "frame": 3D title, tabs (snake outline), controls column, control band,
                              steps window; it knows the operations only through the registry
  operations/
    registry.tsx              CATEGORIES (basic, fractions) and OPERATIONS: id, label, icon, colour, category, board
    basic/AddSubBoard.tsx     addition AND subtraction (one board, `op` prop)
    basic/MultiplicationBoard.tsx
    basic/DivisionBoard.tsx
    fractions/FractionBoard.tsx   fractions (addition / subtraction of two fractions, see below)
  math/shared.tsx             shared pieces: number data, Digit (with the steel drum to change a digit), CarryChip,
                              CarryHop + SumPop (carries/borrows that jump in an arc), OpIcon, ResultSign, helpers
```

## Adding an operation (e.g. fractions)
1. Write `components/operations/<category>/<Name>Board.tsx`, taking `BoardProps` (from `math/shared.tsx`):
   `num1, num2, run, onStatus, onDone, renderSign, onCycleDigit, hoverEdit, availableWidth`.
   The board starts its animation when `run` turns true, calls `onStatus(text)` for each step and
   `onStatus(doneMessage(result))` + `onDone()` at the end. The page clears it by remounting it (new key).
2. Add `board: c => <NameBoard key={`name-${c.boardKey}`} {...props(c)} />` to its entry in `registry.tsx`.
   Use `framed: true` to have it drawn inside the padded frame, like multiplication and division.
3. To move an operation to another category, change its `category` in the registry.
   (The categories are not shown in the UI yet: all tabs are in one row.)

## Look and behaviour already decided (don't change without being asked)
- Tab colours: addition #00cccc, subtraction #ff0066, multiplication #009900, division #5feded, fractions #cc0052.
  The 3D title uses the active tab's colour (light tint → colour, left to right).
- Tabs: no background; a grey "snake" outline with rounded S turns that also closes each tab; the active tab's
  stretch and its name are in its colour.
- Input digits (N1, N2): blue gradient #004d80 → #002e4d (top-left to bottom-right) with a slight dome (light at
  the top left, darker edges). Result digits: cyan → blue gradient (unchanged).
- The steel drum (click the 3 dots of a digit; see "The steel drum" below): green arrow #00e600 up, red arrow #ff0f6f down. While counting, only
  the arrow of that direction is shown and it moves at most 8° so it stays in the frame; the cursor is a copy of the
  macOS up/down cursor with the active triangle filled metallic white.
- Carries jump visibly: the sum (e.g. 16) appears where the digit goes, 6 stays, 1 jumps in an arc to the next
  column (addition, multiplication rows and final sum). Borrows: the ten (red "10") jumps from the digit on the left;
  in subtraction the changed top digit is crossed out in red with its new value written small above it (9 → 8,
  3 → 13); the marks fade when the result is done. Division's subtractions have the jump but not the crossing yet.
- Negative numbers in addition/subtraction are rewritten first (e.g. 3 − 8 = −(8 − 3), with brackets and a pink
  minus); at the end the board goes back to the problem as entered.
- Timing: the rewrite steps at the start are 30% shorter than they used to be; a start without a rewrite is 30%
  longer (add/sub 780 ms + first column 1300 ms; multiplication 2080 + 1300; division 2080 + 2080).
- Layout: on wide desktops (≈1280px+) title, control band (Explain to Me, New Numbers, Stop) and tabs share one
  row; otherwise the band moves into the controls column under the sliders and INTEGER / FLOAT / Redo. The N1/N2
  digit sliders sit in their own box centred on the first operand's digits.

## Fractions (done: adding two fractions; a negative one makes it a subtraction)
- One tab, "Fractions" (#cc0052, category `fractions`, `framed: true`), board `operations/fractions/FractionBoard.tsx`.
- **Numbers**: each numerator and denominator is its own number of **1 to 6 digits**, one slider each on the Fractions
  tab (Numerator 1, Denominator 1 in cyan; Numerator 2, Denominator 2 in pink; default 1 digit). Types `FracPart`,
  `FractionParts`, `FRAC_PARTS` in `math/shared.tsx`; state `fracParts` / `fracCounts` in MathExplorer, passed through
  `BoardContext.fraction` + `onCycleFractionDigit`. Every digit has its own steel drum. The signs of the two fractions
  are N1's and N2's signs (the ± buttons). New numbers are never 0 (no denominator 0, no numerator 0). On Explain to Me
  leading zeros left by the drums go (007 → 7) and the sliders follow. INTEGER / FLOAT are disabled on Fractions.
- **Problem layout**: `( ±a/b ) + ( ±c/d )`: each fraction with its sign button inside tall round brackets (SVG), the
  + between them. When they don't fit side by side, the second goes under the first, the + stays after the first
  (flex-wrap, the board knows `availableWidth`).
- **Steps** (texts in English): denominators different → the LCM. If each list of multiples has at most 7 cells
  (`MAX_MULTIPLES`), lists of multiples ("Multiples of 6:" labels left-aligned with the colons in a column, the
  numbers right-aligned so the common one, green, is in one column; a denominator 1 shows `1 … 5`); otherwise **prime
  factorization**: "Prime factors of 8: 2 × 2 × 2 = 2³" (the multiplication first, then the power, with the status
  explaining "2 multiplied by itself 3 times"), the biggest powers turn green and jump into "LCM: 2³ × 3² = 8 × 9 = 72".
  Then amplification (×k chips beside top and bottom, old values crossed out in red with an SVG line from the
  bottom-left to the top-right corner of the number, new values written small 6px above / below), ONE fraction with a
  **long fraction line under all the numerators and their signs**, the sum, simplification (÷gcd, red chips), then a
  whole number or a **mixed number explained**: 15/8 = (8 + 7)/8 = 8/8 + 7/8 = 1 + 7/8 = 1 7/8 (wholes ringed in green;
  more than 3 wholes as a product: (9 × 8 + 8)/9 = 72/9 + 8/9 = 8 + 8/9; negatives in brackets −(…)).
- **Jumps** (`CarryHop` options used only here): 1.7 s each (`FR_HOP_MS`) + 0.4 s pause, land at 80% of their start
  size (`endScale` 1.28), the square widens with its text (`wide`), and a **crossfade** on landing: the number appears
  blurred → sharp 300 ms before the end while the square fades out (`FR_LAND_MS`, `fadeOutMs`) — never an empty moment.
- **Sizes**: ×k / ÷k chips 28px tall, 9px side padding, text 18.4px; reserved room after them (an invisible copy), so a
  bracket comes after the chips. Rings: 4px padding all round. Input digits 15% bigger while explaining (CSS `zoom`, so
  the layout makes room; no smooth transition), 10px between digits. Calculation digits use `Digit compact` (36px cells,
  24px digits, 26px results). The fraction line sticks out 6px past the wider number.
- **Fit**: when the row of calculations is wider than the board area, the whole board shrinks evenly (CSS zoom, 2% to
  spare) down to 75% (`MIN_FIT`); below that the rows wrap. The jumping square sits outside the zoomed part.
- **Denominator 0**: can be chosen with the drum; the number gets a red ring, a warning plate under the problem
  (#e73131 background, #f2f2f2 text, a 3D warning triangle top-left, an X top-right that gets bolder on hover; it closes
  with the X or a click outside and comes back when a denominator becomes 0 again). Explain to Me and Redo stay
  disabled (`blocked` in the registry, tooltip with the reason) until it changes.

## Addition / subtraction board (AddSubBoard.tsx)
- **Size and place rule (Julian, 2026-11-20 — keep it)**. Desktop (64rem+): normal size while the board fits in
  the board area, a little left of the centre: 0px with 1 digit … 20px with 12 (`ADD_SHIFT_MAX`; with room: `shift =
  min(base, room − need/2)`, tight: `min(room, max(base, need))`).
  From 11 digits on, more digits grow the board ONLY to the left (Julian): the right end stays where it was with 11
  (`right11` = where the board ended with 11 digits, computed from the remembered width at 11 the same way, centring
  clamped at the area's left edge included; past 11: `shift = left-centring + W − right11`; if `room` can't give
  that, the board shrinks a hair instead (`fit ≤ (right11 + room) / W`) so the right end still doesn't move).
  The last digit stops ~3px (nominal; 4.2 real px in Julian's Chrome) from the steps window, not 2: `viewW` is the
  area's width minus ADD_EDGE_GAP = 1 (the area itself ends 2px from the window).
  Checked IN JULIAN'S CHROME (localhost:3001, root font 22px, window 2056px, steps window dragged to 595px):
  11 → 12 digits, right edge 1392 → 1392.
  The board is also measured in a layout effect after every render (before paint), so a new digit never shows one
  frame at the old width. Checked frame by frame (frames.py): 11 → 12 digits, the last digit's right edge doesn't move. Too long (more digits, or the steps window widened): FIRST it moves left, into the
  free room up to 15px from the controls column (`leftRoom`, measured in MathExplorer: the area's left padding
  md:pl-60 minus the column, minus 15), just enough that its right end stays at the area's edge (2px from the window);
  ONLY when that room is used up does it shrink, smoothly, down to 50%; then the window comes over the digits and the
  board scrolls. Room again: normal size and centre come back. Code: `fit = max(0.5, min(1, (viewW + leftRoom) /
  naturalWidth))`, `shift = min(leftRoom, max(0, W·fit − viewW))`; the outer box is `shift` narrower, centred as if
  full width (`margin-left: max(0, (100% − W) / 2)`), the board `margin-left: −shift` (NOT a transform: Chrome still
  counted the old place and showed a scrollbar). The board has no right padding (except `pr-2` in −( … )).
  Checked, 12 digits, default window: 1920/1512/1470/1440 = 100%, no scrollbar (1440: moved left, 71px still free on
  the left); 1280 = 87%, 16px from the column, 2px from the window. Widening at 1512: moves left first (100%),
  then 96% … 66% … 50% + scroll.
  Tablet / phone (< 64rem): shrink to fit the screen, down to 45%, then scroll.
  Rejected before: shrinking because the numbers are long while there is room, growing past the normal size, letting
  the window cover half a digit before shrinking, jumping to a smaller size at once, never shrinking at all (tried).
- The board area ends 2px from the steps window (`desk:lg:gap-0.5` in MathExplorer), so its horizontal scrollbar
  reaches right up to the window's edge (Julian: "la 2 pixeli de fereastră").
- The 0 for a missing digit (Julian, 2026-11-20): while explaining, in every column where one number has no digit, a
  BIG 0 chip (40px, 20px digit: twice a carry chip; green in addition, red in subtraction) sits in that number's
  empty cell, centred. ONE chip: it pops in at the first such column, then hops (an arc, 700ms, Web Animations) one
  column left each time the work moves on, and fades out at the end. No corner "carry 0" badges (tried, rejected).
  A red crossed-out value above a top digit moves a little right (left-[66%]) while a chip sits in that column's
  top-left corner, so the chip doesn't cover it.
- 6px between cells (was 11), 12px thousands commas (was 20). A free column on the left is always kept for a final
  carry (the 13th digit of a 12-digit sum).
- The sign buttons (32px) sit 13px before the first digit (was 32px, then 16; Julian), the N1 / N2 tags moved
  with them (`signLeft = slotLeft − 32 − 13`, also used for the result's sign).
- "N1 ▶" / "N2 ▶" (9px label + the steps window's triangle, in the number's colour) sit on the left of each sign
  button, 8px from it; no label column on the right any more. The sign buttons draw + and − as SVG lines (centred).

## Multiplication / division size and layout (components/math/FitBoard.tsx)
- Layout like addition (Julian, 2026-11-20): sign buttons 13px before the leftmost operand digit, "N1 ▶" / "N2 ▶"
  (`OperandTag`, now in shared.tsx) 8px before them, the × / ":" "=" 50px before the buttons, between the rows. In
  multiplication the partial products' + and the lines start at the × or before the first digit of a wider row.
- Spacing like addition (Julian): 6px between digits, 12px thousands-comma slots (local GAP / COMMA_W in both
  boards; the 20px comma glyph drawn 4px before its slot). Checked in his Chrome: 24 6 6 24 6 6 in all three.
- Multiplication with a carry (Julian, 2026-11-20): the product alone appears big where the digit goes (8 × 2 = 16),
  the carry waiting in the corner jumps into it, "+ 5" shows above the number (green, SumPop `extra`), the number
  becomes the total (21), then as before: the units are written, the tens jump to the corner as the new carry. Under
  10 (2 × 3 + 1 = 7): the same, without a new carry. ~2.5s more per digit with a carry. No carry: unchanged.
- Division, at the end (whole numbers only): "REMAINDER ▶" (OperandTag, amber) on the left of the remainder row,
  13px before its first digit, centred on the row (Julian). Not with decimals (the division goes on after the point).
- Division result (Julian, 2026-11-20): two buttons under CLASSIC / EQUAL DECIMALS, REMAINDER | DECIMALS
  (`divisionResult` in MathExplorer → registry → DivisionBoard `result`, part of the board's key). DECIMALS: the
  division goes on after the point with brought-down zeros (ghost cells), at most MAX_QUOTIENT_DECIMALS = 3 decimal
  places in the quotient, or until exact ("we stop after 3 decimal places"). FLOAT numbers always get decimals
  (REMAINDER disabled). Julian wants to try 3, then maybe 2.
- Decimal points, ALL operations (Julian, decided 2026-11-20): the same 6px cyan dot, 3px from the digit on each
  side (2px tried first; 3px kept). Multiplication: DOT_ROOM = 6 at every place where N1, N2 or the product has its
  point, in all rows (columns stay lined up). Division: DOT_ROOM = 6 between place 0 and −1. Addition /
  subtraction: `-mx-0.75` against the rows' 6px gaps, DOT_OUTER = 0 in slotLeft. Checked in his Chrome: 3px / 3px. Whole numbers with DECIMALS: N1 shows NO decimal point and no
  row of zeros (Julian); a zero shows in N1's row only for the moment it is brought down; the quotient has the point. Decimal points in mult / div boards: z-20, brighter
  (with 6px gaps the glowing cells hid them).
- Same size and place rule as add/sub, in a wrapper (`FitBoard`) MathExplorer puts around these two boards. What
  must fit = what is DRAWN: from the leftmost digit cell or `data-fit` element (tags, signs, operation signs) to the
  board's right edge. The empty room these boards keep on the left for the rows to come doesn't count, so the typed
  numbers keep their normal size like in addition; during an explanation, as wider rows appear, the board shrinks
  smoothly (Julian's choice "A"). Normal size + a little left of centre while it fits; then moved left up to 15px
  from the drums; then shrunk to 50% (tablet / phone: fit, 45%); collapsed steps window = centred on the page.
  No "grow only to the left from 11 digits". These boards don't measure the DOM, so scaling them is safe.
  Checked in Julian's Chrome: 12×12 idle = 100% (15px from the drums), 12×3 explained = shrinks to 86% while the
  partial products appear, still 15px from the drums and ~6px from the window.

## Step delay (all operations)
- Julian, 2026-11-20: under Redo, "STEP DELAY" (label left-aligned with Redo) and a drum like the digit counts
  (`CountDrum` with `format`: 0 / 0.5 / 1 / 1.5 / 2 — 2 s added by Julian, `STEP_DELAYS_MS` in shared.tsx), its right edge aligned with
  FLOAT / Redo, label and drum centred on one line; ALL its values (0, 0.5, 1, 1.5) at one size, 25px (decided by
  the longest text: `textSize`; 17px first, then +50% by Julian), drum w-16: "1.5" ends 7px before the first dot,
  15px between the label and the drum in his Chrome (w-18 put it too close to the label).
  Exception (Julian): the 2 alone is 7% bigger (26.75px, CountDrum `textStyle`), because at the same size as 0.5 /
  1.5 it looked smaller. The N1 / N2 drums' digits (text-2xl, 33px in his Chrome) are unchanged. Remembered in localStorage `math-explorer-step-delay`. (A slider was
  tried first; rejected.)
- Count drums (all of them): at the lowest value the red (down) arrow is pale (opacity 0.45: 0.22 was too faint), at the highest the green one (Julian
  asked for the step delay at 0; done for every count drum).
- Drum arrows, ALL drums (Julian, 2026-11-20): one more dot at each arrow's head (HOLE_STEP 13°, so rows ±6 are on
  the front), the rows reach 39.5% from the middle (last dot ~4.6px from the top / bottom edge in his Chrome), spaced
  half by the drum's curve and half evenly (so the rows near the edges don't crowd), dots 0.2rem wide.
- Arrow heads, ALL drums (Julian, 2026-11-20): no longer dots: a V of two straight lines (like the steps window's
  open / close chevron), from the outer columns at row ±4 to the tip at row ±6, round joins and ends; drawn as a
  dark 3.6px edge, the colour at 2.2px and a thin light line (sharper, like a lit tube), glow 1px (HEAD_COLOR); it
  moves with the drum (`rowTop`). The shafts are 4 rows of 2 dots at rows 1.21 / 2.09 / 2.98 / 3.86 (SHAFT_ROWS;
  the two shafts one dot further apart in the middle: 6.3px between them in his Chrome, Julian),
  right up to the V: the 4th stops a HAIR before the V's outer dark edge (0.4–0.5px, measured at right angles to
  the line; 0px sharing a border was one step before — Julian wanted "a very, very small space"), never under it (Julian: half under = too much, fully clear = too far, touching only the coloured line =
  still under the dark edge). Measure with the dark edge (3.6px wide), not the coloured line.
  Dots 0.18 × 0.15rem, tighter glow. The faded / hidden layers include the V.
- Count drums are 40px tall (h-10; 44 was tried while the shaft was lower); DRUM_BOX_H in MathExplorer follows.
- How: `announce` (each new step line, not "Done") sets `pace.owed = pace.stepMs`; every board's `wait` uses
  `paced(ms)`, so the first pause after a step is longer by that much. The animations keep their speed; only the
  time a step stays on screen grows. Works while explaining (Julian), from the next step; a reset clears `owed`. Checked in his Chrome: +1s → each step ~1000ms longer (2007 → 3035ms …). If a new board is added, its
  `wait` must use `paced`.

## While an explanation runs; Pause / Resume
- Julian, 2026-11-20: while explaining EVERYTHING is locked (drums, INTEGER / FLOAT, Redo, division buttons,
  decimals, tabs, New Numbers, sign buttons, board digits) except Stop, Pause, STEP DELAY (Julian: it works while
  explaining — the step under way finishes as it was, the next ones take the new delay; checked: changed during
  step 2 → step 3 lasted +1.5s) and the steps window's open / close arrow. Redo was not locked before: `disabled={isAnimating || …}`.
- PAUSE / RESUME button under Step delay (only enabled while explaining): amber with a pause icon → "Pause", green
  with a play icon → "Resume"; darker tones, a metallic gradient from LEFT TO RIGHT (Julian; vertical and lighter
  first), light top edge, 3px bottom "depth" shadow; pressed: sinks 2px,
  scales to 97%, shadow shrinks, springs back.
- How: every board's `wait` uses `pausableTimeout` (shared.tsx); `pauseAll` clears those timers (keeping each one's
  remaining time) and pauses every running animation on the page (`document.getAnimations()`: CSS animations,
  transitions, the hops' Web Animations); `resumeAll` re-arms them and plays the frozen animations. Stop / any reset
  calls `resumeAll` and clears `paused`. Checked in his Chrome: paused 5s → no new step, resumed → goes on. A new
  board's `wait` must use `paced` + `pausableTimeout`.

## Board area and steps window (MathExplorer.tsx)
- Steps window collapsed (Julian): its arrow is 7px further in than at first (beside: right-[13px]; under:
  right-[15px]), and the add/sub NUMBERS (first digit to last) are centred on the middle of the PAGE (`pageMidX`,
  measured in MathExplorer), as far as the room allows (not past 15px after the controls column / the area's left
  edge on a phone, not past the area's right edge). Checked in his Chrome: 1 … 12 digits, digits' middle = page
  middle ±1px. Tablet / phone: as close as the room allows.
- The resize grip mark (the 80px bar shown on hover / drag) beside the board sits 2px right of the window's edge
  (`left-[calc(50%+2px)]`); the edge and the resizing are unchanged (Julian).
- Default width beside the board (Julian): the window's left edge lines up with the left edge of the Addition tab
  (`stepsDefaultW` = row right − tab left, measured on resize; ignored if < 200px or > half the row, then the old
  30% / 16–28rem default). A dragged width (localStorage) wins; double click on the resize edge = back to the default.
  With it, 12 digits keep 100% from ~1512px wide screens up (1440: 94%, 1280: 74%).
- While an explanation runs, the board area scrolls down smoothly when the calculations grow past its bottom.
- The board area's scrollbars look like the steps window's (`steps-scroll`: 8px, #456175).
- The steps window can be **closed** (a 30px strip with its arrow) and **resized** by dragging its edge. Beside the
  board (desk + lg): width 200px–70%, handle on its left edge. Under the board (tablet, phone): height 80px–70%,
  handle on its top edge. The arrow is a drawn chevron (arms 120° apart, 2.6px, the border's green) pointing where the
  window will go: beside the board `<` when closed (3px from the green border) and `>` when open; under it `˄` closed,
  `˅` open. The resize edge keeps the system cursor; its grip mark (80px, #456175) appears at once and is centred on
  the pointer (moved directly, no re-render). While dragging, the size is set directly on the window with no transition
  (the 0.3s transition is only for opening / closing), so the edge never lags behind the pointer. Remembered in localStorage
  (`math-explorer-steps`).

## The steel drum (math/shared.tsx, all operations)
- It opens **only with a click (or tap) on the three dots**; hovering the digit or the dots does nothing. Mouse click
  area: the dots plus 1 px around them (15×5 px); on touch screens (`pointer-coarse`) 24×20 px. Once open it stays
  open until the pointer leaves the whole digit (touch: until a tap outside it).
- While open, the **up/down cursor is shown over the whole drum** (the digit part too), not only over the holes; the
  triangle of the direction being counted is filled metallic white while pressing, dragging or scrolling, and stays
  white 450 ms after the last wheel / keyboard step (NUDGE_HOLD_MS).
- **Mouse wheel and two-finger trackpad scroll** turn it (one `wheel` handler, non-passive, page doesn't scroll):
  - only while open, and only for a gesture that began ≥ 300 ms after it opened (a gesture = wheel events < 220 ms
    apart, trackpad inertia included), so a page scroll passing over a digit stays the page's;
  - trackpad: one step per 40 px (the first movement counts at once); mouse wheel: one step per notch; at most one
    step per 70 ms; pinch-zoom (ctrl + wheel) and sideways swipes are ignored;
  - direction: **Mac: scroll up = count up, down = count down** (trackpad and mouse; Safari's
    webkitDirectionInvertedFromDevice turns it round when natural scrolling is off). Windows / Linux: fingers up on a
    touchpad and the wheel rolled away count up. Chrome can't tell a reversed system setting.

## Digit-count drums (MathExplorer.tsx + CountDrum in math/shared.tsx)
- The N1 / N2 Digits sliders are gone (Julian, 2026-11-20): every operation has a steel drum per number instead
  (`CountDrum`), the same drum as a digit but always open (no three dots), in the open digit's frame (cyan / pink
  border, dark background). One under the other, N1 first, each label on one line on its drum's row. 1 to 12 (w-14,
  room for two digits); fractions: four rows, Numerator 1 / Denominator 1 (cyan), Numerator 2 / Denominator 2 (pink),
  1 to 6 (w-11). Arrows, holding, wheel / trackpad and keyboard work as on a digit; disabled (40%) while explaining.
- The drums' box: p-3 and gap-3, so the space between the drums = the space from the drums to the box's edges (12px,
  Julian; checked in his Chrome). The whole box (118px) is centred on the board's two numbers (Julian): `top = 60 +
  (2·cell + 34 − 118) / 2` (in his Chrome: box 231–392, digits 229–397, same centre).
- Every number starts with 1 digit, in every operation.
- Controls column: as wide as the drums' box (Julian): INTEGER | FLOAT (px-2) under it, Redo under them as wide as
  both, then in division CLASSIC and EQUAL DECIMALS each on its own full-width row (the invisible EQUAL DECIMALS
  spacer is gone).
- The test scripts that set `#n1-digits` / `#n2-digits` no longer work: focus the spinbutton
  `[aria-label^="N1 Digits"]` and press ArrowUp instead.

## Lessons learned (don't repeat)
- Julian, 2026-11-20: "try not to make mistakes". Before reporting a change done: look at what else depends on what
  changed (sizes, widths, alignment, other operations) and check it too; compare before / after in his Chrome for
  everything visible, not just the thing asked; say so if anything else looks different.
- CountDrum's size and text size come from the longest text of ALL its values (min … max), not just min and max:
  adding 2 s to the step delay (max text "2") once made it fall back to the narrow drum with big digits.
- UNITS: availableWidth, leftRoom, viewWidth are NOMINAL px (at a 16px root font size). Julian's browser has a bigger
  root font size (22px measured in his Chrome; ~18px guessed before: everything rem-based is ~1.16× bigger), so a board measured in real px (offsetWidth) must
  be converted (× 16 / root px) before comparing, and sizes set back in rem (toRem). Mixing them made the add/sub
  board shrink with empty room on the right — the "it still shrinks" bug of 2026-11-20. Test with
  `html{font-size:18px}` too (t2r.py, ROOTPX=18). FractionBoard's fit still compares real px with availableWidth.
- An absolutely positioned `<svg>` does NOT stretch between left/right/top/bottom like a div: give it an explicit
  width and height (otherwise its height comes from the viewBox ratio and lines run across the board).
- The explorer page's board copy can hide such bugs (it was written with explicit sizes): when a visual detail
  depends on CSS behaviour, test that exact CSS in a small standalone page in Chrome too.
- A size transition on an element that is being dragged makes it lag behind the pointer: switch it off while dragging.
- Julian prefers the system cursors (a custom double-size resize cursor was reverted).

## Ideas mentioned for later
- Fractions stage 2: multiplication and division of fractions (division = multiply by the inverse).
- Possibly hide INTEGER / FLOAT on the Fractions tab (now only disabled, so Redo doesn't move).
- Possibly 0.5 px tolerance around the three dots on Retina screens (now 1 px).
- The crossed-out digits for the subtractions inside division too.
- The same "blocked" rule for division (divisor 0) as for fractions.

## Semnul operației între perechea evidențiată (AddSubBoard, `opMark`)
- În timpul calculului pe coloane, un `+` (adunare) sau `−` (scădere efectivă, `subtract`) stă între cele două cifre ale coloanei evidențiate cu galben, centrat pe golul dintre rânduri (top = −31/2 − 12 + 2 nominal, relativ la rândul 2), cu `left: slotLeft[col]`, `width: cell`.
- Se mută cu `transition-[left] 500ms` la fiecare coloană, inclusiv pe coloanele cu chip-ul 0 (cifră lipsă), și dispare după ultima coloană (`setOpMark(null)` odată cu `setCurrentColumn(-1)`).
- Culoare: amber-400 (galbenul evidențierii), fără umbră/strălucire — Julian l-a vrut „sharp”, fără niciun efect.
- Desenat din două bare plate (nu glifă de font): OP_MARK = 15 × 15 nominal, bară OP_BAR = 3.5 (întâi 18/4, Julian: „un pic cam mare”). Cu glifa, chiar la 36px, „+”-ul ieșea mic (~13px real) și Julian nu vedea diferența; barele dau ~21px real, încap în golul de ~31 nominal dintre rânduri.

## Strict mode: primul pas apărea de două ori
- `reactStrictMode: true` (dev) montează, curăță și remontează efectele. Tablele au `key={boardKey}`, deci la fiecare Explain efectul de rulare pornește pe o montare nouă; dacă primul `onStatus` e sincron (ex. scădere cu interschimbare, 6 − 7), rularea aruncată apuca să-l anunțe → „Step 1” și „Step 2” identice.
- Reparat în toate cele 4 table (AddSub, Multiplication, Division, Fraction): primul lucru în IIFE e `await Promise.resolve(); if (!alive) return;`. În producție nu schimbă nimic.

## Înmulțire: carry-ul la adunarea produselor parțiale (MultiplicationBoard)
- Julian: carry-ul nu mai stă sus, deasupra primului rând, ci la nivelul celui mai de sus rând care are cifră în coloana curentă (în colțul acelei cifre, ca la înmulțire).
- `topRow(col) = parts.findIndex(r => r[col])` (zerourile de completare contează ca cifre); dacă nicio cifră (carry dincolo de ultima coloană) → ultimul rând (n − 1).
- `addChip('sum', col, carry, topRow(col))`, `moveIncoming('sum', col, topRow(col))` mută chip-ul și pe verticală; ținta saltului din `showAndHop` e tot `chipY.top(topRow(col))`. `chipY.sum` a fost scos.
- Verificat în Chrome: 293 × 308, coloana 4 (doar rândul 3 are cifră, 8): carry-ul 1 stă în colțul lui 8.

## Derularea zonei tablei în timpul explicației (MathExplorer, viewRef)
- Bug (Julian): la înmulțire cu multe rânduri, zona tablei sărea la fund (scrollHeight) chiar de la Step 1, ascunzând N1 deși rândurile de jos erau încă goale. Cauza: tablele își rezervă de la început înălțimea pentru toate rândurile, iar ResizeObserver-ul derula la fund la orice redimensionare.
- Acum: la orice schimbare (ResizeObserver + MutationObserver, o dată pe frame) se caută cel mai de jos text vizibil (frunze cu text, opacitate ≥ 0.05 pe tot lanțul) și se derulează (smooth) doar cât trebuie ca el să fie la 16px deasupra marginii de jos. Nimic sub margine → nicio derulare.
- Verificat: înmulțire 3×6 (nu mai derulează la start; derulează ~61px doar când apare rândul sumei), împărțire 8÷1 (urmărește rândurile pe măsură ce apar, restul final vizibil), fracții (nicio derulare). Adunarea/scăderea nu depășesc pe verticală.

## Tabla urcată cu 25px (toate operațiile) — BOARD_LIFT
- Julian: N1/N2 și coloana din stânga (tamburi, INTEGER/FLOAT, Redo, Step delay, Pause) cu 25px mai sus, la toate operațiile, aliniate ca înainte.
- Realizat: tablele și-au pierdut padding-ul de sus de 16px (AddSub root `pb-4` în loc de `py-4`; cadrul înmulțirii/împărțirii `w-max pb-4`; cadrul `framed` (fracții) `pb-4`) + zona tablei (viewRef) urcă 9px de la md în sus (`md:-mt-[0.5625rem]`, în golul de sub antet: rămâne sub titlu/butoane). colRef: `top: 60 - BOARD_LIFT + …`.
- De ce nu totul din padding: etichetele roșii de deasupra numărătorilor la fracții (×k, valori) ajung la ~16px de sus; cu 25px din padding ar fi fost tăiate. Măsurat după: 0.2px de sus (ok); carry-urile adunării la 18px.

## Micșorarea a ce e sub linie (înmulțire, împărțire) — lowerScale / lowerStyle (shared.tsx)
- Julian: ca să nu mai fie nevoie de scroll, ce e sub prima linie se desenează mai mic, doar cât trebuie, cel mult 30% (MIN_LOWER_SCALE = 0.7); peste asta rămâne la 70% și zona derulează (regula de derulare de mai sus).
- Mărimea se calculează DIN ÎNĂLȚIMEA FINALĂ, de la început (cifrele au aceeași mărime toată explicația): înmulțire — fullHeight = yFinal + cell + 12 (cunoscut din n); împărțire — câte cifre ≠ 0 are câtul (qcols din planDivision cu metoda reală) × (2·cell + 35) sub yWork, + 16.
- `availableHeight` = înălțimea zonei tablei (viewRef, nominal) → BoardProps → registry props. s = (avail − 16 − top) / (bottom − top), rotunjit în jos la 0.01, între 0.7 și 1.
- Desen: un strat `absolute inset-0 pointer-events-none` cu transform scale(s), origin = colțul dreapta-sus al părții de jos (dreapta tablei, top) → unitățile rămân sub unități, restul coloanelor vin mai strâns (Julian a fost de acord). Cutia tablei ia înălțimea desenată (top + (H − top)·s), ca să nu apară scrollbar degeaba.
- Înmulțire: în strat — rândurile parțiale, virgulele lor, + , a doua linie, suma, semnul și punctul rezultatului, carry-urile, pop, hop (toate sunt pe rândurile de jos). Prima linie și N1/N2 rămân afară.
- Împărțire: stratul începe la yWork (sub cât; câtul rămâne mărime normală). Carry-urile/pop/hop se împart după y (pe N1 → afară, în zona de lucru → în strat) — `renderBorrows(low)`. Cifra coborâtă (mover) e afară și își calculează singură ținta micșorată (lowX/lowY) + `scale` cu tranziție, ca să aterizeze exact peste cifra din strat.
- Verificat în Chrome: înmulțire 3×6 → 0.93, 6×7 → 0.82, fără scroll; împărțire 5÷1 → 0.88, 8÷1 → 0.71, fără scroll; 8÷1 cu zecimale → 0.70 și derulează urmărind rândurile.
- Adunarea/scăderea nu au nevoie (nu depășesc pe verticală), n-au strat.

## Pasul curent în fereastra de explicații
- Julian: linia curentă (ultimul pas din listă) și săgeata ei în #58c7fe, culoare plină (fără gradient). CURRENT_STEP / CURRENT_STEP_TEXT; `StepArrow current`. Când apare pasul următor, cel vechi revine la gradientul portocaliu. Linia de rezultat („Done! Result = …”, detectată ca în announce: `startsWith('Done')`) are gradient stânga→dreapta în trei nuanțe: #1e958b (închis, la început) → #2ad4c6 (deschis, la mijloc) → #27c4b7 (puțin mai închis la sfârșit: un sfert înapoi spre #1e958b) (RESULT_GRADIENT; săgeata #resultArrowGrad: #1e958b → #2ad4c6). Istoric: #2ad4c6 plin → #26bfb2 plin → gradient pe #36e2d4 → #1e958b→#2ad4c6 → trei nuanțe → acum cu un luciu alb la mijloc: 0% #1e958b, 35% #2ad4c6, 50% #b4f2ec (RESULT_SHINE, #2ad4c6 cu 65% spre alb), 65% #2ad4c6, 100% #27c4b7, text bold și 1.25em (RESULT_STEP_SIZE, pe <li>, ca săgeata — în em — să crească odată cu el).
- Atenție: în Chrome-ul lui Julian textul pașilor iese 18px deși e setat 17px (probabil o mărime minimă de font în setări), așa că 1.15em (19.55px) abia se vedea; 1.25em → 21.25px, cu ~18% peste ceilalți pași.

## Înmulțire: adunarea unei coloane pas cu pas (colAdd)
- Julian: la adunarea rândurilor parțiale, în fiecare coloană: dreptunghi în jurul primelor două cifre reale de sus, + între ele (în golul dintre rânduri), „= s” în golul de sub dreptunghi; dreptunghiul crește în jos cu câte o cifră: eticheta devine „s + d” (coboară sub noua cifră), apoi „= s'”; carry-ul venit de la coloana anterioară se adună LA SFÂRȘIT (chip-ul din colț se aprinde: scale-110 + brightness + glow verde; „s + c” → „= s+c”). Apoi animația de dinainte NESCHIMBATĂ (pop total, scrie cifra, carry sare).
- Zerourile de completare (ghost) nu se adună și nu intră în dreptunghi. Coloană cu o singură cifră reală și fără carry → direct jos, fără dreptunghi (textul vechi „a + 0 + 0 = a → write a”). O cifră + carry → dreptunghi pe ea și „d + c”.
- Pași în fereastră: „a + b = s”, „s + d = s'”, „s + c (the carry) = …”, apoi „The column gives T → write d, carry c” (în loc de expresia lungă, când a fost pas cu pas).
- Culori provizorii: #58c7fe (albastrul pasului curent) pentru chenar, + (bare ca la adunare, OP_MARK 15 / OP_BAR 3.5) și etichetă (20px, font-black) — Julian urmează să dea culorile. Toate în stratul care se micșorează (lowerStyle).
- Verificat în Chrome: 230×477 și 477×436 (= 207,972, corect); dreptunghiul crește, eticheta coboară, carry-ul se aprinde.
- Rămas vechi (neatins): coloana finală care are doar carry scrie „1 = 1 → write 1”.

## Înmulțire: pașii cu 0 la jumătate de timp
- Julian: când una din cele două cifre înmulțite e 0 (din N1 sau din N2), aceleași animații, dar la jumătate din timp. Doar pașii de înmulțire cifră × cifră (bucla j); intro-ul rândului („Multiply N1 by 0…”), carry-ul final al rândului și adunarea coloanelor rămân la fel.
- `quick(ms)` = wait(ms/2) când `zero` (a(j) === 0 || d === 0); saltul carry-ului are și el durata înjumătățită (hop.duration → CarryHop duration). showAndHop nu se folosește în cazul cu 0 (0·d + carry < 10).
- Măsurat în Chrome (step delay 0): „0 × 5 = 0” → 450ms după status (față de 900), highlight-ul înainte 500ms (față de 1000).

## Înmulțire: produsul celor două cifre scris pe tablă (mulExpr)
- Julian: la fiecare pas cifră × cifră, produsul apare EXACT unde se scrie rezultatul: rezultatul în celula din rândul parțial (rândul i, coloana i + j), iar „a × d =” imediat în stânga ei (marginea dreaptă la 6px de celulă), peste celulele încă goale ale rândului (rândul se scrie de la dreapta la stânga). Ordinea: cifra din N1 × cifra din N2 (cea fixă, în dreapta), ca în fereastra de pași.
- 1300ms (jumătate când e un 0), apoi dispare și continuă animația de dinainte (pop în aceeași celulă, carry adunat „35 + 2”, carry care sare). Fără carry în expresie.
- Desenat în stratul care se micșorează (coordonate de tablă). 22px, font-black, #58c7fe provizoriu.
- Istoric: prima variantă era sub prima linie, sub cifra din N1, cu rezultatul care cobora pe rând; Julian a vrut-o direct în dreptul cifrei finale.

## Adunarea coloanei: chenarul în #ff005c (Julian; înainte #b30047). Plusurile și eticheta rămân albastre (#58c7fe) până dă alte culori.
- Chenarul: 5px (border-[5px]; 2px → 4px dublu → +1px, Julian; poate trece puțin peste cifre).
- Carry-ul la adunarea coloanei (Julian): carry-ul venit stă în colțul cifrei de sus cât se adună cifrele; la sfârșit COBOARĂ animat (chip-ul: x = centrul coloanei − 10, y = mijlocul golului de sub chenar − 10; tranziția chip-ului 650ms) până la suma de sub chenar, dispare acolo, eticheta „s + c” → „= s+c”. Nu mai se estompează când apare carry-ul nou; carry-ul nou sare din coloană ca înainte. (Înlocuiește aprinderea chip-ului.)

## Înmulțire: N1 și N2 mai apropiate (doar la înmulțire)
- Julian: N1 cu 3px mai jos (yN1 = 44 + 3, mai departe de butoanele de sus) și distanța N1–N2 cu 40% mai mică (31 → 19px: yN2 = yN1 + cell + 19). Totul de dedesubt urcă odată cu N2 (câștig 9px). Adunarea/scăderea/împărțirea rămân cu 31px.
- Măsurat: centrul lui N1 la 80.2 (era 77.2), al lui N2 la 142.2 (era 151.2) de sub butoane.

## Înălțimea: după 70% jos, se micșorează și operanzii (FitBoard, MIN_FIT_HEIGHT = 0.85)
- Julian (a acceptat propunerea): 1) doar partea de jos până la 70% (lowerScale); 2) dacă tot nu încape, toată tabla (și N1/N2, semnele) se micșorează cât trebuie, până la 85%, păstrând proporția (jos ajunge ~0.7 × 0.85 ≈ 60%); 3) abia apoi scroll. Înmulțire și împărțire (FitBoard).
- FitBoard: fitH = clamp((availableHeight − 4) / natural.h, 0.85, 1), rotunjit în jos la 0.01; fit = min(fitW, fitH). natural.h e înălțimea finală (cutia tablei își rezervă locul rândurilor viitoare), deci mărimea e știută de la început.
- Împărțirea: cutia are acum de la început înălțimea finală (finalBottom = yWork + pași·(2·cell + 35)), ca la înmulțire.
- Consecință: înainte de Explain, la calcule foarte lungi, cifrele de intrare apar deja ușor mai mici (ex. 89%).
- Verificat în Chrome (împărțire cu zecimale): 0.89 + jos 0.7 → încape fără scroll; cazurile extreme ajung la 0.85 + 0.7 și derulează.

## Carry-ul verde cu 50% mai mare (CARRY_CHIP = 30, shared.tsx)
- Julian: chip-urile verzi de carry 30px (erau 20); cifra din ele 24px (15px, apoi +60% la cererea lui; text-[24px] leading-none). Chip-ul micșorat (scale-80, în colțul drept) o micșorează odată cu el. Cele roșii de împrumut (borrow) rămân 20/10. `chipSize(kind)` dă clasele; folosit în CarryChip, în CarryHop (salt; „wide” de la fracții neschimbat) și în insignele adunării + zborul ultimului carry.
- Poziții: înmulțire — chipY.top = yP − 22 (tot 8px peste cifră; între rânduri rămân 6px liberi), colțul drept x + cell − 31, centrul pentru salturi + 15, chip-ul „free” centrat (cell − 30)/2, coborârea la sumă − 15. Adunare — colțul drept cell − 31 (borrow: cell − 21); ținta saltului/zborului calculată cu factorul de font (px pe ecran): stânga + 16·k, jos + (9 − 15)·k.
- CarryHop: jumătatea de mărime se calculează acum în unitatea traseului (pe tablă: px nominali = offsetWidth / k), lărgime și înălțime separat (înainte înălțimea era fixă 10).
- Verificat în Chrome: adunare (chip-ul din colț), înmulțire 530 × 23 (chip-ul 30px în colțul lui 5, la 8px peste cifră, liber față de linie).

## Înmulțire: carry-ul venit se adună pe aceeași linie (fără salt)
- Julian: pe linia rândului apare „a × d = pr”, apoi „pr + [c] = total”: chip-ul VERDE al carry-ului însuși se mută animat din colț în linie (în locul [c], la mărime întreagă), apoi apar „=” și totalul în celulă; chip-ul se estompează (consumat). Apoi ca înainte: totalul apare (pop), se scrie cifra unităților, zecile sar în colț ca noul carry.
- Implementare: mulExpr.slot = un span gol cât un chip (CARRY_CHIP) între „pr +” și „=”; „=” e mereu acolo dar ascuns până la `tail`, ca linia (aliniată la dreapta) să nu se miște. Poziția slotului se calculează din dimensiuni de layout (offsetLeft/offsetWidth ÷ k), NU din getBoundingClientRect: linia e încă în animația pop-in (scalată) când se măsoară. Chip-ul devine area 'free' (scale-100) și ajunge cu centrul în slot (900ms, jumătate la 0).
- Timp: 1300ms pentru fiecare linie (jumătate când e un 0).
- Verificat în Chrome: 736 × 9 = 6,624; 639 × 75 („15 + [4] = 19”, chip-ul exact în slot).

## Fereastra de pași: deschidere/închidere animată cu „bump”
- Julian: la collapse/expand fereastra alunecă lin (600ms, ease cubic-bezier(0.22,1,0.36,1), pe width lângă tablă / height sub ea), iar când ajunge dă o mică vibrație, ca și cum s-ar opri de margine.
- `toggleSteps` setează bumpRef; `onTransitionEnd` (doar pe cutie, doar width/height, doar după toggle — nu după resize prin tragere) rulează o animație Web: translate [0, 6, −4, 3, −1.5, 0.5, 0]px în 420ms; primul pas în direcția alunecării (închidere: dreapta/jos; deschidere: stânga/sus). Fără vibrație la prefers-reduced-motion.
- Verificat în Chrome: închidere 1438→2001 în ~600ms, apoi +6…0; deschidere înapoi la 595px lățime, apoi −…0. Fereastra lăsată deschisă.

## Cifrele când fereastra de pași se deschide/închide (lângă tablă)
- Julian: animația ferestrei rămâne; cifrele:
  - fereastra la lățimea implicită sau mai îngustă (stepsUi.w null sau ≤ stepsDefaultW): cifrele NU se mișcă deloc — tablele primesc lățimea de dinainte (`frozenViewW` = lățimea zonei cu fereastra deschisă) cât alunecă și cât stă închisă; și nu se mai centrează pe pagină la închidere (stepsClosed = închis && lată);
  - fereastra mai lată decât implicit (`stepsWide`): la închidere cifrele cresc/se mută spre locul final, la deschidere invers — tablele primesc de la început lățimea finală (zonă ± (lățimea ferestrei − 30px)) și alunecă acolo în 600ms (`smoothFit` → AddSub: tranziție pe transform/margin-left a rădăcinii și margin-left/width a cutiei; FitBoard: transform/margin-left), aceeași curbă ca fereastra.
- Două buguri găsite la test:
  1. AddSub centra tabla cu `calc((100% − W)/2)` — 100% = lățimea VIE a zonei, care se schimbă la fiecare frame cât alunecă fereastra → acum `(availableWidth + 16)rem`.
  2. Rădăcina AddSub / FitBoard punea `transform` + `transformOrigin: top left` doar când fit ≠ 1; la trecerea la fit = 1 originea sărea la centru (salt de ~84px în primul frame) → acum mereu `scale(fit)` + `top left` (overlay-urile fixed ale adunării sunt în portal, deci transformul permanent nu le strică).
- Atenție: un comentariu `//` pus în interiorul JSX devine TEXT în pagină (a apărut ca un nod text de 146px înaintea tablei). În JSX doar `{/* … */}`.
- Verificat în Chrome (adunare 12+12 cifre, înmulțire 9×3): implicit → cifrele stau pe loc (aceeași poziție în fiecare frame), la deschidere și la închidere; lată (w = 800) → alunecă monoton, fără salturi. localStorage-ul lui Julian restaurat ({"open":false,"w":698}).
- Corecție (Julian): chiar dacă fereastra e mai lată decât implicit, cifrele se mișcă DOAR dacă lățimea ei le afectează, adică tabla nu încape lângă fereastra deschisă la mărime întreagă. Tablele raportează lățimea de care au nevoie la mărime întreagă (`onNaturalWidth`: AddSub natural.w, FitBoard Wn); `affected = stepsWide && naturalW > lățimea zonei cu fereastra deschisă − 1`. Neafectat → ca la implicit (stau pe loc, fără centrare la închidere); afectat → alunecă (smoothFit) și, cât e închisă, se centrează pe pagină (`closedCentred`, setat la toggle).
- Verificat: fereastra la 800px — adunare 3+3 cifre: aceeași poziție în toate frame-urile; 12+12: alunecă monoton (485 → 591 și înapoi).
- Uniform la toate operațiile (Julian): înmulțirea/împărțirea raportează lățimea tablei FINALE (FitBoard natural.w — tablele își rezervă locul rândurilor viitoare), nu doar ce e desenat până acum; fracțiile au acum `FramedBoard` (MathExplorer): centrate în lățimea de lucru (boardViewW, nu `mx-auto` pe lățimea vie), alunecă cu smoothFit și își raportează lățimea.
- Verificat în Chrome (rAF, toate frame-urile): fereastra 800px — adunare/scădere 2+2, înmulțire 2×2, împărțire 2÷1, fracții: stau pe loc; scădere 12+12, înmulțire 9×7, împărțire 10÷3: alunecă monoton în ambele sensuri. Fereastra implicită — adunare 12+12, înmulțire 9×7, împărțire 10÷3, fracții: stau pe loc. localStorage restaurat ({"open":true,"w":653}).

## Titlul și coloana de comenzi la 10px de marginea panoului (întâi 5px; Julian: „prea la stânga”, +5px)
- Julian: titlul operației și coloana din stânga (tamburii N1/N2, INTEGER/FLOAT, Redo, Step delay, Pause; la împărțire și CLASSIC / EQUAL DECIMALS / REMAINDER / DECIMALS; la fracții cei 4 tamburi) aliniate la stânga, la 5px de marginea interioară a panoului, la toate operațiile.
- `EDGE_5` (MathExplorer): margin-left negativ = padding-ul stâng al panoului − 5px pe fiecare breakpoint (p-3 / sm:p-5 / md:p-6 / lg:p-8 → acum −2 / −10 / −14 / −22px nominali, pentru 10px; numele constantei a rămas EDGE_5), pe <h1> și pe colRef. Tabla, butoanele de sus și fereastra de pași nu se mișcă. leftRoom (spațiul în care tabla se poate muta spre stânga) crește automat cu coloana mutată.
- Verificat în Chrome: la toate cele 5 operații titlul și cel mai din stânga element al coloanei sunt la exact 10.0px de marginea panoului.

## Adunare/scădere: calculul coloanei coboară pe rândul rezultatului (expr, AddSubBoard)
- Julian (ca la înmulțire): cu cele două cifre evidențiate și semnul între ele, copii ale celor două cifre și ale semnului coboară animat (650ms) pe rândul rezultatului și formează „a + b =” / „a − b =” imediat în stânga celulei rezultatului (6px·fit), rezultatul apare în celulă (1100ms). Adunare cu carry venit: „s + [ ] =” — chip-ul verde zboară din colțul lui (dreapta-sus, la 80%) în gol (800ms), apoi „= total” (1300ms); chip-ul din colț e consumat (fading). Apoi animația de dinainte NESCHIMBATĂ (suma în celulă, se scrie cifra, carry-ul nou sare în colț).
- Scădere: împrumutul („−1” la vecina care a dat, 10 roșu, cifra tăiată → 14) se face ÎNTÂI sus, ca înainte; abia apoi coboară calculul cu cifra împrumutată: „14 − 9 = 5”. Fără împrumut: „(t − ce a dat) − b”.
- Coloana cu 0 pentru cifra lipsă: 0-ul (chip-ul mare) coboară și el („7 + 0 =”, „8 − 0 =”).
- Tehnic: overlay fixed în portal (coordonate de ecran, ca chip-urile adunării); linia se randează întâi invizibilă ca să se măsoare unde ajung părțile (refs), apoi copiile zboară cu tranziție left/top; font 22px·fit (ca eticheta înmulțirii). Rândurile N2 au acum și ele refs (bottomRefs); opMark are ref.
- Verificat în Chrome: 381 + 52 („1 + 2 = 3”, „3 + [1] = 4” cu chip-ul în gol, rezultat 433); 947 − 97 („14 − 9 = 5” după împrumut, „8 − 0 = 8”, rezultat 850).

## Înmulțire: linia de sub operanzi nu se mai lungește
- Julian: linia de sub N1/N2 se întindea spre stânga cât rândurile parțiale deveneau mai late (intra în numere). Acum prima linie are lungimea operanzilor (left = opLeft) tot timpul; doar „+”-ul produselor parțiale și a doua linie (sub ele) urmează rândurile late (lineLeft).
- Verificat la celelalte: adunarea/scăderea — linia e un element flex cu lățimea fixă a rândurilor (aceeași și când apare carry-ul final: 778..1128 tot timpul); împărțirea nu are linie sub operanzi (doar liniile scăderilor); fracțiile au liniile de fracție fixe.
- Măsurat la înmulțire 3×3: lungimea primei linii constantă (326px); tabla întreagă se mută puțin când apar rândurile late (regula FitBoard de dinainte), linia odată cu ea.
- 0-urile la adunarea coloanei (Julian): când în jos urmează DOUĂ sau mai multe 0-uri reale la rând, chenarul coboară dintr-odată până unde se termină 0-urile, eticheta e „s + 0” (un singur 0), apoi „= s”; un pas în fereastră („3 + 0 + 0 = 3”). Un singur 0 → pas normal. Dacă primele de sub cifra de sus sunt 0-uri, primul pas le cuprinde direct („a + 0 + 0 = a”). Apoi se continuă ca înainte (carry-ul la sfârșit etc.).
- Verificat în Chrome: 205 × 2,168 — coloana 1, 2, 0, 0: „1 + 2 = 3”, „3 + 0 + 0 = 3” (chenarul peste ambele 0-uri dintr-odată), apoi „3 + 1 (the carry) = 4”; rezultat 444,440.
- Clipitul 0-urilor (Julian): cât chenarul coboară peste șirul de 0-uri, celulele lor clipesc într-un galben mai închis (un strat #c27c00 cu mix-blend-multiply peste highlight, opacitate 0 → 1 → 0.25 → 1 → 0 în 1600ms — întâi 950ms, Julian: „un pic mai lent”; pasul cu 0-uri așteaptă 1700ms, Web Animation), apoi revin la galbenul obișnuit. `zeroFlash` {col, rows}.
- Verificat în Chrome: 80 × 9,252, coloana 1, 0, 0: cele două 0-uri clipesc mai închis, chenarul le cuprinde dintr-odată; rezultat 740,160.

## Zerourile de completare (punctate) într-o coloană evidențiată: doar marginea galbenă
- Julian: 0-urile adăugate când un rând se mută la stânga (înmulțire) sau aduse jos după ultima cifră (împărțire) rămân punctate și transparente când coloana lor e evidențiată; doar marginea (punctată) ia galbenul evidențierii. Variantă nouă `ghostHighlight` în Digit (border-dashed border-yellow-400, scale-110, z-30); pickVariant o dă pentru highlighted && ghost (deci și la împărțire); înmulțirea o folosește la adunarea coloanelor.
- Verificat în Chrome: 58 × 577, coloana unităților la adunare — 6 galben plin, cele două 0-uri punctate cu margine galbenă.

## Cronometrul (elapsed time) — components/math/SevenSeg.tsx
- Julian: între titlu și cutia tamburilor, la jumătate pe verticală, aliniat la dreapta cu coloana; format „00:00:00:0” (ore:minute:secunde:zecimi), cifre de tip ceas cu 7 segmente foarte apropiate (vârfurile hexagoanelor ajung la colțuri, gol G = 0.35), 6 cu bara de sus, 9 cu bara de jos. Culoare #58c7fe (segmentele stinse abia vizibile, 9%), cu glow ușor. Doar de la md în sus.
- Pornește la Explain to Me (de la 0); Pause îl oprește, Resume îl continuă; la sfârșitul explicației (onDone) rămâne pe timpul final; Stop (și orice resetResult: alte numere, altă operație) îl pune la 0.
- Implementare în MathExplorer: timer ref {acc, start}, interval 50ms cât `timing`; poziția: copil absolut al coloanei (right-0, bottom = 100% + golul/2, translate-y-1/2), golul titlu → coloană măsurat (titleRef, colRef, ResizeObserver).
- build.js (artifact): SevenSeg.tsx adăugat în SOURCES.
- Verificat în Chrome: centrul la 160.98 față de 160.88 dorit, marginea dreaptă = a coloanei; după 2s 00:00:01:9; în pauză nu crește; după Resume +1s; Stop → 00:00:00:0; la final rămâne (00:00:27:4).

- Cifrele cronometrului refăcute după schița lui Julian (digits_preview, aprobat în 3 iterații): bare drepte de aceeași grosime (grilă 180 × 240, bare 40 → 3 lat × 4 înalt, jumătăți egale, bara din mijloc a lui 3 pornește de la T), 1 = o bară centrată, 6 cu bara de sus, 9 cu bara de jos, 0/4/5 în același stil; TOATE colțurile de 90° (exterioare și interioare) ușor rotunjite — filtru SVG `seg-round`: feGaussianBlur stdDeviation 2.5 + prag alfa (feColorMatrix 24/−12), ca blur + threshold din preview. Fără segmente stinse. Separatorul: două pătrate de grosimea barelor la 30% / 70% din înălțime.
- Spații: 3px între cifre și 3px între o cifră și separator (Julian). Cifra: 22px înălțime.
- Verificat în Chrome: toate spațiile 3.0px, înălțime 22, centrat între titlu și coloană, aliniat la dreapta; mărit ×6 — cifrele cu golurile corecte, colțuri foarte ușor rotunjite.

## Cum îi arăt lui Julian schimbările
După fiecare schimbare: pagina IDE ca UN SINGUR fișier (math-explorer.html: explorator stânga, cod dreapta, aplicația jos, iframe srcdoc cu app.html), trimis cu SendUserFile display=render, ca să se deschidă în panoul de lângă chat. NU app.html singur.

## Cronometru și coloana din stânga
- SevenSeg: conturul cifrelor e calculat ca o singură formă (fără filtru), colțuri ROUND = 2% din înălțime; 0 are un dreptunghiuleț în mijloc (dot0).
- COL_DROP = 3: coloana (tamburi, butoane) și cronometrul sunt cu 3px mai jos, în toate tab-urile.

## Harta fișierelor (după refactorizarea din 21 noiembrie)
Totul arată și se comportă exact ca înainte (verificat: HTML-ul paginii identic în toate cele 5 operații, înainte și după explicație).

- `components/MathExplorer.tsx` — doar pagina, care leagă bucățile de mai jos.
- `components/explorer/`
  - `useProblem.ts` — problema: operația, numerele, fracțiile, cifre/zecimale, integer/float, opțiunile împărțirii și tot ce le schimbă.
  - `useExplanation.ts` (+ `useElapsedTimer.ts`) — explicația în curs: pașii, statusul, rulare/pauză, cheia board-ului, cronometrul.
  - `useStepDelay.ts` — step delay (cu localStorage).
  - `useStepsWindow.ts` + `StepsWindow.tsx` — fereastra de pași (deschis/închis, mărime, trasul marginii, alunecarea + vibrația, efectul asupra board-urilor) și desenul ei.
  - `useLayoutMeasures.ts` — măsurătorile: banda pe rândul titlului, mărimea zonei board-ului, distanța cronometrului, leftRoom/pageMidX, colBottom, scroll-follow.
  - `Title.tsx`, `OperationTabs.tsx` (șarpele), `ActionButtons.tsx`, `SignButton.tsx`, `ControlsColumn.tsx` (cronometru, tamburi, INTEGER/FLOAT, Redo, Step delay, Pause, opțiunile împărțirii, zecimale), `BoardView.tsx` (FitBoard / FramedBoard), `PageStyles.tsx` (keyframes, gradienți SVG), `constants.ts` (EDGE_5, COL_DROP, BOARD_LIFT, DRUM_BOX_H), `problem.ts` (fracții noi, etichete).
- `components/math/` — `shared.tsx` e doar index (re-export) pentru: `types.ts`, `timing.ts` (pace, timeri cu pauză), `layout.ts` (CELL, REM_PX, toRem, lowerScale, useCellSize), `numbers.ts`, `Digit.tsx`, `Drum.tsx` (DigitDrum, CountDrum), `RollingDigit.tsx`, `chips.tsx` (CarryChip, CarryHop, SumPop), `marks.tsx` (OperandTag, OpIcon, ThousandsComma, ResultSign). Plus `FitBoard.tsx`, `SevenSeg.tsx`.
- `components/operations/basic/` — fiecare board are lângă el un folder: `model` (tipuri, constante, helperi, componente mici), `script.ts` (explicația pas cu pas, `runAddSub` / `runMultiplication` / `runDivision`, apelată din useEffect cu tot ce-i trebuie), iar adunarea și `useFit.ts` (regula de mărime/poziție). `geometry.ts`: GAP, COMMA_W, COMMA_NUDGE, DOT_ROOM, OP_MARK, OP_BAR comune.
- `components/operations/fractions/` — `FractionBoard.tsx`, `model.tsx`, `script.ts` (`runFractions`).
- Re-exporturi păstrate pentru compatibilitate: `DivisionBoard` exportă tipurile DivisionMethod/DivisionResult, `FractionBoard` exportă hasZeroDenominator.
- `.refactor-backup/` (în .gitignore): copia de dinainte de refactorizare + uneltele de analiză; se poate șterge.

## Pagina de modificări pe iterații (Julian, 24 nov 2026) — REGULĂ
- Artifactul: https://claude.ai/artifact/PC7xyUKBvgMZVzLvdQwmYK („math-explorer changes”). Se republică același, după
  fiecare iterație, apoi se deschide.
- **O iterație = o cerere a lui Julian** (cu toate încercările mele pentru ea). Stânga: arborele DOAR cu fișierele care
  s-au schimbat față de iterația anterioară (roșu = modificat, verde = nou), cu buton de copiere. Dreapta sus: diff în stil GitHub
  față de iterația anterioară (nu față de un commit): doar liniile schimbate, cu 3 linii de context, golurile strânse în
  antete „@@ -vechi +nou @@”, două coloane de numere (înainte / după), scoase = roșu cu −, adăugate = verde cu +; butonul
  „Tot fișierul” arată tot fișierul cu aceleași marcaje. Dreapta jos: aplicația reală (iframe srcDoc).
- Un fișier neschimbat în iterația curentă NU apare pe pagină; e scris pe disc și rămâne acolo.
- Fișierele se scriu direct în proiect pe disc (device shell), apoi `npx tsc --noEmit -p .`, apoi se verifică pe disc.
- Cum se construiește (în workspace-ul din cloud, nu în proiect): toate sursele se aduc cu device_stage_files;
  `/tmp/claude-0/mxiter/prev/` = instantaneul iterației anterioare. `build.sh "titlu"` compară sursele curente cu
  instantaneul → lista de fișiere schimbate + bazele pentru diff, construiește pagina; după publicare
  `build.sh commit` salvează instantaneul nou și crește numărul iterației. Dacă workspace-ul s-a pierdut: instantaneul
  se reface din sursele curente (iterația începe de la zero).
- NU afișa comenzi git și NU lista schimbările în chat (Julian face git singur; pagina arată schimbările). Site-ul de pe
  GitHub Pages se actualizează doar după push-ul lui.

## Rotițele de cifre lângă N1 / N2 (OperandDrum.tsx, 24 nov 2026)
- Tamburii N1 / N2 Digits stau pe tablă, în stânga etichetelor N1 / N2 (fracții: o coloană numărător/numitor în
  stânga fiecărei fracții). Cutia din coloana din stânga a dispărut.
- Tabla e ținută de etichetele N1 / N2 (`data-tag`): ele stau la 66 px de tablă (−1px) după marginea dreaptă a unei
  coloane de 8rem (aceeași în toate operațiile), oricâte cifre, cu fereastra de pași deschisă sau nu (md în sus).
  Tamburii atârnă în stânga etichetelor (gap 15 px de tablă = 0.9375rem, DRUM_REACH): mutarea lor NU mută nimic altceva.
- Când tabla se micșorează, tamburii se micșorează mult mai puțin (drumScaleFor: 100% până la 75%, apoi spre max. 80%).
- Linia orizontală de sub operanzi pornește de la marginea stângă a tamburilor (adunare, scădere, înmulțire).
- Coloana de butoane coboară sub operanzi: marginea de sus a INTEGER/FLOAT la 25 px sub linia orizontală (împărțire:
  sub mijlocul lui „=”); fracțiile au rămas cum erau. Cronometrul e sub Pause, la 25 px, centrat.

## Lecție: px vs rem (24 nov 2026)
- Root font-ul lui Julian e 22px: tot ce e pe tablă e în px de tablă = rem (toRem, × 22/16). O distanță scrisă în px
  CSS ficși (ex. `gap-[15px]`) NU crește odată cu tabla: „mută 5px” a devenit ~1px la el. Pe tablă: rem
  (`gap-[0.9375rem]`) sau toRem. Verifică mereu în Chrome-ul lui (localhost:3000), după reîncărcare: o parte din poziții
  se măsoară doar la încărcare, iar actualizarea automată (HMR) nu le reface.


## Fracții: 2 rânduri, 12 cifre, virgule (24 nov 2026)
- Fracția a doua sub prima (grilă), aceeași aliniere; + în dreapta, între ele, centrat pe paranteza din dreapta a
  fracției mai late, fără paranteze. Rotițele lipite de paranteză (16.5 px de tablă). De la md în sus FramedBoard nu mai
  centrează (`anchored`): conținutul pornește la 6.0625rem de marginea zonei, deci totul stă fix când se schimbă cifrele.
- Numărătorii / numitorii: 1–12 cifre (FRACTION_MAX_DIGITS), cu virgulă la fiecare 3 cifre (FracComma), și la
  rezultate (Num). ATENȚIE: calculele fracțiilor sunt în Number; peste ~15–16 cifre (LCM, produse) devin inexacte —
  de trecut pe BigInt dacă Julian folosește numere mari.
- Pagina de modificări: build.js (Tailwind) extrage candidații și cu virgule, altfel clasele arbitrare cu virgule
  (COMMA_STYLE etc.) lipseau din CSS-ul paginii.

## Telefon: fereastra de explicații lipită de marginea de jos (24 nov 2026)
- Zona din mijloc are flex-1 și panoul nu are padding jos pe `phone` (variantă nouă în globals.css = tot ce nu e
  `desk`): fereastra stă pe marginea de jos a ecranului, deschisă sau strânsă, și se deschide doar în sus.

## Rotițele de cifre: locul pe tablă, rotița reală în DrumLayer (24 nov 2026)
- Tabla se reface la fiecare problemă nouă (boardKey), deci și la fiecare schimbare a numărului de cifre. O rotiță
  desenată în tablă se refăcea și ea și pierdea ce făcea: săgeata albă a cursorului, gestul de rotiță/trackpad,
  tragerea, focusul tastaturii (Julian: „săgețile nu mai merg”).
- Acum tabla are doar locul rotiței (`OperandDrum`: div gol w-14 × h-10, `data-drumpart`, mutat și scalat ca înainte),
  iar rotițele reale sunt în `DrumLayer` (MathExplorer, în viewRef, făcute o singură dată), puse peste locul lor la
  fiecare cadru (poziție + scară citite din loc). Ascunse cât locul lipsește (ex. adunarea cu problema rescrisă).

## Telefon: tabla nu intră sub fereastra de explicații; Redo scos; start după 150 ms (24 nov 2026)
- Pe telefon (useViewSize) înălțimea zonei = de la vârful ei până la vârful ferestrei de explicații (verificată la
  fiecare cadru). Adunare/scădere (useAddSubFit) și fracții se micșorează pe înălțime până la 40%; înmulțirea și
  împărțirea (FitBoard) se potrivesc după ce e DESENAT acum (hd), nu după rândurile rezervate, și scara doar scade cât
  trăiește tabla (altfel bucla hd ↔ scară dădea React #185); repornește când se schimbă spațiul (fereastra deschisă /
  închisă).
- Redo a dispărut cu totul (buton + logică): Explain to Me pornește oricum de la început.
- Explain to Me: tabla se curăță și cronometrul trece la 0 imediat; explicația și cronometrul pornesc după 150 ms
  - Actualizat: dacă TIME ELAPSED e deja 0, pornește imediat; altfel 0 → 1000 ms (START_DELAY_MS, pe toate ecranele, toate operațiile) → pornește
  (START_DELAY_MS în useExplanation), cu o tablă nouă făcută cu run = true (unele table citesc `run` doar la creare).


## Lecție: comparații exacte cu numere măsurate (24 nov 2026)
- `prev.tl === tl` în FitBoard / useAddSubFit: `tl` e măsurat (rect / scară) și variază cu zecimale la fiecare
  randare când scara se schimbă (tragerea ferestrei de pași) → setState la fiecare randare → React #185 (Maximum update
  depth exceeded) și aplicația dispărea. Orice valoare măsurată se compară cu toleranță, niciodată cu ===.

## Prev / Next (25 nov 2026)
- Sub Pause: două butoane la fel ca Pause (3D, umbre, push), fundal #104070 cu gradient metalic #40668c, text alb, șevroane duble.
- Active când e pauză (în timpul explicației) sau când explicația s-a terminat.
- Prev = rulează din nou explicația de la început fără așteptare (seek în timing.ts: timerele pe MessageChannel, `html.mx-seek` face tranzițiile 0s) până la începutul pasului anterior, apoi pauză. Next = la fel, dar continuă din locul curent până la pasul următor.
- Oprirea: fiecare pas se arată ÎNTREG — oprire când se creează ultima pauză (wait) a pasului (`nav` în timing.ts: `perStep` = câte pauze are fiecare pas, învățat în timpul rulării; un loc = {step, fired}). Pentru pasul cel mai îndepărtat, nefinalizat: locul unde s-a pus pauza (`frontier.live`). Contorul își păstrează valoarea (timerSet).
- Un pas nou în script = un `onStatus(...)` înaintea modificărilor lui; tot ce face pasul trebuie să fie înainte de ultima lui pauză.
- Orice timer nou din scripturi trebuie să treacă prin `pausableTimeout`, altfel nu e accelerat la Prev/Next.
- Prev de la Pasul 1 duce la început (`atStart`): tabla ca înainte de Explain to Me, fără evidențieri, încă pe pauză. De acolo Next merge la Pasul 1, iar Resume pornește normal.
- Prev e activ pe pauză (nu la început) sau la final. Next e activ numai pe pauză și numai dacă înainte sunt pași deja văzuți: `frontier` ține minte până unde a ajuns explicația și dacă s-a terminat. La frontieră, Next e dezactivat.
- Adunare / scădere: fiecare parte a unei coloane e un pas separat (deci și o oprire pentru Prev / Next): coloana evidențiată cu semnul, calculul care coboară, adunarea carry-ului, borrow-ul, scrierea cifrei (cu carry).
- Next merge la viteză normală până la locul următor. Prev joacă pasul înapoi încet:
  - Scriptul înregistrează `nav.undo[k]`: mișcările inverse (cifrele zboară înapoi în coloană, carry-ul înapoi în colț, borrow-ul înapoi la stânga, cifra scrisă se stinge), apoi revine la starea de la sfârșitul pasului k-1 cu tranziții.
  - Starea e ținută în `shadow` prin setterii împachetați cu `track`; `ends[k]` e luat la ultima pauză a fiecărui pas.
  - După animație, tabla e refăcută rapid (seek) sub o copie statică (`makeCover`, `html.mx-covered`), ca să nu se vadă nimic.
  - Unde nu există undo (pauză în mijlocul unui pas, înmulțire / împărțire / fracții deocamdată), copia se estompează spre pasul anterior.
- `navReset` aruncă timerele tablei vechi: scriptul vechi nu mai continuă.
- Overlays din AddSubBoard sunt în `<div data-mx-overlays>`, ca să fie copiate și ascunse.

## Telefon: rotițe mai mari, tabla mai sus (25 nov 2026)
- `drumScaleFor(fit, phone)`: pe telefon rotițele pornesc de la 125% și rămân așa cât timp tabla e la 80% sau mai mult. Apoi scad blând până la curba normală (minimum 80%). `drumExtra` și `solveFit` primesc și ele `phone`.
- Adunare/scădere pe telefon: rândul de carry e cu 8px mai aproape de N1 (`max-md:-mb-2`), deci numerele sunt mai aproape de Explain to Me.
- Pe telefon: 4px între step delay, Pause, Prev/Next și banda Explain to Me.
- Pe telefon, minimum 2px între două rotițe una sub alta (DrumLayer): când s-ar atinge, se desenează mai mici, față de mijlocul lor, iar marginea dreaptă rămâne pe loc.
- Pe telefon, o rotiță atinsă crește de 1,2 ori, dar ajunge cel puțin la 130% din mărimea ei minimă (adică 1,3 × 80% = 104% din normal), ca să fie ușor de rotit și când sunt mulți digiți.
