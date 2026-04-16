import type { FactsPayload } from "./buildFactsPayload.js";

type SummaryResult = {
  summary: string[];
  dataCoverage: {
    worldbank: string;
    weather: string;
  };
};

type CodedError = Error & {
  code: string;
  status: number;
  details?: unknown;
};

function createCodedError(code: string, status: number, message: string, details?: unknown): CodedError {
  const error = new Error(message) as CodedError;
  error.code = code;
  error.status = status;
  error.details = details;
  return error;
}

function shouldUseMock(): boolean {
  const rawValue = process.env.AI_USE_MOCK;

  if (rawValue == null) {
    return process.env.NODE_ENV !== "production";
  }

  return rawValue.toLowerCase() === "true";
}

function formatMetricValue(
  factsPayload: FactsPayload,
  key: string,
  fallbackText = "нет данных"
): { text: string; yearText: string } {
  const metric = factsPayload.metrics.find((item) => item.key === key);

  if (!metric || metric.value == null) {
    return { text: fallbackText, yearText: "" };
  }

  const yearText = metric.asOf.year ? ` (данные WB за ${metric.asOf.year} г.)` : "";
  return {
    text: `${metric.value} ${metric.unit}`,
    yearText
  };
}

function validateSummaryResponse(result: SummaryResult): void {
  if (!Array.isArray(result.summary)) {
    throw createCodedError("AI_SCHEMA_INVALID", 500, "AI summary response is invalid: summary must be array");
  }

  if (result.summary.length < 2 || result.summary.length > 8) {
    throw createCodedError("AI_SCHEMA_INVALID", 500, "AI summary response is invalid: summary size out of range");
  }

  if (result.summary.some((item) => typeof item !== "string" || item.trim().length === 0)) {
    throw createCodedError("AI_SCHEMA_INVALID", 500, "AI summary response is invalid: summary items must be non-empty strings");
  }

  if (
    !result.dataCoverage ||
    typeof result.dataCoverage.worldbank !== "string" ||
    typeof result.dataCoverage.weather !== "string"
  ) {
    throw createCodedError("AI_SCHEMA_INVALID", 500, "AI summary response is invalid: dataCoverage is malformed");
  }
}

function buildMockSummary(factsPayload: FactsPayload): SummaryResult {
  const population = formatMetricValue(factsPayload, "wb.population");
  const gdp = formatMetricValue(factsPayload, "wb.gdp_current_usd");
  const temp = formatMetricValue(factsPayload, "ow.temp_c");
  const humidity = formatMetricValue(factsPayload, "ow.humidity_pct");

  const summary = [
    `${factsPayload.country.displayName} (${factsPayload.country.countryCode}): сводка сформирована на ${factsPayload.generatedAt}.`,
    `Покрытие данных: World Bank — ${factsPayload.dataCoverage.worldbank}, OpenWeather — ${factsPayload.dataCoverage.weather}.`,
    `Население: ${population.text}${population.yearText || ""}.`,
    `ВВП (текущий, USD): ${gdp.text}${gdp.yearText || ""}.`,
    `Погода: температура ${temp.text}, влажность ${humidity.text}.`
  ];

  return {
    summary,
    dataCoverage: {
      worldbank: factsPayload.dataCoverage.worldbank,
      weather: factsPayload.dataCoverage.weather
    }
  };
}

export async function generateCountrySummary(
  factsPayload: FactsPayload,
  language?: string
): Promise<SummaryResult> {
  const targetLanguage = language ?? process.env.AI_DEFAULT_LANGUAGE ?? "ru";

  if (targetLanguage !== "ru") {
    throw createCodedError("AI_LANGUAGE_UNSUPPORTED", 400, "Only Russian language is supported in MVP");
  }

  if (!shouldUseMock()) {
    throw createCodedError("AI_NOT_CONFIGURED", 503, "AI provider is not configured for non-mock mode");
  }

  const result = buildMockSummary(factsPayload);
  validateSummaryResponse(result);
  return result;
}
