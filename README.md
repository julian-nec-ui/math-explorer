# Math Explorer

A Next.js app that explains, step by step and with animations, column addition and subtraction (with carries and borrows), long multiplication (with partial products) and long division (with quotient and remainder).

## Getting started

You need Node.js 18.18 or newer and pnpm 10.26 or newer (pnpm 11 and 12 work too).

### Installing pnpm

The easiest way is Corepack, which ships with Node.js:

```bash
corepack enable
```

If you don't have Corepack, install pnpm globally with npm:

```bash
npm install -g pnpm
```

Check the installation with `pnpm --version`.

### Running the project

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

`pnpm dev` starts the Next.js app on http://localhost:3000 and the Express server on http://localhost:4000 together. You can also start them separately with `pnpm dev:web` and `pnpm dev:api`.

To check the code, run `pnpm lint` (ESLint with the Next.js rules) and `pnpm typecheck` (TypeScript in strict mode, which also reports unused code).

pnpm doesn't run packages' install scripts automatically. The packages that need them (esbuild for tsx, sharp for Next.js, and Tailwind) are approved in `pnpm-workspace.yaml`, under `allowBuilds`. If an update brings an `ERR_PNPM_IGNORED_BUILDS` error for another package, run `pnpm approve-builds` and pick the package from the list.

## Pages

- `/` is the Math Explorer app.
- `/flow` shows diagrams of the algorithms (React Flow and Mermaid).

## API (Express)

- `GET /api/health` checks that the server is running.
- `GET /api/problem?n1=3&n2=4&type=float` generates two random numbers.

In the app, the server is called with Axios through the functions in `lib/api.ts`.

## Project structure

- `app/page.tsx` renders the main component.
- `app/flow/page.tsx` renders the algorithm diagrams.
- `app/layout.tsx` holds the shared HTML structure and imports the styles.
- `app/globals.css` loads Tailwind CSS v4.
- `components/MathExplorer.tsx` holds the app's logic and interface.
- `components/math/shared.tsx` holds the types, the digit cell and other shared pieces.
- `components/math/MultiplicationBoard.tsx` animates long multiplication.
- `components/math/DivisionBoard.tsx` animates long division.
- `components/AlgorithmFlow.tsx` is the interactive diagram for addition.
- `components/Mermaid.tsx` renders Mermaid diagrams from text.
- `lib/api.ts` holds the Axios client for the Express server.
- `lib/cn.ts` combines Tailwind classes without conflicts.
- `server/index.ts` is the Express server.
- `pnpm-workspace.yaml` holds the pnpm settings (packages approved at install time).
- `global.d.ts` tells TypeScript that importing CSS files is allowed.
- `eslint.config.mjs` configures ESLint with the Next.js and TypeScript rules.

## Libraries

- **Tailwind CSS v4** for styling.
- **Axios** for HTTP requests to the API.
- **Express** for the API server.
- **Motion** for animations in React (the successor of Framer Motion).
- **React Flow** (`@xyflow/react`) for interactive diagrams and flowcharts.
- **Mermaid** for diagrams written as text.
- **clsx** and **tailwind-merge** for conditional CSS classes.
- **pnpm** as the package manager.
- **tsx** and **concurrently** to run the TypeScript server and both servers together.