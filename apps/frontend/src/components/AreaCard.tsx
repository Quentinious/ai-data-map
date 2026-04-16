import type { AreaSnapshot, ListingWithPricePerM2 } from "../types/areaSnapshot";

type AreaCardProps = {
  snapshot: AreaSnapshot;
};

function formatPrice(rub: number): string {
  if (rub >= 1_000_000) {
    return `${(rub / 1_000_000).toFixed(2)} млн ₽`;
  }
  return `${rub.toLocaleString("ru-RU")} ₽`;
}

function formatPricePerM2(ppm2: number): string {
  return `${ppm2.toLocaleString("ru-RU")} ₽/м²`;
}

function ListingRow({ listing }: { listing: ListingWithPricePerM2 }) {
  return (
    <li className="listing-row">
      <span className="listing-rooms">{listing.rooms}-к</span>
      <span className="listing-area">{listing.areaM2} м²</span>
      <span className="listing-price">{formatPrice(listing.priceRub)}</span>
      <span className="listing-ppm2">{formatPricePerM2(listing.pricePerM2)}</span>
      <span className="listing-address">{listing.address}</span>
    </li>
  );
}

export function AreaCard({ snapshot }: AreaCardProps) {
  const { district, counts, priceRub, pricePerM2Rub, areaM2, topListings, warnings, dataset } = snapshot;

  return (
    <article className="snapshot-card">
      <h3>{district.name}</h3>
      <p className="asof-line">
        Данные: {dataset.mode} · обновлено {dataset.updatedAt.slice(0, 10)} · сформировано{" "}
        {new Date(snapshot.generatedAt).toLocaleString("ru-RU")}
      </p>

      {warnings.length > 0 && (
        <div className="warnings-block">
          {warnings.map((w) => (
            <p key={w}>{w}</p>
          ))}
        </div>
      )}

      <section className="metrics-section">
        <h4>Общая статистика</h4>
        <ul className="metrics-list">
          <li>
            <strong>Объявлений:</strong> {counts.totalListings}
          </li>
          <li>
            <strong>По комнатности:</strong>{" "}
            {Object.entries(counts.byRooms)
              .filter(([, v]) => v > 0)
              .map(([k, v]) => `${k}-к: ${v}`)
              .join(", ")}
          </li>
        </ul>
      </section>

      <section className="metrics-section">
        <h4>Цена объявления, ₽</h4>
        <ul className="metrics-list">
          <li>
            <strong>Медиана:</strong> {formatPrice(priceRub.median)}
          </li>
          <li>
            <strong>P25 – P75:</strong> {formatPrice(priceRub.p25)} – {formatPrice(priceRub.p75)}
          </li>
        </ul>
      </section>

      <section className="metrics-section">
        <h4>Цена за м², ₽/м²</h4>
        <ul className="metrics-list">
          <li>
            <strong>Медиана:</strong> {formatPricePerM2(pricePerM2Rub.median)}
          </li>
          <li>
            <strong>P25 – P75:</strong> {formatPricePerM2(pricePerM2Rub.p25)} –{" "}
            {formatPricePerM2(pricePerM2Rub.p75)}
          </li>
        </ul>
      </section>

      <section className="metrics-section">
        <h4>Площадь, м²</h4>
        <ul className="metrics-list">
          <li>
            <strong>Медиана:</strong> {areaM2.median} м²
          </li>
          <li>
            <strong>P25 – P75:</strong> {areaM2.p25} – {areaM2.p75} м²
          </li>
        </ul>
      </section>

      <section className="metrics-section">
        <h4>Топ-5 дешевейших по ₽/м²</h4>
        <ul className="metrics-list listing-table">
          {topListings.cheapestByM2.map((l) => (
            <ListingRow key={l.id} listing={l} />
          ))}
        </ul>
      </section>

      <section className="metrics-section">
        <h4>Топ-5 дорогих по ₽/м²</h4>
        <ul className="metrics-list listing-table">
          {topListings.expensiveByM2.map((l) => (
            <ListingRow key={l.id} listing={l} />
          ))}
        </ul>
      </section>
    </article>
  );
}
