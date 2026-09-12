import { SKETCH_DIM, type Chunk, type ChunkVector, type MatchTerm } from "./types";
import { tokenize } from "./tokenize";

function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function l2normalize(v: number[]): number[] {
  let n = 0;
  for (const x of v) n += x * x;
  const d = Math.sqrt(n) || 1;
  return v.map((x) => x / d);
}

function termFreq(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
  const n = tokens.length || 1;
  for (const [t, c] of tf) tf.set(t, c / n);
  return tf;
}

function sketchFrom(tfidf: Map<string, number>, dim = SKETCH_DIM): number[] {
  const v = Array.from({ length: dim }, () => 0);
  for (const [term, w] of tfidf) {
    const h = fnv1a(term);
    const idx = h % dim;
    const sign = h & 1 ? 1 : -1;
    v[idx] += sign * w;
  }
  return l2normalize(v);
}

export function buildIdf(tokenDocs: string[][]): Map<string, number> {
  const df = new Map<string, number>();
  const N = tokenDocs.length || 1;
  for (const tokens of tokenDocs) {
    for (const t of new Set(tokens)) df.set(t, (df.get(t) ?? 0) + 1);
  }
  const idf = new Map<string, number>();
  for (const [t, d] of df) {
    idf.set(t, Math.log((N + 1) / (d + 1)) + 1);
  }
  return idf;
}

export function toTfidf(tokens: string[], idf: Map<string, number>): Map<string, number> {
  const tf = termFreq(tokens);
  const out = new Map<string, number>();
  for (const [t, f] of tf) {
    const w = f * (idf.get(t) ?? Math.log(2) + 1);
    if (w > 0) out.set(t, w);
  }
  return out;
}

export function cosineSparse(a: Map<string, number>, b: Map<string, number>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  const [small, large] = a.size < b.size ? [a, b] : [b, a];
  for (const [t, w] of small) {
    const v = large.get(t);
    if (v) dot += w * v;
  }
  for (const w of a.values()) na += w * w;
  for (const w of b.values()) nb += w * w;
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export function embedChunks(chunks: Chunk[]): {
  vectors: ChunkVector[];
  idf: Map<string, number>;
  vocabSize: number;
} {
  const tokenDocs = chunks.map((c) => tokenize(c.text));
  const idf = buildIdf(tokenDocs);
  const vectors = chunks.map((c, i) => {
    const tokens = tokenDocs[i]!;
    const tfidf = toTfidf(tokens, idf);
    return {
      id: c.id,
      tfidf,
      sketch: sketchFrom(tfidf),
      tokens,
    };
  });
  return { vectors, idf, vocabSize: idf.size };
}

export function embedQuery(query: string, idf: Map<string, number>): ChunkVector {
  const tokens = tokenize(query);
  const tfidf = toTfidf(tokens, idf);
  return {
    id: "query",
    tfidf,
    sketch: sketchFrom(tfidf),
    tokens,
  };
}

export function topMatches(
  query: ChunkVector,
  chunk: ChunkVector,
  limit = 8,
): MatchTerm[] {
  const items: MatchTerm[] = [];
  for (const [term, qw] of query.tfidf) {
    const cw = chunk.tfidf.get(term);
    if (!cw) continue;
    items.push({
      term,
      queryWeight: qw,
      chunkWeight: cw,
      score: qw * cw,
    });
  }
  items.sort((a, b) => b.score - a.score);
  return items.slice(0, limit);
}

export function documentFrequencies(tokenDocs: string[][]): Map<string, number> {
  const df = new Map<string, number>();
  for (const tokens of tokenDocs) {
    for (const t of new Set(tokens)) df.set(t, (df.get(t) ?? 0) + 1);
  }
  return df;
}

/** Okapi BM25. Returns an unbounded positive score — normalize at display time. */
export function bm25Score(
  queryTokens: string[],
  docTokens: string[],
  df: Map<string, number>,
  docCount: number,
  avgdl: number,
  k1 = 1.5,
  b = 0.75,
): number {
  if (queryTokens.length === 0 || docTokens.length === 0) return 0;
  const tf = new Map<string, number>();
  for (const t of docTokens) tf.set(t, (tf.get(t) ?? 0) + 1);
  const dl = docTokens.length;
  const seen = new Set<string>();
  let score = 0;
  for (const term of queryTokens) {
    if (seen.has(term)) continue;
    seen.add(term);
    const f = tf.get(term) ?? 0;
    if (f === 0) continue;
    const n = df.get(term) ?? 0;
    const idf = Math.log(1 + (docCount - n + 0.5) / (n + 0.5));
    const denom = f + k1 * (1 - b + b * (dl / (avgdl || 1)));
    score += idf * ((f * (k1 + 1)) / denom);
  }
  return score;
}

/** Power-iteration PCA onto 2D. Inputs should already be comparable (sketches). */
export function project2D(vectors: number[][]): { x: number; y: number }[] {
  const n = vectors.length;
  const d = vectors[0]?.length ?? 0;
  if (n === 0 || d === 0) return [];

  const mean = Array.from({ length: d }, () => 0);
  for (const v of vectors) {
    for (let j = 0; j < d; j++) mean[j]! += v[j]! / n;
  }
  const X = vectors.map((v) => v.map((x, j) => x - mean[j]!));

  const mul = (vec: number[]) => {
    const acc = Array.from({ length: d }, () => 0);
    for (const row of X) {
      let dot = 0;
      for (let j = 0; j < d; j++) dot += row[j]! * vec[j]!;
      for (let j = 0; j < d; j++) acc[j]! += row[j]! * dot;
    }
    return acc;
  };
  const norm = (v: number[]) => {
    let s = 0;
    for (const x of v) s += x * x;
    const den = Math.sqrt(s) || 1;
    return v.map((x) => x / den);
  };

  let e1 = norm(Array.from({ length: d }, () => 1));
  for (let i = 0; i < 20; i++) e1 = norm(mul(e1));

  const deflate = (v: number[]) => {
    let dot = 0;
    for (let j = 0; j < d; j++) dot += v[j]! * e1[j]!;
    return v.map((x, j) => x - dot * e1[j]!);
  };

  let e2 = norm(deflate(Array.from({ length: d }, (_, i) => (i % 2 === 0 ? 1 : -1))));
  for (let i = 0; i < 20; i++) e2 = norm(deflate(mul(e2)));

  const pts = X.map((row) => {
    let x = 0;
    let y = 0;
    for (let j = 0; j < d; j++) {
      x += row[j]! * e1[j]!;
      y += row[j]! * e2[j]!;
    }
    return { x, y };
  });

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const sx = maxX - minX || 1;
  const sy = maxY - minY || 1;
  return pts.map((p) => ({
    x: ((p.x - minX) / sx) * 2 - 1,
    y: ((p.y - minY) / sy) * 2 - 1,
  }));
}
