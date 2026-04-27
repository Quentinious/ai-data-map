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
