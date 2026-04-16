import type { Country } from "./types";

const backendBaseUrl = import.meta.env.VITE_BACKEND_BASE_URL ?? "http://127.0.0.1:4000";

export async function fetchCountries(): Promise<Country[]> {
  const response = await fetch(`${backendBaseUrl}/api/countries`);
  if (!response.ok) {
    throw new Error("Failed to load countries");
  }

  const payload = (await response.json()) as { data?: Country[] };
  if (!Array.isArray(payload.data)) {
    throw new Error("Invalid countries response format");
  }

  return payload.data;
}

export async function fetchCountryDetails(countryCode: string): Promise<Country> {
  const response = await fetch(`${backendBaseUrl}/api/countries/${countryCode}`);
  if (!response.ok) {
    throw new Error("Failed to load country details");
  }

  const payload = (await response.json()) as { data?: Country };
  if (!payload.data) {
    throw new Error("Invalid country details response format");
  }

  return payload.data;
}
