import { describe, it, expect } from "vitest";
import type { AreaSnapshot } from "../../dto/areaSnapshot.js";

// -----------------------------------------------------------------------
// Replicated from apps/backend/src/routes/v1/ai.ts for unit testing
// (pure functions — no side effects, no env reads)
// -----------------------------------------------------------------------

function formatPrice(rub: number): string {
  if (rub >= 1_000_000) {
    return `${(rub / 1_000_000).toFixed(2)} млн ₽`;
  }
  return `${Math.round(rub).toLocaleString("ru-RU")} ₽`;
}

function buildTemplateSummaryText(snapshot: AreaSnapshot): string {
  const byRooms = Object.entries(snapshot.counts.byRooms)
    .filter(([, value]) => (value as number) > 0)
    .map(([rooms, value]) => `${rooms}-к: ${value as number}`)
    .join(", ");

  const cheapest = snapshot.topListings.cheapestByM2[0];
  const expensive = snapshot.topListings.expensiveByM2[0];

  const lines = [
    `Район ${snapshot.district.name}: в анализе ${snapshot.counts.totalListings} объявлений.`,
    `Цена: медиана ${formatPrice(snapshot.priceRub.median)} (P25 ${formatPrice(snapshot.priceRub.p25)} / P75 ${formatPrice(snapshot.priceRub.p75)}).`,
    `Цена за м²: медиана ${snapshot.pricePerM2Rub.median.toLocaleString("ru-RU")} ₽/м² (P25 ${snapshot.pricePerM2Rub.p25.toLocaleString("ru-RU")} / P75 ${snapshot.pricePerM2Rub.p75.toLocaleString("ru-RU")}).`,
    `Площадь: медиана ${snapshot.areaM2.median} м² (P25 ${snapshot.areaM2.p25} / P75 ${snapshot.areaM2.p75}).`,
    `Комнатность: ${byRooms || "нет данных"}.`,
  ];

  if (cheapest) {
    lines.push(`Самое доступное из топа: ${cheapest.rooms}-к, ${cheapest.areaM2} м², ${formatPrice(cheapest.priceRub)}.`);
  }

  if (expensive) {
    lines.push(`Самое дорогое из топа: ${expensive.rooms}-к, ${expensive.areaM2} м², ${formatPrice(expensive.priceRub)}.`);
  }

  return lines.join("\n");
}

// -----------------------------------------------------------------------
// Helper: districtId validation (mirrors logic in the route handler)
// -----------------------------------------------------------------------
function isValidDistrictId(raw: unknown): raw is string {
  return typeof raw === "string" && raw.trim().length > 0;
}

// -----------------------------------------------------------------------
// Test data
// -----------------------------------------------------------------------

function makeSnapshot(overrides: Partial<AreaSnapshot> = {}): AreaSnapshot {
  return {
    district: { id: "centralny", name: "Центральный" },
    generatedAt: "2025-10-01T00:00:00Z",
    dataset: { mode: "sample", updatedAt: "2025-10-01T00:00:00Z" },
    filtersApplied: {},
    counts: { totalListings: 10, byRooms: { 1: 2, 2: 5, 3: 2, 4: 1 } },
    priceRub: { median: 5_000_000, p25: 4_000_000, p75: 6_500_000 },
    pricePerM2Rub: { median: 90_000, p25: 75_000, p75: 110_000 },
    areaM2: { median: 55, p25: 40, p75: 70 },
    topListings: {
      cheapestByM2: [
        {
          id: "c1", source: "sample", url: "https://x.com/1",
          districtId: "centralny", address: "ул. Ленина 1",
          rooms: 1, areaM2: 35, priceRub: 2_800_000, pricePerM2: 80_000,
          publishedAt: "2025-10-01T00:00:00Z", buildingType: "panel",
        },
      ],
      expensiveByM2: [
        {
          id: "e1", source: "sample", url: "https://x.com/2",
          districtId: "centralny", address: "ул. Красный проспект 50",
          rooms: 3, areaM2: 80, priceRub: 10_000_000, pricePerM2: 125_000,
          publishedAt: "2025-09-01T00:00:00Z", buildingType: "monolith",
        },
      ],
    },
    warnings: [],
    ...overrides,
  };
}

// -----------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------

describe("formatPrice", () => {
  it("formats amounts >= 1 million as млн ₽", () => {
    expect(formatPrice(5_000_000)).toBe("5.00 млн ₽");
    expect(formatPrice(1_500_000)).toBe("1.50 млн ₽");
  });

  it("formats amounts < 1 million as ₽", () => {
    expect(formatPrice(500_000)).toContain("₽");
    expect(formatPrice(500_000)).not.toContain("млн");
  });
});

describe("buildTemplateSummaryText", () => {
  it("includes the district name", () => {
    const text = buildTemplateSummaryText(makeSnapshot());
    expect(text).toContain("Центральный");
  });

  it("includes total listings count", () => {
    const text = buildTemplateSummaryText(makeSnapshot());
    expect(text).toContain("10 объявлений");
  });

  it("includes median price", () => {
    const text = buildTemplateSummaryText(makeSnapshot());
    expect(text).toContain("5.00 млн ₽");
  });

  it("includes room breakdown when there are rooms", () => {
    const text = buildTemplateSummaryText(makeSnapshot());
    expect(text).toContain("2-к: 5");
  });

  it("shows 'нет данных' when all room counts are zero", () => {
    const text = buildTemplateSummaryText(
      makeSnapshot({ counts: { totalListings: 0, byRooms: { 1: 0, 2: 0, 3: 0, 4: 0 } } })
    );
    expect(text).toContain("нет данных");
  });

  it("includes cheapest and most expensive listings from topListings", () => {
    const text = buildTemplateSummaryText(makeSnapshot());
    expect(text).toContain("Самое доступное из топа");
    expect(text).toContain("Самое дорогое из топа");
  });

  it("omits cheapest/expensive lines when topListings are empty", () => {
    const text = buildTemplateSummaryText(
      makeSnapshot({ topListings: { cheapestByM2: [], expensiveByM2: [] } })
    );
    expect(text).not.toContain("Самое доступное");
    expect(text).not.toContain("Самое дорогое");
  });
});

describe("districtId validation", () => {
  it("accepts a valid non-empty string", () => {
    expect(isValidDistrictId("centralny")).toBe(true);
    expect(isValidDistrictId("kalininsky")).toBe(true);
  });

  it("rejects empty strings", () => {
    expect(isValidDistrictId("")).toBe(false);
    expect(isValidDistrictId("   ")).toBe(false);
  });

  it("rejects non-string values", () => {
    expect(isValidDistrictId(null)).toBe(false);
    expect(isValidDistrictId(undefined)).toBe(false);
    expect(isValidDistrictId(123)).toBe(false);
    expect(isValidDistrictId({})).toBe(false);
  });
});
