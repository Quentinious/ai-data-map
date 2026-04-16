import type { AreaSnapshot } from "../types/areaSnapshot";

const baseUrl = import.meta.env.VITE_BACKEND_BASE_URL ?? "http://127.0.0.1:4000";

type AreaSnapshotResponse = {
  data: AreaSnapshot;
};

export async function fetchAreaSnapshot(districtId: string): Promise<AreaSnapshot> {
  const response = await fetch(`${baseUrl}/v1/areas/${encodeURIComponent(districtId)}/snapshot`);

  if (!response.ok) {
    throw new Error(`Failed to load area snapshot (${response.status})`);
  }

  const payload = (await response.json()) as AreaSnapshotResponse;

  if (!payload?.data) {
    throw new Error("Invalid area snapshot response format");
  }

  return payload.data;
}
