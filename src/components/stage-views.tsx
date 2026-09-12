import { useMemo, useState, type ReactNode } from "react";
import { Info } from "lucide-react";
import type { Diagnosis } from "@/lib/rag/diagnose";
import { diagnoseAnswer } from "@/lib/rag/diagnose";
import { groundAnswer, type GroundSpan } from "@/lib/rag/ground";
import { captureSnap } from "@/lib/rag/compare";
import { MMR_LAMBDA } from "@/lib/rag/mmr";
import type { PipelineResult, StageId } from "@/lib/rag/types";
import { MAX_DOCUMENT_CHARS } from "@/lib/rag/types";
import { SAMPLES } from "@/lib/rag/samples";
import { currentFingerprint, useRagStore } from "@/lib/store";
import { formatInt } from "@/lib/utils";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { ChunkCard } from "./chunk-card";
import { useGenerate } from "./use-generate";
import { DocumentOverlay } from "./viz/document-overlay";
import { Fingerprint } from "./viz/fingerprint";
import { OverlapTracks } from "./viz/overlap-tracks";
import { ScatterPlot } from "./viz/scatter-plot";
import { ScoreBars } from "./viz/score-bars";
import { HighlightedText } from "./viz/highlighted-text";
import { DiagnosisPanel } from "./viz/diagnosis-panel";
import { GroundedText } from "./viz/grounded-text";
import { AnswerText } from "./viz/answer-text";
import { ComparePanel } from "./viz/compare-panel";
import { EvidenceCard, evidenceFromSpan, type Evidence } from "./viz/evidence-card";

function Panel({
  title,
  kicker,
  extra,
  children,
}: {
  title: string;
  kicker?: string;
  extra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl bg-surface p-4 hairline sm:p-5">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          {kicker ? (
            <p className="mb-1 font-mono text-2xs tracking-widest text-subtle uppercase">
              {kicker}
            </p>
          ) : null}
          <h2 className="text-base font-medium text-fg">{title}</h2>
        </div>
        {extra}
      </header>
      {children}
    </section>
  );
}

function Note({ children }: { children: ReactNode }) {
  return (
    <p className="flex gap-2 text-xs leading-relaxed text-muted">
      <Info className="mt-0.5 size-3.5 shrink-0 text-subtle" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

function idsLine(ids: string[]) {
  return ids.join(" · ") || "—";
}

export function StageViews({
  stage,
  pipe,
  diag,
}: {
  stage: StageId;
  pipe: PipelineResult;
  diag: Diagnosis;
}) {
  const selectedId = useRagStore((s) => s.selectedChunkId);
  const selectChunk = useRagStore((s) => s.selectChunk);
  const setStage = useRagStore((s) => s.setStage);
  const query = useRagStore((s) => s.query);
  const retrievedIds = useMemo(
    () => new Set(pipe.topK.map((r) => r.chunk.id)),
    [pipe.topK],
  );

  function jump(id: string) {
    selectChunk(id);
    const inTop = retrievedIds.has(id);
    setStage(inTop ? "topk" : "search");
  }

  switch (stage) {
    case "document":
      return <DocumentStage pipe={pipe} retrievedIds={retrievedIds} />;
    case "chunking":
      return (
        <div className="flex flex-col gap-4">
          {diag.facts.some((f) => f.status === "split") ? (
            <DiagnosisPanel diag={diag} onJump={jump} />
          ) : null}
          <ChunkingStage
            pipe={pipe}
            selectedId={selectedId}
            retrievedIds={retrievedIds}
            onSelect={selectChunk}
            query={query}
          />
        </div>
      );
    case "embedding":
      return (
        <EmbeddingStage
          pipe={pipe}
          selectedId={selectedId}
          retrievedIds={retrievedIds}
          onSelect={selectChunk}
        />
      );
    case "search":
      return (
        <div className="flex flex-col gap-4">
          <CompareStrip pipe={pipe} diag={diag} />
          <DiagnosisPanel diag={diag} onJump={jump} />
          <SearchStage pipe={pipe} selectedId={selectedId} onSelect={selectChunk} />
        </div>
      );
    case "topk":
      return (
        <div className="flex flex-col gap-4">
          <DiagnosisPanel diag={diag} onJump={jump} />
          <TopKStage
            pipe={pipe}
            selectedId={selectedId}
            onSelect={selectChunk}
            query={query}
          />
        </div>
      );
    case "context":
      return <ContextStage pipe={pipe} />;
    case "llm":
      return <LlmStage pipe={pipe} />;
    case "answer":
      return <AnswerStage pipe={pipe} diag={diag} onJump={jump} />;
    default:
      return null;
  }
}

function CompareStrip({ pipe, diag }: { pipe: PipelineResult; diag: Diagnosis }) {
  const compare = useRagStore((s) => s.compare);
  const pinCompare = useRagStore((s) => s.pinCompare);
  const clearCompare = useRagStore((s) => s.clearCompare);
  const setStage = useRagStore((s) => s.setStage);
  const chunkSize = useRagStore((s) => s.chunkSize);
  const overlap = useRagStore((s) => s.overlap);
  const topK = useRagStore((s) => s.topK);
  const ranker = useRagStore((s) => s.ranker);
  const rerank = useRagStore((s) => s.rerank);
  const query = useRagStore((s) => s.query);
  const document = useRagStore((s) => s.document);
  const gen = useRagStore((s) => s.gen);
  if (!compare) return null;
  const fp = currentFingerprint({
    document,
    chunkSize,
    overlap,
    topK,
    query,
    ranker,
    rerank,
  });
  const stale = gen.fingerprint != null && gen.fingerprint !== fp;
  return (
    <ComparePanel
      snap={compare}
      current={{
        chunkSize,
        overlap,
        topK,
        ranker,
        rerank,
        hitCount: diag.hitCount,
        factCount: diag.factCount,
        poison: diag.poison,
        contextChars: pipe.contextChars,
        contextTokensEst: pipe.contextTokensEst,
        topIds: pipe.topK.map((r) => r.chunk.id),
      }}
      currentAnswer={gen.withRag}
      answerFresh={!stale && Boolean(gen.withRag)}
      onJumpAnswer={() => setStage("answer")}
      onUpdate={() =>
        pinCompare(
          captureSnap(pipe, diag, {
            chunkSize,
            overlap,
            topK,
            ranker,
            rerank,
            fingerprint: fp,
            withRag: gen.withRag,
            answerFresh: !stale && Boolean(gen.withRag),
          }),
        )
      }
      onClear={clearCompare}
    />
  );
}

function DocumentStage({
  pipe,
  retrievedIds,
}: {
  pipe: PipelineResult;
  retrievedIds: Set<string>;
}) {
  const document = useRagStore((s) => s.document);
  const sampleId = useRagStore((s) => s.sampleId);
  const setDocument = useRagStore((s) => s.setDocument);
  const loadSample = useRagStore((s) => s.loadSample);
  const selectedId = useRagStore((s) => s.selectedChunkId);
  const selectChunk = useRagStore((s) => s.selectChunk);
  const setStage = useRagStore((s) => s.setStage);

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="lg:col-span-3">
        <Panel
          kicker="01 · Document"
          title="貼上要檢索的文件"
          extra={
            <span className="font-mono text-xs tabular-nums text-muted">
              {formatInt(document.length)} / {formatInt(MAX_DOCUMENT_CHARS)}
            </span>
          }
        >
          <textarea
            value={document}
            onChange={(e) => setDocument(e.target.value)}
            spellCheck={false}
            className="min-h-64 w-full resize-y rounded-md bg-bg p-3 font-mono text-sm leading-relaxed text-fg hairline outline-none focus:hairline-accent"
            placeholder="貼上文章、說明書、內部筆記…"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {SAMPLES.map((s) => (
              <Button
                key={s.id}
                type="button"
                size="sm"
                variant={sampleId === s.id ? "primary" : "secondary"}
                onClick={() => loadSample(s.id)}
              >
                {s.title}
              </Button>
            ))}
          </div>
        </Panel>
      </div>
      <div className="flex flex-col gap-4 lg:col-span-2">
        <Panel kicker="覆蓋" title="切塊落在原文哪裡">
          <OverlapTracks
            chunks={pipe.chunks}
            textLength={pipe.document.length}
            selectedId={selectedId}
            retrievedIds={retrievedIds}
            onSelect={(id) => {
              selectChunk(id);
              setStage("chunking");
            }}
          />
          <div className="mt-4 max-h-80 overflow-auto rounded-md bg-bg p-3">
            <DocumentOverlay
              text={pipe.document}
              chunks={pipe.chunks}
              selectedId={selectedId}
              retrievedIds={retrievedIds}
              onSelect={selectChunk}
            />
          </div>
          <div className="mt-3">
            <Note>
              選中片段以鋼青底色標出；若已檢索，Top-K 會更亮。重疊區表示 overlap 讓相鄰切塊共用文字。
            </Note>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function ChunkingStage({
  pipe,
  selectedId,
  retrievedIds,
  onSelect,
  query,
}: {
  pipe: PipelineResult;
  selectedId: string | null;
  retrievedIds: Set<string>;
  onSelect: (id: string) => void;
  query: string;
}) {
  const visible = pipe.chunks.slice(0, 24);
  const extra = pipe.chunks.length - visible.length;
  return (
    <div className="flex flex-col gap-4">
      <Panel
        kicker="02 · Chunking"
        title={`${pipe.chunks.length} 個切塊`}
        extra={<Badge tone="warn">字元視窗 · 句界微調 · 估算</Badge>}
      >
        <OverlapTracks
          chunks={pipe.chunks}
          textLength={pipe.document.length}
          selectedId={selectedId}
          retrievedIds={retrievedIds}
          onSelect={onSelect}
        />
        <div className="mt-3">
          <Note>
            拖動 chunk size 與 overlap，切塊立刻重算。較小的塊較容易命中單一事實，但可能切破句子；overlap 用來保住跨塊句子。
          </Note>
        </div>
      </Panel>
      <div className="grid gap-3 md:grid-cols-2">
        {visible.map((c) => (
          <ChunkCard
            key={c.id}
            chunk={c}
            query={query}
            selected={selectedId === c.id}
            onSelect={onSelect}
          />
        ))}
      </div>
      {extra > 0 ? (
        <p className="text-xs text-muted">其餘 {extra} 個切塊可在時間軸上點選。</p>
      ) : null}
    </div>
  );
}

function EmbeddingStage({
  pipe,
  selectedId,
  retrievedIds,
  onSelect,
}: {
  pipe: PipelineResult;
  selectedId: string | null;
  retrievedIds: Set<string>;
  onSelect: (id: string) => void;
}) {
  const selected =
    pipe.vectors.find((v) => v.id === selectedId) ?? pipe.vectors[0];
  const querySketch = pipe.queryVector?.sketch;

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="lg:col-span-3">
        <Panel
          kicker="03 · Embedding"
          title="簡化向量空間"
          extra={<Badge tone="warn">32 維雜湊草圖 · PCA 投影 · 估算</Badge>}
        >
          <div className="overflow-hidden rounded-md">
            <ScatterPlot
              points={pipe.points}
              selectedId={selectedId}
              retrievedIds={retrievedIds}
              onSelect={onSelect}
            />
          </div>
          <div className="mt-3">
            <Note>
              真正排序用的是 TF-IDF 餘弦相似度，不是神經網路 embedding。圖上每個點是切塊草圖投影到 2D，用來觀察誰離問題比較近。
            </Note>
          </div>
        </Panel>
      </div>
      <div className="lg:col-span-2">
        <Panel
          kicker="指紋"
          title={selected ? selected.id : "選擇一個切塊"}
          extra={<Badge tone="muted">詞彙 {formatInt(pipe.vocabSize)}</Badge>}
        >
          {selected ? (
            <>
              <p className="mb-2 text-xs text-muted">
                鋼青為切塊，灰底為問題向量（若已輸入）。
              </p>
              <Fingerprint sketch={selected.sketch} compare={querySketch} />
              <ul className="mt-4 max-h-72 space-y-1 overflow-auto">
                {pipe.vectors.map((v) => (
                  <li key={v.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(v.id)}
                      className={`flex w-full items-center gap-3 rounded-sm px-2 py-2 text-left ${
                        selectedId === v.id ? "bg-accent/10" : "hover:bg-surface-2"
                      }`}
                    >
                      <span className="w-8 font-mono text-xs text-subtle">{v.id}</span>
                      <Fingerprint sketch={v.sketch} compact className="flex-1" />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-sm text-muted">文件為空時沒有向量。</p>
          )}
        </Panel>
      </div>
    </div>
  );
}

function CompareRow({
  label,
  ids,
  same,
  active,
}: {
  label: string;
  ids: string;
  same?: boolean;
  active?: boolean;
}) {
  return (
    <p className={active ? "text-fg" : same === false ? "text-warn" : "text-muted"}>
      <span className="inline-block w-16 text-subtle">{label}</span>
      {ids}
      {same == null ? null : same ? " · 相同" : " · 不同"}
    </p>
  );
}

function SearchStage({
  pipe,
  selectedId,
  onSelect,
}: {
  pipe: PipelineResult;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (!pipe.queryVector) {
    return (
      <Panel kicker="04 · Vector Search" title="先在下方輸入問題">
        <Note>檢索會對每個切塊算 TF-IDF 餘弦或 BM25（估算）並排序。沒有問題就沒有搜尋。</Note>
      </Panel>
    );
  }
  const activeLabel = pipe.ranker === "bm25" ? "BM25" : "TF-IDF";
  const altLabel = pipe.ranker === "bm25" ? "TF-IDF" : "BM25";
  const greedyIds = idsLine(pipe.greedyTopIds);
  const mmrIds = idsLine(pipe.mmrTopIds);
  const altIds = idsLine(pipe.altTopIds);
  const rankSame = greedyIds === altIds;
  const mmrSame = greedyIds === mmrIds;
  const selectedIds = new Set(pipe.topK.map((r) => r.chunk.id));

  return (
    <Panel
      kicker="04 · Vector Search"
      title="全部切塊的相似度"
      extra={
        <Badge tone="warn">
          {activeLabel}
          {pipe.rerank === "mmr" ? " · MMR" : ""} · 估算
        </Badge>
      }
    >
      <Note>
        鋼青長條是目前實際取回的 Top-K。Greedy 取分數最高的 K 塊；MMR 會扣掉與已選塊太像的候選（λ {MMR_LAMBDA} 估算）。
      </Note>
      <div className="mt-3 grid gap-2 rounded-md bg-bg px-3 py-2 font-mono text-xs sm:grid-cols-2">
        <div>
          <CompareRow label={activeLabel} ids={greedyIds} active />
          <CompareRow label={altLabel} ids={altIds} same={rankSame} />
        </div>
        <div>
          <CompareRow
            label="Greedy"
            ids={greedyIds}
            active={pipe.rerank === "greedy"}
          />
          <CompareRow
            label="MMR"
            ids={mmrIds}
            active={pipe.rerank === "mmr"}
            same={mmrSame}
          />
        </div>
      </div>
      <div className="mt-4">
        <ScoreBars
          ranked={pipe.ranked}
          selectedId={selectedId}
          selectedIds={selectedIds}
          onSelect={onSelect}
        />
      </div>
    </Panel>
  );
}

function TopKStage({
  pipe,
  selectedId,
  onSelect,
  query,
}: {
  pipe: PipelineResult;
  selectedId: string | null;
  onSelect: (id: string) => void;
  query: string;
}) {
  if (!pipe.queryVector) {
    return (
      <Panel kicker="05 · Top-K" title="還沒有檢索結果">
        <Note>輸入問題後，這裡會列出分數最高的 K 個切塊，並標出與問題重疊的詞。</Note>
      </Panel>
    );
  }
  if (pipe.topK.length === 0) {
    return (
      <Panel kicker="05 · Top-K" title="沒有可取回的切塊">
        <Note>文件是空的，或切塊數為 0。</Note>
      </Panel>
    );
  }
  const mmrOn = pipe.rerank === "mmr";
  return (
    <div className="flex flex-col gap-4">
      <Panel
        kicker="05 · Top-K Retrieval"
        title={`取回 ${pipe.topK.length} / ${pipe.chunks.length} 個切塊`}
      >
        <Note>
          高亮是與問題重疊的詞（字元／詞項匹配，估算）。改 top-k 會增減送給模型的上下文，不重新切塊。
          {mmrOn ? " 編號是 MMR 取回順序；greedy # 是原本名次。" : ""}
        </Note>
      </Panel>
      <div className="grid gap-3 lg:grid-cols-2">
        {pipe.topK.map((r) => (
          <ChunkCard
            key={r.chunk.id}
            chunk={r.chunk}
            query={query}
            selected={selectedId === r.chunk.id}
            rank={r.pick || r.rank}
            similarity={r.similarity}
            matches={r.matches}
            note={mmrOn && r.rank !== r.pick ? `greedy #${r.rank}` : undefined}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}

function ContextStage({ pipe }: { pipe: PipelineResult }) {
  const query = useRagStore((s) => s.query);
  if (!pipe.context) {
    return (
      <Panel kicker="06 · Context" title="還沒組裝上下文">
        <Note>
          有檢索結果之後，這裡會顯示真正會拼進提示的文字，包含來源編號與相似度。
        </Note>
      </Panel>
    );
  }
  return (
    <Panel
      kicker="06 · Context"
      title="送給模型的檢索上下文"
      extra={
        <Badge tone="warn">
          {formatInt(pipe.contextChars)} chars · ~{formatInt(pipe.contextTokensEst)} tok
          估算
        </Badge>
      }
    >
      <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-md bg-bg p-4 font-mono text-xs leading-relaxed text-fg">
        {pipe.context}
      </pre>
      <div className="mt-3">
        <Note>
          模型看不到整份文件，只看得到這些片段。切塊切壞或 top-k 太小，答案就會缺條件。
        </Note>
      </div>
      {query ? (
        <div className="mt-4 rounded-md bg-surface-2 p-3">
          <p className="mb-1 font-mono text-2xs tracking-widest text-subtle uppercase">
            Query
          </p>
          <HighlightedText text={query} query={query} />
        </div>
      ) : null}
    </Panel>
  );
}

function LlmStage({ pipe }: { pipe: PipelineResult }) {
  const query = useRagStore((s) => s.query);
  const prompt = `系統：只能根據檢索上下文作答。找不到就說找不到。\n\n檢索上下文：\n\n${pipe.context || "（空）"}\n\n---\n問題：${query || "（尚未輸入）"}`;
  return (
    <Panel
      kicker="07 · LLM"
      title="即將送出的提示"
      extra={<Badge tone="muted">grok-4.5 · max 360 tok</Badge>}
    >
      <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-md bg-bg p-4 font-mono text-xs leading-relaxed text-fg">
        {prompt}
      </pre>
      <div className="mt-3">
        <Note>
          「生成回答」只跑有 RAG 的一側；「對照無 RAG」會再多打一次不含上下文的請求。都由你主動觸發，不會在載入時呼叫模型。
        </Note>
      </div>
    </Panel>
  );
}

function AnswerStage({
  pipe,
  diag,
  onJump,
}: {
  pipe: PipelineResult;
  diag: Diagnosis;
  onJump: (id: string) => void;
}) {
  const gen = useRagStore((s) => s.gen);
  const selectChunk = useRagStore((s) => s.selectChunk);
  const setStage = useRagStore((s) => s.setStage);
  const { retry, stale } = useGenerate(pipe);
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const spans = useMemo(
    () => (gen.withRag ? groundAnswer(gen.withRag, pipe.topK) : []),
    [gen.withRag, pipe.topK],
  );
  const answerFindings = useMemo(
    () => (gen.withRag ? diagnoseAnswer(gen.withRag, diag) : []),
    [gen.withRag, diag],
  );

  function openSpan(span: GroundSpan) {
    const hit = pipe.topK.find((r) => r.chunk.id === span.chunkId);
    const ev = evidenceFromSpan(span, hit?.chunk.start ?? 0, hit?.chunk.end ?? 0);
    if (ev) {
      setEvidence(ev);
      selectChunk(ev.chunkId);
    }
  }

  function cite(n: number) {
    const hit = pipe.topK[n - 1];
    if (!hit) return;
    const span =
      spans.find((s) => s.pick === n) ??
      spans.find((s) => s.chunkId === hit.chunk.id && s.factual) ??
      spans.find((s) => s.text.includes(`#${n}`));
    if (span) {
      openSpan(span);
      return;
    }
    selectChunk(hit.chunk.id);
    setEvidence({
      chunkId: hit.chunk.id,
      pick: hit.pick || n,
      start: hit.chunk.start,
      end: hit.chunk.end,
      quote: hit.chunk.text.trim().slice(0, 280),
      sentence: "",
      reason: `引用 #${n} 對應 ${hit.chunk.id}（字元 ${hit.chunk.start}–${hit.chunk.end}）`,
      coverage: hit.similarity,
      support: "strong",
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <CompareStrip pipe={pipe} diag={diag} />
      <DiagnosisPanel diag={diag} onJump={onJump} />
      {answerFindings.length > 0 ? (
        <div className="rounded-lg bg-warn/10 px-4 py-3 text-sm text-warn">
          {answerFindings[0]!.title}
          <span className="mt-1 block text-xs text-muted">{answerFindings[0]!.detail}</span>
        </div>
      ) : null}
      {stale && gen.withRag ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-warn/10 px-4 py-3 text-sm text-warn">
          <p>切塊、排序器或問題已改變，底下是舊回答。重新生成才會對上目前 Top-K。</p>
          <Button type="button" size="sm" onClick={() => void retry()}>
            重新生成
          </Button>
        </div>
      ) : null}
      {gen.error ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger">
          <p>{gen.error}</p>
          <Button type="button" size="sm" variant="secondary" onClick={() => void retry()}>
            重試
          </Button>
        </div>
      ) : null}
      {gen.pending ? (
        <p className="font-mono text-2xs text-accent">
          生成中 · 正在根據 Top-{pipe.topK.length} 上下文呼叫 grok-4.5
        </p>
      ) : null}
      {evidence ? (
        <EvidenceCard
          evidence={evidence}
          onClose={() => setEvidence(null)}
          onShowChunk={() => {
            selectChunk(evidence.chunkId);
            setStage("topk");
          }}
          onShowDoc={() => {
            selectChunk(evidence.chunkId);
            setStage("document");
          }}
        />
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <AnswerColumn
          title="Without RAG"
          kicker="只用問題"
          body={gen.withoutRag}
          pending={gen.pending && gen.mode === "both" && !gen.withoutRag}
          empty="按「對照無 RAG」會讓模型在沒有這份文件的情況下作答。虛構公司通常會答錯或承認不知道。"
        />
        <AnswerColumn
          title="With RAG"
          kicker={`Top-${pipe.topK.length} 上下文`}
          body={gen.withRag}
          pending={gen.pending && !gen.withRag}
          empty="按「生成回答」，模型會只根據取回的切塊作答。"
          citeMax={pipe.topK.length}
          onCite={cite}
          spans={spans}
          onOpen={openSpan}
          faded={stale}
        />
      </div>
    </div>
  );
}

function AnswerColumn({
  title,
  kicker,
  body,
  pending,
  empty,
  citeMax,
  onCite,
  spans,
  onOpen,
  faded,
}: {
  title: string;
  kicker: string;
  body: string | null;
  pending: boolean;
  empty: string;
  citeMax?: number;
  onCite?: (n: number) => void;
  spans?: GroundSpan[];
  onOpen?: (span: GroundSpan) => void;
  faded?: boolean;
}) {
  return (
    <section className="rounded-xl bg-surface p-4 hairline sm:p-5">
      <header className="mb-3">
        <p className="font-mono text-2xs tracking-widest text-subtle uppercase">
          {kicker}
        </p>
        <h2 className="text-base font-medium text-fg">{title}</h2>
      </header>
      {pending ? (
        <div>
          <p className="mb-2 text-xs text-muted">生成中…</p>
          <div className="h-32 rounded-md bg-surface-2 shimmer" />
        </div>
      ) : body && spans && spans.length > 0 && citeMax && onCite && onOpen ? (
        <div className={faded ? "opacity-60" : undefined}>
          <GroundedText spans={spans} maxCite={citeMax} onCite={onCite} onOpen={onOpen} />
          <p className="mt-3 text-xs text-subtle">
            點 #1 或「有依據」會打開來源定位：切塊、原文位置、支持該句的文字。有依據是數字極性一致，不是語意保證。估算。
          </p>
        </div>
      ) : body && citeMax && onCite ? (
        <div className={faded ? "opacity-60" : undefined}>
          <AnswerText text={body} max={citeMax} onCite={onCite} />
          <p className="mt-3 text-xs text-subtle">點 #1 #2 打開來源定位。</p>
        </div>
      ) : body ? (
        <div className={faded ? "opacity-60" : undefined}>
          <AnswerText text={body} />
        </div>
      ) : (
        <p className="text-sm leading-relaxed text-muted">{empty}</p>
      )}
    </section>
  );
}
