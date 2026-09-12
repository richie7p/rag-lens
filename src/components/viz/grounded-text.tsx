import type { GroundSpan, Support } from "@/lib/rag/ground";
import { supportCounts } from "@/lib/rag/ground";
import { cn } from "@/lib/utils";
import { AnswerText } from "./answer-text";

const BORDER: Record<Support, string> = {
  strong: "border-ok",
  weak: "border-warn",
  conflict: "border-danger",
  none: "border-danger",
  skip: "border-border",
};

const LABEL: Record<Support, string> = {
  strong: "有依據",
  weak: "弱依據",
  conflict: "極性相反",
  none: "無依據",
  skip: "不計入",
};

const TONE: Record<Support, string> = {
  strong: "text-ok",
  weak: "text-warn",
  conflict: "text-danger",
  none: "text-danger",
  skip: "text-subtle",
};

export function GroundedText({
  spans,
  maxCite,
  onCite,
  onOpen,
}: {
  spans: GroundSpan[];
  maxCite: number;
  onCite: (n: number) => void;
  onOpen: (span: GroundSpan) => void;
}) {
  const counts = supportCounts(spans);

  return (
    <div className="flex flex-col gap-3">
      <p className="font-mono text-2xs tabular-nums text-subtle">
        有依據 {counts.strong} · 弱 {counts.weak}
        {counts.conflict ? ` · 極性相反 ${counts.conflict}` : ""}
        {" · "}
        無 {counts.none} · {counts.scored} 句事實 · 估算
      </p>
      {spans.map((s, i) => (
        <div key={i} className={cn("border-l-2 pl-3", BORDER[s.support])}>
          <AnswerText text={s.text} max={maxCite} onCite={onCite} />
          {s.support === "skip" ? (
            <p className="mt-1 font-mono text-2xs text-subtle">開場／標題 · 不列入統計</p>
          ) : s.chunkId ? (
            <button
              type="button"
              onClick={() => onOpen(s)}
              className={cn("mt-1 min-h-11 text-left font-mono text-2xs hover:underline", TONE[s.support])}
            >
              {LABEL[s.support]} · {s.chunkId}
              {s.pick ? ` #${s.pick}` : ""} · 重疊 {s.coverage.toFixed(2)}
            </button>
          ) : (
            <p className={cn("mt-1 font-mono text-2xs", TONE[s.support])}>{LABEL[s.support]}</p>
          )}
        </div>
      ))}
    </div>
  );
}
