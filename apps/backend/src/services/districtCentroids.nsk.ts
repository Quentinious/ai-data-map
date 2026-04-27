export type DistrictCentroid = {
  lat: number;
  lng: number;
};

export const districtCentroidsNsk: Record<string, DistrictCentroid> = {
  centralny: { lat: 55.0302, lng: 82.9204 },
  zheleznodorozhny: { lat: 55.0375, lng: 82.9181 },
  zaeltsovsky: { lat: 55.0704, lng: 82.8968 },
  kalininsky: { lat: 55.0908, lng: 82.9366 },
  leninsky: { lat: 54.9805, lng: 82.8904 },
  kirovsky: { lat: 54.9641, lng: 82.8597 },
  oktyabrsky: { lat: 55.0133, lng: 82.9436 },
  sovetsky: { lat: 54.9874, lng: 83.065 },
  dzerzhinsky: { lat: 55.0531, lng: 82.9006 },
  pervomaysky: { lat: 54.9635, lng: 83.1002 }
};
