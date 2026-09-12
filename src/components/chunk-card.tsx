import type { Chunk, MatchTerm } from "@/lib/rag/types";
import { cn, estimateTokens, formatInt } from "@/lib/utils";
import { HighlightedText } from "./viz/highlighted-text";
import { Badge } from "./ui/badge";

export function ChunkCard({
  chunk,
  query,
  selected,
  rank,
  similarity,
  matches,
  note,
  onSelect,
}: {
  chunk: Chunk;
  query: string;
  selected?: boolean;
  rank?: number;
  similarity?: number;
  matches?: MatchTerm[];
  note?: string;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      data-chunk-id={chunk.id}
      onClick={() => onSelect(chunk.id)}
      className={cn(
        "w-full rounded-lg p-4 text-left transition-[box-shadow,background-color] duration-150",
        selected
          ? "bg-surface-2 hairline-accent"
          : "bg-surface hairline hover:hairline-strong",
      )}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-accent">{chunk.id}</span>
        {rank != null ? <Badge tone="accent">#{rank}</Badge> : null}
        {note ? <Badge tone="muted">{note}</Badge> : null}
        {similarity != null ? (
          <Badge tone="muted">sim {similarity.toFixed(3)} · 估算</Badge>
        ) : null}
        <span className="ml-auto font-mono text-2xs tabular-nums text-subtle">
          {formatInt(chunk.start)}–{formatInt(chunk.end)} · ~{estimateTokens(chunk.text)} tok
        </span>
      </div>
      <HighlightedText text={chunk.text.trim()} query={query} />
      {matches && matches.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1">
          {matches.slice(0, 6).map((m) => (
            <span
              key={m.term}
              className="rounded-sm bg-accent/10 px-1.5 py-0.5 font-mono text-2xs text-accent"
            >
              {m.term}
            </span>
          ))}
        </div>
      ) : null}
    </button>
  );
}
