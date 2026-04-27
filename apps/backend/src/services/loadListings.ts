import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Listing } from "../dto/listing.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultListingsPath = path.resolve(__dirname, "../../data/listings.sample.json");

export type ListingsFile =
  | Listing[]
  | { updatedAt: string; source?: string; listings: Listing[] };

let listingsCache: Listing[] | null = null;
let listingsUpdatedAt: string | null = null;

function resolveListingsPath(): string {
  const envPath = process.env["LISTINGS_DATA_PATH"];
  if (envPath) {
    return path.isAbsolute(envPath) ? envPath : path.resolve(process.cwd(), envPath);
  }
  return defaultListingsPath;
}

export function getListingsUpdatedAt(): string {
  return listingsUpdatedAt ?? "2025-10-01T00:00:00Z";
}

export function getDatasetMode(): "sample" | "real" {
  return process.env["LISTINGS_DATA_PATH"] ? "real" : "sample";
}

export function getListingsSource(): string {
  return path.basename(resolveListingsPath());
}

export async function loadListings(): Promise<Listing[]> {
  if (listingsCache) {
    return listingsCache;
  }

  const filePath = resolveListingsPath();
  const fileContent = await readFile(filePath, "utf-8");
  const parsed = JSON.parse(fileContent) as ListingsFile;

  if (Array.isArray(parsed)) {
    listingsCache = parsed;
    listingsUpdatedAt = null;
  } else {
    listingsCache = parsed.listings;
    listingsUpdatedAt = parsed.updatedAt;
  }

  return listingsCache;
}

export type ListingsFilter = {
  districtId?: string;
  rooms?: number;
  userType?: string;
  minArea?: number;
  maxArea?: number;
  minPrice?: number;
  maxPrice?: number;
};

export async function getFilteredListings(filter: ListingsFilter): Promise<Listing[]> {
  const all = await loadListings();

  return all.filter((listing) => {
    if (filter.districtId !== undefined && listing.districtId !== filter.districtId) {
      return false;
    }

    if (filter.rooms !== undefined && listing.rooms !== filter.rooms) {
      return false;
    }

    if (filter.userType !== undefined && listing.userType !== filter.userType) {
      return false;
    }

    if (filter.minArea !== undefined && listing.areaM2 < filter.minArea) {
      return false;
    }

    if (filter.maxArea !== undefined && listing.areaM2 > filter.maxArea) {
      return false;
    }

    if (filter.minPrice !== undefined && listing.priceRub < filter.minPrice) {
      return false;
    }

    if (filter.maxPrice !== undefined && listing.priceRub > filter.maxPrice) {
      return false;
    }

    return true;
  });
}
