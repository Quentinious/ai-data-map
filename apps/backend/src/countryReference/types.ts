export type CountryReference = {
  countryCode: string;
  displayName: string;
  repPointType: "capital" | "centroid" | "manual";
  representativePoint: {
    lat: number;
    lon: number;
  };
};
