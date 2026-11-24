"use client";

import { motion } from "motion/react";
import AlgorithmFlow from "@/components/AlgorithmFlow";
import Mermaid from "@/components/Mermaid";

const subtractionChart = `flowchart TD
  A[Take the next pair] --> B{top - borrow < bottom?}
  B -- yes --> C[Borrow 10, set borrow = 1]
  B -- no --> D[borrow = 0]
  C --> E[Write top + 10 - borrow - bottom]
  D --> F[Write top - borrow - bottom]
  E --> G{More pairs?}
  F --> G
  G -- yes --> A
  G -- no --> H[Remove leading zeros]`;

export default function FlowPage() {
  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-zinc-100 md:p-12">
      <motion.h1
        className="mb-8 text-4xl font-black tracking-tighter"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        How the algorithms work
      </motion.h1>

      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-lg font-semibold text-cyan-400">Addition (React Flow)</h2>
          <AlgorithmFlow />
        </section>
        <section>
          <h2 className="mb-3 text-lg font-semibold text-pink-400">Subtraction (Mermaid)</h2>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
            <Mermaid chart={subtractionChart} />
          </div>
        </section>
      </div>
    </main>
  );
}
