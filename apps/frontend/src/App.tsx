import { useEffect, useState } from "react";
import { fetchAreas } from "./api/areas";
import { fetchAreaSnapshot } from "./api/areaSnapshot";
import { AISummaryPanel } from "./components/AISummaryPanel";
import { AreaCard } from "./components/AreaCard";
import { FiltersPanel } from "./components/FiltersPanel";
import { ComparePanel } from "./components/ComparePanel";
import { MapPanel } from "./components/MapPanel";
import type { AreaSnapshot, District, SnapshotFilters } from "./types/areaSnapshot";

export default function App() {
  const [districts, setDistricts] = useState<District[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [snapshot, setSnapshot] = useState<AreaSnapshot | null>(null);
  const [districtsError, setDistrictsError] = useState<string>("");
  const [snapshotError, setSnapshotError] = useState<string>("");
  const [loadingSnapshot, setLoadingSnapshot] = useState<boolean>(false);
  const [filters, setFilters] = useState<SnapshotFilters>({});

  useEffect(() => {
    fetchAreas()
      .then((data) => {
        setDistricts(data);
        if (data.length > 0) {
          setSelectedId(data[0].id);
        }
      })
      .catch((err: unknown) => {
        setDistrictsError(err instanceof Error ? err.message : "Failed to load districts");
      });
  }, []);

  const loadSnapshot = (districtId: string, currentFilters: SnapshotFilters) => {
    setLoadingSnapshot(true);
    setSnapshotError("");

    fetchAreaSnapshot(districtId, currentFilters)
      .then((data) => {
        setSnapshot(data);
      })
      .catch((err: unknown) => {
        setSnapshot(null);
        setSnapshotError(err instanceof Error ? err.message : "Failed to load snapshot");
      })
      .finally(() => {
        setLoadingSnapshot(false);
      });
  };

  useEffect(() => {
    if (!selectedId) {
      return;
    }

    loadSnapshot(selectedId, filters);
  }, [selectedId, filters]);

  const handleFiltersApply = (newFilters: SnapshotFilters) => {
    setFilters(newFilters);
  };

  const selectedLabel = districts.find((d) => d.id === selectedId)?.name ?? "-";

  return (
    <div className="page">
      <header className="topbar">
        <h1>AI Data Map</h1>
        <p>Рынок жилья Новосибирска — анализ объявлений по районам</p>
      </header>

      <main className="layout">
        <section className="panel">
          <h2>Выбор района</h2>
          <label htmlFor="district-select">Район Новосибирска</label>
          <select
            id="district-select"
            value={selectedId}
            onChange={(event) => setSelectedId(event.target.value)}
          >
            {districts.map((district) => (
              <option key={district.id} value={district.id}>
                {district.name}
              </option>
            ))}
          </select>

          <div className="meta">
            <p>
              <strong>Выбран:</strong> {selectedLabel}
            </p>
            {districtsError && <p className="error">{districtsError}</p>}
          </div>

          <FiltersPanel onApply={handleFiltersApply} activeFilters={filters} />

          {loadingSnapshot && <p>Loading snapshot...</p>}

          {snapshotError && (
            <div className="snapshot-error-block">
              <p className="error">{snapshotError}</p>
              <button type="button" onClick={() => loadSnapshot(selectedId, filters)} className="retry-button">
                Retry
              </button>
            </div>
          )}

          {snapshot && (
            <>
              <p className="listing-count-line">
                Найдено объявлений: <strong>{snapshot.counts.totalListings}</strong>
              </p>
              <AreaCard snapshot={snapshot} />
            </>
          )}

          <AISummaryPanel districtId={selectedId || null} />
        </section>

        <section className="map-placeholder" aria-label="interactive map">
          <h2>Interactive Map</h2>
          <MapPanel selectedDistrictId={selectedId} filters={filters} onDistrictSelect={setSelectedId} />
        </section>
      </main>

      {districts.length > 0 && selectedId && (
        <ComparePanel
          districts={districts}
          primaryDistrictId={selectedId}
          filters={filters}
        />
      )}
    </div>
  );
}
