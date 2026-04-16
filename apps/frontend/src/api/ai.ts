const baseUrl = import.meta.env.VITE_BACKEND_BASE_URL ?? "http://127.0.0.1:4000";

export type AICountrySummaryResponse = {
  summary: string[];
  dataCoverage: {
    worldbank: string;
    weather: string;
  };
};

export type AIAreaSummaryResponse = {
  summary: string[];
  district: {
    id: string;
    name: string;
  };
  dataset: {
    mode: string;
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

export async function generateAreaSummary(districtId: string): Promise<AIAreaSummaryResponse> {
  const response = await fetch(`${baseUrl}/v1/ai/area-summary`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ districtId, language: "ru" })
  });

  const payload = (await response.json()) as
    | AIAreaSummaryResponse
    | { error?: { message?: string } };

  if (!response.ok) {
    const message =
      "error" in payload && payload.error?.message
        ? payload.error.message
        : `Failed to generate area summary (${response.status})`;
    throw new Error(message);
  }

  if (!("summary" in payload) || !Array.isArray((payload as AIAreaSummaryResponse).summary)) {
    throw new Error("Invalid AI area summary response format");
  }

  return payload as AIAreaSummaryResponse;
}
