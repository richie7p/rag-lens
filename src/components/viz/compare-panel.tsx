import {
  compareNotes,
  hitLine,
  idsLine,
  settingsLine,
  type CompareSnap,
} from "@/lib/rag/compare";
import { formatInt } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AnswerText } from "./answer-text";

export function ComparePanel({
  snap,
  current,
  currentAnswer,
  answerFresh,
  onJumpAnswer,
  onUpdate,
  onClear,
}: {
  snap: CompareSnap;
  current: Omit<CompareSnap, "withRag" | "fingerprint">;
  currentAnswer: string | null;
  answerFresh: boolean;
  onJumpAnswer: () => void;
  onUpdate: () => void;
  onClear: () => void;
}) {
  const now: CompareSnap = {
    ...current,
    withRag: answerFresh ? currentAnswer : null,
    fingerprint: "",
  };
  const notes = compareNotes(snap, now);
  const sameSettings =
    snap.chunkSize === current.chunkSize &&
    snap.overlap === current.overlap &&
    snap.topK === current.topK &&
    snap.ranker === current.ranker &&
    snap.rerank === current.rerank;

  return (
    <section className="rounded-xl bg-surface p-4 hairline sm:p-5">
      <header className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="mb-1 font-mono text-2xs tracking-widest text-subtle uppercase">
            A / B
          </p>
          <h2 className="text-base font-medium text-fg">實驗對照</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone={sameSettings ? "muted" : "warn"}>
            {sameSettings ? "同一組設定" : "設定已變"}
          </Badge>
          <Button type="button" size="sm" variant="secondary" onClick={onUpdate}>
            更新對照
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onClear}>
            清除
          </Button>
        </div>
      </header>
      <p className="mb-3 text-xs text-muted">同一份文件與問題。先記住一組，再改切塊或 Top-K。</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-80 text-left text-sm">
          <thead>
            <tr className="font-mono text-2xs tracking-widest text-subtle uppercase">
              <th className="py-1 pr-3 font-medium">項目</th>
              <th className="py-1 pr-3 font-medium">對照 A</th>
              <th className="py-1 font-medium">目前</th>
            </tr>
          </thead>
          <tbody className="text-fg">
            <tr className="border-t border-border">
              <td className="py-2 pr-3 text-muted">設定</td>
              <td className="py-2 pr-3 font-mono text-xs">{settingsLine(snap)}</td>
              <td className="py-2 font-mono text-xs">{settingsLine(current)}</td>
            </tr>
            <tr className="border-t border-border">
              <td className="py-2 pr-3 text-muted">命中</td>
              <td className="py-2 pr-3 font-mono text-xs">
                {hitLine(snap.hitCount, snap.factCount, snap.poison)}
              </td>
              <td className="py-2 font-mono text-xs">
                {hitLine(current.hitCount, current.factCount, current.poison)}
              </td>
            </tr>
            <tr className="border-t border-border">
              <td className="py-2 pr-3 text-muted">上下文</td>
              <td className="py-2 pr-3 font-mono text-xs">
                {formatInt(snap.contextChars)}c · ~{formatInt(snap.contextTokensEst)} tok
              </td>
              <td className="py-2 font-mono text-xs">
                {formatInt(current.contextChars)}c · ~{formatInt(current.contextTokensEst)} tok
              </td>
            </tr>
            <tr className="border-t border-border">
              <td className="py-2 pr-3 text-muted">Top-K</td>
              <td className="py-2 pr-3 font-mono text-xs">{idsLine(snap.topIds)}</td>
              <td className="py-2 font-mono text-xs">{idsLine(current.topIds)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <ul className="mt-3 flex flex-col gap-1">
        {notes.map((n) => (
          <li key={n} className="text-xs leading-relaxed text-muted">
            {n}
          </li>
        ))}
      </ul>
      {snap.withRag || (answerFresh && currentAnswer) ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <div className="rounded-md bg-bg p-3">
            <p className="mb-2 font-mono text-2xs tracking-widest text-subtle uppercase">
              對照 A 回答
            </p>
            {snap.withRag ? (
              <AnswerText text={snap.withRag} />
            ) : (
              <p className="text-xs text-muted">當時還沒生成。</p>
            )}
          </div>
          <div className="rounded-md bg-bg p-3">
            <p className="mb-2 font-mono text-2xs tracking-widest text-subtle uppercase">
              目前回答
            </p>
            {answerFresh && currentAnswer ? (
              <AnswerText text={currentAnswer} />
            ) : (
              <p className="text-xs text-muted">生成目前這組之後才會出現在這裡。</p>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-3">
          <Button type="button" size="sm" variant="secondary" onClick={onJumpAnswer}>
            去生成目前這組
          </Button>
        </div>
      )}
    </section>
  );
}
