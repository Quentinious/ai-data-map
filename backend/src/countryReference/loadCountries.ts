import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { CountryReference } from "./types.js";

let countries: CountryReference[] = [];

function isValidCountryCode(value: string): boolean {
  return /^[A-Z]{2}$/.test(value);
}

export async function loadCountriesOnStart(): Promise<void> {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const countriesFilePath = path.resolve(
    __dirname,
    process.env.COUNTRIES_FILE_PATH ?? "../../../data/countries.json"
  );

  const fileRaw = await readFile(countriesFilePath, "utf-8");
  const parsed = JSON.parse(fileRaw) as CountryReference[];

  if (!Array.isArray(parsed)) {
    throw new Error("countries.json must contain an array");
  }

  parsed.forEach((country, index) => {
    if (!country || typeof country !== "object") {
      throw new Error(`countries.json item at index ${index} must be an object`);
    }

    if (typeof country.name !== "string" || country.name.trim().length === 0) {
      throw new Error(`countries.json item at index ${index} has invalid name`);
    }

    if (typeof country.countryCode !== "string" || !isValidCountryCode(country.countryCode)) {
      throw new Error(`countries.json item at index ${index} has invalid countryCode`);
    }
  });

  countries = parsed;
}

export function getCountries(): CountryReference[] {
  return countries;
}
