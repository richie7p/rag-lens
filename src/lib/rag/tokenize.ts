const EN_STOP = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "but",
  "in",
  "on",
  "at",
  "to",
  "for",
  "of",
  "with",
  "by",
  "from",
  "as",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "it",
  "this",
  "that",
  "these",
  "those",
  "not",
  "no",
  "so",
  "if",
  "then",
  "than",
  "too",
  "very",
  "can",
  "will",
  "just",
  "about",
  "into",
  "over",
  "after",
  "before",
  "between",
  "out",
  "up",
  "down",
  "its",
  "their",
  "his",
  "her",
  "they",
  "them",
  "we",
  "you",
  "i",
]);

const ZH_STOP = new Set([
  "的",
  "了",
  "在",
  "是",
  "與",
  "及",
  "和",
  "或",
  "並",
  "而",
  "也",
  "就",
  "都",
  "被",
  "把",
  "為",
  "於",
  "對",
  "從",
  "等",
  "其",
  "此",
  "該",
  "一個",
  "以及",
]);

const TOKEN_RE = /[a-z0-9]+|[\u4e00-\u9fff]+/gi;

export function tokenize(text: string): string[] {
  const tokens: string[] = [];
  const parts = text.toLowerCase().match(TOKEN_RE) ?? [];
  for (const part of parts) {
    if (/[\u4e00-\u9fff]/.test(part)) {
      for (let i = 0; i < part.length; i++) {
        const uni = part[i]!;
        if (!ZH_STOP.has(uni)) tokens.push(uni);
      }
      for (let i = 0; i < part.length - 1; i++) {
        const bi = part.slice(i, i + 2);
        if (!ZH_STOP.has(bi)) tokens.push(bi);
      }
    } else if (part.length > 1 && !EN_STOP.has(part)) {
      tokens.push(part);
    }
  }
  return tokens;
}

export function uniqueTokens(tokens: string[]): string[] {
  return [...new Set(tokens)];
}
