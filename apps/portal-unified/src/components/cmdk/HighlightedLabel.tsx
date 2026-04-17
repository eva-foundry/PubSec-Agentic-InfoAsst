import { matchPositions } from "@/lib/cmdk/fuzzy";

interface HighlightedLabelProps {
  text: string;
  query: string;
  className?: string;
}

/** Render a label with the matched query characters highlighted. */
export function HighlightedLabel({ text, query, className }: HighlightedLabelProps) {
  const q = query.trim();
  const positions = q ? matchPositions(q, text) : null;
  if (!positions || positions.length === 0) {
    return <span className={className}>{text}</span>;
  }
  const set = new Set(positions);
  // Coalesce consecutive matching/non-matching runs for fewer DOM nodes.
  const runs: { text: string; hit: boolean }[] = [];
  for (let i = 0; i < text.length; i++) {
    const hit = set.has(i);
    const last = runs[runs.length - 1];
    if (last && last.hit === hit) last.text += text[i];
    else runs.push({ text: text[i], hit });
  }
  return (
    <span className={className}>
      {runs.map((r, i) =>
        r.hit ? (
          <mark
            key={i}
            className="rounded-sm bg-product/25 px-0.5 font-semibold text-foreground"
          >
            {r.text}
          </mark>
        ) : (
          <span key={i}>{r.text}</span>
        ),
      )}
    </span>
  );
}
