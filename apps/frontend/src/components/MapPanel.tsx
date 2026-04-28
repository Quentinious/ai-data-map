import type { Feature, FeatureCollection, Geometry } from "geojson";
import L from "leaflet";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CircleMarker, GeoJSON, MapContainer, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
import { fetchDistrictMapData } from "../api/map";
import { districtCentroidsNsk } from "../data/districtCentroids.nsk";
import type { SnapshotFilters } from "../types/areaSnapshot";
import type { MapDistrictItem, MapDistrictsResponse } from "../types/map";

const NOVOSIBIRSK_CENTER: [number, number] = [55.0302, 82.9204];
const NOVOSIBIRSK_ZOOM = 11;
const LEGEND_COLORS = ["#dbeafe", "#bfdbfe", "#93c5fd", "#60a5fa", "#2563eb", "#1d4ed8"];

type MapPanelProps = {
  selectedDistrictId: string;
  filters: SnapshotFilters;
  onDistrictSelect: (districtId: string) => void;
};

type LegendBand = {
  label: string;
  color: string;
  upperBound: number;
};

type DistrictFeatureProperties = {
  districtId: string;
  districtName: string;
};

type DistrictGeoJSONFeature = Feature<Geometry, DistrictFeatureProperties>;
type DistrictGeoJSONCollection = FeatureCollection<Geometry, DistrictFeatureProperties>;

function formatPricePerM2(value: number | null): string {
  if (value === null) {
    return "—";
  }

  return `${Math.round(value).toLocaleString("ru-RU")} ₽/м²`;
}

function formatPricePerM2Short(value: number | null): string {
  if (value === null) {
    return "—";
  }

  return `${Math.round(value / 1000)}k ₽/м²`;
}

function clamp(min: number, x: number, max: number): number {
  return Math.min(max, Math.max(min, x));
}

function computeRadius(count: number, selected: boolean): number {
  const base = clamp(6, 6 + Math.sqrt(count), 18);
  return base + (selected ? 3 : 0);
}

function percentile(sortedValues: number[], ratio: number): number {
  if (sortedValues.length === 0) {
    return 0;
  }

  if (sortedValues.length === 1) {
    return sortedValues[0];
  }

  const index = ratio * (sortedValues.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  if (lower === upper) {
    return sortedValues[lower];
  }

  const weight = index - lower;
  return Math.round(sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight);
}

function buildLegendBands(districts: MapDistrictItem[]): LegendBand[] {
  const values = districts
    .map((district) => district.medianPricePerM2)
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b);

  if (values.length === 0) {
    return [{ label: "Нет данных", color: "#94a3b8", upperBound: Number.POSITIVE_INFINITY }];
  }

  if (values[0] === values[values.length - 1]) {
    return [{ label: formatPricePerM2Short(values[0]), color: LEGEND_COLORS[0], upperBound: values[0] }];
  }

  const bands: LegendBand[] = [];
  const bandCount = LEGEND_COLORS.length;

  for (let index = 0; index < bandCount; index += 1) {
    const lowerRatio = index / bandCount;
    const upperRatio = (index + 1) / bandCount;
    const lowerBound = index === 0 ? values[0] : percentile(values, lowerRatio);
    const upperBound = index === bandCount - 1 ? values[values.length - 1] : percentile(values, upperRatio);

    bands.push({
      label:
        index === 0
          ? `До ${formatPricePerM2Short(upperBound)}`
          : index === bandCount - 1
            ? `От ${formatPricePerM2Short(lowerBound)}`
            : `${formatPricePerM2Short(lowerBound)} – ${formatPricePerM2Short(upperBound)}`,
      color: LEGEND_COLORS[index],
      upperBound,
    });
  }

  return bands;
}

function getBandColor(value: number | null, bands: LegendBand[]): string {
  if (value === null) {
    return "#94a3b8";
  }

  const band = bands.find((item) => value <= item.upperBound);
  return band?.color ?? bands[bands.length - 1]?.color ?? "#94a3b8";
}

function getDistrictCentroid(district: MapDistrictItem): { lat: number; lng: number } {
  return district.centroid ?? districtCentroidsNsk[district.id] ?? { lat: NOVOSIBIRSK_CENTER[0], lng: NOVOSIBIRSK_CENTER[1] };
}

function getPolygonStyle(medianPricePerM2: number | null, selected: boolean, bands: LegendBand[]): L.PathOptions {
  const fillColor = getBandColor(medianPricePerM2, bands);
  return {
    color: selected ? "#0f172a" : "#334155",
    weight: selected ? 3 : 1.5,
    opacity: selected ? 1 : 0.7,
    fillColor,
    fillOpacity: selected ? 0.55 : 0.28,
  };
}

function getPolygonBounds(geoData: DistrictGeoJSONCollection, districtId: string): L.LatLngBounds | null {
  const feature = geoData.features.find((f) => f.properties.districtId === districtId);
  if (!feature) return null;
  try {
    return L.geoJSON(feature).getBounds();
  } catch {
    return null;
  }
}

function getAllPolygonBounds(geoData: DistrictGeoJSONCollection): L.LatLngBounds | null {
  try {
    const bounds = L.geoJSON(geoData).getBounds();
    return bounds.isValid() ? bounds : null;
  } catch {
    return null;
  }
}

function formatDatasetLabel(mode: MapDistrictsResponse["dataset"]["mode"]): "DEMO" | "REAL" {
  return mode === "sample" ? "DEMO" : "REAL";
}

function formatUpdatedAtLocal(updatedAt: string): string {
  const parsedDate = new Date(updatedAt);
  if (Number.isNaN(parsedDate.getTime())) {
    return updatedAt;
  }

  return parsedDate.toLocaleString("ru-RU");
}

function MapMarkerContent({ district }: { district: MapDistrictItem }) {
  return (
    <>
      <strong>{district.name}</strong>
      <br />
      Объявлений: {district.listingCountAfterFilters}
      <br />
      Медиана ₽/м²: {formatPricePerM2(district.medianPricePerM2)}
    </>
  );
}

function SelectedDistrictFlyTo({
  districts,
  selectedDistrictId,
  geoData,
}: {
  districts: MapDistrictItem[];
  selectedDistrictId: string;
  geoData: DistrictGeoJSONCollection | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (!selectedDistrictId) {
      return;
    }

    if (geoData) {
      const bounds = getPolygonBounds(geoData, selectedDistrictId);
      if (bounds) {
        map.flyToBounds(bounds, { padding: [20, 20], duration: 0.6, maxZoom: 14 });
        return;
      }
    }

    const district = districts.find((item) => item.id === selectedDistrictId);
    if (!district) {
      return;
    }

    const centroid = getDistrictCentroid(district);
    map.flyTo([centroid.lat, centroid.lng], Math.max(map.getZoom(), 12), { duration: 0.6 });
  }, [districts, geoData, map, selectedDistrictId]);

  return null;
}

function FitBoundsOnLoad({
  districts,
  geoData,
}: {
  districts: MapDistrictItem[];
  geoData: DistrictGeoJSONCollection | null;
}) {
  const map = useMap();
  const done = useRef(false);

  useEffect(() => {
    if (done.current || (districts.length === 0 && !geoData)) {
      return;
    }

    if (geoData) {
      const bounds = getAllPolygonBounds(geoData);
      if (bounds) {
        map.fitBounds(bounds, { padding: [20, 20] });
        done.current = true;
        return;
      }
    }

    if (districts.length === 0) {
      return;
    }

    const points = districts.map((district) => {
      const centroid = getDistrictCentroid(district);
      return [centroid.lat, centroid.lng] as [number, number];
    });

    map.fitBounds(points, { padding: [20, 20] });
    done.current = true;
  }, [districts, geoData, map]);

  return null;
}

export function MapPanel({ selectedDistrictId, filters, onDistrictSelect }: MapPanelProps) {
  const [data, setData] = useState<MapDistrictsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [geoData, setGeoData] = useState<DistrictGeoJSONCollection | null>(null);

  // Refs so onEachFeature callbacks always see the latest values without re-mounting the GeoJSON layer
  const legendBandsRef = useRef<LegendBand[]>([]);
  const districtsRef = useRef<MapDistrictItem[]>([]);
  const selectedDistrictIdRef = useRef(selectedDistrictId);
  const onDistrictSelectRef = useRef(onDistrictSelect);

  const loadMapData = () => {
    setLoading(true);
    setError("");

    fetchDistrictMapData(filters)
      .then(setData)
      .catch((err: unknown) => {
        setData(null);
        setError(err instanceof Error ? err.message : "Не удалось загрузить карту районов");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    loadMapData();
  }, [filters]);

  useEffect(() => {
    fetch("/geo/novosibirsk-districts.geojson")
      .then((r) => r.json() as Promise<DistrictGeoJSONCollection>)
      .then(setGeoData)
      .catch((err: unknown) => {
        console.warn("Failed to load district GeoJSON:", err);
      });
  }, []);

  const districts = data?.districts ?? [];
  const legendBands = useMemo(() => buildLegendBands(districts), [districts]);

  // Keep refs in sync with latest values
  legendBandsRef.current = legendBands;
  districtsRef.current = districts;
  selectedDistrictIdRef.current = selectedDistrictId;
  onDistrictSelectRef.current = onDistrictSelect;

  // Stable callback for GeoJSON layer — uses refs to access latest state values
  // without triggering GeoJSON layer re-renders (onEachFeature isn't updated by react-leaflet after mount)
  const onEachFeature = useCallback((feature: Feature, layer: L.Layer) => {
    const props = feature.properties as DistrictFeatureProperties;
    const { districtId, districtName } = props;

    layer.on("mouseover", (e) => {
      (e.target as L.Path).setStyle({ weight: 3, fillOpacity: 0.6 });
      (e.target as L.Path).bringToFront();
    });

    layer.on("mouseout", (e) => {
      const dist = districtsRef.current.find((d) => d.id === districtId);
      const selected = selectedDistrictIdRef.current === districtId;
      (e.target as L.Path).setStyle(getPolygonStyle(dist?.medianPricePerM2 ?? null, selected, legendBandsRef.current));
    });

    layer.on("click", () => {
      onDistrictSelectRef.current(districtId);
    });

    (layer as L.Path).bindTooltip(
      () => {
        const dist = districtsRef.current.find((d) => d.id === districtId);
        const price = dist?.medianPricePerM2 ?? null;
        const count = dist?.listingCountAfterFilters;
        const priceStr = price !== null ? formatPricePerM2Short(price) : "нет данных";
        const countStr = count !== undefined ? ` · ${count} объявл.` : "";
        return `<strong>${districtName}</strong><br/>${priceStr}${countStr}`;
      },
      { sticky: true, direction: "top", className: "district-tooltip" },
    );
  }, []);

  // Style function — recreated when selectedDistrictId or legendBands change (react-leaflet calls setStyle)
  const polygonStyle = (feature?: Feature): L.PathOptions => {
    if (!feature?.properties) return { fillColor: "#94a3b8", fillOpacity: 0.28, color: "#334155", weight: 1.5 };
    const { districtId } = feature.properties as DistrictFeatureProperties;
    const dist = districts.find((d) => d.id === districtId);
    const selected = districtId === selectedDistrictId;
    return getPolygonStyle(dist?.medianPricePerM2 ?? null, selected, legendBands);
  };

  return (
    <section className="map-panel">
      <div className="map-panel-header">
        <div>
          <h3>Interactive map</h3>
          <p>Leaflet + OpenStreetMap без ключей. Цвет маркера показывает медиану ₽/м² по району.</p>
        </div>

        {data && (
          <div
            className={`map-dataset-badge ${
              data.dataset.mode === "sample" ? "map-dataset-badge--demo" : "map-dataset-badge--real"
            }`}
            title={`Updated: ${formatUpdatedAtLocal(data.dataset.updatedAt)}`}
          >
            <span>{formatDatasetLabel(data.dataset.mode)}</span>
          </div>
        )}
      </div>

      {error && (
        <div className="snapshot-error-block">
          <p className="error">{error}</p>
          <button type="button" className="retry-button" onClick={loadMapData}>
            Retry
          </button>
        </div>
      )}

      <div className="map-shell">
        {loading && <div className="map-overlay">Загрузка карты районов…</div>}

        <MapContainer center={NOVOSIBIRSK_CENTER} zoom={NOVOSIBIRSK_ZOOM} scrollWheelZoom className="map-canvas">
          <FitBoundsOnLoad districts={districts} geoData={geoData} />
          <SelectedDistrictFlyTo districts={districts} selectedDistrictId={selectedDistrictId} geoData={geoData} />

          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {geoData && (
            <GeoJSON
              data={geoData}
              style={polygonStyle}
              onEachFeature={onEachFeature}
            />
          )}

          {districts.map((district) => {
            const centroid = getDistrictCentroid(district);
            const selected = district.id === selectedDistrictId;
            const color = getBandColor(district.medianPricePerM2, legendBands);

            return (
              <CircleMarker
                key={district.id}
                center={[centroid.lat, centroid.lng]}
                radius={computeRadius(district.listingCountAfterFilters, selected)}
                eventHandlers={{
                  click: () => onDistrictSelect(district.id),
                }}
                pathOptions={{
                  color: selected ? "#0f172a" : color,
                  fillColor: color,
                  fillOpacity: selected ? 0.9 : 0.5,
                  weight: selected ? 2.5 : 1,
                }}
              >
                <Tooltip direction="top" offset={[0, -8]} opacity={1} sticky>
                  {district.medianPricePerM2 !== null
                    ? `${district.name} — ${formatPricePerM2Short(district.medianPricePerM2)}`
                    : `${district.name} — нет данных`}
                </Tooltip>
                <Popup>
                  <MapMarkerContent district={district} />
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>

        <div className="map-legend" aria-label="Легенда карты">
          <h4>Медиана ₽/м²</h4>
          <ul>
            {legendBands.map((band) => (
              <li key={band.label}>
                <span className="map-legend-swatch" style={{ backgroundColor: band.color }} />
                <span>{band.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {data?.warnings.length ? (
        <div className="warnings-block map-warnings">
          {data.warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      ) : null}

      {districts.length > 0 && (
        <p className="map-caption">
          Выбран район: <strong>{districts.find((district) => district.id === selectedDistrictId)?.name ?? "—"}</strong>
        </p>
      )}
    </section>
  );
}
