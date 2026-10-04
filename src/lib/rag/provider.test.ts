import assert from "node:assert/strict";
import { test } from "node:test";
import { createCallBudget, generateWithProvider, validCitations } from "./provider.server";
const input = { query: "退款期限？", context: "[#1 · c0 · sim 1.000]\n退款7天。", mode: "rag" as const };
const config = { apiKey: "test-only-placeholder", reserve: () => true };
const response = (content = "退款7天。#1", finish_reason = "stop") => new Response(JSON.stringify({ choices: [{ message: { content }, finish_reason }] }));
test("refusal exception cannot hide uncited factual claims", () => {
  assert.equal(validCitations("Refunds are not included; the cancellation charge is 999 euros.", input.context), false);
  assert.equal(validCitations("找不到足夠的文件資訊來回答。", input.context), true);
  assert.equal(validCitations("找不到足夠的文件資訊來回答。退款99天。", input.context), false);
});
test("invalid input and missing key never call the provider", async () => {
  let count = 0; const fetcher: typeof fetch = async () => { count++; return response(); };
  for (const value of [null, { ...input, context: 1 }, { ...input, query: "x".repeat(801) }]) assert.equal((await generateWithProvider(value, { ...config, fetcher })).ok, false);
  assert.equal((await generateWithProvider(input, { fetcher })).ok, false); assert.equal(count, 0);
});
test("prompt isolates untrusted text and comparison uses exactly two bounded calls", async () => {
  const bodies: Array<{ max_tokens: number; messages: Array<{ content: string }> }> = [];
  const result = await generateWithProvider({ ...input, mode: "both" }, { ...config, fetcher: async (_url, init) => { bodies.push(JSON.parse(String(init?.body))); return response(); } });
  assert.equal(result.ok, true); assert.equal(bodies.length, 2); assert.equal(bodies[0].max_tokens, 360);
  assert.match(bodies[0].messages[0].content, /未受信任/); assert.match(bodies[0].messages[1].content, /untrusted_context/);
});
test("missing evidence returns a refusal without paying for a RAG call", async () => {
  const result = await generateWithProvider({ ...input, context: "" }, { ...config, fetcher: async () => { throw Error("must not call"); } });
  assert.equal(result.ok, true); if (result.ok) assert.match(result.withRag, /沒有取回/);
});
test("unknown citations, empty and truncated responses fail closed", async () => {
  for (const fetcher of [async () => response("答案 #99"), async () => response("退款7天。"), async () => response(""), async () => response("半句", "length"), async () => new Response("{}"), async () => new Response("secret upstream diagnostic", { status: 429 })]) {
    const result = await generateWithProvider(input, { ...config, fetcher }); assert.equal(result.ok, false); assert.ok(!JSON.stringify(result).includes("secret"));
  }
});
test("a stalled request is aborted and no raw transport error leaks", async () => {
  const result = await generateWithProvider(input, { ...config, timeoutMs: 10, fetcher: async (_url, init) => new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("secret transport details")))) });
  assert.equal(result.ok, false); if (!result.ok) assert.match(result.error, /逾時/);
});
test("call budget is atomic for comparisons and resets only after its window", () => {
  const reserve = createCallBudget(3, 1000); assert.equal(reserve(2, 1000), true); assert.equal(reserve(2, 1001), false); assert.equal(reserve(1, 1002), true); assert.equal(reserve(1, 1003), false); assert.equal(reserve(2, 2000), true);
});
