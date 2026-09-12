import { create } from "zustand";
import { persist } from "zustand/middleware";
import { MAX_DOCUMENT_CHARS, type Ranker, type Rerank, type StageId } from "@/lib/rag/types";
import { DEFAULT_SAMPLE, SAMPLES } from "@/lib/rag/samples";
import { fingerprintOf } from "@/lib/rag/pipeline";
import type { CompareSnap } from "@/lib/rag/compare";
import {
  DISTRACTOR_EN,
  DISTRACTOR_ZH,
  hasDistractor,
  stripDistractor,
} from "@/lib/rag/experiments";

export type GenState = {
  withRag: string | null;
  withoutRag: string | null;
  error: string | null;
  pending: boolean;
  ranAt: number | null;
  fingerprint: string | null;
  mode: "rag" | "both" | null;
};

type RagState = {
  document: string;
  sampleId: string;
  chunkSize: number;
  overlap: number;
  topK: number;
  ranker: Ranker;
  rerank: Rerank;
  query: string;
  stage: StageId;
  selectedChunkId: string | null;
  gen: GenState;
  compare: CompareSnap | null;
  setDocument: (text: string) => void;
  loadSample: (id: string) => void;
  setChunkSize: (n: number) => void;
  setOverlap: (n: number) => void;
  setTopK: (n: number) => void;
  setRanker: (r: Ranker) => void;
  setRerank: (r: Rerank) => void;
  setQuery: (q: string) => void;
  setStage: (s: StageId) => void;
  selectChunk: (id: string | null) => void;
  setGen: (partial: Partial<GenState>) => void;
  pinCompare: (snap: CompareSnap) => void;
  clearCompare: () => void;
  applySplit: () => void;
  applyK1: () => void;
  applyNoise: () => void;
  resetDemo: () => void;
};

export const initialGen: GenState = {
  withRag: null,
  withoutRag: null,
  error: null,
  pending: false,
  ranAt: null,
  fingerprint: null,
  mode: null,
};

export function currentFingerprint(s: {
  document: string;
  chunkSize: number;
  overlap: number;
  topK: number;
  query: string;
  ranker: Ranker;
  rerank: Rerank;
}) {
  return fingerprintOf(s);
}

export const useRagStore = create<RagState>()(
  persist(
    (set, get) => ({
      document: DEFAULT_SAMPLE.text,
      sampleId: DEFAULT_SAMPLE.id,
      chunkSize: 280,
      overlap: 56,
      topK: 3,
      ranker: "tfidf",
      rerank: "greedy",
      query: DEFAULT_SAMPLE.query,
      stage: "document",
      selectedChunkId: null,
      gen: initialGen,
      compare: null,
      setDocument: (text) =>
        set({
          document: text.slice(0, MAX_DOCUMENT_CHARS),
          sampleId: "custom",
          gen: initialGen,
          compare: null,
        }),
      loadSample: (id) => {
        const sample = SAMPLES.find((s) => s.id === id);
        if (!sample) return;
        set({
          document: sample.text,
          sampleId: sample.id,
          query: sample.query,
          selectedChunkId: null,
          gen: initialGen,
          compare: null,
        });
      },
      setChunkSize: (n) => set({ chunkSize: n }),
      setOverlap: (n) => set({ overlap: n }),
      setTopK: (n) => set({ topK: n }),
      setRanker: (r) => set({ ranker: r }),
      setRerank: (r) => set({ rerank: r }),
      setQuery: (q) => set({ query: q }),
      setStage: (s) => set({ stage: s }),
      selectChunk: (id) => set({ selectedChunkId: id }),
      setGen: (partial) => set((s) => ({ gen: { ...s.gen, ...partial } })),
      pinCompare: (snap) => set({ compare: snap }),
      clearCompare: () => set({ compare: null }),
      applySplit: () => set({ chunkSize: 110, overlap: 0, stage: "chunking" }),
      applyK1: () => set({ topK: 1, stage: "topk" }),
      applyNoise: () => {
        const s = get();
        if (hasDistractor(s.document)) {
          set({ stage: "search" });
          return;
        }
        const block = s.sampleId === "lumenfold-en" ? DISTRACTOR_EN : DISTRACTOR_ZH;
        set({
          document: `${s.document}\n\n${block}`.slice(0, MAX_DOCUMENT_CHARS),
          stage: "search",
        });
      },
      resetDemo: () => {
        const s = get();
        const sample = SAMPLES.find((x) => x.id === s.sampleId);
        if (sample) {
          set({
            document: sample.text,
            query: sample.query,
            chunkSize: 280,
            overlap: 56,
            topK: 3,
            ranker: "tfidf",
            rerank: "greedy",
            selectedChunkId: null,
            gen: initialGen,
            compare: null,
            stage: "document",
          });
          return;
        }
        set({
          document: stripDistractor(s.document),
          chunkSize: 280,
          overlap: 56,
          topK: 3,
          ranker: "tfidf",
          rerank: "greedy",
          gen: initialGen,
          compare: null,
          stage: "document",
        });
      },
    }),
    {
      name: "rag-lens-v5",
      skipHydration: true,
      partialize: (s) => ({
        document: s.document,
        sampleId: s.sampleId,
        chunkSize: s.chunkSize,
        overlap: s.overlap,
        topK: s.topK,
        ranker: s.ranker,
        rerank: s.rerank,
        query: s.query,
        compare: s.compare,
      }),
    },
  ),
);
