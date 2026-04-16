import type { AreaSnapshot, ListingWithPricePerM2 } from "../dto/areaSnapshot.js";
import type { Listing } from "../dto/listing.js";
import { getDistrictById } from "./loadDistricts.js";
import { getFilteredListings } from "./loadListings.js";
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

export async function buildAreaSnapshot(districtId: string): Promise<AreaSnapshot> {
  const district = await getDistrictById(districtId);

  if (!district) {
    throw createCodedError("DISTRICT_NOT_FOUND", 404, `District not found: ${districtId}`);
  }

  const rawListings = await getFilteredListings({ districtId });
  const listings = rawListings.filter(isValidListing);

  if (listings.length === 0) {
    throw createCodedError("NO_LISTINGS", 404, `No listings found for district: ${districtId}`);
  }

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

  const sortedByM2Asc = [...listingsWithPpm2].sort((a, b) => a.pricePerM2 - b.pricePerM2);
  const cheapestByM2 = sortedByM2Asc.slice(0, 5);
  const expensiveByM2 = [...sortedByM2Asc].reverse().slice(0, 5);

  return {
    district: { id: district.id, name: district.name },
    generatedAt: new Date().toISOString(),
    dataset: {
      mode: "sample",
      updatedAt: "2025-10-01T00:00:00Z",
    },
    counts: {
      totalListings: listings.length,
      byRooms,
    },
    priceRub: priceRubStats,
    pricePerM2Rub: pricePerM2Stats,
    areaM2: areaM2Stats,
    topListings: {
      cheapestByM2,
      expensiveByM2,
    },
    warnings: [
      "Данный набор данных является синтетическим (sample). Не используйте для реальных сделок.",
    ],
  };
}
