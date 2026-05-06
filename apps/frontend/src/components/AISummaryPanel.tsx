import { useEffect, useState } from "react";
import {
  generateAreaSummary,
  type AIAreaSummaryResponse
} from "../api/ai";
import type { SnapshotFilters } from "../types/areaSnapshot";

type AISummaryPanelProps = {
  districtId: string | null;
  filters: SnapshotFilters;
  dataset?: {
    mode?: string;
    updatedAt?: string;
  };
};

export function AISummaryPanel({ districtId, filters, dataset }: AISummaryPanelProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [data, setData] = useState<AIAreaSummaryResponse | null>(null);

  const canGenerate = Boolean(districtId);

  useEffect(() => {
    setLoading(false);
    setError("");
    setData(null);
  }, [districtId]);

  const runGenerate = async () => {
    if (!districtId) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const summary = await generateAreaSummary({
        districtId,
        filters,
        dataset,
      });
      setData(summary);
    } catch (err: unknown) {
      setData(null);
      setError(err instanceof Error ? err.message : "Failed to generate AI summary");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="ai-summary-panel">
      <h3>AI Summary</h3>
      <div className="ai-summary-actions">
        <button type="button" onClick={runGenerate} disabled={!canGenerate || loading} className="retry-button">
          {loading ? "Генерирую..." : "Сгенерировать AI summary"}
        </button>
      </div>

      {!canGenerate && <p className="muted">Выберите район, чтобы сгенерировать summary.</p>}
      {loading && <p>Генерация summary...</p>}

      {error && (
        <div className="snapshot-error-block">
          <p className="error">{error}</p>
          <button type="button" onClick={runGenerate} className="retry-button" disabled={!canGenerate || loading}>
            Retry
          </button>
        </div>
      )}

      {data && (
        <>
          <p className="ai-summary-text">{data.summaryText}</p>
          {data.warnings.length > 0 && (
            <ul className="ai-summary-warnings">
              {data.warnings.map((warning) => (
                <li key={warning} className="ai-summary-warning">{warning}</li>
              ))}
            </ul>
          )}
          <p className="asof-line">
            Район: {data.district.name} · набор данных: {data.dataset.mode} · источник: {data.source}
          </p>
        </>
      )}
    </section>
  );
}
