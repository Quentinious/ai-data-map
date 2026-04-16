export type PriceStats = {
  median: number;
  p25: number;
  p75: number;
};

export type ListingWithPricePerM2 = {
  id: string;
  source: "sample";
  url: string;
  districtId: string;
  address: string;
  rooms: 1 | 2 | 3 | 4;
  areaM2: number;
  priceRub: number;
  publishedAt: string;
  floor?: number;
  totalFloors?: number;
  buildingType: "panel" | "brick" | "monolith" | "unknown";
  pricePerM2: number;
};

export type SnapshotFilters = {
  rooms?: number;
  minArea?: number;
  maxArea?: number;
  minPrice?: number;
  maxPrice?: number;
};

export type AreaSnapshot = {
  district: {
    id: string;
    name: string;
  };
  generatedAt: string;
  dataset: {
    mode: "sample";
    updatedAt: string;
  };
  filtersApplied: SnapshotFilters;
  counts: {
    totalListings: number;
    byRooms: {
      1: number;
      2: number;
      3: number;
      4: number;
    };
  };
  priceRub: PriceStats;
  pricePerM2Rub: PriceStats;
  areaM2: PriceStats;
  topListings: {
    cheapestByM2: ListingWithPricePerM2[];
    expensiveByM2: ListingWithPricePerM2[];
  };
  warnings: string[];
};

export type District = {
  id: string;
  name: string;
};
