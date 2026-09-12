import type { ReactNode } from "react";

export function CitedText({
  text,
  max,
  onCite,
}: {
  text: string;
  max: number;
  onCite: (n: number) => void;
}) {
  const parts: ReactNode[] = [];
  const re = /#(\d+)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const n = Number(m[1]);
    if (n >= 1 && n <= max) {
      const cite = n;
      parts.push(
        <button
          key={`c-${i}-${cite}`}
          type="button"
          onClick={() => onCite(cite)}
          className="mx-0.5 inline-flex rounded-sm bg-accent/20 px-1 font-mono text-xs text-accent hover:bg-accent/30"
        >
          #{cite}
        </button>,
      );
    } else {
      parts.push(m[0]);
    }
    i += 1;
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <p className="whitespace-pre-wrap text-sm leading-relaxed text-fg">{parts}</p>;
}
