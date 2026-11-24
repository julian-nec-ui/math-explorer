"use client";

import { ReactFlow, Background, Controls, type Edge, type Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

// Pașii algoritmului de adunare în coloană, ca diagramă interactivă (React Flow)
const nodes: Node[] = [
  { id: "start", position: { x: 0, y: 0 }, data: { label: "Start: carry = 0" }, type: "input" },
  { id: "pick", position: { x: 0, y: 90 }, data: { label: "Take the next pair of digits" } },
  { id: "sum", position: { x: 0, y: 180 }, data: { label: "sum = top + bottom + carry" } },
  { id: "write", position: { x: 0, y: 270 }, data: { label: "Write sum % 10" } },
  { id: "carry", position: { x: 0, y: 360 }, data: { label: "carry = sum ≥ 10 ? 1 : 0" } },
  { id: "more", position: { x: 0, y: 450 }, data: { label: "More pairs?" } },
  { id: "spill", position: { x: 260, y: 450 }, data: { label: "If carry = 1, write it in front" } },
  { id: "end", position: { x: 260, y: 540 }, data: { label: "Done" }, type: "output" },
];

const edges: Edge[] = [
  { id: "e1", source: "start", target: "pick" },
  { id: "e2", source: "pick", target: "sum" },
  { id: "e3", source: "sum", target: "write" },
  { id: "e4", source: "write", target: "carry" },
  { id: "e5", source: "carry", target: "more" },
  { id: "e6", source: "more", target: "pick", label: "yes", type: "smoothstep" },
  { id: "e7", source: "more", target: "spill", label: "no" },
  { id: "e8", source: "spill", target: "end" },
];

export default function AlgorithmFlow() {
  return (
    <div className="h-160 w-full rounded-2xl border border-zinc-800 bg-zinc-900/50">
      <ReactFlow nodes={nodes} edges={edges} fitView colorMode="dark" proOptions={{ hideAttribution: true }}>
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
}
