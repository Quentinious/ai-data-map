import type { CountrySnapshot, Metric } from "../types/snapshot";

type CountryCardProps = {
  snapshot: CountrySnapshot;
};

function formatMetric(metric: Metric): string {
  if (metric.quality === "error") {
    return "ошибка источника";
  }

  if (metric.value === null && metric.quality === "missing") {
    return "нет данных";
  }

  if (metric.value === null) {
    return "нет данных";
  }

  return `${metric.value} ${metric.unit}`;
}

function formatMetricAsOf(metric: Metric): string {
  if (metric.asOf.year) {
    return `year: ${metric.asOf.year}`;
  }

  if (metric.asOf.datetime) {
    return `asOf: ${metric.asOf.datetime}`;
  }

  return "";
}

export function CountryCard({ snapshot }: CountryCardProps) {
  return (
    <article className="snapshot-card">
      <h3>
        {snapshot.country.displayName} ({snapshot.country.countryCode})
      </h3>

      {snapshot.warnings.length > 0 && (
        <div className="warnings-block">
          {snapshot.warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      )}

      <section className="metrics-section">
        <div className="metrics-header">
          <h4>World Bank</h4>
          <span className={`status-badge status-${snapshot.layers.worldbank.status}`}>
            {snapshot.layers.worldbank.status}
          </span>
        </div>
        <ul className="metrics-list">
          {snapshot.layers.worldbank.metrics.map((metric) => (
            <li key={metric.key}>
              <strong>{metric.key}</strong>: {formatMetric(metric)}
              {formatMetricAsOf(metric) && ` (${formatMetricAsOf(metric)})`}
            </li>
          ))}
        </ul>
      </section>

      <section className="metrics-section">
        <div className="metrics-header">
          <h4>Weather</h4>
          <span className={`status-badge status-${snapshot.layers.weather.status}`}>
            {snapshot.layers.weather.status}
          </span>
        </div>
        {snapshot.layers.weather.asOf && <p className="asof-line">asOf: {snapshot.layers.weather.asOf}</p>}
        <ul className="metrics-list">
          {snapshot.layers.weather.metrics.map((metric) => (
            <li key={metric.key}>
              <strong>{metric.key}</strong>: {formatMetric(metric)}
              {formatMetricAsOf(metric) && ` (${formatMetricAsOf(metric)})`}
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}