import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Listing } from "../dto/listing.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const listingsFilePath = path.resolve(__dirname, "../../data/listings.sample.json");

let listingsCache: Listing[] | null = null;

export async function loadListings(): Promise<Listing[]> {
  if (listingsCache) {
    return listingsCache;
  }

  const fileContent = await readFile(listingsFilePath, "utf-8");
  listingsCache = JSON.parse(fileContent) as Listing[];
  return listingsCache;
}

export type ListingsFilter = {
  districtId?: string;
  rooms?: number;
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
