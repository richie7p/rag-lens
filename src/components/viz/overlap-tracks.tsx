import { assignLanes } from "@/lib/rag/chunk";
import type { Chunk } from "@/lib/rag/types";
import { cn } from "@/lib/utils";

export function OverlapTracks({
  chunks,
  textLength,
  selectedId,
  retrievedIds,
  onSelect,
}: {
  chunks: Chunk[];
  textLength: number;
  selectedId: string | null;
  retrievedIds: Set<string>;
  onSelect: (id: string) => void;
}) {
  const { lanes, laneCount } = assignLanes(chunks);
  const laneOf = new Map(lanes.map((l) => [l.id, l.lane]));
  const total = Math.max(1, textLength);

  return (
    <div className="flex flex-col gap-1">
      <div className="relative w-full" style={{ height: laneCount * 18 + 4 }}>
        {chunks.map((c) => {
          const lane = laneOf.get(c.id) ?? 0;
          const left = (c.start / total) * 100;
          const width = Math.max(0.8, ((c.end - c.start) / total) * 100);
          const selected = selectedId === c.id;
          const retrieved = retrievedIds.has(c.id);
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelect(c.id)}
              title={`${c.id} · ${c.start}–${c.end}`}
              className={cn(
                "absolute h-3.5 rounded-sm transition-[opacity,background-color] duration-150",
                selected
                  ? "bg-accent"
                  : retrieved
                    ? "bg-accent/70"
                    : "bg-fg/20 hover:bg-fg/35",
              )}
              style={{
                left: `${left}%`,
                width: `${width}%`,
                top: lane * 18 + 2,
              }}
            />
          );
        })}
      </div>
      <div className="flex justify-between font-mono text-2xs text-subtle tabular-nums">
        <span>0</span>
        <span>{total} chars</span>
      </div>
    </div>
  );
}
