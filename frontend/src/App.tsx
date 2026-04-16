import { useEffect, useMemo, useState } from "react";
import { fetchCountries } from "./api";
import type { Country } from "./types";

export default function App() {
  const [countries, setCountries] = useState<Country[]>([]);
  const [selectedCode, setSelectedCode] = useState<string>("");
  const [loadError, setLoadError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetchCountries()
      .then((loaded) => {
        if (loaded.length > 0) {
          setCountries(loaded);
          setSelectedCode(loaded[0].countryCode);
        }
        setLoadError("");
      })
      .catch(() => {
        setCountries([]);
        setSelectedCode("");
        setLoadError("Не удалось загрузить список стран с backend.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const selectedCountry = useMemo(
    () => countries.find((country) => country.countryCode === selectedCode) ?? null,
    [countries, selectedCode]
  );

  return (
    <div className="page">
      <header className="header">
        <h1>AI Data Map</h1>
        <p>Sprint 1 Skeleton</p>
      </header>

      <main className="layout">
        <section className="mapArea" aria-label="map area">
          <h2>Map Area</h2>
          <div className="mapPlaceholder">Map placeholder (интеграция позже)</div>
        </section>

        <aside className="sidePanel">
          <h2>Country Panel</h2>
          <label htmlFor="countrySelect">Выбор страны</label>
          <select
            id="countrySelect"
            value={selectedCode}
            onChange={(event) => setSelectedCode(event.target.value)}
            disabled={loading || !!loadError || countries.length === 0}
          >
            {loading && <option value="">Загрузка стран...</option>}
            {!loading && loadError && <option value="">Список стран недоступен</option>}
            {countries.map((country) => (
              <option key={country.countryCode} value={country.countryCode}>
                {country.name} ({country.countryCode})
              </option>
            ))}
          </select>

          {loadError && <p className="warning">{loadError}</p>}

          <div className="selectedCountry">
            <h3>Selected Country</h3>
            {selectedCountry ? (
              <>
                <p>
                  <strong>Name:</strong> {selectedCountry.name}
                </p>
                <p>
                  <strong>Code:</strong> {selectedCountry.countryCode}
                </p>
                <p>
                  <strong>Region:</strong> {selectedCountry.region ?? "n/a"}
                </p>
              </>
            ) : (
              <p>Страна не выбрана.</p>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}
