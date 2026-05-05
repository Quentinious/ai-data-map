import type { SnapshotFilters } from "../types/areaSnapshot";
import type { DistrictTopListingsResponse, MapDistrictsResponse, TopListingsSort } from "../types/map";

const baseUrl = import.meta.env.VITE_BACKEND_BASE_URL ?? "http://127.0.0.1:4000";

type MapDistrictsResponseBody = {
  data: MapDistrictsResponse;
};

export async function fetchDistrictMapData(filters?: SnapshotFilters): Promise<MapDistrictsResponse> {
  const params = new URLSearchParams();

  if (filters?.rooms !== undefined) params.set("rooms", String(filters.rooms));
  if (filters?.userType !== undefined) params.set("userType", filters.userType);
  if (filters?.minArea !== undefined) params.set("minArea", String(filters.minArea));
  if (filters?.maxArea !== undefined) params.set("maxArea", String(filters.maxArea));
  if (filters?.minPrice !== undefined) params.set("minPrice", String(filters.minPrice));
  if (filters?.maxPrice !== undefined) params.set("maxPrice", String(filters.maxPrice));

  const query = params.toString();
  const response = await fetch(`${baseUrl}/v1/map/districts${query ? `?${query}` : ""}`);

  if (!response.ok) {
    throw new Error(`Failed to load district map (${response.status})`);
  }

  const payload = (await response.json()) as MapDistrictsResponseBody;

  if (!payload?.data) {
    throw new Error("Invalid district map response format");
  }

  return payload.data;
}

type TopListingsResponseBody = {
  data: DistrictTopListingsResponse;
};

export async function fetchDistrictTopListings(
  districtId: string,
  sort: TopListingsSort,
  filters?: SnapshotFilters,
  signal?: AbortSignal,
): Promise<DistrictTopListingsResponse> {
  const params = new URLSearchParams();
  params.set("districtId", districtId);
  params.set("sort", sort);
  params.set("limit", "5");

  if (filters?.rooms !== undefined) params.set("rooms", String(filters.rooms));
  if (filters?.userType !== undefined) params.set("userType", filters.userType);
  if (filters?.minArea !== undefined) params.set("minArea", String(filters.minArea));
  if (filters?.maxArea !== undefined) params.set("maxArea", String(filters.maxArea));
  if (filters?.minPrice !== undefined) params.set("minPrice", String(filters.minPrice));
  if (filters?.maxPrice !== undefined) params.set("maxPrice", String(filters.maxPrice));

  const response = await fetch(`${baseUrl}/v1/map/listings?${params.toString()}`, { signal });

  if (!response.ok) {
    throw new Error(`Failed to load top listings (${response.status})`);
  }

  const payload = (await response.json()) as TopListingsResponseBody;

  if (!payload?.data) {
    throw new Error("Invalid top listings response format");
  }

  return payload.data;
}
