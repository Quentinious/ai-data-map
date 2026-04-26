import { useEffect, useState } from "react";
import {
  generateAreaSummary,
  type AIAreaSummaryResponse
} from "../api/ai";

type AISummaryPanelProps = {
  districtId: string | null;
};

export function AISummaryPanel({ districtId }: AISummaryPanelProps) {
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
      const summary = await generateAreaSummary(districtId);
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
          {loading ? "Generating..." : "Generate summary"}
        </button>
      </div>

      {!canGenerate && <p className="muted">Выберите район, чтобы сгенерировать summary.</p>}
      {loading && <p>Loading AI summary...</p>}

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
          <ul className="metrics-list ai-summary-list">
            {data.summaryPoints.map((point, index) => (
              <li key={`${index}-${point}`}>{point}</li>
            ))}
          </ul>
          {data.warnings.length > 0 && (
            <ul className="ai-summary-warnings">
              {data.warnings.map((warning) => (
                <li key={warning} className="ai-summary-warning">{warning}</li>
              ))}
            </ul>
          )}
          <p className="asof-line">
            Район: {data.district.name} · набор данных: {data.dataset.mode}
          </p>
        </>
      )}
    </section>
  );
}
