import type { AreaSnapshot, ListingWithPricePerM2, SnapshotFilters } from "../dto/areaSnapshot.js";
import type { Listing } from "../dto/listing.js";
import { getDistrictById } from "./loadDistricts.js";
import { getDatasetMode, getDatasetStatus, getFilteredListings, getListingsUpdatedAt } from "./loadListings.js";
import { computeStats } from "./statsHelpers.js";

type CodedError = Error & {
  code: string;
  status: number;
  details?: unknown;
};

function createCodedError(code: string, status: number, message: string): CodedError {
  const error = new Error(message) as CodedError;
  error.code = code;
  error.status = status;
  return error;
}

function isValidListing(listing: Listing): boolean {
  return (
    listing.areaM2 > 0 &&
    listing.priceRub > 0 &&
    listing.rooms >= 1 &&
    listing.rooms <= 4
  );
}

function withPricePerM2(listing: Listing): ListingWithPricePerM2 {
  return {
    ...listing,
    pricePerM2: Math.round(listing.priceRub / listing.areaM2),
  };
}

function classifyUserType(rawUserType: string | undefined): "private" | "agency" | "unknown" {
  const s = (rawUserType ?? "").toLowerCase();
  if (s.includes("агент") || s.includes("юр")) return "agency";
  if (s.includes("частн") || s.includes("физ")) return "private";
  return "unknown";
}

export async function buildAreaSnapshot(districtId: string, filters: SnapshotFilters = {}): Promise<AreaSnapshot> {
  const district = await getDistrictById(districtId);

  if (!district) {
    throw createCodedError("DISTRICT_NOT_FOUND", 404, `District not found: ${districtId}`);
  }

  // Count listings before snapshot filters (only districtId filter)
  const allDistrictListings = await getFilteredListings({ districtId });
  const validDistrictListings = allDistrictListings.filter(isValidListing);
  const listingCountBeforeFilters = validDistrictListings.length;

  const rawListings = await getFilteredListings({ districtId, ...filters });
  const listings = rawListings.filter(isValidListing);

  if (listings.length === 0) {
    throw createCodedError("NO_LISTINGS", 404, `No listings found for district: ${districtId}`);
  }

  const listingCountAfterFilters = listings.length;

  const listingsWithPpm2 = listings.map(withPricePerM2);

  const priceRubStats = computeStats(listings.map((l) => l.priceRub));
  const pricePerM2Stats = computeStats(listingsWithPpm2.map((l) => l.pricePerM2));
  const areaM2Stats = computeStats(listings.map((l) => l.areaM2));

  const byRooms = {
    1: listings.filter((l) => l.rooms === 1).length,
    2: listings.filter((l) => l.rooms === 2).length,
    3: listings.filter((l) => l.rooms === 3).length,
    4: listings.filter((l) => l.rooms === 4).length,
  };

  // Composition: userType breakdown
  const compositionByUserType = { private: 0, agency: 0, unknown: 0 };
  for (const l of listings) {
    compositionByUserType[classifyUserType(l.userType)]++;
  }

  const sortedByM2Asc = [...listingsWithPpm2].sort((a, b) => a.pricePerM2 - b.pricePerM2);
  const cheapestByM2 = sortedByM2Asc.slice(0, 5);
  const expensiveByM2 = [...sortedByM2Asc].reverse().slice(0, 5);

  const warnings: string[] = [];
  const datasetMode = getDatasetMode();

  if (datasetMode === "sample") {
    warnings.push(
      "Данный набор данных является синтетическим (sample). Не используйте для реальных сделок."
    );
  }

  if (listings.length < 10) {
    warnings.push(
      `Малая выборка: ${listings.length} объявлений после применения фильтров. Статистика может быть неточной.`
    );
  }

  // Warn if too much data was dropped during import (>30%)
  const status = await getDatasetStatus();
  if (
    status.droppedListings !== null &&
    status.totalListings + status.droppedListings > 0
  ) {
    const totalImported = status.totalListings + status.droppedListings;
    const dropPct = (status.droppedListings / totalImported) * 100;
    if (dropPct > 30) {
      warnings.push(
        `Предупреждение: при импорте было отброшено ${dropPct.toFixed(1)}% записей (${status.droppedListings} из ${totalImported}).`
      );
    }
  }

  return {
    district: { id: district.id, name: district.name },
    generatedAt: new Date().toISOString(),
    dataset: {
      mode: getDatasetMode(),
      updatedAt: getListingsUpdatedAt(),
    },
    filtersApplied: filters,
    counts: {
      totalListings: listings.length,
      byRooms,
    },
    listingCountBeforeFilters,
    listingCountAfterFilters,
    composition: {
      byUserType: compositionByUserType,
      byRooms,
    },
    priceRub: priceRubStats,
    pricePerM2Rub: pricePerM2Stats,
    areaM2: areaM2Stats,
    topListings: {
      cheapestByM2,
      expensiveByM2,
    },
    warnings,
  };
}
