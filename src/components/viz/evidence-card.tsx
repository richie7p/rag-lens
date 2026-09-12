import type { GroundSpan } from "@/lib/rag/ground";
import { formatInt } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HighlightedText } from "./highlighted-text";

export type Evidence = {
  chunkId: string;
  pick: number | null;
  start: number;
  end: number;
  quote: string;
  sentence: string;
  reason: string;
  coverage: number;
  support: GroundSpan["support"];
};

export function evidenceFromSpan(span: GroundSpan, fallbackStart = 0, fallbackEnd = 0): Evidence | null {
  if (!span.chunkId) return null;
  return {
    chunkId: span.chunkId,
    pick: span.pick,
    start: span.docStart ?? fallbackStart,
    end: span.docEnd ?? fallbackEnd,
    quote: span.quote ?? "",
    sentence: span.text,
    reason: span.reason,
    coverage: span.coverage,
    support: span.support,
  };
}

export function EvidenceCard({
  evidence,
  onClose,
  onShowChunk,
  onShowDoc,
}: {
  evidence: Evidence;
  onClose: () => void;
  onShowChunk: () => void;
  onShowDoc: () => void;
}) {
  return (
    <section className="rounded-xl bg-surface p-4 hairline sm:p-5">
      <header className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="mb-1 font-mono text-2xs tracking-widest text-subtle uppercase">
            Source locator
          </p>
          <h2 className="text-base font-medium text-fg">來源定位</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="accent">{evidence.chunkId}</Badge>
          {evidence.pick ? <Badge tone="muted">#{evidence.pick}</Badge> : null}
          <Badge tone="warn">估算</Badge>
        </div>
      </header>
      <p className="font-mono text-xs tabular-nums text-muted">
        原文位置 {formatInt(evidence.start)}–{formatInt(evidence.end)} 字元
      </p>
      {evidence.quote ? (
        <div className="mt-3 rounded-md bg-bg p-3">
          <p className="mb-1 font-mono text-2xs tracking-widest text-subtle uppercase">
            支持該句的文字
          </p>
          <HighlightedText text={evidence.quote} query={evidence.sentence} />
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted">這句在 Top-K 裡沒有對得上的片段。</p>
      )}
      <p className="mt-3 text-xs leading-relaxed text-muted">{evidence.reason}</p>
      <p className="mt-1 font-mono text-2xs text-subtle">
        詞彙重疊 {evidence.coverage.toFixed(2)} · 高重疊不代表內容正確
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={onShowChunk}>
          看切塊
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={onShowDoc}>
          看原文
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onClose}>
          關閉
        </Button>
      </div>
    </section>
  );
}
