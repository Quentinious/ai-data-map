import type { CountrySnapshot } from "../dto/countrySnapshot.js";

export type FactsPayload = {
  country: {
    countryCode: string;
    displayName: string;
    repPointType: "capital" | "centroid" | "manual";
  };
  generatedAt: string;
  metrics: Array<{
    key: string;
    value: number | null;
    unit: string;
    source: "worldbank" | "openweather";
    quality: "ok" | "missing" | "error";
    asOf: {
      year?: number;
      datetime?: string;
    };
  }>;
  dataCoverage: {
    worldbank: "ok" | "degraded" | "error";
    weather: "ok" | "degraded" | "error";
  };
};

export function buildFactsPayload(snapshot: CountrySnapshot): FactsPayload {
  return {
    country: {
      countryCode: snapshot.country.countryCode,
      displayName: snapshot.country.displayName,
      repPointType: snapshot.country.repPointType
    },
    generatedAt: snapshot.generatedAt,
    metrics: [...snapshot.layers.worldbank.metrics, ...snapshot.layers.weather.metrics].map((metric) => ({
      key: metric.key,
      value: metric.value,
      unit: metric.unit,
      source: metric.source,
      quality: metric.quality,
      asOf: metric.asOf
    })),
    dataCoverage: {
      worldbank: snapshot.layers.worldbank.status,
      weather: snapshot.layers.weather.status
    }
  };
}
