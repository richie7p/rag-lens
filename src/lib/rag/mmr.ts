import { cosineSparse } from "./vector";
import type { RankedChunk } from "./types";

/** Relevance vs diversity mix. Labeled 估算 — not a production default. */
export const MMR_LAMBDA = 0.72;

/**
 * Maximal Marginal Relevance. First pick is the top greedy hit; later picks
 * subtract TF-IDF cosine against already chosen chunks so overlap twins drop.
 */
export function selectMmr(
  ranked: RankedChunk[],
  k: number,
  lambda = MMR_LAMBDA,
): RankedChunk[] {
  if (k <= 0 || ranked.length === 0) return [];
  if (ranked.length <= k || k === 1) return ranked.slice(0, k);

  const selected: RankedChunk[] = [];
  const rest = [...ranked];

  while (selected.length < k && rest.length > 0) {
    let bestI = 0;
    let bestScore = -Infinity;
    for (let i = 0; i < rest.length; i++) {
      const c = rest[i]!;
      let div = 0;
      if (selected.length > 0) {
        for (const s of selected) {
          const sim = cosineSparse(c.vector.tfidf, s.vector.tfidf);
          if (sim > div) div = sim;
        }
      }
      const score = lambda * c.similarity - (1 - lambda) * div;
      if (score > bestScore) {
        bestScore = score;
        bestI = i;
      }
    }
    const next = rest.splice(bestI, 1)[0];
    if (next) selected.push(next);
  }

  return selected;
}
