export type MetricSource = "worldbank" | "openweather";

export type MetricQuality = "ok" | "missing" | "error";

export type Metric = {
  key: string;
  value: number | null;
  unit: string;
  source: MetricSource;
  quality: MetricQuality;
  asOf: {
    year?: number;
    datetime?: string;
  };
  indicator?: string;
};

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