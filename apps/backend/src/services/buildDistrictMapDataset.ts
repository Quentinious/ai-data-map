import type { MapDistrictItem, MapDistrictsResponse } from "../dto/mapDistricts.js";
import type { Listing } from "../dto/listing.js";
import { loadDistricts } from "./loadDistricts.js";
import { getDatasetMode, getListingsSource, getListingsUpdatedAt, loadListings } from "./loadListings.js";
import { districtCentroidsNsk } from "./districtCentroids.nsk.js";
import type { ListingFilters } from "../routes/v1/parseListingFilters.js";

function isValidListing(listing: Listing): boolean {
  return (
    listing.areaM2 > 0 &&
    listing.priceRub > 0 &&
    listing.rooms >= 1 &&
    listing.rooms <= 4
  );
}

function median(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 1) {
    return sorted[middle];
  }

  return Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

export async function buildDistrictMapDataset(filters: ListingFilters = {}): Promise<MapDistrictsResponse> {
  const [districts, listings] = await Promise.all([loadDistricts(), loadListings()]);

  const grouped = new Map<string, number[]>();
  const warnings: string[] = [];

  for (const listing of listings) {
    if (!isValidListing(listing)) {
      continue;
    }

    if (filters.rooms !== undefined && listing.rooms !== filters.rooms) {
      continue;
    }

    if (filters.userType !== undefined && listing.userType !== filters.userType) {
      continue;
    }

    if (filters.minArea !== undefined && listing.areaM2 < filters.minArea) {
      continue;
    }

    if (filters.maxArea !== undefined && listing.areaM2 > filters.maxArea) {
      continue;
    }

    if (filters.minPrice !== undefined && listing.priceRub < filters.minPrice) {
      continue;
    }

    if (filters.maxPrice !== undefined && listing.priceRub > filters.maxPrice) {
      continue;
    }

    const pricePerM2 = Math.round(listing.priceRub / listing.areaM2);
    const existing = grouped.get(listing.districtId);

    if (existing) {
      existing.push(pricePerM2);
    } else {
      grouped.set(listing.districtId, [pricePerM2]);
    }
  }

  const districtItems: MapDistrictItem[] = districts.map((district) => {
    const centroid = districtCentroidsNsk[district.id];

    if (!centroid) {
      warnings.push(`Missing centroid for district: ${district.id}`);
    }

    const pricePerM2Values = grouped.get(district.id) ?? [];

    return {
      id: district.id,
      name: district.name,
      listingCountAfterFilters: pricePerM2Values.length,
      medianPricePerM2: median(pricePerM2Values),
      centroid: centroid ?? { lat: 55.0302, lng: 82.9204 }
    };
  });

  return {
    dataset: {
      mode: getDatasetMode(),
      source: getListingsSource(),
      updatedAt: getListingsUpdatedAt()
    },
    districts: districtItems,
    warnings
  };
}
