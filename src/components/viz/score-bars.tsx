import type { RankedChunk } from "@/lib/rag/types";
import { cn } from "@/lib/utils";

export function ScoreBars({
  ranked,
  selectedId,
  selectedIds,
  onSelect,
}: {
  ranked: RankedChunk[];
  selectedId: string | null;
  selectedIds: Set<string>;
  onSelect: (id: string) => void;
}) {
  const max = Math.max(0.0001, ranked[0]?.similarity ?? 0);
  return (
    <ul className="flex flex-col gap-1">
      {ranked.map((r) => {
        const pct = Math.max(2, (r.similarity / max) * 100);
        const inK = selectedIds.has(r.chunk.id);
        const selected = selectedId === r.chunk.id;
        const moved = r.altRank !== r.rank;
        return (
          <li key={r.chunk.id}>
            <button
              type="button"
              data-chunk-id={r.chunk.id}
              onClick={() => onSelect(r.chunk.id)}
              className={cn(
                "flex w-full min-h-11 items-center gap-3 rounded-sm px-1 py-2 text-left transition-colors duration-150",
                selected ? "bg-accent/10" : "hover:bg-surface-2",
              )}
            >
              <span className="w-10 shrink-0 font-mono text-xs tabular-nums text-subtle">
                {r.chunk.id}
              </span>
              <span className="relative h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-2">
                <span
                  className={cn(
                    "absolute inset-y-0 left-0 rounded-full transition-[width] duration-200 ease-out",
                    inK ? "bg-accent" : "bg-fg/25",
                  )}
                  style={{ width: `${pct}%` }}
                />
              </span>
              <span className="w-14 shrink-0 text-right font-mono text-xs tabular-nums text-muted">
                {r.similarity.toFixed(3)}
              </span>
              {inK ? (
                <span className="w-8 shrink-0 text-right font-mono text-2xs text-accent">
                  #{r.pick || r.rank}
                </span>
              ) : (
                <span className="w-8 shrink-0" />
              )}
              {moved ? (
                <span className="hidden w-16 shrink-0 text-right font-mono text-2xs text-subtle sm:inline">
                  alt #{r.altRank}
                </span>
              ) : (
                <span className="hidden w-16 shrink-0 sm:inline" />
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
