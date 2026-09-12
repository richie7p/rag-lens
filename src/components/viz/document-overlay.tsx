import type { Chunk } from "@/lib/rag/types";
import { cn } from "@/lib/utils";

type Seg = { start: number; end: number; chunkIds: string[] };

function coverage(text: string, chunks: Chunk[]): Seg[] {
  const points = new Set<number>([0, text.length]);
  for (const c of chunks) {
    points.add(c.start);
    points.add(c.end);
  }
  const sorted = [...points].sort((a, b) => a - b);
  const segs: Seg[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const start = sorted[i]!;
    const end = sorted[i + 1]!;
    if (end <= start) continue;
    const chunkIds = chunks
      .filter((c) => c.start <= start && c.end >= end)
      .map((c) => c.id);
    segs.push({ start, end, chunkIds });
  }
  return segs;
}

export function DocumentOverlay({
  text,
  chunks,
  selectedId,
  retrievedIds,
  onSelect,
}: {
  text: string;
  chunks: Chunk[];
  selectedId: string | null;
  retrievedIds: Set<string>;
  onSelect: (id: string) => void;
}) {
  const segs = coverage(text, chunks);
  return (
    <div className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-fg">
      {segs.map((s, i) => {
        const slice = text.slice(s.start, s.end);
        if (s.chunkIds.length === 0) {
          return (
            <span key={i} className="text-subtle">
              {slice}
            </span>
          );
        }
        const selected = selectedId ? s.chunkIds.includes(selectedId) : false;
        const retrieved = s.chunkIds.some((id) => retrievedIds.has(id));
        const overlap = s.chunkIds.length > 1;
        return (
          <button
            key={i}
            type="button"
            onClick={() => onSelect(s.chunkIds[0]!)}
            className={cn(
              "rounded-xs px-px align-baseline",
              selected
                ? "bg-accent/35 text-fg"
                : retrieved
                  ? "bg-accent/20 text-fg"
                  : overlap
                    ? "bg-fg/10 text-fg"
                    : "bg-transparent text-fg hover:bg-fg/10",
            )}
            title={s.chunkIds.join(" ∩ ")}
          >
            {slice}
          </button>
        );
      })}
    </div>
  );
}
