import { useServerFn } from "@tanstack/react-start";
import type { PipelineResult } from "@/lib/rag/types";
import { generateAnswers } from "@/lib/generate";
import { currentFingerprint, useRagStore } from "@/lib/store";

export function useGenerate(pipe: PipelineResult) {
  const query = useRagStore((s) => s.query);
  const setStage = useRagStore((s) => s.setStage);
  const gen = useRagStore((s) => s.gen);
  const setGen = useRagStore((s) => s.setGen);
  const document = useRagStore((s) => s.document);
  const chunkSize = useRagStore((s) => s.chunkSize);
  const overlap = useRagStore((s) => s.overlap);
  const topK = useRagStore((s) => s.topK);
  const ranker = useRagStore((s) => s.ranker);
  const rerank = useRagStore((s) => s.rerank);
  const generate = useServerFn(generateAnswers);

  const fp = currentFingerprint({
    document,
    chunkSize,
    overlap,
    topK,
    query,
    ranker,
    rerank,
  });
  const stale = gen.fingerprint != null && gen.fingerprint !== fp;

  async function run(mode: "rag" | "both") {
    if (!query.trim()) {
      setStage("search");
      return;
    }
    setStage("answer");
    setGen({ pending: true, error: null, mode });
    try {
      const result = await generate({
        data: { query, context: pipe.context, mode },
      });
      if (!result.ok) {
        setGen({ pending: false, error: result.error, mode });
        return;
      }
      setGen({
        pending: false,
        error: null,
        withRag: result.withRag,
        withoutRag:
          mode === "both" ? result.withoutRag : useRagStore.getState().gen.withoutRag,
        ranAt: Date.now(),
        fingerprint: fp,
        mode,
      });
    } catch (err) {
      setGen({
        pending: false,
        error: err instanceof Error ? err.message : "生成失敗，可重試。",
        mode,
      });
    }
  }

  function retry() {
    return run(gen.mode === "both" ? "both" : "rag");
  }

  return { run, retry, gen, stale, fp };
}
