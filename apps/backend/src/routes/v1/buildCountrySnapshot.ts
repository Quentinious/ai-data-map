import type { CountrySnapshot } from "../../dto/countrySnapshot.js";
import { getOpenWeatherMetrics } from "../../integrations/openweather/getWeatherMetrics.js";
import { getWorldBankCoreMetrics } from "../../integrations/worldbank/getCoreMetrics.js";
import { getCountryReferenceByCode } from "../../countryReference/loadCountries.js";

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

function getLayerStatus(metrics: Array<{ quality: string }>): "ok" | "degraded" | "error" {
  if (metrics.length === 0 || metrics.every((metric) => metric.quality === "error")) {
    return "error";
  }

  if (metrics.some((metric) => metric.quality === "error")) {
    return "degraded";
  }

  return "ok";
}

export async function buildCountrySnapshot(countryCode: string): Promise<CountrySnapshot> {
  const normalizedCountryCode = countryCode.toUpperCase();
  const country = await getCountryReferenceByCode(normalizedCountryCode);

  if (!country) {
    throw createCodedError("COUNTRY_NOT_FOUND", 404, `Country not found: ${normalizedCountryCode}`);
  }

  const [wbMetrics, weatherResult] = await Promise.all([
    getWorldBankCoreMetrics(normalizedCountryCode),
    getOpenWeatherMetrics(country.representativePoint.lat, country.representativePoint.lon)
  ]);

  const worldBankStatus = getLayerStatus(wbMetrics);
  const weatherStatus = getLayerStatus(weatherResult.metrics);
  const warnings = ["Snapshot stub: integrations not implemented yet"];

  if (!process.env.OPENWEATHER_API_KEY) {
    warnings.push("OpenWeather disabled: OPENWEATHER_API_KEY is not set");
  }

  return {
    country: {
      countryCode: country.countryCode,
      displayName: country.displayName,
      repPointType: country.repPointType
    },
    generatedAt: new Date().toISOString(),
    layers: {
      worldbank: {
        source: "worldbank",
        status: worldBankStatus,
        metrics: wbMetrics
      },
      weather: {
        source: "openweather",
        status: weatherStatus,
        asOf: weatherResult.asOf,
        metrics: weatherResult.metrics
      }
    },
    warnings
  };
}
