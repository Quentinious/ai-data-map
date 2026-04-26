import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Listing } from "../dto/listing.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultListingsPath = path.resolve(__dirname, "../../data/listings.sample.json");

export type ListingsFile =
  | Listing[]
  | {
      updatedAt: string;
      source?: string;
      totalInputRows?: number;
      dedupedListings?: number;
      droppedListings?: number;
      listings: Listing[];
    };

let listingsCache: Listing[] | null = null;
let listingsUpdatedAt: string | null = null;
let listingsSource: string | null = null;
let listingsTotalInputRows: number | null = null;
let listingsDedupedListings: number | null = null;
let listingsDroppedListings: number | null = null;

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

export type DatasetStatus = {
  mode: "sample" | "real";
  source: string;
  updatedAt: string;
  totalListings: number;
  dedupedListings: number | null;
  droppedListings: number | null;
  warnings: string[];
};

export async function getDatasetStatus(): Promise<DatasetStatus> {
  const listings = await loadListings();
  const mode = getDatasetMode();
  const warnings: string[] = [];
  if (mode === "sample") {
    warnings.push("sample dataset");
  }
  return {
    mode,
    source: listingsSource ?? (mode === "sample" ? "sample" : "avito_restapp"),
    updatedAt: getListingsUpdatedAt(),
    totalListings: listings.length,
    dedupedListings: listingsDedupedListings,
    droppedListings: listingsDroppedListings,
    warnings,
  };
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
    listingsSource = null;
    listingsTotalInputRows = null;
    listingsDedupedListings = null;
    listingsDroppedListings = null;
  } else {
    listingsCache = parsed.listings;
    listingsUpdatedAt = parsed.updatedAt;
    listingsSource = parsed.source ?? null;
    listingsTotalInputRows = parsed.totalInputRows ?? null;
    listingsDedupedListings = parsed.dedupedListings ?? null;
    listingsDroppedListings = parsed.droppedListings ?? null;
  }

  return listingsCache;
}

export type ListingsFilter = {
  districtId?: string;
  rooms?: number;
  minArea?: number;
  maxArea?: number;
  minPrice?: number;
  maxPrice?: number;
  userType?: "any" | "private" | "agency";
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

    if (filter.userType !== undefined && filter.userType !== "any") {
      const rawUserType = (listing.userType ?? "").toLowerCase();
      if (filter.userType === "private") {
        // Private: keep listings explicitly marked as private ("частн", "физ").
        // Listings with unknown/empty userType are excluded to avoid showing agency listings.
        if (!rawUserType.includes("частн") && !rawUserType.includes("физ")) {
          return false;
        }
      } else if (filter.userType === "agency") {
        // Agency: keep only listings explicitly marked as agency ("агент", "юр").
        if (!rawUserType.includes("агент") && !rawUserType.includes("юр")) {
          return false;
        }
      }
    }

    return true;
  });
}
