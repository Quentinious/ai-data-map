import { useEffect, useState } from "react";
import {
  generateCountrySummary,
  type AICountrySummaryResponse
} from "../api/ai";

type AISummaryPanelProps = {
  countryCode: string | null;
};

export function AISummaryPanel({ countryCode }: AISummaryPanelProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [data, setData] = useState<AICountrySummaryResponse | null>(null);

  const canGenerate = Boolean(countryCode);

  useEffect(() => {
    setLoading(false);
    setError("");
    setData(null);
  }, [countryCode]);

  const runGenerate = async () => {
    if (!countryCode) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const summary = await generateCountrySummary(countryCode);
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

      {!canGenerate && <p className="muted">Выберите страну, чтобы сгенерировать summary.</p>}
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
            {data.summary.map((point, index) => (
              <li key={`${index}-${point}`}>{point}</li>
            ))}
          </ul>
          <p className="asof-line">
            Coverage: worldbank={data.dataCoverage.worldbank}, weather={data.dataCoverage.weather}
          </p>
        </>
      )}
    </section>
  );
}
