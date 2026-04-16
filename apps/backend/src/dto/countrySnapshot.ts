import type { Metric } from "./metric.js";

export type LayerStatus = "ok" | "degraded" | "error";

export type CountrySnapshot = {
  country: {
    countryCode: string;
    displayName: string;
    repPointType: "capital" | "centroid" | "manual";
  };
  generatedAt: string;
  layers: {
    worldbank: {
      source: "worldbank";
      status: LayerStatus;
      metrics: Metric[];
    };
    weather: {
      source: "openweather";
      status: LayerStatus;
      asOf?: string;
      metrics: Metric[];
    };
  };
  warnings: string[];
};
