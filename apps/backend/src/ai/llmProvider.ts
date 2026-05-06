/**
 * LLM provider abstraction for AI summary generation.
 */

import { randomUUID } from "crypto";

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

export type LLMProviderName = "openai" | "gemini" | "ollama" | "gigachat";

export type LLMResponse = {
  text: string;
  /** Provider-reported finish reason, e.g. "stop" | "length" */
  finishReason?: string;
};

type ProviderError = Error & {
  code: string;
  status?: number;
  provider?: LLMProviderName;
  details?: unknown;
};

type ProviderConfig =
  | {
      provider: "openai";
      model: string;
      apiKey: string;
    }
  | {
      provider: "gemini";
      model: string;
      apiKey: string;
    }
  | {
      provider: "ollama";
      model: string;
      baseUrl: string;
    }
  | {
      provider: "gigachat";
      model: string;
      authKey: string;
      scope: string;
      authUrl: string;
      apiBaseUrl: string;
    };

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_OLLAMA_BASE_URL = "http://127.0.0.1:11434";
const DEFAULT_GIGACHAT_AUTH_URL = "https://ngw.devices.sberbank.ru:9443/api/v2/oauth";
const DEFAULT_GIGACHAT_API_BASE_URL = "https://gigachat.devices.sberbank.ru/api/v1";
const DEFAULT_GIGACHAT_SCOPE = "GIGACHAT_API_PERS";
const DEFAULT_GIGACHAT_MODEL = "GigaChat-2-Pro";
const GIGACHAT_TOKEN_CACHE_BUFFER_MS = 60_000;

type GigaChatOAuthToken = {
  accessToken: string;
  expiresAt: number;
};

let cachedGigaChatToken: GigaChatOAuthToken | null = null;

function createProviderError(
  code: string,
  message: string,
  status?: number,
  provider?: LLMProviderName,
  details?: unknown
): ProviderError {
  const error = new Error(message) as ProviderError;
  error.code = code;
  error.status = status;
  error.provider = provider;
  error.details = details;
  return error;
}

function normalizeProviderName(rawProvider: string | undefined): LLMProviderName | null {
  const provider = rawProvider?.trim().toLowerCase();

  if (provider === "openai" || provider === "gemini" || provider === "ollama" || provider === "gigachat") {
    return provider;
  }

  return null;
}

function getProviderConfig(): ProviderConfig | null {
  const provider = normalizeProviderName(process.env.AI_PROVIDER);

  if (!provider) {
    return null;
  }

  if (provider === "openai") {
    const model = process.env.OPENAI_MODEL?.trim() || process.env.AI_MODEL?.trim();
    const apiKey = process.env.OPENAI_API_KEY?.trim() || process.env.AI_API_KEY?.trim();

    if (!model || !apiKey) {
      return null;
    }

    return { provider, model, apiKey };
  }

  if (provider === "gemini") {
    const model = process.env.GEMINI_MODEL?.trim();
    const apiKey = process.env.GEMINI_API_KEY?.trim();

    if (!model || !apiKey) {
      return null;
    }

    return { provider, model, apiKey };
  }

  if (provider === "ollama") {
    const model = process.env.OLLAMA_MODEL?.trim();
    const baseUrl = process.env.OLLAMA_BASE_URL?.trim() || DEFAULT_OLLAMA_BASE_URL;

    if (!model) {
      return null;
    }

    return { provider, model, baseUrl };
  }

  const authKey = process.env.GIGACHAT_AUTH_KEY?.trim();
  const model = process.env.GIGACHAT_MODEL?.trim() || DEFAULT_GIGACHAT_MODEL;
  const scope = process.env.GIGACHAT_SCOPE?.trim() || DEFAULT_GIGACHAT_SCOPE;
  const authUrl = process.env.GIGACHAT_AUTH_URL?.trim() || DEFAULT_GIGACHAT_AUTH_URL;
  const apiBaseUrl = process.env.GIGACHAT_API_BASE_URL?.trim() || DEFAULT_GIGACHAT_API_BASE_URL;

  if (!authKey) {
    return null;
  }

  return { provider, model, authKey, scope, authUrl, apiBaseUrl };
}

function isUnsupportedRegionResponse(status: number, bodyText: string): boolean {
  return status === 403 && bodyText.includes("unsupported_country_region_territory");
}

function parseErrorBody(rawBody: string): { message: string; code?: string } {
  try {
    const payload = JSON.parse(rawBody) as {
      error?: {
        message?: string;
        code?: string;
        type?: string;
      };
    };

    return {
      message: payload.error?.message || rawBody,
      code: payload.error?.code || payload.error?.type,
    };
  } catch {
    return { message: rawBody };
  }
}

async function readResponseText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

function buildGeminiContents(messages: LLMMessage[]): {
  systemInstruction?: { parts: Array<{ text: string }> };
  contents: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }>;
} {
  const systemMessages = messages.filter((message) => message.role === "system");
  const chatMessages = messages.filter((message) => message.role !== "system");
  const systemText = systemMessages.map((message) => message.content).join("\n").trim();

  return {
    systemInstruction: systemText ? { parts: [{ text: systemText }] } : undefined,
    contents: chatMessages.map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }],
    })),
  };
}

async function callOpenAI(request: LLMRequest, config: Extract<ProviderConfig, { provider: "openai" }>): Promise<LLMResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: config.model,
        temperature: request.temperature ?? 0.4,
        max_tokens: request.maxTokens ?? 512,
        messages: request.messages,
      }),
    });

    if (!response.ok) {
      const rawBody = await readResponseText(response);
      const parsed = parseErrorBody(rawBody);

      if (isUnsupportedRegionResponse(response.status, rawBody) || parsed.code === "unsupported_country_region_territory") {
        throw createProviderError(
          "LLM_PROVIDER_UNSUPPORTED_REGION",
          "OpenAI is unavailable in this region",
          response.status,
          config.provider,
          { rawBody, parsed }
        );
      }

      throw createProviderError(
        "LLM_PROVIDER_REQUEST_FAILED",
        parsed.message || `OpenAI request failed (${response.status})`,
        response.status,
        config.provider,
        { rawBody, parsed }
      );
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
    };

    const text = payload.choices?.[0]?.message?.content?.trim();
    if (!text) {
      throw createProviderError("LLM_PROVIDER_EMPTY_RESPONSE", "OpenAI returned an empty summary", 502, config.provider);
    }

    return {
      text,
      finishReason: payload.choices?.[0]?.finish_reason,
    };
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "AbortError") {
      throw createProviderError("LLM_PROVIDER_TIMEOUT", "OpenAI request timed out", 504, config.provider);
    }

    if (typeof error === "object" && error && "code" in error) {
      throw error;
    }

    const message = error instanceof Error ? error.message : String(error);
    throw createProviderError("LLM_PROVIDER_REQUEST_FAILED", message, 500, config.provider);
  } finally {
    clearTimeout(timeout);
  }
}

async function callGemini(request: LLMRequest, config: Extract<ProviderConfig, { provider: "gemini" }>): Promise<LLMResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);

  try {
    const { systemInstruction, contents } = buildGeminiContents(request.messages);
    const endpoint = `${GEMINI_API_URL}/${encodeURIComponent(config.model)}:generateContent?key=${encodeURIComponent(config.apiKey)}`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        ...(systemInstruction ? { systemInstruction } : {}),
        contents,
        generationConfig: {
          temperature: request.temperature ?? 0.4,
          maxOutputTokens: request.maxTokens ?? 512,
        },
      }),
    });

    if (!response.ok) {
      const rawBody = await readResponseText(response);
      const parsed = parseErrorBody(rawBody);

      if (isUnsupportedRegionResponse(response.status, rawBody)) {
        throw createProviderError(
          "LLM_PROVIDER_UNSUPPORTED_REGION",
          "Gemini is unavailable in this region",
          response.status,
          config.provider,
          { rawBody, parsed }
        );
      }

      throw createProviderError(
        "LLM_PROVIDER_REQUEST_FAILED",
        parsed.message || `Gemini request failed (${response.status})`,
        response.status,
        config.provider,
        { rawBody, parsed }
      );
    }

    const payload = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };

    const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim();
    if (!text) {
      throw createProviderError("LLM_PROVIDER_EMPTY_RESPONSE", "Gemini returned an empty summary", 502, config.provider);
    }

    return { text };
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "AbortError") {
      throw createProviderError("LLM_PROVIDER_TIMEOUT", "Gemini request timed out", 504, config.provider);
    }

    if (typeof error === "object" && error && "code" in error) {
      throw error;
    }

    const message = error instanceof Error ? error.message : String(error);
    throw createProviderError("LLM_PROVIDER_REQUEST_FAILED", message, 500, config.provider);
  } finally {
    clearTimeout(timeout);
  }
}

async function callOllama(request: LLMRequest, config: Extract<ProviderConfig, { provider: "ollama" }>): Promise<LLMResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  const baseUrl = config.baseUrl.replace(/\/$/, "");

  try {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: config.model,
        messages: request.messages,
        stream: false,
        options: {
          temperature: request.temperature ?? 0.4,
          num_predict: request.maxTokens ?? 512,
        },
      }),
    });

    if (!response.ok) {
      const rawBody = await readResponseText(response);
      const parsed = parseErrorBody(rawBody);

      if (isUnsupportedRegionResponse(response.status, rawBody)) {
        throw createProviderError(
          "LLM_PROVIDER_UNSUPPORTED_REGION",
          "Ollama is unavailable in this region",
          response.status,
          config.provider,
          { rawBody, parsed }
        );
      }

      throw createProviderError(
        "LLM_PROVIDER_REQUEST_FAILED",
        parsed.message || `Ollama request failed (${response.status})`,
        response.status,
        config.provider,
        { rawBody, parsed }
      );
    }

    const payload = (await response.json()) as {
      message?: { content?: string };
      response?: string;
    };

    const text = (payload.message?.content ?? payload.response ?? "").trim();
    if (!text) {
      throw createProviderError("LLM_PROVIDER_EMPTY_RESPONSE", "Ollama returned an empty summary", 502, config.provider);
    }

    return { text };
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "AbortError") {
      throw createProviderError("LLM_PROVIDER_TIMEOUT", "Ollama request timed out", 504, config.provider);
    }

    if (typeof error === "object" && error && "code" in error) {
      throw error;
    }

    const message = error instanceof Error ? error.message : String(error);
    throw createProviderError("LLM_PROVIDER_REQUEST_FAILED", message, 500, config.provider);
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeGigaChatAuthKey(authKey: string): string {
  const trimmed = authKey.trim();
  if (trimmed.startsWith("Basic ")) {
    return trimmed;
  }
  return `Basic ${trimmed}`;
}

async function getGigaChatAccessToken(config: Extract<ProviderConfig, { provider: "gigachat" }>): Promise<string> {
  const now = Date.now();

  if (cachedGigaChatToken && cachedGigaChatToken.expiresAt > now) {
    return cachedGigaChatToken.accessToken;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    // Generate UUID v4 for RqUID header
    const rqUid = randomUUID();
    const normalizedAuthKey = normalizeGigaChatAuthKey(config.authKey);

    // Build body as application/x-www-form-urlencoded
    const bodyParams = new URLSearchParams({ scope: config.scope });

    const response = await fetch(config.authUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        RqUID: rqUid,
        Authorization: normalizedAuthKey,
      },
      signal: controller.signal,
      body: bodyParams.toString(),
    });

    if (!response.ok) {
      const rawBody = await readResponseText(response);
      const logMessage = `GigaChat OAuth failed: status=${response.status}, step=token_request`;
      console.error(logMessage, { rawBodyLength: rawBody.length, rawBodyStart: rawBody.slice(0, 100) });

      throw createProviderError(
        "LLM_PROVIDER_AUTH_FAILED",
        logMessage,
        response.status,
        "gigachat",
        { rawBody }
      );
    }

    const payload = (await response.json()) as {
      access_token?: string;
      expires_at?: number;
      expires_in?: number;
    };

    const accessToken = payload.access_token;
    // Use expires_at if available, otherwise calculate from expires_in
    const expiresAt = payload.expires_at ?? (payload.expires_in ? now + payload.expires_in * 1000 : now + 1800_000);

    if (!accessToken) {
      throw createProviderError("LLM_PROVIDER_AUTH_FAILED", "GigaChat OAuth response missing access_token", 502, "gigachat");
    }

    cachedGigaChatToken = {
      accessToken,
      expiresAt: expiresAt - GIGACHAT_TOKEN_CACHE_BUFFER_MS,
    };

    return accessToken;
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "AbortError") {
      throw createProviderError("LLM_PROVIDER_TIMEOUT", "GigaChat OAuth request timed out", 504, "gigachat");
    }

    if (typeof error === "object" && error && "code" in error) {
      throw error;
    }

    const message = error instanceof Error ? error.message : String(error);
    throw createProviderError("LLM_PROVIDER_AUTH_FAILED", message, 500, "gigachat");
  } finally {
    clearTimeout(timeout);
  }
}

async function callGigaChat(request: LLMRequest, config: Extract<ProviderConfig, { provider: "gigachat" }>): Promise<LLMResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);

  try {
    const accessToken = await getGigaChatAccessToken(config);

    const response = await fetch(`${config.apiBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: config.model,
        messages: request.messages,
        stream: false,
        max_tokens: request.maxTokens ?? 512,
        temperature: request.temperature ?? 0.2,
      }),
    });

    if (!response.ok) {
      const rawBody = await readResponseText(response);
      const parsed = parseErrorBody(rawBody);
      const logMessage = `GigaChat chat request failed: status=${response.status}, step=chat_request`;
      console.error(logMessage, { rawBodyLength: rawBody.length, rawBodyStart: rawBody.slice(0, 100) });

      throw createProviderError(
        "LLM_PROVIDER_CHAT_FAILED",
        parsed.message || logMessage,
        response.status,
        "gigachat",
        { rawBody, parsed }
      );
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
    };

    const text = payload.choices?.[0]?.message?.content?.trim();
    if (!text) {
      throw createProviderError("LLM_PROVIDER_EMPTY_RESPONSE", "GigaChat returned an empty summary", 502, "gigachat");
    }

    return {
      text,
      finishReason: payload.choices?.[0]?.finish_reason,
    };
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "AbortError") {
      throw createProviderError("LLM_PROVIDER_TIMEOUT", "GigaChat request timed out", 504, "gigachat");
    }

    if (typeof error === "object" && error && "code" in error) {
      throw error;
    }

    const message = error instanceof Error ? error.message : String(error);
    throw createProviderError("LLM_PROVIDER_CHAT_FAILED", message, 500, "gigachat");
  } finally {
    clearTimeout(timeout);
  }
}

export function getConfiguredLLMProvider(): LLMProviderName | null {
  return getProviderConfig()?.provider ?? null;
}

export function getConfiguredLLMModel(): string | null {
  return getProviderConfig()?.model ?? null;
}

/**
 * Returns true when real LLM integration is enabled for either:
 * - new summary flow (AI_SUMMARY_ENABLED=true), or
 * - legacy LLM flow (AI_LLM_ENABLED=true).
 */
export function isLLMEnabled(): boolean {
  const summaryEnabled = process.env.AI_SUMMARY_ENABLED?.trim().toLowerCase() === "true";
  const legacyEnabled = process.env.AI_LLM_ENABLED?.trim().toLowerCase() === "true";
  return summaryEnabled || legacyEnabled;
}

/**
 * Calls the configured LLM provider with the given messages.
 */
export async function callLLM(request: LLMRequest): Promise<LLMResponse> {
  if (!isLLMEnabled()) {
    throw createProviderError("LLM_DISABLED", "LLM integration is disabled. Set AI_LLM_ENABLED=true to enable.");
  }

  const config = getProviderConfig();

  if (!config) {
    throw createProviderError(
      "LLM_PROVIDER_NOT_CONFIGURED",
      "LLM provider is not fully configured. Set AI_PROVIDER and provider-specific credentials."
    );
  }

  if (config.provider === "openai") {
    return callOpenAI(request, config);
  }

  if (config.provider === "gemini") {
    return callGemini(request, config);
  }

  if (config.provider === "ollama") {
    return callOllama(request, config);
  }

  return callGigaChat(request, config);
}
