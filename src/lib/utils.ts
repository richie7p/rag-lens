import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function formatInt(n: number) {
  return new Intl.NumberFormat("zh-Hant").format(Math.round(n));
}

/** Rough token estimate — never treat as a real tokenizer. */
export function estimateTokens(text: string) {
  if (!text) return 0;
  const cjk = (text.match(/[\u4e00-\u9fff]/g) ?? []).length;
  const rest = text.length - cjk;
  return Math.max(1, Math.round(cjk * 0.7 + rest / 4));
}
