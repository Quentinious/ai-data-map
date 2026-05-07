import type { Metric } from "../../dto/metric.js";
import { wbFetchJson } from "./client.js";
import { parseLastNonNull } from "./parseLastNonNull.js";

const WORLD_BANK_INDICATORS = [
  { indicator: "SP.POP.TOTL", key: "wb.population", unit: "people" },
  { indicator: "NY.GDP.MKTP.CD", key: "wb.gdp_current_usd", unit: "USD" },
  { indicator: "NY.GDP.PCAP.CD", key: "wb.gdp_per_capita_usd", unit: "USD/person" },
  { indicator: "SP.DYN.LE00.IN", key: "wb.life_expectancy_years", unit: "years" }
] as const;

export async function getWorldBankCoreMetrics(countryCode: string): Promise<Metric[]> {
  const metrics: Metric[] = [];

  for (const item of WORLD_BANK_INDICATORS) {
    try {
      const wbResponseJson = await wbFetchJson(
        `/country/${countryCode}/indicator/${item.indicator}?format=json&per_page=60`
      );
      const parsed = parseLastNonNull(wbResponseJson);

      if (parsed.value === null) {
        metrics.push({
          key: item.key,
          unit: item.unit,
          source: "worldbank",
          quality: "missing",
          value: null,
          asOf: {},
          indicator: item.indicator
        });
        continue;
      }

      metrics.push({
        key: item.key,
        unit: item.unit,
        source: "worldbank",
        quality: "ok",
        value: parsed.value,
        asOf: parsed.year == null ? {} : { year: parsed.year },
        indicator: item.indicator
      });
    } catch {
      metrics.push({
        key: item.key,
        unit: item.unit,
        source: "worldbank",
        quality: "error",
        value: null,
        asOf: {},
        indicator: item.indicator
      });
    }
  }

  return metrics;
}
