import { estimateTokens } from "@/lib/utils";
import { chunkDocument } from "./chunk";
import { selectMmr } from "./mmr";
import {
  bm25Score,
  cosineSparse,
  documentFrequencies,
  embedChunks,
  embedQuery,
  project2D,
  topMatches,
} from "./vector";
import type { PipelineResult, RankedChunk, Ranker, Rerank } from "./types";

export function buildContext(chunks: RankedChunk[]): string {
  if (chunks.length === 0) return "";
  return chunks
    .map((r, i) => {
      const sim = r.similarity.toFixed(3);
      return `[#${i + 1} · ${r.chunk.id} · sim ${sim}]\n${r.chunk.text.trim()}`;
    })
    .join("\n\n---\n\n");
}

export function fingerprintOf(input: {
  document: string;
  chunkSize: number;
  overlap: number;
  topK: number;
  query: string;
  ranker: Ranker;
  rerank: Rerank;
}) {
  return [
    input.document.length,
    input.chunkSize,
    input.overlap,
    input.topK,
    input.ranker,
    input.rerank,
    input.query.trim(),
    input.document.slice(0, 80),
    input.document.slice(-40),
  ].join("|");
}

export function runPipeline(
  document: string,
  chunkSize: number,
  overlap: number,
  topK: number,
  query: string,
  ranker: Ranker = "tfidf",
  rerank: Rerank = "greedy",
): PipelineResult {
  const chunks = chunkDocument(document, chunkSize, overlap);
  const { vectors, idf, vocabSize } = embedChunks(chunks);
  const byId = new Map(vectors.map((v) => [v.id, v]));
  const tokenDocs = vectors.map((v) => v.tokens);
  const df = documentFrequencies(tokenDocs);
  const avgdl =
    tokenDocs.reduce((s, t) => s + t.length, 0) / Math.max(1, tokenDocs.length);

  const q = query.trim();
  const queryVector = q && chunks.length > 0 ? embedQuery(q, idf) : null;

  const scored = chunks.map((chunk) => {
    const v = byId.get(chunk.id)!;
    const tfidfScore = queryVector ? cosineSparse(queryVector.tfidf, v.tfidf) : 0;
    const bm25 = queryVector
      ? bm25Score(queryVector.tokens, v.tokens, df, chunks.length, avgdl)
      : 0;
    return { id: chunk.id, tfidfScore, bm25Score: bm25 };
  });

  const maxBm25 = Math.max(0.0001, ...scored.map((s) => s.bm25Score));

  const byTfidf = [...scored].sort((a, b) => b.tfidfScore - a.tfidfScore);
  const byBm25 = [...scored].sort((a, b) => b.bm25Score - a.bm25Score);
  const tfidfRank = new Map(byTfidf.map((s, i) => [s.id, i + 1]));
  const bm25Rank = new Map(byBm25.map((s, i) => [s.id, i + 1]));
  const activeOrder = ranker === "bm25" ? byBm25 : byTfidf;

  const ranked: RankedChunk[] = activeOrder.map((s, i) => {
    const chunk = chunks.find((c) => c.id === s.id)!;
    const vector = byId.get(s.id)!;
    const similarity = ranker === "bm25" ? s.bm25Score / maxBm25 : s.tfidfScore;
    return {
      chunk,
      vector,
      similarity,
      tfidfScore: s.tfidfScore,
      bm25Score: s.bm25Score,
      rank: i + 1,
      altRank: ranker === "bm25" ? (tfidfRank.get(s.id) ?? i + 1) : (bm25Rank.get(s.id) ?? i + 1),
      pick: 0,
      matches: queryVector ? topMatches(queryVector, vector) : [],
    };
  });

  const k = Math.max(1, Math.min(topK, ranked.length || 1));
  const greedy = queryVector ? ranked.slice(0, k) : [];
  const mmrPicked = queryVector ? selectMmr(ranked, k) : [];
  const chosen = rerank === "mmr" ? mmrPicked : greedy;
  const pickOf = new Map(chosen.map((r, i) => [r.chunk.id, i + 1]));
  const rankedPicked = ranked.map((r) => ({
    ...r,
    pick: pickOf.get(r.chunk.id) ?? 0,
  }));
  const top = chosen.map((r, i) => ({ ...r, pick: i + 1 }));
  const altTopIds = (ranker === "bm25" ? byTfidf : byBm25)
    .slice(0, k)
    .map((s) => s.id);
  const greedyTopIds = greedy.map((r) => r.chunk.id);
  const mmrTopIds = mmrPicked.map((r) => r.chunk.id);
  const context = buildContext(top);

  const sketches = vectors.map((v) => v.sketch);
  if (queryVector) sketches.push(queryVector.sketch);
  const projected = project2D(sketches);
  const points: PipelineResult["points"] = vectors.map((v, i) => ({
    id: v.id,
    x: projected[i]?.x ?? 0,
    y: projected[i]?.y ?? 0,
  }));
  if (queryVector && projected[vectors.length]) {
    points.push({
      id: "query",
      x: projected[vectors.length]!.x,
      y: projected[vectors.length]!.y,
      isQuery: true,
    });
  }

  return {
    document,
    chunks,
    vectors,
    vocabSize,
    queryTokens: queryVector?.tokens ?? [],
    queryVector,
    ranker,
    rerank,
    scores: rankedPicked.map((r) => ({ id: r.chunk.id, similarity: r.similarity })),
    ranked: rankedPicked,
    topK: top,
    altTopIds,
    greedyTopIds,
    mmrTopIds,
    context,
    contextChars: context.length,
    contextTokensEst: estimateTokens(context),
    points,
  };
}
