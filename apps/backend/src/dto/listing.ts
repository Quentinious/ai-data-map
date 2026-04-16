export type District = {
  id: string;
  name: string;
};

export type BuildingType = "panel" | "brick" | "monolith" | "unknown";

export type Listing = {
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
  buildingType: BuildingType;
};
