import { cn } from "@/lib/utils";

export function Fingerprint({
  sketch,
  compare,
  className,
  compact,
}: {
  sketch: number[];
  compare?: number[];
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-end gap-px",
        compact ? "h-8" : "h-14",
        className,
      )}
      aria-hidden
    >
      {sketch.map((v, i) => {
        const mag = Math.min(1, Math.abs(v) * 2.2);
        const cmp = compare ? Math.min(1, Math.abs(compare[i] ?? 0) * 2.2) : 0;
        return (
          <div key={i} className="relative flex h-full flex-1 items-end">
            {compare ? (
              <div
                className="absolute bottom-0 w-full bg-muted/40"
                style={{ height: `${Math.max(6, cmp * 100)}%` }}
              />
            ) : null}
            <div
              className={cn(
                "relative w-full",
                v >= 0 ? "bg-accent" : "bg-fg/55",
              )}
              style={{ height: `${Math.max(6, mag * 100)}%` }}
            />
          </div>
        );
      })}
    </div>
  );
}
