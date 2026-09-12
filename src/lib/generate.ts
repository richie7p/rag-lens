import { createServerFn } from "@tanstack/react-start";

const MAX_QUERY = 800;
const MAX_CONTEXT = 8_000;

export type GenerateInput = {
  query: string;
  context: string;
  mode: "rag" | "both";
};

export type GenerateResult =
  | {
      ok: true;
      withRag: string;
      withoutRag: string | null;
      model: string;
    }
  | { ok: false; error: string };

function friendlyStatus(status: number) {
  if (status === 401 || status === 403) return "這個環境暫時無法呼叫模型。";
  if (status === 429) return "模型忙碌或額度不足，請稍後重試。";
  if (status >= 500) return "模型服務暫時失敗，可重試。";
  return `生成失敗（${status}），可重試。`;
}

async function chat(
  apiKey: string,
  messages: { role: "system" | "user"; content: string }[],
): Promise<string> {
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "grok-4.5",
      messages,
      temperature: 0.2,
      max_tokens: 360,
    }),
  });
  if (!res.ok) {
    throw new Error(friendlyStatus(res.status));
  }
  const body = (await res.json()) as {
    choices: { message: { content: string } }[];
  };
  return body.choices[0]?.message.content?.trim() ?? "";
}

export const generateAnswers = createServerFn({ method: "POST" })
  .validator((data: GenerateInput) => {
    if (!data || typeof data.query !== "string") {
      throw new Error("invalid input");
    }
    return {
      query: data.query.slice(0, MAX_QUERY),
      context: (data.context ?? "").slice(0, MAX_CONTEXT),
      mode: data.mode === "both" ? "both" : "rag",
    } satisfies GenerateInput;
  })
  .handler(async ({ data }): Promise<GenerateResult> => {
    const apiKey = process.env.XAI_API_KEY?.trim();
    if (!apiKey) {
      return { ok: false, error: "這個環境暫時無法呼叫模型。" };
    }
    const query = data.query.trim();
    if (!query) return { ok: false, error: "請先輸入問題。" };

    const ragMessages: { role: "system" | "user"; content: string }[] = [
      {
        role: "system",
        content:
          "你是 RAG 示範裡的回答模型。只能根據提供的檢索上下文作答。若上下文沒有答案，明確說找不到。用完整句子，句末用 #1 #2 標來源。可用輕量粗體，不要把整段做成 markdown 標題，不要單獨把 #1 當成一段。不要編造文件裡沒有的數字、地名或產品名。用與問題相同的語言回答。",
      },
      {
        role: "user",
        content: `檢索上下文：\n\n${data.context || "（沒有取回任何片段）"}\n\n---\n問題：${query}`,
      },
    ];

    const plainMessages: { role: "system" | "user"; content: string }[] = [
      {
        role: "system",
        content:
          "直接回答使用者的問題。你沒有任何內部文件。若你不確定，就說不知道，不要編造具體數字或內部產品細節。用與問題相同的語言、完整句子回答。",
      },
      { role: "user", content: query },
    ];

    try {
      if (data.mode === "both") {
        const [withRag, withoutRag] = await Promise.all([
          chat(apiKey, ragMessages),
          chat(apiKey, plainMessages),
        ]);
        return { ok: true, withRag, withoutRag, model: "grok-4.5" };
      }
      const withRag = await chat(apiKey, ragMessages);
      return { ok: true, withRag, withoutRag: null, model: "grok-4.5" };
    } catch (err) {
      const message = err instanceof Error ? err.message : "生成失敗，可重試。";
      return { ok: false, error: message };
    }
  });
