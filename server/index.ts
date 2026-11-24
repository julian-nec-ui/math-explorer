import express, { type Request, type Response } from "express";
import cors from "cors";

const app = express();
const PORT = Number(process.env.API_PORT ?? 4000);

app.use(cors({ origin: ["http://localhost:3000"] }));
app.use(express.json());

type NumberType = "integer" | "float";

interface NumberData {
  digits: number[];
  decimalCount: number;
  sign: 1 | -1;
}

// Aceeași regulă ca în MathExplorer: fără zerouri în față, cel mult 2 zecimale
const computeNumber = (totalDigits: number, type: NumberType): NumberData => {
  const digits: number[] = [];
  for (let i = 0; i < totalDigits; i++) {
    digits.push(i === 0 && totalDigits > 1 ? Math.floor(Math.random() * 9) + 1 : Math.floor(Math.random() * 10));
  }
  const decimalCount = type === "float" ? Math.min(2, Math.max(0, totalDigits - 1)) : 0;
  return { digits, decimalCount, sign: 1 };
};

const clampDigits = (value: unknown, fallback: number) => {
  const n = Number(value);
  return Number.isInteger(n) ? Math.min(12, Math.max(1, n)) : fallback;
};

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// GET /api/problem?n1=3&n2=4&type=float
app.get("/api/problem", (req: Request, res: Response) => {
  const n1 = clampDigits(req.query.n1, 3);
  const n2 = clampDigits(req.query.n2, 3);
  const type: NumberType = req.query.type === "float" ? "float" : "integer";
  res.json({ num1: computeNumber(n1, type), num2: computeNumber(n2, type) });
});

app.listen(PORT, () => {
  console.log(`API ready on http://localhost:${PORT}`);
});
