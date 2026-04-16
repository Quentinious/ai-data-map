export type MetricSource = "worldbank" | "openweather";

export type MetricQuality = "ok" | "missing" | "error";

export type Metric = {
  key: string;
  label?: string;
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
