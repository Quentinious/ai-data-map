import { describe, it, expect } from "vitest";
import type { AreaSnapshot } from "../../dto/areaSnapshot.js";
import {
  buildTemplateSummaryText,
  formatPrice,
  getProviderFallbackReason,
  isValidDistrictId,
} from "./summaryUtils.js";

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

describe("getProviderFallbackReason", () => {
  it("maps unsupported region errors", () => {
    expect(
      getProviderFallbackReason(Object.assign(new Error("unsupported"), { code: "LLM_PROVIDER_UNSUPPORTED_REGION" }))
    ).toBe("provider_error_unsupported_region");
  });

  it("maps GigaChat OAuth 400 to auth bad request", () => {
    expect(
      getProviderFallbackReason(Object.assign(new Error("bad scope"), { code: "LLM_PROVIDER_AUTH_FAILED", status: 400 }))
    ).toBe("provider_error_auth_bad_request");
  });

  it("maps TLS-looking network errors separately", () => {
    expect(
      getProviderFallbackReason(Object.assign(new Error("self-signed certificate"), { code: "LLM_PROVIDER_REQUEST_FAILED" }))
    ).toBe("provider_error_tls");
  });
});
