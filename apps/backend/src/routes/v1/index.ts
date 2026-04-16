import { Router, type Request, type Response } from "express";
import type { CountrySnapshot } from "../../dto/countrySnapshot.js";
import { getOpenWeatherMetrics } from "../../integrations/openweather/getWeatherMetrics.js";
import { getWorldBankCoreMetrics } from "../../integrations/worldbank/getCoreMetrics.js";
import { getCountryReferenceByCode } from "../../countryReference/loadCountries.js";
import { validateCountryCode } from "../../middleware/validateCountryCode.js";

const router = Router();

function getLayerStatus(metrics: Array<{ quality: string }>): "ok" | "degraded" | "error" {
  if (metrics.length === 0 || metrics.every((metric) => metric.quality === "error")) {
    return "error";
  }

  if (metrics.some((metric) => metric.quality === "error")) {
    return "degraded";
  }

  return "ok";
}

router.get("/countries/:countryCode/snapshot", validateCountryCode, async (req: Request, res: Response) => {
  const countryCode = String(req.params.countryCode);
  const country = await getCountryReferenceByCode(countryCode);

  if (!country) {
    res.status(404).json({
      error: {
        code: "COUNTRY_NOT_FOUND",
        message: `Country not found: ${countryCode}`
      }
    });
    return;
  }

  const [wbMetrics, weatherResult] = await Promise.all([
    getWorldBankCoreMetrics(countryCode),
    getOpenWeatherMetrics(country.representativePoint.lat, country.representativePoint.lon)
  ]);

  const worldBankStatus = getLayerStatus(wbMetrics);
  const weatherStatus = getLayerStatus(weatherResult.metrics);
  const weatherApiKeyMissing = !process.env.OPENWEATHER_API_KEY;
  const now = new Date();
  const warnings = ["Snapshot stub: integrations not implemented yet"];

  if (weatherApiKeyMissing) {
    warnings.push("OpenWeather disabled: OPENWEATHER_API_KEY is not set");
  }

  const snapshot: CountrySnapshot = {
    country: {
      countryCode: country.countryCode,
      displayName: country.displayName,
      repPointType: country.repPointType
    },
    generatedAt: now.toISOString(),
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

  res.json({ data: snapshot });
});

export default router;
