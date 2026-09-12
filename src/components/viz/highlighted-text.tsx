import { markMatches } from "@/lib/rag/highlight";
import { cn } from "@/lib/utils";

export function HighlightedText({
  text,
  query,
  className,
}: {
  text: string;
  query: string;
  className?: string;
}) {
  const marks = markMatches(text, query);
  return (
    <p className={cn("whitespace-pre-wrap text-sm leading-relaxed text-fg", className)}>
      {marks.map((m, i) => {
        const slice = text.slice(m.start, m.end);
        if (m.kind === "match") {
          return (
            <mark
              key={i}
              className="rounded-xs bg-accent/25 px-px text-fg"
            >
              {slice}
            </mark>
          );
        }
        return <span key={i}>{slice}</span>;
      })}
    </p>
  );
}
