import { useEffect, useMemo, useState } from "react";
import { fetchCountries, fetchCountryByCode } from "./api";
import type { Country, CountryDetails } from "./types";

export default function App() {
  const [countries, setCountries] = useState<Country[]>([]);
  const [selectedCode, setSelectedCode] = useState<string>("");
  const [selectedCountry, setSelectedCountry] = useState<CountryDetails | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    fetchCountries()
      .then((data) => {
        setCountries(data);
        if (data.length > 0) {
          setSelectedCode(data[0].countryCode);
        }
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load countries");
      });
  }, []);

  useEffect(() => {
    if (!selectedCode) {
      return;
    }

    setLoading(true);
    setError("");

    fetchCountryByCode(selectedCode)
      .then((data) => setSelectedCountry(data))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load country details");
        setSelectedCountry(null);
      })
      .finally(() => setLoading(false));
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
            {loading && <p>Loading country details...</p>}
            {error && <p className="error">{error}</p>}
          </div>

          {selectedCountry && (
            <article className="card">
              <h3>{selectedCountry.name}</h3>
              <p>
                <strong>ISO2:</strong> {selectedCountry.countryCode}
              </p>
              <p>
                <strong>Region:</strong> {selectedCountry.region ?? "n/a"}
              </p>
              <p>
                <strong>Income level:</strong> {selectedCountry.incomeLevel ?? "n/a"}
              </p>
              <p>
                <strong>AI summary:</strong> {selectedCountry.aiSummary}
              </p>
            </article>
          )}
        </section>

        <section className="map-placeholder" aria-label="map placeholder">
          <h2>Interactive Map</h2>
          <p>Map integration is a Sprint 2 task. This area is reserved for the map canvas.</p>
        </section>
      </main>
    </div>
  );
}
