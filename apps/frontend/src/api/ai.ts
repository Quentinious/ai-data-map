const baseUrl = import.meta.env.VITE_BACKEND_BASE_URL ?? "http://127.0.0.1:4000";

export type AICountrySummaryResponse = {
  summary: string[];
  dataCoverage: {
    worldbank: string;
    weather: string;
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
