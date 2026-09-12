import { cn } from "@/lib/utils";

type Point = { id: string; x: number; y: number; isQuery?: boolean };

export function ScatterPlot({
  points,
  selectedId,
  retrievedIds,
  onSelect,
}: {
  points: Point[];
  selectedId: string | null;
  retrievedIds: Set<string>;
  onSelect: (id: string) => void;
}) {
  const w = 520;
  const h = 280;
  const pad = 28;
  const toX = (x: number) => pad + ((x + 1) / 2) * (w - pad * 2);
  const toY = (y: number) => pad + ((1 - y) / 2) * (h - pad * 2);

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="h-auto w-full"
      role="img"
      aria-label="Chunk embeddings projected to 2D"
    >
      <rect x={0} y={0} width={w} height={h} className="fill-surface" />
      <line
        x1={pad}
        y1={h / 2}
        x2={w - pad}
        y2={h / 2}
        className="stroke-border"
        strokeWidth={1}
      />
      <line
        x1={w / 2}
        y1={pad}
        x2={w / 2}
        y2={h - pad}
        className="stroke-border"
        strokeWidth={1}
      />
      {points.map((p) => {
        const cx = toX(p.x);
        const cy = toY(p.y);
        if (p.isQuery) {
          return (
            <g key={p.id}>
              <circle
                cx={cx}
                cy={cy}
                r={9}
                className="fill-accent/20 stroke-accent"
                strokeWidth={1.5}
              />
              <text x={cx + 12} y={cy + 4} className="fill-accent font-mono text-2xs">
                query
              </text>
            </g>
          );
        }
        const selected = selectedId === p.id;
        const retrieved = retrievedIds.has(p.id);
        return (
          <g key={p.id} className="cursor-pointer" onClick={() => onSelect(p.id)}>
            <circle
              cx={cx}
              cy={cy}
              r={selected ? 8 : retrieved ? 6.5 : 5}
              className={cn(
                selected
                  ? "fill-accent stroke-fg"
                  : retrieved
                    ? "fill-accent/80 stroke-accent"
                    : "fill-muted/50 stroke-border-strong",
              )}
              strokeWidth={selected ? 2 : 1}
            />
            {selected || retrieved ? (
              <text x={cx + 10} y={cy + 3} className="fill-muted font-mono text-2xs">
                {p.id}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
