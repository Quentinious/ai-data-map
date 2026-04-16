import type { AreaSnapshot, SnapshotFilters } from "../types/areaSnapshot";

const baseUrl = import.meta.env.VITE_BACKEND_BASE_URL ?? "http://127.0.0.1:4000";

type AreaSnapshotResponse = {
  data: AreaSnapshot;
};

export async function fetchAreaSnapshot(districtId: string, filters?: SnapshotFilters): Promise<AreaSnapshot> {
  const params = new URLSearchParams();
  if (filters?.rooms !== undefined) params.set("rooms", String(filters.rooms));
  if (filters?.minArea !== undefined) params.set("minArea", String(filters.minArea));
  if (filters?.maxArea !== undefined) params.set("maxArea", String(filters.maxArea));
  if (filters?.minPrice !== undefined) params.set("minPrice", String(filters.minPrice));
  if (filters?.maxPrice !== undefined) params.set("maxPrice", String(filters.maxPrice));

  const query = params.toString();
  const url = `${baseUrl}/v1/areas/${encodeURIComponent(districtId)}/snapshot${query ? `?${query}` : ""}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to load area snapshot (${response.status})`);
  }

  const payload = (await response.json()) as AreaSnapshotResponse;

  if (!payload?.data) {
    throw new Error("Invalid area snapshot response format");
  }

  return payload.data;
}
