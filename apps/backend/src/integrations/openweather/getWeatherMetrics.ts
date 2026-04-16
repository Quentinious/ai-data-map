import type { Metric } from "../../dto/metric.js";
import { owFetchJson } from "./client.js";

const WEATHER_METRICS = [
  { key: "ow.temp_c", unit: "°C", label: "Temperature", sourceKey: ["main", "temp"] as const },
  { key: "ow.humidity_pct", unit: "%", label: "Humidity", sourceKey: ["main", "humidity"] as const },
  { key: "ow.wind_m_s", unit: "m/s", label: "Wind speed", sourceKey: ["wind", "speed"] as const },
  { key: "ow.clouds_pct", unit: "%", label: "Cloud cover", sourceKey: ["clouds", "all"] as const },
  { key: "ow.precip_1h_mm", unit: "mm", label: "Precipitation last hour", sourceKey: ["rain", "1h"] as const, optional: true }
] as const;

function getNestedValue(payload: any, path: readonly [string, string]): number | null {
  const [first, second] = path;
  const value = payload?.[first]?.[second];
  return typeof value === "number" ? value : null;
}

function buildErrorMetrics(asOf: string): Metric[] {
  return WEATHER_METRICS.map((metric) => ({
    key: metric.key,
    label: metric.label,
    value: null,
    unit: metric.unit,
    source: "openweather",
    quality: "error",
    asOf: { datetime: asOf },
    indicator: metric.key
  }));
}

export async function getOpenWeatherMetrics(lat: number, lon: number): Promise<{ asOf: string; metrics: Metric[] }> {
  const nowIso = new Date().toISOString();

  if (!process.env.OPENWEATHER_API_KEY) {
    return { asOf: nowIso, metrics: buildErrorMetrics(nowIso) };
  }

  try {
    const payload = await owFetchJson(`/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric`);
    const asOf = typeof payload?.dt === "number" ? new Date(payload.dt * 1000).toISOString() : nowIso;

    const metrics: Metric[] = WEATHER_METRICS.map((metric) => {
      if (metric.key === "ow.precip_1h_mm") {
        const rainValue = payload?.rain?.["1h"];

        if (typeof rainValue === "number") {
          return {
            key: metric.key,
            label: metric.label,
            value: rainValue,
            unit: metric.unit,
            source: "openweather",
            quality: "ok",
            asOf: { datetime: asOf },
            indicator: metric.key
          };
        }

        return {
          key: metric.key,
          label: metric.label,
          value: null,
          unit: metric.unit,
          source: "openweather",
          quality: "missing",
          asOf: { datetime: asOf },
          indicator: metric.key
        };
      }

      const value = getNestedValue(payload, metric.sourceKey as readonly [string, string]);

      if (value == null) {
        return {
          key: metric.key,
          label: metric.label,
          value: null,
          unit: metric.unit,
          source: "openweather",
          quality: "error",
          asOf: { datetime: asOf },
          indicator: metric.key
        };
      }

      return {
        key: metric.key,
        label: metric.label,
        value,
        unit: metric.unit,
        source: "openweather",
        quality: "ok",
        asOf: { datetime: asOf },
        indicator: metric.key
      };
    });

    return { asOf, metrics };
  } catch (error) {
    return { asOf: nowIso, metrics: buildErrorMetrics(nowIso) };
  }
}
