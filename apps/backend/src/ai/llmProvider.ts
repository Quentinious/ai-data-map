/**
 * LLM provider abstraction for AI summary generation.
 *
 * Feature flag: set AI_LLM_ENABLED=true in the environment to enable real LLM calls.
 * Required env vars when AI_LLM_ENABLED=true:
 *   AI_PROVIDER  — provider name, e.g. "openai"
 *   AI_API_KEY   — API key for the chosen provider
 *   AI_MODEL     — model name, e.g. "gpt-4o-mini"
 *
 * When AI_LLM_ENABLED is absent or false, isLLMEnabled() returns false and
 * callers must fall back to the template summary.
 */

export type LLMMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type LLMRequest = {
  messages: LLMMessage[];
  /** Maximum number of tokens to generate */
  maxTokens?: number;
  /** Temperature (0–1), lower = more deterministic */
  temperature?: number;
};

export type LLMResponse = {
  text: string;
  /** Provider-reported finish reason, e.g. "stop" | "length" */
  finishReason?: string;
};

/**
 * Returns true when real LLM integration is enabled via env var AI_LLM_ENABLED=true.
 */
export function isLLMEnabled(): boolean {
  return process.env.AI_LLM_ENABLED?.toLowerCase() === "true";
}

/**
 * Calls the configured LLM provider with the given messages.
 *
 * Throws if AI_LLM_ENABLED is not true or required env vars are missing.
 * This function is intentionally not implemented — add your provider SDK here
 * (e.g. the openai npm package) once you enable the feature.
 */
export async function callLLM(request: LLMRequest): Promise<LLMResponse> {
  if (!isLLMEnabled()) {
    throw new Error("LLM integration is disabled. Set AI_LLM_ENABLED=true to enable.");
  }

  const provider = process.env.AI_PROVIDER?.toLowerCase();
  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL;

  if (!provider || !apiKey || !model) {
    throw new Error(
      "LLM provider is not fully configured. Required: AI_PROVIDER, AI_API_KEY, AI_MODEL."
    );
  }

  // Placeholder: add provider-specific SDK calls here.
  // Example for OpenAI:
  //   import OpenAI from "openai";
  //   const client = new OpenAI({ apiKey });
  //   const completion = await client.chat.completions.create({
  //     model,
  //     messages: request.messages,
  //     max_tokens: request.maxTokens ?? 512,
  //     temperature: request.temperature ?? 0.4,
  //   });
  //   return { text: completion.choices[0].message.content ?? "", finishReason: completion.choices[0].finish_reason };

  throw new Error(
    `LLM provider "${provider}" is not yet implemented. Add the provider SDK call in the callLLM function.`
  );
}
