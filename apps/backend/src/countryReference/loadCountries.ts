import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { CountryReference } from "./types.js";

type CountryRow = {
  countryCode: string;
  name: string;
};

const representativePoints: Record<string, { lat: number; lon: number }> = {
  US: { lat: 38.9072, lon: -77.0369 },
  CA: { lat: 45.4215, lon: -75.6972 },
  BR: { lat: -15.7939, lon: -47.8828 },
  DE: { lat: 52.52, lon: 13.405 },
  FR: { lat: 48.8566, lon: 2.3522 },
  IN: { lat: 28.6139, lon: 77.209 },
  JP: { lat: 35.6762, lon: 139.6503 },
  NG: { lat: 9.0765, lon: 7.3986 },
  ZA: { lat: -25.7479, lon: 28.2293 },
  AU: { lat: -35.2809, lon: 149.13 }
};

let countriesCache: CountryReference[] | null = null;

export async function loadCountries(): Promise<CountryReference[]> {
  if (countriesCache) {
    return countriesCache;
  }

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const countriesFilePath = path.resolve(__dirname, "../../data/countries.json");

  const fileContent = await readFile(countriesFilePath, "utf-8");
  const parsed = JSON.parse(fileContent) as CountryRow[];

  countriesCache = parsed.map((country) => ({
    countryCode: country.countryCode,
    displayName: country.name,
    repPointType: "capital",
    representativePoint: representativePoints[country.countryCode] ?? representativePoints.US
  }));

  return countriesCache;
}

export async function getCountryReferenceByCode(countryCode: string): Promise<CountryReference | null> {
  const countries = await loadCountries();
  return countries.find((country) => country.countryCode === countryCode) ?? null;
}
