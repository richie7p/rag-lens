import { clamp } from "@/lib/utils";
import type { Chunk } from "./types";

const BREAKS = /[\n.!?。！？；;]/;

function lastBreakIn(text: string): number {
  for (let i = text.length - 1; i >= 0; i--) {
    if (BREAKS.test(text[i]!)) return i;
  }
  return -1;
}

export function chunkDocument(
  text: string,
  chunkSize: number,
  overlap: number,
): Chunk[] {
  const size = Math.max(60, Math.round(chunkSize));
  const ov = clamp(Math.round(overlap), 0, size - 20);
  if (!text) return [];

  const chunks: Chunk[] = [];
  let start = 0;
  let index = 0;
  const n = text.length;

  while (start < n) {
    let end = Math.min(start + size, n);
    if (end < n) {
      const window = text.slice(start, end);
      const snapAt = Math.floor(window.length * 0.72);
      const rel = lastBreakIn(window.slice(snapAt));
      if (rel >= 0) end = start + snapAt + rel + 1;
    }

    while (end < n && /\s/.test(text[end]!)) end += 1;

    const slice = text.slice(start, end);
    if (slice.trim().length > 0) {
      chunks.push({
        id: `c${index}`,
        index,
        start,
        end,
        text: slice,
      });
      index += 1;
    }

    if (end >= n) break;
    const next = end - ov;
    start = next <= start ? end : next;
  }

  return chunks;
}

export type Lane = { id: string; lane: number };

/** Greedy interval coloring so overlapping chunks sit on different tracks. */
export function assignLanes(chunks: Chunk[]): { lanes: Lane[]; laneCount: number } {
  const sorted = [...chunks].sort((a, b) => a.start - b.start || a.end - b.end);
  const ends: number[] = [];
  const lanes: Lane[] = [];

  for (const chunk of sorted) {
    let lane = ends.findIndex((e) => e <= chunk.start);
    if (lane < 0) {
      lane = ends.length;
      ends.push(chunk.end);
    } else {
      ends[lane] = chunk.end;
    }
    lanes.push({ id: chunk.id, lane });
  }

  return { lanes, laneCount: Math.max(1, ends.length) };
}
