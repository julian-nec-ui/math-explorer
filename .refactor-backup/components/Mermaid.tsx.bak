"use client";

import { useEffect, useId, useState } from "react";

// Desenează o diagramă Mermaid din text. Biblioteca se încarcă doar în browser.
export default function Mermaid({ chart }: { chart: string }) {
  const id = useId().replace(/:/g, "");
  const [svg, setSvg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    import("mermaid").then(async ({ default: mermaid }) => {
      mermaid.initialize({ startOnLoad: false, theme: "dark" });
      try {
        const { svg } = await mermaid.render(`m${id}`, chart);
        if (!cancelled) { setSvg(svg); setError(""); }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Invalid diagram");
      }
    });
    return () => { cancelled = true; };
  }, [chart, id]);

  if (error) return <p className="text-sm text-red-400">{error}</p>;
  return <div className="flex justify-center [&_svg]:max-w-full" dangerouslySetInnerHTML={{ __html: svg }} />;
}
