import type { AreaSnapshot } from "../dto/areaSnapshot.js";

export type AreaSummaryResult = {
  summaryPoints: string[];
  warnings: string[];
  district: {
    id: string;
    name: string;
  };
  dataset: {
    mode: string;
    updatedAt: string;
  };
};

type CodedError = Error & {
  code: string;
  status: number;
};

function createCodedError(code: string, status: number, message: string): CodedError {
  const error = new Error(message) as CodedError;
  error.code = code;
  error.status = status;
  return error;
}

function shouldUseMock(): boolean {
  const rawValue = process.env.AI_USE_MOCK;

  if (rawValue == null) {
    return process.env.NODE_ENV !== "production";
  }

  return rawValue.toLowerCase() === "true";
}

function formatPrice(rub: number): string {
  if (rub >= 1_000_000) {
    return `${(rub / 1_000_000).toFixed(2)} млн ₽`;
  }
  return `${rub.toLocaleString("ru-RU")} ₽`;
}

function buildMockAreaSummary(snapshot: AreaSnapshot): AreaSummaryResult {
  const { district, counts, priceRub, pricePerM2Rub, areaM2 } = snapshot;

  const roomDistParts = (Object.entries(counts.byRooms) as [string, number][])
    .filter(([, cnt]) => cnt > 0)
    .map(([rooms, cnt]) => `${rooms}-к: ${cnt}`)
    .join(", ");

  const summaryPoints: string[] = [
    `Район «${district.name}»: анализ основан на ${counts.totalListings} объявлениях.`,
    `Медианная цена — ${formatPrice(priceRub.median)}, диапазон P25–P75: ${formatPrice(priceRub.p25)} – ${formatPrice(priceRub.p75)}.`,
    `Медианная цена за м² — ${pricePerM2Rub.median.toLocaleString("ru-RU")} ₽/м², диапазон P25–P75: ${pricePerM2Rub.p25.toLocaleString("ru-RU")} – ${pricePerM2Rub.p75.toLocaleString("ru-RU")} ₽/м².`,
    `Медианная площадь квартиры — ${areaM2.median} м² (P25: ${areaM2.p25} м², P75: ${areaM2.p75} м²).`,
    `Распределение по комнатности: ${roomDistParts || "нет данных"}.`,
  ];

  const warnings: string[] = [];

  if (snapshot.dataset.mode === "sample") {
    warnings.push("Внимание: данные синтетические (sample) и предназначены только для демонстрации.");
  }

  if (shouldUseMock()) {
    warnings.push("AI Summary сгенерирован в mock-режиме.");
  }

  return {
    summaryPoints,
    warnings,
    district: { id: district.id, name: district.name },
    dataset: { mode: snapshot.dataset.mode, updatedAt: snapshot.dataset.updatedAt },
  };
}

export async function generateAreaSummary(
  snapshot: AreaSnapshot,
  language?: string
): Promise<AreaSummaryResult> {
  const targetLanguage = language ?? process.env.AI_DEFAULT_LANGUAGE ?? "ru";

  if (targetLanguage !== "ru") {
    throw createCodedError("AI_LANGUAGE_UNSUPPORTED", 400, "Only Russian language is supported in MVP");
  }

  if (!shouldUseMock()) {
    throw createCodedError("AI_NOT_CONFIGURED", 503, "AI provider is not configured for non-mock mode");
  }

  return buildMockAreaSummary(snapshot);
}
