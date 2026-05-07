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
let listingsMode: "sample" | "real" = "sample";
let listingsSource = path.basename(defaultListingsPath);
let loggedListingsFallback = false;

function uniquePaths(paths: string[]): string[] {
  return [...new Set(paths)];
}

function resolveListingsCandidates(): string[] {
  const envPath = process.env["LISTINGS_DATA_PATH"]?.trim();

  if (!envPath) {
    return [defaultListingsPath];
  }

  if (path.isAbsolute(envPath)) {
    return [envPath];
  }

  // Support running backend from monorepo root and from apps/backend workspace.
  return uniquePaths([
    path.resolve(process.cwd(), envPath),
    path.resolve(__dirname, "../../", envPath),
    path.resolve(__dirname, "../../../", envPath),
    path.resolve(__dirname, "../../../../", envPath),
  ]);
}

export function getListingsUpdatedAt(): string {
  return listingsUpdatedAt ?? "2025-10-01T00:00:00Z";
}

export function getDatasetMode(): "sample" | "real" {
  return listingsMode;
}

export function getListingsSource(): string {
  return listingsSource;
}

export async function loadListings(): Promise<Listing[]> {
  if (listingsCache) {
    return listingsCache;
  }

  const envPath = process.env["LISTINGS_DATA_PATH"]?.trim();
  const candidates = resolveListingsCandidates();
  let fileContent: string | null = null;
  let loadedPath: string | null = null;
  let lastError: unknown = null;

  for (const candidate of candidates) {
    try {
      fileContent = await readFile(candidate, "utf-8");
      loadedPath = candidate;
      break;
    } catch (error: unknown) {
      lastError = error;
      const isNotFound =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: string }).code === "ENOENT";

      if (!isNotFound) {
        throw error;
      }
    }
  }

  if (!fileContent || !loadedPath) {
    if (envPath) {
      if (!loggedListingsFallback) {
        console.warn(
          `LISTINGS_DATA_PATH not found (${envPath}). Falling back to sample dataset: ${defaultListingsPath}`
        );
        loggedListingsFallback = true;
      }

      fileContent = await readFile(defaultListingsPath, "utf-8");
      loadedPath = defaultListingsPath;
    } else {
      throw lastError instanceof Error ? lastError : new Error("Failed to load listings dataset");
    }
  }

  const parsed = JSON.parse(fileContent) as ListingsFile;

  listingsMode = loadedPath === defaultListingsPath ? "sample" : "real";
  listingsSource = path.basename(loadedPath);

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

export function matchesListingFilter(listing: Listing, filter: ListingsFilter): boolean {
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
}

export function filterListings(listings: Listing[], filter: ListingsFilter): Listing[] {
  return listings.filter((listing) => matchesListingFilter(listing, filter));
}

export async function getFilteredListings(filter: ListingsFilter): Promise<Listing[]> {
  const all = await loadListings();
  return filterListings(all, filter);
}
