import { type ReactNode } from "react";

/** Lightweight markdown: **bold**, `code`, lists, headings. Citations stay clickable. */
export function AnswerText({
  text,
  max = 0,
  onCite,
}: {
  text: string;
  max?: number;
  onCite?: (n: number) => void;
}) {
  const blocks = splitBlocks(text);
  return (
    <div className="flex flex-col gap-2 text-sm leading-relaxed text-fg">
      {blocks.map((b, i) => {
        if (b.kind === "heading") {
          return (
            <p key={i} className="font-medium text-fg">
              {inline(b.text, max, onCite)}
            </p>
          );
        }
        if (b.kind === "list") {
          return (
            <ul key={i} className="flex flex-col gap-1 pl-4">
              {b.items.map((item, j) => (
                <li key={j} className="list-disc">
                  {inline(item, max, onCite)}
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="whitespace-pre-wrap">
            {inline(b.text, max, onCite)}
          </p>
        );
      })}
    </div>
  );
}

type Block =
  | { kind: "p" | "heading"; text: string }
  | { kind: "list"; items: string[] };

function splitBlocks(text: string): Block[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: string[] = [];

  const flushPara = () => {
    const t = para.join("\n").trim();
    para = [];
    if (t) blocks.push({ kind: "p", text: t });
  };
  const flushList = () => {
    if (list.length) blocks.push({ kind: "list", items: list });
    list = [];
  };

  for (const line of lines) {
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    const li = /^\s*(?:[-*+]|\d+[.)])\s+(.+)$/.exec(line);
    if (heading) {
      flushPara();
      flushList();
      blocks.push({ kind: "heading", text: heading[2]!.trim() });
    } else if (li) {
      flushPara();
      list.push(li[1]!.trim());
    } else if (!line.trim()) {
      flushPara();
      flushList();
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();
  return blocks.length ? blocks : [{ kind: "p", text: text }];
}

function inline(text: string, max: number, onCite?: (n: number) => void): ReactNode[] {
  const parts: ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|`([^`]+)`|【#(\d+)】|\[#(\d+)\]|（#(\d+)）|\(#(\d+)\)|#(\d+)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[1] != null) {
      parts.push(
        <strong key={`b${i}`} className="font-medium text-fg">
          {m[1]}
        </strong>,
      );
    } else if (m[2] != null) {
      parts.push(
        <code key={`c${i}`} className="rounded-xs bg-surface-2 px-1 font-mono text-2xs">
          {m[2]}
        </code>,
      );
    } else {
      const n = Number(m[3] ?? m[4] ?? m[5] ?? m[6] ?? m[7]);
      if (onCite && n >= 1 && n <= max) {
        const cite = n;
        parts.push(
          <button
            key={`n${i}-${cite}`}
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
    }
    i += 1;
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}
