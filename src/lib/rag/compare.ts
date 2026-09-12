import type { Diagnosis } from "./diagnose";
import type { PipelineResult, Ranker, Rerank } from "./types";

export type CompareSnap = {
  chunkSize: number;
  overlap: number;
  topK: number;
  ranker: Ranker;
  rerank: Rerank;
  hitCount: number;
  factCount: number;
  poison: boolean;
  contextChars: number;
  contextTokensEst: number;
  topIds: string[];
  withRag: string | null;
  fingerprint: string;
};

export function captureSnap(
  pipe: PipelineResult,
  diag: Diagnosis,
  opts: {
    chunkSize: number;
    overlap: number;
    topK: number;
    ranker: Ranker;
    rerank: Rerank;
    fingerprint: string;
    withRag: string | null;
    answerFresh: boolean;
  },
): CompareSnap {
  return {
    chunkSize: opts.chunkSize,
    overlap: opts.overlap,
    topK: opts.topK,
    ranker: opts.ranker,
    rerank: opts.rerank,
    hitCount: diag.hitCount,
    factCount: diag.factCount,
    poison: diag.poison,
    contextChars: pipe.contextChars,
    contextTokensEst: pipe.contextTokensEst,
    topIds: pipe.topK.map((r) => r.chunk.id),
    withRag: opts.answerFresh ? opts.withRag : null,
    fingerprint: opts.fingerprint,
  };
}

export function settingsLine(s: {
  chunkSize: number;
  overlap: number;
  topK: number;
  ranker: Ranker;
  rerank: Rerank;
}) {
  const rank = s.ranker === "bm25" ? "BM25" : "TF-IDF";
  const rr = s.rerank === "mmr" ? "MMR" : "Greedy";
  return `${s.chunkSize} / ${s.overlap} · k=${s.topK} · ${rank} · ${rr}`;
}

export function idsLine(ids: string[]) {
  return ids.join(" · ") || "—";
}

export function hitLine(hit: number, total: number, poison: boolean) {
  if (poison) return "干擾";
  if (!total) return "—";
  return `${hit}/${total}`;
}

export function compareNotes(a: CompareSnap, b: CompareSnap): string[] {
  const notes: string[] = [];
  if (a.hitCount !== b.hitCount && a.factCount) {
    notes.push(`命中 ${a.hitCount}/${a.factCount} → ${b.hitCount}/${b.factCount}`);
  }
  if (a.poison !== b.poison) {
    notes.push(b.poison ? "目前 Top-K 含干擾段" : "目前已不含干擾段");
  }
  const tokDelta = b.contextTokensEst - a.contextTokensEst;
  if (Math.abs(tokDelta) >= 20) {
    notes.push(
      tokDelta > 0
        ? `上下文約多 ${tokDelta} tok`
        : `上下文約少 ${Math.abs(tokDelta)} tok`,
    );
  }
  const dropped = a.topIds.filter((id) => !b.topIds.includes(id));
  const added = b.topIds.filter((id) => !a.topIds.includes(id));
  if (dropped.length || added.length) {
    notes.push(
      `Top-K 拿掉 ${dropped.join(" · ") || "—"}，補上 ${added.join(" · ") || "—"}`,
    );
  }
  if (a.withRag && b.withRag && a.withRag !== b.withRag) {
    notes.push("兩側都有回答，內容不同");
  } else if (a.withRag && !b.withRag) {
    notes.push("對照有回答，目前尚未生成（或已過期）");
  }
  if (notes.length === 0) notes.push("檢索結果與對照幾乎相同");
  return notes;
}
