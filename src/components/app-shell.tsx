import { useEffect, useMemo } from "react";
import { runPipeline } from "@/lib/rag/pipeline";
import { diagnose, searchMeta } from "@/lib/rag/diagnose";
import { captureSnap } from "@/lib/rag/compare";
import { hasDistractor } from "@/lib/rag/experiments";
import type { Ranker, Rerank, StageId } from "@/lib/rag/types";
import { currentFingerprint, useRagStore } from "@/lib/store";
import { estimateTokens, formatInt } from "@/lib/utils";
import { PipelineNav } from "./pipeline-nav";
import { QueryDock } from "./query-dock";
import { StageViews } from "./stage-views";
import { Slider } from "./ui/slider";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";

function Seg<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex shrink-0 rounded-md bg-surface-2 p-0.5 hairline">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={`h-11 shrink-0 rounded-sm px-3 text-xs font-medium ${
            value === o.id ? "bg-accent text-accent-fg" : "text-muted hover:text-fg"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function AppShell() {
  const docText = useRagStore((s) => s.document);
  const sampleId = useRagStore((s) => s.sampleId);
  const chunkSize = useRagStore((s) => s.chunkSize);
  const overlap = useRagStore((s) => s.overlap);
  const topK = useRagStore((s) => s.topK);
  const ranker = useRagStore((s) => s.ranker);
  const rerank = useRagStore((s) => s.rerank);
  const query = useRagStore((s) => s.query);
  const stage = useRagStore((s) => s.stage);
  const gen = useRagStore((s) => s.gen);
  const compare = useRagStore((s) => s.compare);
  const selectedChunkId = useRagStore((s) => s.selectedChunkId);
  const setStage = useRagStore((s) => s.setStage);
  const setChunkSize = useRagStore((s) => s.setChunkSize);
  const setOverlap = useRagStore((s) => s.setOverlap);
  const setTopK = useRagStore((s) => s.setTopK);
  const setRanker = useRagStore((s) => s.setRanker);
  const setRerank = useRagStore((s) => s.setRerank);
  const selectChunk = useRagStore((s) => s.selectChunk);
  const pinCompare = useRagStore((s) => s.pinCompare);
  const applySplit = useRagStore((s) => s.applySplit);
  const applyK1 = useRagStore((s) => s.applyK1);
  const applyNoise = useRagStore((s) => s.applyNoise);
  const resetDemo = useRagStore((s) => s.resetDemo);

  useEffect(() => {
    void useRagStore.persist.rehydrate();
  }, []);

  const maxOverlap = Math.max(0, chunkSize - 20);

  useEffect(() => {
    if (overlap > maxOverlap) setOverlap(maxOverlap);
  }, [overlap, maxOverlap, setOverlap]);

  const pipe = useMemo(
    () => runPipeline(docText, chunkSize, overlap, topK, query, ranker, rerank),
    [docText, chunkSize, overlap, topK, query, ranker, rerank],
  );

  const diag = useMemo(() => diagnose(pipe, sampleId), [pipe, sampleId]);
  const fp = currentFingerprint({
    document: docText,
    chunkSize,
    overlap,
    topK,
    query,
    ranker,
    rerank,
  });
  const stale = gen.fingerprint != null && gen.fingerprint !== fp;

  useEffect(() => {
    if (selectedChunkId && !pipe.chunks.some((c) => c.id === selectedChunkId)) {
      selectChunk(null);
    }
  }, [pipe.chunks, selectedChunkId, selectChunk]);

  useEffect(() => {
    if (!selectedChunkId) return;
    const el = window.document.querySelector(`[data-chunk-id="${selectedChunkId}"]`);
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedChunkId, stage]);

  const answerMeta = gen.pending
    ? "生成中"
    : gen.error
      ? "失敗"
      : stale
        ? "過期"
        : gen.withRag
          ? "ready"
          : "idle";

  const meta: Record<StageId, string> = {
    document: `${formatInt(docText.length)}c`,
    chunking: `${pipe.chunks.length} pcs`,
    embedding: `${pipe.vocabSize} terms`,
    search: searchMeta(diag, pipe.chunks.length, !pipe.queryVector),
    topk: pipe.topK.length ? `k=${pipe.topK.length}` : "—",
    context: pipe.context ? `~${formatInt(pipe.contextTokensEst)}` : "—",
    llm: "grok-4.5",
    answer: answerMeta,
  };

  const splitOn = chunkSize <= 120 && overlap === 0;
  const noiseOn = hasDistractor(docText);
  const compareOn = Boolean(compare && compare.fingerprint !== fp);

  function pinNow() {
    pinCompare(
      captureSnap(pipe, diag, {
        chunkSize,
        overlap,
        topK,
        ranker,
        rerank,
        fingerprint: fp,
        withRag: gen.withRag,
        answerFresh: !stale && Boolean(gen.withRag),
      }),
    );
    setStage("answer");
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-bg text-fg">
      <header className="shrink-0 border-b border-border bg-bg">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:gap-4 sm:px-6 sm:py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-2xs tracking-widest text-subtle uppercase">
                Pipeline debugger
              </p>
              <h1 className="text-xl font-medium tracking-tight text-fg sm:text-2xl">
                RAG Lens
              </h1>
              <p className="mt-1 hidden max-w-xl text-sm text-muted sm:block">
                調整切塊、排序器與 Top-K，立刻看檢索怎麼變。點回答裡的 #1 可對回原文。相似度與 token 都是估算。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge tone="warn">估算 · 非神經 embedding</Badge>
              <Badge tone="muted">~{formatInt(estimateTokens(docText))} tok</Badge>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 rounded-lg bg-surface p-3 hairline sm:gap-4 sm:p-4">
            <Slider
              label="Size"
              value={chunkSize}
              min={80}
              max={900}
              step={10}
              display={String(chunkSize)}
              unit="chars"
              onValueChange={setChunkSize}
            />
            <Slider
              label="Overlap"
              value={Math.min(overlap, maxOverlap)}
              min={0}
              max={Math.max(10, maxOverlap)}
              step={8}
              display={String(Math.min(overlap, maxOverlap))}
              unit="chars"
              onValueChange={setOverlap}
            />
            <Slider
              label="Top-K"
              value={topK}
              min={1}
              max={8}
              step={1}
              display={String(topK)}
              unit="chunks"
              onValueChange={setTopK}
            />
          </div>

          <div className="hide-scroll flex flex-nowrap items-center gap-2 overflow-x-auto">
            <Seg<Ranker>
              value={ranker}
              onChange={setRanker}
              options={[
                { id: "tfidf", label: "TF-IDF" },
                { id: "bm25", label: "BM25" },
              ]}
            />
            <Seg<Rerank>
              value={rerank}
              onChange={setRerank}
              options={[
                { id: "greedy", label: "Greedy" },
                { id: "mmr", label: "MMR" },
              ]}
            />
            <Button
              type="button"
              size="sm"
              variant={splitOn ? "primary" : "secondary"}
              onClick={applySplit}
              className="shrink-0"
            >
              切碎關鍵句
            </Button>
            <Button
              type="button"
              size="sm"
              variant={topK === 1 ? "primary" : "secondary"}
              onClick={applyK1}
              className="shrink-0"
            >
              只取 1 塊
            </Button>
            <Button
              type="button"
              size="sm"
              variant={noiseOn ? "primary" : "secondary"}
              onClick={applyNoise}
              className="shrink-0"
            >
              加入干擾段
            </Button>
            <Button
              type="button"
              size="sm"
              variant={compareOn ? "primary" : "secondary"}
              onClick={pinNow}
              className="shrink-0"
            >
              {compare ? "更新對照" : "存成對照"}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={resetDemo} className="shrink-0">
              還原示範
            </Button>
          </div>

          <PipelineNav stage={stage} onStage={setStage} meta={meta} />
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto bg-grid">
        <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 sm:py-5">
          <div className="stage-enter" key={stage}>
            <StageViews stage={stage} pipe={pipe} diag={diag} />
          </div>
        </div>
      </main>

      <div className="shrink-0">
        <QueryDock pipe={pipe} />
      </div>
    </div>
  );
}
