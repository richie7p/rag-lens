import { DISTRACTOR_MARK } from "./experiments";
import { factsForDocument, type GoldFact } from "./samples";
import { looksLikeRefusal } from "./ground";
import type { PipelineResult } from "./types";

export type FactStatus = "hit" | "miss" | "split" | "absent";

export type FactCover = {
  id: string;
  label: string;
  needles: string[];
  mentions?: string[];
  status: FactStatus;
  chunkId: string | null;
  rank: number | null;
};

export type TermCover = {
  term: string;
  chunkId: string | null;
  rank: number | null;
  inTopK: boolean;
};

export type Finding = {
  severity: "ok" | "info" | "warn" | "bad";
  title: string;
  detail: string;
  chunkId?: string;
};

export type Diagnosis = {
  facts: FactCover[];
  findings: Finding[];
  terms: TermCover[];
  hitCount: number;
  factCount: number;
  poison: boolean;
  hasQuery: boolean;
};

function containsNeedle(text: string, needle: string) {
  return text.toLowerCase().includes(needle.toLowerCase());
}

function spanOverlap(
  a: { start: number; end: number },
  b: { start: number; end: number },
) {
  const s = Math.max(a.start, b.start);
  const e = Math.min(a.end, b.end);
  const ov = Math.max(0, e - s);
  const shorter = Math.min(a.end - a.start, b.end - b.start) || 1;
  return ov / shorter;
}

function coverFact(
  fact: GoldFact,
  pipe: PipelineResult,
  topIds: Set<string>,
): FactCover {
  const rankOf = new Map(pipe.ranked.map((r) => [r.chunk.id, r.rank]));
  const intact: string[] = [];
  const partial: string[] = [];
  for (const c of pipe.chunks) {
    const hits = fact.needles.filter((n) => containsNeedle(c.text, n));
    if (hits.length === fact.needles.length) intact.push(c.id);
    else if (hits.length > 0) partial.push(c.id);
  }
  const bestIntact = intact
    .map((id) => ({ id, rank: rankOf.get(id) ?? 999 }))
    .sort((a, b) => a.rank - b.rank)[0];
  const bestPartial = partial
    .map((id) => ({ id, rank: rankOf.get(id) ?? 999 }))
    .sort((a, b) => a.rank - b.rank)[0];

  if (bestIntact && (topIds.has(bestIntact.id) || !pipe.queryVector)) {
    return {
      ...fact,
      status: "hit",
      chunkId: bestIntact.id,
      rank: bestIntact.rank,
    };
  }
  if (bestIntact) {
    return {
      ...fact,
      status: "miss",
      chunkId: bestIntact.id,
      rank: bestIntact.rank,
    };
  }
  if (bestPartial) {
    return {
      ...fact,
      status: "split",
      chunkId: bestPartial.id,
      rank: bestPartial.rank,
    };
  }
  return { ...fact, status: "absent", chunkId: null, rank: null };
}

export function diagnose(pipe: PipelineResult, sampleId: string): Diagnosis {
  const factsSrc = factsForDocument(pipe.document, sampleId);
  const topIds = new Set(pipe.topK.map((r) => r.chunk.id));
  const facts = factsSrc.map((f) => coverFact(f, pipe, topIds));

  const terms: TermCover[] = [];
  const seen = new Set<string>();
  const stopish = /[的了在是與及和或並而也就都被把為於對從等其此該嗎呢吧啊]/;
  for (const t of pipe.queryTokens) {
    if (t.length < 2 || seen.has(t)) continue;
    if (t.length === 2 && stopish.test(t)) continue;
    seen.add(t);
    let bestId: string | null = null;
    let bestRank = Infinity;
    for (const r of pipe.ranked) {
      if (r.vector.tokens.includes(t) && r.rank < bestRank) {
        bestRank = r.rank;
        bestId = r.chunk.id;
      }
    }
    if (!bestId) continue;
    terms.push({
      term: t,
      chunkId: bestId,
      rank: bestRank,
      inTopK: topIds.has(bestId),
    });
    if (terms.length >= 10) break;
  }

  const findings: Finding[] = [];
  const poisonChunk = pipe.ranked.find((r) =>
    r.chunk.text.includes(DISTRACTOR_MARK),
  );
  const poison = Boolean(poisonChunk && topIds.has(poisonChunk.chunk.id));

  if (!pipe.queryVector) {
    const splits = facts.filter((f) => f.status === "split");
    if (splits.length) {
      for (const f of splits) {
        findings.push({
          severity: "bad",
          title: `${f.label} 被切碎`,
          detail: "關鍵數字與描述落在不同切塊。加大 Size 或 Overlap，讓它們留在同一塊。",
          chunkId: f.chunkId ?? undefined,
        });
      }
    } else {
      findings.push({
        severity: "info",
        title: "輸入問題後才會診斷檢索",
        detail: "這裡會標出事實有沒有被取回、切塊有沒有被切碎、干擾段有沒有擠進 Top-K。",
      });
    }
  } else {
    if (poison && poisonChunk) {
      findings.push({
        severity: "bad",
        title: "干擾段進入 Top-K",
        detail: `${poisonChunk.chunk.id} 含錯誤更正，卻排到 #${poisonChunk.rank}。換排序器或開 MMR 看它會不會被擠出去。`,
        chunkId: poisonChunk.chunk.id,
      });
    }

    for (const f of facts) {
      if (f.status === "miss") {
        findings.push({
          severity: "warn",
          title: `${f.label} 在 K 外`,
          detail: f.chunkId
            ? `完整句子在 ${f.chunkId}（貪婪 #${f.rank}），沒進目前 Top-K。加大 K、改切塊，或開 MMR。`
            : "完整句子在文件裡，但沒被取回。",
          chunkId: f.chunkId ?? undefined,
        });
      } else if (f.status === "split") {
        findings.push({
          severity: "bad",
          title: `${f.label} 被切碎`,
          detail: "沒有任何一塊同時含完整事實。加大 chunk size 或加 overlap。",
          chunkId: f.chunkId ?? undefined,
        });
      }
    }

    let worst: { a: string; b: string; ov: number } | null = null;
    const topChunks = pipe.topK.map((r) => r.chunk);
    for (let i = 0; i < topChunks.length; i++) {
      for (let j = i + 1; j < topChunks.length; j++) {
        const ov = spanOverlap(topChunks[i]!, topChunks[j]!);
        if (!worst || ov > worst.ov) {
          worst = { a: topChunks[i]!.id, b: topChunks[j]!.id, ov };
        }
      }
    }
    if (worst && worst.ov >= 0.28) {
      findings.push({
        severity: "warn",
        title: "Top-K 有重疊塊",
        detail: `${worst.a} 與 ${worst.b} 重疊約 ${Math.round(worst.ov * 100)}%。Greedy 常因 overlap 連取相鄰段；MMR 會扣掉太像的候選。`,
        chunkId: worst.a,
      });
    }

    if (pipe.rerank === "mmr") {
      const greedy = pipe.greedyTopIds.join("|");
      const mmr = pipe.mmrTopIds.join("|");
      if (greedy !== mmr) {
        const dropped = pipe.greedyTopIds.filter((id) => !pipe.mmrTopIds.includes(id));
        const added = pipe.mmrTopIds.filter((id) => !pipe.greedyTopIds.includes(id));
        findings.push({
          severity: "info",
          title: "MMR 換了一批切塊",
          detail: `拿掉 ${dropped.join(" · ") || "—"}，補上 ${added.join(" · ") || "—"}。λ 0.72 估算。`,
          chunkId: added[0],
        });
      } else if (pipe.topK.length <= 1) {
        findings.push({
          severity: "info",
          title: "K=1 時 MMR 等於 Greedy",
          detail: "多樣性重排至少需要取回兩塊才有差。",
        });
      }
    }

    const hits = facts.filter((f) => f.status === "hit");
    const hitChunkIds = new Set(hits.map((f) => f.chunkId));
    if (pipe.topK.length === 1 && hits.length >= 2 && hitChunkIds.size === 1) {
      findings.push({
        severity: "info",
        title: "兩件事實黏在同一塊",
        detail: `K=1 取到 ${pipe.topK[0]!.chunk.id}，裡面同時有 ${hits.map((f) => f.label).join("、")}。把 Size 調小，它們會拆到不同塊，K=1 就會漏。`,
        chunkId: pipe.topK[0]!.chunk.id,
      });
    }

    if (findings.length === 0 && facts.length > 0 && facts.every((f) => f.status === "hit")) {
      findings.push({
        severity: "ok",
        title: "關鍵事實都在 Top-K",
        detail: "以示範文件的波長與失效模式來看，目前這組切塊／K／排序器有取到完整句子。",
      });
    } else if (findings.length === 0 && pipe.topK.length > 0) {
      findings.push({
        severity: "ok",
        title: "已取回切塊",
        detail: "這份文件沒有內建金標事實。用下方詞項看問題詞有沒有進 Top-K。",
      });
    }
  }

  return {
    facts,
    findings,
    terms,
    hitCount: facts.filter((f) => f.status === "hit").length,
    factCount: facts.length,
    poison,
    hasQuery: Boolean(pipe.queryVector),
  };
}

export function diagnoseAnswer(answer: string, diag: Diagnosis): Finding[] {
  if (!answer.trim()) return [];
  const hits = diag.facts.filter((f) => f.status === "hit");
  if (looksLikeRefusal(answer) && hits.length > 0) {
    return [
      {
        severity: "warn",
        title: "模型說找不到，但 Top-K 有事實",
        detail: `上下文已含 ${hits.map((f) => f.label).join("、")}。可能是提示過嚴，或事實埋在切塊邊角。`,
        chunkId: hits[0]?.chunkId ?? undefined,
      },
    ];
  }
  const missing = hits.filter((f) => {
    const keys = f.mentions?.length ? f.mentions : f.needles;
    return !keys.some((n) => answer.toLowerCase().includes(n.toLowerCase()));
  });
  if (missing.length && hits.length) {
    return [
      {
        severity: "warn",
        title: "回答漏了已取回的事實",
        detail: `Top-K 有 ${missing.map((f) => f.label).join("、")}，但回答沒寫出來。`,
        chunkId: missing[0]?.chunkId ?? undefined,
      },
    ];
  }
  return [];
}

export function searchMeta(diag: Diagnosis, scored: number, idle: boolean): string {
  if (idle) return "idle";
  if (diag.poison) return "干擾";
  if (diag.factCount) {
    const split = diag.facts.some((f) => f.status === "split");
    if (split) return `${diag.hitCount}/${diag.factCount} 切碎`;
    return `${diag.hitCount}/${diag.factCount}${
      diag.hitCount === diag.factCount ? " 命中" : " 漏"
    }`;
  }
  return `${scored} scored`;
}
