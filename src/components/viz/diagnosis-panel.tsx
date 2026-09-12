import type { Diagnosis, FactStatus, Finding } from "@/lib/rag/diagnose";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const FACT_TONE: Record<FactStatus, "ok" | "warn" | "danger" | "muted"> = {
  hit: "ok",
  miss: "warn",
  split: "danger",
  absent: "muted",
};

const FINDING_TONE: Record<Finding["severity"], string> = {
  ok: "text-ok",
  info: "text-muted",
  warn: "text-warn",
  bad: "text-danger",
};

export function DiagnosisPanel({
  diag,
  onJump,
}: {
  diag: Diagnosis;
  onJump: (chunkId: string) => void;
}) {
  const hitLabel = diag.hasQuery ? "命中" : "完整";
  const statusLabel: Record<FactStatus, string> = {
    hit: hitLabel,
    miss: "K 外",
    split: "切碎",
    absent: "不在文件",
  };

  return (
    <section className="rounded-xl bg-surface p-4 hairline sm:p-5">
      <header className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="mb-1 font-mono text-2xs tracking-widest text-subtle uppercase">
            Debugger
          </p>
          <h2 className="text-base font-medium text-fg">檢索診斷</h2>
        </div>
        <Badge tone="warn">規則比對 · 估算</Badge>
      </header>

      {diag.facts.length > 0 ? (
        <div className="mb-3 flex flex-wrap gap-2">
          {diag.facts.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => f.chunkId && onJump(f.chunkId)}
              className="min-h-11"
            >
              <Badge tone={FACT_TONE[f.status]}>
                {statusLabel[f.status]} · {f.label}
                {f.chunkId ? ` · ${f.chunkId}` : ""}
                {diag.hasQuery && f.rank != null ? ` #${f.rank}` : ""}
              </Badge>
            </button>
          ))}
        </div>
      ) : null}

      <ul className="flex flex-col gap-1">
        {diag.findings.map((f, i) => (
          <li key={`${f.title}-${i}`}>
            {f.chunkId ? (
              <button
                type="button"
                onClick={() => onJump(f.chunkId!)}
                className="flex min-h-11 w-full flex-col justify-center rounded-sm px-2 py-2 text-left hover:bg-surface-2"
              >
                <FindingBody finding={f} />
              </button>
            ) : (
              <div className="px-2 py-2">
                <FindingBody finding={f} />
              </div>
            )}
          </li>
        ))}
      </ul>

      {diag.hasQuery && diag.terms.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1">
          {diag.terms.map((t) => (
            <button
              key={t.term}
              type="button"
              disabled={!t.chunkId}
              onClick={() => t.chunkId && onJump(t.chunkId)}
              className={cn(
                "rounded-sm px-1.5 py-1 font-mono text-2xs",
                t.inTopK
                  ? "bg-ok/15 text-ok"
                  : t.chunkId
                    ? "bg-warn/15 text-warn"
                    : "bg-surface-2 text-subtle",
              )}
            >
              {t.term}
              {t.chunkId ? ` ${t.chunkId}` : " —"}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function FindingBody({ finding }: { finding: Finding }) {
  return (
    <>
      <p className={cn("text-sm font-medium", FINDING_TONE[finding.severity])}>
        {finding.title}
      </p>
      <p className="mt-0.5 text-xs leading-relaxed text-muted">{finding.detail}</p>
    </>
  );
}
