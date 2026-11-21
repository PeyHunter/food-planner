import type Anthropic from "@anthropic-ai/sdk";
import type { Database } from "./db.ts";
import type { PhotoRecipeClient } from "./photo-recipe.ts";
import { aiCalls } from "./schema.ts";

export type AiFeature = "photo" | "link" | "vegetarian";

/** US dollars per million tokens, from Anthropic's price list (2026-11). Cache writes are the 5-minute kind (1.25 × input). */
export const modelPrices: Record<string, { input: number; output: number; cacheWrite: number; cacheRead: number }> = {
  "claude-sonnet-5-5": { input: 2, output: 10, cacheWrite: 2.5, cacheRead: 0.1 },
};

type Usage = Pick<Anthropic.Beta.Messages.BetaUsage, "input_tokens" | "output_tokens"> &
  Partial<Pick<Anthropic.Beta.Messages.BetaUsage, "cache_creation_input_tokens" | "cache_read_input_tokens">>;

/** What one call cost in dollars; 0 for a model missing from modelPrices. */
export function costUsd(model: string, usage: Usage) {
  const price = modelPrices[model];
  if (!price) return 0;
  const perToken =
    usage.input_tokens * price.input +
    (usage.cache_creation_input_tokens ?? 0) * price.cacheWrite +
    (usage.cache_read_input_tokens ?? 0) * price.cacheRead +
    usage.output_tokens * price.output;
  return perToken / 1_000_000;
}

/** The same client, but every call is written to ai_calls for this kitchen and user. A failed write is logged, never shown to the user. */
export function loggingClient(client: PhotoRecipeClient, { db }: Database, who: { kitchenId: string; userId: string; feature: AiFeature }): PhotoRecipeClient {
  return {
    beta: {
      messages: {
        async create(params, options) {
          const message = await client.beta.messages.create(params, options);
          const usage: Usage = message.usage ?? { input_tokens: 0, output_tokens: 0 };
          if (!modelPrices[message.model]) console.error(`No price for model ${message.model}: add it to modelPrices in src/server/ai-calls.ts.`);
          await db
            .insert(aiCalls)
            .values({
              ...who,
              model: message.model,
              inputTokens: usage.input_tokens + (usage.cache_creation_input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0),
              outputTokens: usage.output_tokens,
              costUsd: costUsd(message.model, usage).toFixed(6),
            })
            .catch((error: unknown) => console.error("Saving an AI call failed:", (error as Error).message));
          return message;
        },
      },
    },
  };
}
