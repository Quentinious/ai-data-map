import { describe, it, expect } from "vitest";
import type { Listing } from "../dto/listing.js";

// We test the filter predicate logic directly without loading from disk
// by extracting the filter logic inline (matching getFilteredListings behaviour).
function applyFilter(
  listings: Listing[],
  filter: {
    districtId?: string;
    rooms?: number;
    userType?: string;
    minArea?: number;
    maxArea?: number;
    minPrice?: number;
    maxPrice?: number;
  }
): Listing[] {
  return listings.filter((listing) => {
    if (filter.districtId !== undefined && listing.districtId !== filter.districtId) return false;
    if (filter.rooms !== undefined && listing.rooms !== filter.rooms) return false;
    if (filter.userType !== undefined && listing.userType !== filter.userType) return false;
    if (filter.minArea !== undefined && listing.areaM2 < filter.minArea) return false;
    if (filter.maxArea !== undefined && listing.areaM2 > filter.maxArea) return false;
    if (filter.minPrice !== undefined && listing.priceRub < filter.minPrice) return false;
    if (filter.maxPrice !== undefined && listing.priceRub > filter.maxPrice) return false;
    return true;
  });
}

function makeListing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: "test-id",
    source: "sample",
    url: "https://example.com/1",
    districtId: "centralny",
    address: "ул. Ленина 1",
    rooms: 2,
    areaM2: 50,
    priceRub: 5_000_000,
    publishedAt: "2025-10-01T00:00:00Z",
    buildingType: "panel",
    ...overrides,
  };
}

const sampleListings: Listing[] = [
  makeListing({ id: "1", districtId: "centralny", rooms: 1, areaM2: 35, priceRub: 3_000_000 }),
  makeListing({ id: "2", districtId: "centralny", rooms: 2, areaM2: 55, priceRub: 5_500_000 }),
  makeListing({ id: "3", districtId: "centralny", rooms: 3, areaM2: 75, priceRub: 7_200_000 }),
  makeListing({ id: "4", districtId: "kalininsky", rooms: 2, areaM2: 48, priceRub: 4_800_000 }),
  makeListing({ id: "5", districtId: "centralny", rooms: 2, areaM2: 60, priceRub: 6_000_000, userType: "agent" }),
];

describe("listing filter logic", () => {
  it("returns all listings when no filter is applied", () => {
    expect(applyFilter(sampleListings, {})).toHaveLength(sampleListings.length);
  });

  it("filters by districtId", () => {
    const result = applyFilter(sampleListings, { districtId: "centralny" });
    expect(result).toHaveLength(4);
    expect(result.every((l) => l.districtId === "centralny")).toBe(true);
  });

  it("filters by rooms", () => {
    const result = applyFilter(sampleListings, { rooms: 2 });
    expect(result).toHaveLength(3);
    expect(result.every((l) => l.rooms === 2)).toBe(true);
  });

  it("filters by districtId and rooms together", () => {
    const result = applyFilter(sampleListings, { districtId: "centralny", rooms: 2 });
    expect(result).toHaveLength(2);
  });

  it("filters by minArea", () => {
    const result = applyFilter(sampleListings, { minArea: 55 });
    expect(result.every((l) => l.areaM2 >= 55)).toBe(true);
  });

  it("filters by maxArea", () => {
    const result = applyFilter(sampleListings, { maxArea: 55 });
    expect(result.every((l) => l.areaM2 <= 55)).toBe(true);
  });

  it("filters by price range", () => {
    const result = applyFilter(sampleListings, { minPrice: 4_000_000, maxPrice: 6_000_000 });
    expect(result.every((l) => l.priceRub >= 4_000_000 && l.priceRub <= 6_000_000)).toBe(true);
  });

  it("filters by userType", () => {
    const result = applyFilter(sampleListings, { userType: "agent" });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("5");
  });

  it("returns empty array when no listings match", () => {
    const result = applyFilter(sampleListings, { districtId: "nonexistent" });
    expect(result).toHaveLength(0);
  });
});
