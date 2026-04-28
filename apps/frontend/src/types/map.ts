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

export type MapListingPoint = {
  id: string;
  lat: number;
  lng: number;
  priceRub: number;
  areaM2: number;
  pricePerM2: number;
  rooms: 1 | 2 | 3 | 4;
  userType?: string;
  source: string;
};

export type MapListingsResponse = {
  dataset: {
    mode: "sample" | "real";
    source: string;
    updatedAt: string;
  };
  districtId: string;
  listings: MapListingPoint[];
  truncated: boolean;
  warnings: string[];
};
