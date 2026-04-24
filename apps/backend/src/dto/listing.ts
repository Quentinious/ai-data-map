export type District = {
  id: string;
  name: string;
};

export type BuildingType = "panel" | "brick" | "monolith" | "unknown";

export type ListingSource = "sample" | "avito_restapp";

export type Listing = {
  id: string;
  source: ListingSource;
  url: string;
  districtId: string;
  address: string;
  rooms: 1 | 2 | 3 | 4;
  areaM2: number;
  priceRub: number;
  publishedAt: string;
  floor?: number;
  totalFloors?: number;
  buildingType: BuildingType;
  lat?: number;
  lon?: number;
  metro?: string;
  userType?: string;
  category?: string;
  subcategory?: string;
};
