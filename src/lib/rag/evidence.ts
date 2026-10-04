import type { GroundSpan } from "./ground";
export type Evidence = {
  chunkId: string;
  pick: number | null;
  start: number;
  end: number;
  quote: string;
  sentence: string;
  reason: string;
  coverage: number;
  support: GroundSpan["support"];
};

export function evidenceFromSpan(span: GroundSpan, fallbackStart = 0, fallbackEnd = 0): Evidence | null {
  if (!span.chunkId) return null;
  return {
    chunkId: span.chunkId,
    pick: span.pick,
    start: span.docStart ?? fallbackStart,
    end: span.docEnd ?? fallbackEnd,
    quote: span.quote ?? "",
    sentence: span.text,
    reason: span.reason,
    coverage: span.coverage,
    support: span.support,
  };
}

