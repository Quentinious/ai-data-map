import { useEffect, useMemo, useState } from "react";
import { fetchCountries } from "./api";
import { fetchCountrySnapshot } from "./api/snapshot";
import { AISummaryPanel } from "./components/AISummaryPanel";
import { CountryCard } from "./components/CountryCard";
import type { CountrySnapshot } from "./types/snapshot";
import type { Country } from "./types";

export default function App() {
  const [countries, setCountries] = useState<Country[]>([]);
  const [selectedCode, setSelectedCode] = useState<string>("");
  const [snapshot, setSnapshot] = useState<CountrySnapshot | null>(null);
  const [countriesError, setCountriesError] = useState<string>("");
  const [snapshotError, setSnapshotError] = useState<string>("");
  const [loadingSnapshot, setLoadingSnapshot] = useState<boolean>(false);

  useEffect(() => {
    fetchCountries()
      .then((data) => {
        setCountries(data);
        if (data.length > 0) {
          setSelectedCode(data[0].countryCode);
        }
      })
      .catch((err: unknown) => {
        setCountriesError(err instanceof Error ? err.message : "Failed to load countries");
      });
  }, []);

  const loadSnapshot = (countryCode: string) => {
    setLoadingSnapshot(true);
    setSnapshotError("");

    fetchCountrySnapshot(countryCode)
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
    if (!selectedCode) {
      return;
    }

    loadSnapshot(selectedCode);
  }, [selectedCode]);

  const selectedLabel = useMemo(() => {
    const match = countries.find((country) => country.countryCode === selectedCode);
    return match ? `${match.name} (${match.countryCode})` : "-";
  }, [countries, selectedCode]);

  return (
    <div className="page">
      <header className="topbar">
        <h1>AI Data Map</h1>
        <p>MVP Sprint 1: country data explorer</p>
      </header>

      <main className="layout">
        <section className="panel">
          <h2>Country Selector</h2>
          <label htmlFor="country-select">Choose country</label>
          <select
            id="country-select"
            value={selectedCode}
            onChange={(event) => setSelectedCode(event.target.value)}
          >
            {countries.map((country) => (
              <option key={country.countryCode} value={country.countryCode}>
                {country.name} ({country.countryCode})
              </option>
            ))}
          </select>

          <div className="meta">
            <p>
              <strong>Selected:</strong> {selectedLabel}
            </p>
            {countriesError && <p className="error">{countriesError}</p>}
          </div>

          {loadingSnapshot && <p>Loading snapshot...</p>}

          {snapshotError && (
            <div className="snapshot-error-block">
              <p className="error">{snapshotError}</p>
              <button type="button" onClick={() => loadSnapshot(selectedCode)} className="retry-button">
                Retry
              </button>
            </div>
          )}

          {snapshot && <CountryCard snapshot={snapshot} />}

          <AISummaryPanel countryCode={selectedCode || null} />
        </section>

        <section className="map-placeholder" aria-label="map placeholder">
          <h2>Interactive Map</h2>
          <p>Map integration is a Sprint 2 task. This area is reserved for the map canvas.</p>
        </section>
      </main>
    </div>
  );
}
