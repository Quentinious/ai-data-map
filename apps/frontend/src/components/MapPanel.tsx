import type { Feature, FeatureCollection, Geometry } from "geojson";
import L from "leaflet";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GeoJSON, MapContainer, Marker, TileLayer, Tooltip, useMap } from "react-leaflet";
import { fetchDistrictMapData, fetchDistrictTopListings } from "../api/map";
import { districtCentroidsNsk } from "../data/districtCentroids.nsk";
import type { SnapshotFilters } from "../types/areaSnapshot";
import type { MapDistrictItem, MapDistrictsResponse, TopListingItem, TopListingsSort } from "../types/map";

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

type DistrictGeoJSONCollection = FeatureCollection<Geometry, DistrictFeatureProperties>;

function formatPricePerM2Short(value: number | null): string {
  if (value === null) {
    return "—";
  }

  return `${Math.round(value / 1000)}k ₽/м²`;
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

function formatPrice(rub: number): string {
  if (rub >= 1_000_000) {
    return `${(rub / 1_000_000).toFixed(1)} млн ₽`;
  }
  return `${Math.round(rub).toLocaleString("ru-RU")} ₽`;
}

function buildListingMarkerIcon(index: number, selected: boolean): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<div class="listing-number-marker${selected ? " listing-number-marker--selected" : ""}">${index + 1}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

function SelectedListingFlyTo({
  listings,
  selectedListingId,
}: {
  listings: TopListingItem[];
  selectedListingId: string | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (!selectedListingId) {
      return;
    }

    const listing = listings.find((item) => item.id === selectedListingId);
    if (!listing || listing.lat === undefined || listing.lon === undefined) {
      return;
    }

    map.flyTo([listing.lat, listing.lon], Math.max(map.getZoom(), 13), { duration: 0.55 });
  }, [listings, map, selectedListingId]);

  return null;
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

const SORT_LABELS: Record<TopListingsSort, string> = {
  publishedAt: "Сначала новые",
  priceRub: "Цена ↑",
  pricePerM2: "₽/м² ↑",
  areaM2: "Площадь ↓",
};

export function MapPanel({ selectedDistrictId, filters, onDistrictSelect }: MapPanelProps) {
  const [data, setData] = useState<MapDistrictsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [geoData, setGeoData] = useState<DistrictGeoJSONCollection | null>(null);

  // Top listings state
  const [topListings, setTopListings] = useState<TopListingItem[]>([]);
  const [topListingsSort, setTopListingsSort] = useState<TopListingsSort>("publishedAt");
  const [topListingsLoading, setTopListingsLoading] = useState(false);
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  const [topListingsWarning, setTopListingsWarning] = useState<string>("");
  const topListingsAbortRef = useRef<AbortController | null>(null);

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

  // Fetch top listings whenever district, sort, or filters change
  useEffect(() => {
    topListingsAbortRef.current?.abort();

    if (!selectedDistrictId) {
      setTopListings([]);
      setTopListingsLoading(false);
      setSelectedListingId(null);
      setTopListingsWarning("");
      return;
    }

    const controller = new AbortController();
    topListingsAbortRef.current = controller;
    setTopListingsLoading(true);

    fetchDistrictTopListings(selectedDistrictId, topListingsSort, filters, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setTopListings(result.listings);
          setSelectedListingId(null);
          if (result.mappingMeta && result.mappingMeta.returned < result.mappingMeta.requested) {
            setTopListingsWarning(
              `Показано ${result.mappingMeta.returned} объявлений с координатами (из ${result.mappingMeta.requested}).`,
            );
          } else {
            setTopListingsWarning("");
          }
        }
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          console.warn("Failed to load top listings:", err);
          setTopListings([]);
          setTopListingsWarning("");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setTopListingsLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [selectedDistrictId, topListingsSort, filters]);

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

  const selectedDistrictName = districts.find((d) => d.id === selectedDistrictId)?.name;
  const selectedListing = topListings.find((item) => item.id === selectedListingId) ?? null;

  return (
    <section className="map-panel">
      <div className="map-panel-header">
        <div>
          <h3>Карта районов</h3>
          <p>Чороплет районов и объявления с координатами. Подсказки и детали вынесены в правую панель.</p>
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

      <div className="map-shell map-shell--split">
        {loading && <div className="map-overlay">Загрузка карты районов…</div>}

        <div className="map-canvas-wrap">
          <MapContainer center={NOVOSIBIRSK_CENTER} zoom={NOVOSIBIRSK_ZOOM} scrollWheelZoom className="map-canvas">
            <FitBoundsOnLoad districts={districts} geoData={geoData} />
            <SelectedDistrictFlyTo districts={districts} selectedDistrictId={selectedDistrictId} geoData={geoData} />
            <SelectedListingFlyTo listings={topListings} selectedListingId={selectedListingId} />

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

            {/* Numbered markers for top listings (only for selected district) */}
            {topListings.map((listing, index) => {
              if (listing.lat === undefined || listing.lon === undefined) return null;
              const isSelected = listing.id === selectedListingId;
              return (
                <Marker
                  key={listing.id}
                  position={[listing.lat, listing.lon]}
                  icon={buildListingMarkerIcon(index, isSelected)}
                  eventHandlers={{
                    click: () => setSelectedListingId(isSelected ? null : listing.id),
                  }}
                  zIndexOffset={isSelected ? 1000 : 0}
                >
                  <Tooltip direction="top" offset={[0, -10]} opacity={1} permanent={false} className="listing-tooltip">
                    <span>#{index + 1}</span>
                    <span>{formatPrice(listing.priceRub)}</span>
                    <span>{listing.pricePerM2.toLocaleString("ru-RU")} ₽/м²</span>
                  </Tooltip>
                </Marker>
              );
            })}
          </MapContainer>

          <p className="map-legend-caption">Цвет района = медиана ₽/м²</p>
        </div>

        <aside className="map-sidebar" aria-label="Панель карты">
          <div className="map-legend-panel map-legend-panel--sidebar" aria-label="Легенда карты">
            <h4>МЕДИАНА ₽/м²</h4>
            <ul>
              {legendBands.map((band) => (
                <li key={band.label}>
                  <span className="map-legend-swatch" style={{ backgroundColor: band.color }} />
                  <span>{band.label}</span>
                </li>
              ))}
            </ul>
          </div>

          {selectedDistrictId && (
            <div className="top-listings-overlay top-listings-overlay--sidebar" aria-label="Топ объявлений района">
              <div className="top-listings-header">
                <span className="top-listings-title">
                  {topListingsLoading
                    ? `Объявления${selectedDistrictName ? ` · ${selectedDistrictName}` : ""}`
                    : topListings.length > 0
                      ? `Топ ${topListings.length}${selectedDistrictName ? ` · ${selectedDistrictName}` : ""}`
                      : `Объявления${selectedDistrictName ? ` · ${selectedDistrictName}` : ""}`}
                </span>
                <select
                  className="top-listings-sort"
                  value={topListingsSort}
                  onChange={(e) => setTopListingsSort(e.target.value as TopListingsSort)}
                  aria-label="Сортировка объявлений"
                >
                  {(Object.keys(SORT_LABELS) as TopListingsSort[]).map((key) => (
                    <option key={key} value={key}>
                      {SORT_LABELS[key]}
                    </option>
                  ))}
                </select>
              </div>

              {!!topListingsWarning && <p className="top-listings-warning">{topListingsWarning}</p>}

              {topListingsLoading ? (
                <p className="top-listings-empty">Загрузка…</p>
              ) : topListings.length === 0 ? (
                <p className="top-listings-empty">Нет объявлений</p>
              ) : (
                <ol className="top-listings-list">
                  {topListings.map((listing, index) => {
                    const isSelected = listing.id === selectedListingId;
                    return (
                      <li
                        key={listing.id}
                        className={`top-listings-item${isSelected ? " top-listings-item--selected" : ""}`}
                        onClick={() => setSelectedListingId(isSelected ? null : listing.id)}
                      >
                        <span className="top-listings-num">{index + 1}</span>
                        <span className="top-listings-rooms">{listing.rooms}-к</span>
                        <span className="top-listings-area">{listing.areaM2} м²</span>
                        <span className="top-listings-price">{formatPrice(listing.priceRub)}</span>
                        <span className="top-listings-ppm2">{listing.pricePerM2.toLocaleString("ru-RU")} ₽/м²</span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          )}

          {selectedListing && (
            <div className="top-listings-detail top-listings-detail--sidebar">
              <p className="top-listings-detail-headline">
                #{topListings.findIndex((item) => item.id === selectedListing.id) + 1} · {selectedListing.rooms}-к, {selectedListing.areaM2} м²
              </p>
              <p className="top-listings-detail-price">
                {formatPrice(selectedListing.priceRub)} · {selectedListing.pricePerM2.toLocaleString("ru-RU")} ₽/м²
              </p>
              {selectedListing.address && <p className="top-listings-detail-address">{selectedListing.address}</p>}
              {selectedListing.metro && <p className="top-listings-detail-metro">🚇 {selectedListing.metro}</p>}
              {selectedListing.userType && (
                <p className="top-listings-detail-usertype">Продавец: {selectedListing.userType}</p>
              )}
              <a
                href={selectedListing.url}
                target="_blank"
                rel="noopener noreferrer"
                className="top-listings-detail-link"
              >
                Открыть объявление ↗
              </a>
            </div>
          )}
        </aside>
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
          Выбран район: <strong>{selectedDistrictName ?? "—"}</strong>
        </p>
      )}
    </section>
  );
}
