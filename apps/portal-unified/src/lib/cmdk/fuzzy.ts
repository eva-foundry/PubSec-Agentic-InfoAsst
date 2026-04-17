// Fuzzy scoring + match-position helpers used by the Cmd+K palette.

/** Score a target string against a query. Higher is better. Returns null on no match. */
export function fuzzyScore(query: string, target: string): number | null {
  if (!query) return 0;
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  let qi = 0, ti = 0, score = 0, streak = 0, firstMatch = -1;
  while (qi < q.length && ti < t.length) {
    if (q[qi] === t[ti]) {
      if (firstMatch === -1) firstMatch = ti;
      streak += 1;
      score += 8 + streak * 4;
      const prev = t[ti - 1];
      if (ti === 0 || prev === " " || prev === "-" || prev === "_" || prev === "/" || prev === ".") score += 6;
      qi += 1;
    } else {
      streak = 0;
    }
    ti += 1;
  }
  if (qi < q.length) return null;
  score -= Math.min(firstMatch, 20);
  score -= Math.max(0, t.length - q.length) * 0.05;
  return score;
}

/**
 * Greedy subsequence match positions inside a label (case-insensitive).
 * Returns the indices of label characters that match the query in order, or null.
 */
export function matchPositions(query: string, label: string): number[] | null {
  const q = query.toLowerCase();
  const l = label.toLowerCase();
  if (!q) return [];
  const out: number[] = [];
  let qi = 0;
  for (let li = 0; li < l.length && qi < q.length; li++) {
    if (l[li] === q[qi]) { out.push(li); qi += 1; }
  }
  return qi === q.length ? out : null;
}
