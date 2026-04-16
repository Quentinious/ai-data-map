import type { District } from "../types/areaSnapshot";

const baseUrl = import.meta.env.VITE_BACKEND_BASE_URL ?? "http://127.0.0.1:4000";

type AreasResponse = {
  data: District[];
};

export async function fetchAreas(): Promise<District[]> {
  const response = await fetch(`${baseUrl}/api/areas`);

  if (!response.ok) {
    throw new Error(`Failed to load districts (${response.status})`);
  }

  const payload = (await response.json()) as AreasResponse;

  if (!payload?.data) {
    throw new Error("Invalid areas response format");
  }

  return payload.data;
}
