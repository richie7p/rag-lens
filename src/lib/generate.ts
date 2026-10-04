import { createServerFn } from "@tanstack/react-start";
import { generateInputSchema, generateWithProvider } from "./rag/provider.server";
export type { GenerateInput, GenerateResult } from "./rag/provider.server";
export const generateAnswers = createServerFn({ method: "POST" })
  .validator((data: unknown) => generateInputSchema.parse(data))
  .handler(async ({ data }) => generateWithProvider(data, { apiKey: process.env.XAI_API_KEY }));
