import { LoaderCircle, Play, SplitSquareHorizontal } from "lucide-react";
import type { PipelineResult } from "@/lib/rag/types";
import { useGenerate } from "./use-generate";
import { useRagStore } from "@/lib/store";
import { Button } from "./ui/button";

export function QueryDock({ pipe }: { pipe: PipelineResult }) {
  const query = useRagStore((s) => s.query);
  const setQuery = useRagStore((s) => s.setQuery);
  const setStage = useRagStore((s) => s.setStage);
  const { run, retry, gen, stale } = useGenerate(pipe);

  const busy = gen.pending;
  const canRun = !busy && Boolean(query.trim()) && pipe.chunks.length > 0;

  return (
    <div className="border-t border-border bg-surface p-3 sm:p-4">
      <div className="mx-auto flex max-w-7xl flex-col gap-2">
        {busy ? (
          <p className="font-mono text-2xs text-accent">
            生成中 · 正在把 Top-K 上下文送給 grok-4.5
          </p>
        ) : gen.error ? (
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs text-danger">{gen.error}</p>
            <Button type="button" size="sm" variant="secondary" onClick={() => void retry()}>
              重試
            </Button>
          </div>
        ) : stale && gen.withRag ? (
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs text-warn">切塊、排序或問題已改，目前回答已過期。</p>
            <Button type="button" size="sm" variant="secondary" onClick={() => void retry()}>
              重新生成
            </Button>
          </div>
        ) : null}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <label className="min-w-0 flex-1">
            <span className="mb-1.5 block font-mono text-2xs tracking-widest text-subtle uppercase">
              Query
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  setStage("search");
                }
              }}
              placeholder="問這份文件一個它才知道的問題"
              className="h-11 w-full rounded-md bg-bg px-3 text-sm text-fg hairline outline-none placeholder:text-subtle focus:hairline-accent"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setStage("search")}
              disabled={!query.trim() || pipe.chunks.length === 0}
            >
              檢視檢索
            </Button>
            <Button
              type="button"
              onClick={() => void run("rag")}
              disabled={!canRun}
            >
              {busy && gen.mode !== "both" ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Play className="size-4" />
              )}
              {busy && gen.mode !== "both" ? "生成中" : gen.error ? "重試生成" : "生成回答"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => void run("both")}
              disabled={!canRun}
            >
              {busy && gen.mode === "both" ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <SplitSquareHorizontal className="size-4" />
              )}
              {busy && gen.mode === "both" ? "對照中" : "對照無 RAG"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
