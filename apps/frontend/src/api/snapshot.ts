import type { CountrySnapshot } from "../types/snapshot";

const baseUrl = import.meta.env.VITE_BACKEND_BASE_URL ?? "http://127.0.0.1:4000";

type SnapshotResponse = {
  data: CountrySnapshot;
};

export async function fetchCountrySnapshot(countryCode: string): Promise<CountrySnapshot> {
  const response = await fetch(`${baseUrl}/v1/countries/${countryCode}/snapshot`);

  if (!response.ok) {
    throw new Error(`Failed to load snapshot (${response.status})`);
  }

  const payload = (await response.json()) as SnapshotResponse;

  if (!payload?.data) {
    throw new Error("Invalid snapshot response format");
  }

  return payload.data;
}