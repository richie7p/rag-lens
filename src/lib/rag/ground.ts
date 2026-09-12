import { tokenize } from "./tokenize";
import type { RankedChunk } from "./types";

export type Support = "strong" | "weak" | "conflict" | "none" | "skip";

export type GroundSpan = {
  text: string;
  support: Support;
  factual: boolean;
  chunkId: string | null;
  pick: number | null;
  coverage: number;
  quote: string | null;
  docStart: number | null;
  docEnd: number | null;
  reason: string;
};

export type NumberClaim = {
  raw: string;
  index: number;
  polarity: "pos" | "neg";
};

const NEG_RE =
  /不是|並非|並不是|而非|不再是|不再為|忽略(?:先前)?|不要(?:用|當|把)?|not\s+(?:the\s+)?|no\s+longer|isn['’]t|is\s+not|rather\s+than/i;

export function looksLikeRefusal(text: string) {
  return /不知道|找不到|沒有[足夠所]?[資訊答案]|無法從|無法判斷|cannot find|don't know|do not know|no information|not (?:in|enough)|i['’]m unable/i.test(
    text,
  );
}

export function splitSentences(text: string): string[] {
  const raw = text
    .split(/(?<=[。！？!?])\s*|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const out: string[] = [];
  for (const s of raw) {
    const last = out[out.length - 1];
    const loneCite = /^[#＃(（【[]?\s*#?\d+[)）】\]]?\.?$/.test(s);
    if (last && s.length < 8 && !loneCite) out[out.length - 1] = last + s;
    else out.push(s);
  }
  return out;
}

/** Openers, headings, and lone citation markers are not scored as 無依據. */
export function isFactualSentence(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  const noMd = trimmed.replace(/^#{1,6}\s+/, "").replace(/\*\*/g, "").trim();
  if (/^#{1,6}\s/.test(trimmed) && noMd.length < 28) return false;
  const onlyCite = trimmed
    .replace(/[#＃［\[\]］()（）\s,，、。．.：:來源參考注釋see\sref]/gi, "")
    .replace(/\d+/g, "");
  if (!onlyCite && /#\s*\d/.test(trimmed)) return false;
  if (/^(來源|參考|注)[:：]?\s*#?\d+\s*$/i.test(noMd)) return false;
  if (
    /^(根據(檢索|提供|上下文|以上|文件)?|依據(檢索)?上下文|綜上|如下|以下(為|是)?(回答|答案)?|答(案)?[:：]|according to|based on)/i.test(
      noMd,
    )
  ) {
    if (noMd.length < 28) return false;
    if (noMd.length < 64 && !/\d/.test(noMd)) return false;
  }
  const compact = noMd.replace(/\s+/g, "");
  if (compact.length < 10 && !/\d/.test(compact)) return false;
  return true;
}

export function polarityAt(text: string, index: number): "pos" | "neg" {
  const raw = text.slice(Math.max(0, index - 18), index);
  const clause = raw.split(/[。！？!?；;,，]/).pop() ?? raw;
  return NEG_RE.test(clause.slice(-12)) ? "neg" : "pos";
}

export function extractNumbers(text: string): NumberClaim[] {
  const out: NumberClaim[] = [];
  const re = /\d+(?:\.\d+)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m[0].length < 2) continue;
    out.push({
      raw: m[0],
      index: m.index,
      polarity: polarityAt(text, m.index),
    });
  }
  return out;
}

function tokenCoverage(sentTokens: string[], chunkTokens: Set<string>): number {
  const uniq = [...new Set(sentTokens.filter((t) => t.length >= 2))];
  if (uniq.length === 0) return 0;
  let n = 0;
  for (const t of uniq) if (chunkTokens.has(t)) n += 1;
  return n / uniq.length;
}

function excerpt(
  chunkText: string,
  chunkStart: number,
  needles: string[],
): { quote: string; docStart: number; docEnd: number } {
  let idx = 0;
  let needle = needles[0] ?? "";
  for (const n of needles) {
    const i = chunkText.toLowerCase().indexOf(n.toLowerCase());
    if (i >= 0) {
      idx = i;
      needle = n;
      break;
    }
  }
  const from = Math.max(0, idx - 28);
  const to = Math.min(chunkText.length, idx + Math.max(needle.length, 1) + 72);
  let quote = chunkText.slice(from, to).trim();
  if (from > 0) quote = "…" + quote;
  if (to < chunkText.length) quote = quote + "…";
  return {
    quote,
    docStart: chunkStart + from,
    docEnd: chunkStart + to,
  };
}

function conflictReason(answer: NumberClaim, chunk: NumberClaim): string {
  if (answer.polarity === "pos" && chunk.polarity === "neg") {
    return `回答寫 ${answer.raw}，來源寫「不是 ${chunk.raw}」。詞彙重疊但極性相反。`;
  }
  if (answer.polarity === "neg" && chunk.polarity === "pos") {
    return `回答否定 ${answer.raw}，來源卻當成正面陳述。`;
  }
  return `同一數字 ${answer.raw} 的肯定／否定不一致。`;
}

/** Lexical overlap + polarity check against retrieved chunks. 估算. */
export function groundAnswer(answer: string, topK: RankedChunk[]): GroundSpan[] {
  if (!answer.trim()) return [];
  const sentences = splitSentences(answer);
  const chunkTok = topK.map((r) => ({
    id: r.chunk.id,
    pick: r.pick,
    text: r.chunk.text,
    start: r.chunk.start,
    end: r.chunk.end,
    tokens: new Set(r.vector.tokens),
    numbers: extractNumbers(r.chunk.text),
  }));

  return sentences.map((text) => {
    const factual = isFactualSentence(text);
    if (!factual) {
      return {
        text,
        support: "skip" as const,
        factual: false,
        chunkId: null,
        pick: null,
        coverage: 0,
        quote: null,
        docStart: null,
        docEnd: null,
        reason: "開場或標題，不列入依據統計",
      };
    }

    const sentTok = tokenize(text);
    const claims = extractNumbers(text);
    let bestId: string | null = null;
    let bestPick: number | null = null;
    let bestCov = 0;
    let bestChunk = chunkTok[0] ?? null;
    let conflict: { claim: NumberClaim; other: NumberClaim } | null = null;

    for (const c of chunkTok) {
      let cov = tokenCoverage(sentTok, c.tokens);
      let need = 0;
      let hit = 0;
      for (const n of claims) {
        need += 1;
        if (c.text.includes(n.raw)) hit += 1;
      }
      if (need > 0) cov = Math.max(cov, hit / need);
      if (cov > bestCov) {
        bestCov = cov;
        bestId = c.id;
        bestPick = c.pick || null;
        bestChunk = c;
      }
    }

    if (bestChunk) {
      for (const claim of claims) {
        const matches = bestChunk.numbers.filter((n) => n.raw === claim.raw);
        const opposite = matches.find((n) => n.polarity !== claim.polarity);
        const same = matches.find((n) => n.polarity === claim.polarity);
        if (opposite && !same) {
          conflict = { claim, other: opposite };
          break;
        }
      }
    }

    let support: Support = "none";
    let reason = "這句在 Top-K 裡找不到對應數字或足夠詞項。";
    if (conflict && bestChunk) {
      support = "conflict";
      reason = conflictReason(conflict.claim, conflict.other);
      bestId = bestChunk.id;
      bestPick = bestChunk.pick || null;
    } else if (bestCov >= 0.34) {
      support = "strong";
      reason =
        claims.length > 0
          ? "來源有相同數字，且肯定／否定方向一致。詞彙重疊 ≠ 內容一定對，估算。"
          : "與取回切塊詞項重疊高。這是詞彙重疊，不是語意保證。估算。";
    } else if (bestCov >= 0.14) {
      support = "weak";
      reason = "只有部分詞項對得上，事實可能不完整。估算。";
    }

    const needles = [
      ...claims.map((c) => c.raw),
      ...sentTok.filter((t) => t.length >= 2).slice(0, 4),
    ];
    const ex =
      bestChunk && bestId
        ? excerpt(bestChunk.text, bestChunk.start, needles)
        : { quote: null as string | null, docStart: null as number | null, docEnd: null as number | null };

    return {
      text,
      support,
      factual: true,
      chunkId: bestId,
      pick: bestPick,
      coverage: bestCov,
      quote: ex.quote,
      docStart: ex.docStart,
      docEnd: ex.docEnd,
      reason,
    };
  });
}

export function supportCounts(spans: GroundSpan[]) {
  const counted = spans.filter((s) => s.factual);
  const counts = { strong: 0, weak: 0, conflict: 0, none: 0, skip: 0, scored: counted.length };
  for (const s of spans) {
    if (s.support === "skip") counts.skip += 1;
    else if (s.support === "strong") counts.strong += 1;
    else if (s.support === "weak") counts.weak += 1;
    else if (s.support === "conflict") counts.conflict += 1;
    else counts.none += 1;
  }
  return counts;
}
