export type MapDistrictItem = {
  id: string;
  name: string;
  listingCountAfterFilters: number;
  medianPricePerM2: number | null;
  centroid: {
    lat: number;
    lng: number;
  };
};

export type MapDistrictsDataset = {
  mode: "sample" | "real";
  source: string;
  updatedAt: string;
};

export type MapDistrictsResponse = {
  dataset: MapDistrictsDataset;
  districts: MapDistrictItem[];
  warnings: string[];
};

export type TopListingsSort = "publishedAt" | "priceRub" | "pricePerM2" | "areaM2";

export type TopListingItem = {
  id: string;
  districtId: string;
  url: string;
  address: string;
  rooms: 1 | 2 | 3 | 4;
  areaM2: number;
  priceRub: number;
  pricePerM2: number;
  publishedAt: string;
  metro?: string;
  userType?: string;
  lat?: number;
  lon?: number;
};

export type DistrictTopListingsResponse = {
  districtId: string;
  sort: TopListingsSort;
  total: number;
  listings: TopListingItem[];
  mappingMeta?: {
    requested: number;
    returned: number;
    skippedNoCoords: number;
    skippedOutOfBbox: number;
    swappedCount: number;
  };
  warnings: string[];
};
