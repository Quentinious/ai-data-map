import { describe, it, expect } from "vitest";
import type { Listing } from "../dto/listing.js";
import { filterListings } from "./loadListings.js";

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
    expect(filterListings(sampleListings, {})).toHaveLength(sampleListings.length);
  });

  it("filters by districtId", () => {
    const result = filterListings(sampleListings, { districtId: "centralny" });
    expect(result).toHaveLength(4);
    expect(result.every((l) => l.districtId === "centralny")).toBe(true);
  });

  it("filters by rooms", () => {
    const result = filterListings(sampleListings, { rooms: 2 });
    expect(result).toHaveLength(3);
    expect(result.every((l) => l.rooms === 2)).toBe(true);
  });

  it("filters by districtId and rooms together", () => {
    const result = filterListings(sampleListings, { districtId: "centralny", rooms: 2 });
    expect(result).toHaveLength(2);
  });

  it("filters by minArea", () => {
    const result = filterListings(sampleListings, { minArea: 55 });
    expect(result.every((l) => l.areaM2 >= 55)).toBe(true);
  });

  it("filters by maxArea", () => {
    const result = filterListings(sampleListings, { maxArea: 55 });
    expect(result.every((l) => l.areaM2 <= 55)).toBe(true);
  });

  it("filters by price range", () => {
    const result = filterListings(sampleListings, { minPrice: 4_000_000, maxPrice: 6_000_000 });
    expect(result.every((l) => l.priceRub >= 4_000_000 && l.priceRub <= 6_000_000)).toBe(true);
  });

  it("filters by userType", () => {
    const result = filterListings(sampleListings, { userType: "agent" });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("5");
  });

  it("returns empty array when no listings match", () => {
    const result = filterListings(sampleListings, { districtId: "nonexistent" });
    expect(result).toHaveLength(0);
  });
});
