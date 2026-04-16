import type { Country, CountryDetails } from "./types";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

type CountriesResponse = {
  data: Country[];
};

type CountryResponse = {
  data: CountryDetails;
};

export async function fetchCountries(): Promise<Country[]> {
  const response = await fetch(`${apiBaseUrl}/api/countries`);

  if (!response.ok) {
    throw new Error("Failed to load countries");
  }

  const payload = (await response.json()) as CountriesResponse;
  return payload.data;
}

export async function fetchCountryByCode(countryCode: string): Promise<CountryDetails> {
  const response = await fetch(`${apiBaseUrl}/api/countries/${countryCode}`);

  if (!response.ok) {
    throw new Error("Failed to load country details");
  }

  const payload = (await response.json()) as CountryResponse;
  return payload.data;
}
