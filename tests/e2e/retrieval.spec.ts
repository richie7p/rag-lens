import { expect, test } from "@playwright/test";
test("document through ranking, context and unavailable-provider feedback", async ({ page }, testInfo) => {
  const errors: string[] = []; page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("navigation", { name: "RAG pipeline" }).getByRole("button", { name: /01 DOC/ }).click();
  await page.getByPlaceholder("貼上文章、說明書、內部筆記…").fill("退款期限為7天，申請請聯絡客服。".repeat(35));
  await page.getByPlaceholder("問這份文件一個它才知道的問題").fill("退款期限");
  await page.getByRole("button", { name: "檢視檢索", exact: true }).click();
  const nav = page.getByRole("navigation", { name: "RAG pipeline" });
  await nav.getByRole("button", { name: /06 CTX/ }).click();
  await expect(page.getByText("送給模型的檢索上下文", { exact: true })).toBeVisible();
  await expect(page.locator("body")).toContainText("[#1 · c");
  await page.getByRole("button", { name: "生成回答", exact: true }).click();
  await expect(page.getByText("這個環境暫時無法呼叫模型。", { exact: true }).first()).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("retrieval.png"), fullPage: true }); expect(errors).toEqual([]);
});
test("unrelated query creates no misleading context", async ({ page }) => {
  await page.goto("/"); const nav = page.getByRole("navigation", { name: "RAG pipeline" });
  await nav.getByRole("button", { name: /01 DOC/ }).click();
  await page.getByPlaceholder("貼上文章、說明書、內部筆記…").fill("The refund policy permits returns within seven days.");
  await page.getByPlaceholder("問這份文件一個它才知道的問題").fill("zzzzunrelated");
  await nav.getByRole("button", { name: /05 TOP-K/ }).click();
  await expect(page.getByText("沒有可取回的切塊", { exact: true })).toBeVisible();
  await expect(page.getByText(/系統不會用零分片段填滿 Top-K/)).toBeVisible();
});
