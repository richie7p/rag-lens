import { tokenize } from "./tokenize";

export type Mark = { start: number; end: number; kind: "match" | "plain" };

function collectNeedles(query: string): string[] {
  const tokens = tokenize(query);
  const needles = new Set<string>();
  for (const t of tokens) {
    if (t.length >= 2) needles.add(t);
  }
  return [...needles].sort((a, b) => b.length - a.length);
}

/** Case-insensitive span marking for query terms inside a chunk. */
export function markMatches(text: string, query: string): Mark[] {
  if (!text) return [];
  const needles = collectNeedles(query);
  if (needles.length === 0) return [{ start: 0, end: text.length, kind: "plain" }];

  const hits: { start: number; end: number }[] = [];
  const lower = text.toLowerCase();
  for (const n of needles) {
    let from = 0;
    const needle = n.toLowerCase();
    while (from < lower.length) {
      const i = lower.indexOf(needle, from);
      if (i < 0) break;
      hits.push({ start: i, end: i + needle.length });
      from = i + Math.max(1, needle.length);
    }
  }

  if (hits.length === 0) return [{ start: 0, end: text.length, kind: "plain" }];

  hits.sort((a, b) => a.start - b.start || b.end - a.end);
  const merged: { start: number; end: number }[] = [];
  for (const h of hits) {
    const last = merged[merged.length - 1];
    if (last && h.start <= last.end) last.end = Math.max(last.end, h.end);
    else merged.push({ ...h });
  }

  const marks: Mark[] = [];
  let cursor = 0;
  for (const h of merged) {
    if (h.start > cursor) marks.push({ start: cursor, end: h.start, kind: "plain" });
    marks.push({ start: h.start, end: h.end, kind: "match" });
    cursor = h.end;
  }
  if (cursor < text.length) marks.push({ start: cursor, end: text.length, kind: "plain" });
  return marks;
}
