import { ChevronRight } from "lucide-react";
import { STAGES, type StageId } from "@/lib/rag/types";
import { cn } from "@/lib/utils";

export function PipelineNav({
  stage,
  onStage,
  meta,
}: {
  stage: StageId;
  onStage: (s: StageId) => void;
  meta: Record<StageId, string>;
}) {
  return (
    <nav aria-label="RAG pipeline" className="grid grid-cols-4 gap-1 sm:flex sm:w-full">
      {STAGES.map((s, i) => {
        const active = stage === s.id;
        return (
          <div key={s.id} className="flex min-w-0 items-center gap-1 sm:flex-1">
            {i > 0 ? (
              <ChevronRight className="hidden size-3 shrink-0 text-subtle sm:block" aria-hidden />
            ) : null}
            <button
              type="button"
              onClick={() => onStage(s.id)}
              className={cn(
                "flex min-h-11 min-w-0 w-full flex-col justify-center rounded-md px-2 py-1.5 text-left transition-colors duration-150",
                active
                  ? "bg-accent text-accent-fg"
                  : "bg-surface-2 text-muted hover:text-fg",
              )}
            >
              <span className="truncate font-mono text-2xs tracking-wider">
                {String(i + 1).padStart(2, "0")} {s.short}
              </span>
              <span className="truncate text-xs tabular-nums opacity-80">{meta[s.id]}</span>
            </button>
          </div>
        );
      })}
    </nav>
  );
}
