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

export type MapListingsDataset = {
  mode: "sample" | "real";
  source: string;
  updatedAt: string;
};

export type MapListingsResponse = {
  dataset: MapListingsDataset;
  districtId: string;
  listings: MapListingPoint[];
  truncated: boolean;
  warnings: string[];
};
