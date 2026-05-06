const baseUrl = import.meta.env.VITE_BACKEND_BASE_URL ?? "http://127.0.0.1:4000";

export type AICountrySummaryResponse = {
  summary: string[];
  dataCoverage: {
    worldbank: string;
    weather: string;
  };
};

export type AIAreaSummaryResponse = {
  summaryText: string;
  source: "openai" | "gemini" | "ollama" | "gigachat" | "template";
  provider: "openai" | "gemini" | "ollama" | "gigachat" | "template";
  reason?: "disabled_flag" | "missing_api_key" | "provider_error_unsupported_region" | "error";
  model?: string;
  warnings: string[];
  district: {
    id: string;
    name: string;
  };
  dataset: {
    mode: string;
    updatedAt: string;
  };
  cache: {
    hit: boolean;
    key: string;
    ttlSeconds: number;
  };
};

export type AIAreaSummaryRequest = {
  districtId: string;
  filters?: {
    rooms?: number;
    userType?: string;
    minArea?: number;
    maxArea?: number;
    minPrice?: number;
    maxPrice?: number;
  };
  dataset?: {
    mode?: string;
    updatedAt?: string;
  };
};

export async function generateCountrySummary(countryCode: string): Promise<AICountrySummaryResponse> {
  const response = await fetch(`${baseUrl}/v1/ai/country-summary`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ countryCode, language: "ru" })
  });

  const payload = (await response.json()) as
    | AICountrySummaryResponse
    | { error?: { message?: string } };

  if (!response.ok) {
    const message =
      "error" in payload && payload.error?.message
        ? payload.error.message
        : `Failed to generate summary (${response.status})`;
    throw new Error(message);
  }

  if (!("summary" in payload) || !Array.isArray(payload.summary)) {
    throw new Error("Invalid AI summary response format");
  }

  return payload as AICountrySummaryResponse;
}

export async function generateAreaSummary(request: AIAreaSummaryRequest): Promise<AIAreaSummaryResponse> {
  const response = await fetch(`${baseUrl}/v1/ai/summary`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(request)
  });

  const payload = (await response.json()) as
    | { data: AIAreaSummaryResponse }
    | { error?: { message?: string } };

  if (!response.ok) {
    const message =
      "error" in payload && payload.error?.message
        ? payload.error.message
        : `Failed to generate area summary (${response.status})`;
    throw new Error(message);
  }

  if (!("data" in payload) || typeof payload.data?.summaryText !== "string") {
    throw new Error("Invalid AI area summary response format");
  }

  return payload.data;
}
