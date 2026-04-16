import { useEffect, useState } from "react";
import { fetchAreaSnapshot } from "../api/areaSnapshot";
import type { AreaSnapshot, District, SnapshotFilters } from "../types/areaSnapshot";

type ComparePanelProps = {
  districts: District[];
  primaryDistrictId: string;
  filters: SnapshotFilters;
};

function formatPrice(rub: number): string {
  if (rub >= 1_000_000) {
    return `${(rub / 1_000_000).toFixed(2)} млн ₽`;
  }
  return `${rub.toLocaleString("ru-RU")} ₽`;
}

function formatPpm2(ppm2: number): string {
  return `${ppm2.toLocaleString("ru-RU")} ₽/м²`;
}

function calcDeltaPct(a: number, b: number): string | null {
  if (!b || !a) return null;
  const pct = ((a - b) / b) * 100;
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

function CompareCard({ snapshot, label }: { snapshot: AreaSnapshot; label: string }) {
  const { district, counts, priceRub, pricePerM2Rub } = snapshot;
  return (
    <div className="compare-card">
      <div className="compare-card-header">
        <span className="compare-label">{label}</span>
        <span className="compare-district-name">{district.name}</span>
      </div>
      <ul className="compare-stats">
        <li>
          <span className="compare-stat-label">Объявлений</span>
          <span className="compare-stat-value">{counts.totalListings}</span>
        </li>
        <li>
          <span className="compare-stat-label">Медиана ₽/м²</span>
          <span className="compare-stat-value">{formatPpm2(pricePerM2Rub.median)}</span>
        </li>
        <li>
          <span className="compare-stat-label">P25 / P75 ₽/м²</span>
          <span className="compare-stat-value">
            {formatPpm2(pricePerM2Rub.p25)} / {formatPpm2(pricePerM2Rub.p75)}
          </span>
        </li>
        <li>
          <span className="compare-stat-label">Медиана цены</span>
          <span className="compare-stat-value">{formatPrice(priceRub.median)}</span>
        </li>
        <li>
          <span className="compare-stat-label">По комнатам</span>
          <span className="compare-stat-value">
            {Object.entries(counts.byRooms)
              .filter(([, v]) => v > 0)
              .map(([k, v]) => `${k}-к: ${v}`)
              .join(", ") || "—"}
          </span>
        </li>
      </ul>
    </div>
  );
}

export function ComparePanel({ districts, primaryDistrictId, filters }: ComparePanelProps) {
  const [districtA, setDistrictA] = useState<string>(primaryDistrictId);
  const [districtB, setDistrictB] = useState<string>("");
  const [snapshotA, setSnapshotA] = useState<AreaSnapshot | null>(null);
  const [snapshotB, setSnapshotB] = useState<AreaSnapshot | null>(null);
  const [loadingA, setLoadingA] = useState(false);
  const [loadingB, setLoadingB] = useState(false);
  const [errorA, setErrorA] = useState("");
  const [errorB, setErrorB] = useState("");

  // Keep districtA in sync when the primary selection changes
  useEffect(() => {
    setDistrictA(primaryDistrictId);
  }, [primaryDistrictId]);

  useEffect(() => {
    if (!districtA) return;
    setLoadingA(true);
    setErrorA("");
    fetchAreaSnapshot(districtA, filters)
      .then(setSnapshotA)
      .catch((err: unknown) => {
        setSnapshotA(null);
        setErrorA(err instanceof Error ? err.message : "Ошибка загрузки");
      })
      .finally(() => setLoadingA(false));
  }, [districtA, filters]);

  useEffect(() => {
    if (!districtB) {
      setSnapshotB(null);
      return;
    }
    setLoadingB(true);
    setErrorB("");
    fetchAreaSnapshot(districtB, filters)
      .then(setSnapshotB)
      .catch((err: unknown) => {
        setSnapshotB(null);
        setErrorB(err instanceof Error ? err.message : "Ошибка загрузки");
      })
      .finally(() => setLoadingB(false));
  }, [districtB, filters]);

  const delta =
    snapshotA && snapshotB
      ? calcDeltaPct(snapshotA.pricePerM2Rub.median, snapshotB.pricePerM2Rub.median)
      : null;

  const districtAName = districts.find((d) => d.id === districtA)?.name ?? districtA;
  const districtBName = districts.find((d) => d.id === districtB)?.name ?? districtB;

  return (
    <section className="compare-panel">
      <h3 className="compare-panel-title">Сравнение районов</h3>

      <div className="compare-selectors">
        <label className="filters-label">
          Район A
          <select
            className="filters-select"
            value={districtA}
            onChange={(e) => setDistrictA(e.target.value)}
          >
            {districts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>

        <label className="filters-label">
          Район B
          <select
            className="filters-select"
            value={districtB}
            onChange={(e) => setDistrictB(e.target.value)}
          >
            <option value="">— выберите —</option>
            {districts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {(loadingA || loadingB) && <p className="muted">Загрузка данных для сравнения…</p>}

      {(errorA || errorB) && (
        <div>
          {errorA && <p className="error">{errorA}</p>}
          {errorB && <p className="error">{errorB}</p>}
        </div>
      )}

      {snapshotA || snapshotB ? (
        <div className="compare-cards">
          {snapshotA ? (
            <CompareCard snapshot={snapshotA} label="A" />
          ) : (
            <div className="compare-card compare-card-empty">
              {loadingA ? "Загрузка…" : "Нет данных"}
            </div>
          )}
          {districtB ? (
            snapshotB ? (
              <CompareCard snapshot={snapshotB} label="B" />
            ) : (
              <div className="compare-card compare-card-empty">
                {loadingB ? "Загрузка…" : "Нет данных"}
              </div>
            )
          ) : (
            <div className="compare-card compare-card-empty">Выберите район B</div>
          )}
        </div>
      ) : null}

      {delta && snapshotA && snapshotB && (
        <p className="compare-delta">
          Медиана ₽/м² в <strong>{districtAName}</strong> составляет{" "}
          <strong>{delta}</strong> относительно <strong>{districtBName}</strong>
        </p>
      )}
    </section>
  );
}
