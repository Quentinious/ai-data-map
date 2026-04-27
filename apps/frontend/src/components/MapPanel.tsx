import { useEffect, useMemo, useRef, useState } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
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

function SelectedDistrictFlyTo({ districts, selectedDistrictId }: { districts: MapDistrictItem[]; selectedDistrictId: string }) {
  const map = useMap();

  useEffect(() => {
    if (!selectedDistrictId) {
      return;
    }

    const district = districts.find((item) => item.id === selectedDistrictId);
    if (!district) {
      return;
    }

    const centroid = getDistrictCentroid(district);
    map.flyTo([centroid.lat, centroid.lng], Math.max(map.getZoom(), 12), { duration: 0.6 });
  }, [districts, map, selectedDistrictId]);

  return null;
}

function FitBoundsOnLoad({ districts }: { districts: MapDistrictItem[] }) {
  const map = useMap();
  const done = useRef(false);

  useEffect(() => {
    if (done.current || districts.length === 0) {
      return;
    }

    const points = districts.map((district) => {
      const centroid = getDistrictCentroid(district);
      return [centroid.lat, centroid.lng] as [number, number];
    });

    map.fitBounds(points, { padding: [20, 20] });
    done.current = true;
  }, [districts, map]);

  return null;
}

export function MapPanel({ selectedDistrictId, filters, onDistrictSelect }: MapPanelProps) {
  const [data, setData] = useState<MapDistrictsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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

  const districts = data?.districts ?? [];
  const legendBands = useMemo(() => buildLegendBands(districts), [districts]);

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
          <FitBoundsOnLoad districts={districts} />
          <SelectedDistrictFlyTo districts={districts} selectedDistrictId={selectedDistrictId} />

          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

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
                  fillOpacity: selected ? 0.95 : 0.82,
                  weight: selected ? 3 : 1.5,
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
