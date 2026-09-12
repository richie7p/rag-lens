export type Chunk = {
  id: string;
  index: number;
  start: number;
  end: number;
  text: string;
};

export type Ranker = "tfidf" | "bm25";
export type Rerank = "greedy" | "mmr";

export type ChunkVector = {
  id: string;
  /** Sparse TF-IDF weights used for retrieval ranking. */
  tfidf: Map<string, number>;
  /** 32-dim hashed sketch, L2-normalized — visualization only. */
  sketch: number[];
  tokens: string[];
};

export type MatchTerm = {
  term: string;
  queryWeight: number;
  chunkWeight: number;
  score: number;
};

export type RankedChunk = {
  chunk: Chunk;
  vector: ChunkVector;
  similarity: number;
  tfidfScore: number;
  bm25Score: number;
  /** 1-based greedy rank of the active ranker. */
  rank: number;
  altRank: number;
  /** 1-based position in the selected Top-K (0 = not selected). */
  pick: number;
  matches: MatchTerm[];
};

export type PipelineResult = {
  document: string;
  chunks: Chunk[];
  vectors: ChunkVector[];
  vocabSize: number;
  queryTokens: string[];
  queryVector: ChunkVector | null;
  ranker: Ranker;
  rerank: Rerank;
  scores: { id: string; similarity: number }[];
  ranked: RankedChunk[];
  topK: RankedChunk[];
  altTopIds: string[];
  greedyTopIds: string[];
  mmrTopIds: string[];
  context: string;
  contextChars: number;
  contextTokensEst: number;
  points: { id: string; x: number; y: number; isQuery?: boolean }[];
};

export const STAGES = [
  { id: "document", label: "Document", short: "DOC", hint: "原始文件" },
  { id: "chunking", label: "Chunking", short: "CHUNK", hint: "切塊與重疊" },
  { id: "embedding", label: "Embedding", short: "EMBED", hint: "簡化向量" },
  { id: "search", label: "Search", short: "SEARCH", hint: "相似度檢索" },
  { id: "topk", label: "Top-K", short: "TOP-K", hint: "取回片段" },
  { id: "context", label: "Context", short: "CTX", hint: "送進模型的內容" },
  { id: "llm", label: "LLM", short: "LLM", hint: "提示組裝" },
  { id: "answer", label: "Answer", short: "ANS", hint: "有／無 RAG 對照" },
] as const;

export type StageId = (typeof STAGES)[number]["id"];

export const SKETCH_DIM = 32;
export const MAX_DOCUMENT_CHARS = 20_000;
