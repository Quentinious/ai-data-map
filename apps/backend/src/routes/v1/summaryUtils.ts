import type { AreaSnapshot, SnapshotFilters } from "../../dto/areaSnapshot.js";

export type SummaryFallbackReason =
  | "disabled_flag"
  | "missing_api_key"
  | "provider_error_missing_credentials"
  | "provider_error_tls"
  | "provider_error_auth"
  | "provider_error_auth_bad_request"
  | "provider_error_chat"
  | "provider_error_network"
  | "provider_error_unsupported_region"
  | "template_fallback"
  | "error";

export function isValidDistrictId(raw: unknown): raw is string {
  return typeof raw === "string" && raw.trim().length > 0;
}

export function parseSummaryFilters(raw: unknown): SnapshotFilters | null {
  if (raw === undefined) {
    return {};
  }

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }

  const source = raw as Record<string, unknown>;
  const filters: SnapshotFilters = {};

  if (source.rooms !== undefined) {
    const rooms = Number(source.rooms);
    if (!Number.isInteger(rooms) || rooms < 1 || rooms > 4) return null;
    filters.rooms = rooms;
  }

  if (source.userType !== undefined) {
    if (typeof source.userType !== "string" || source.userType.trim().length === 0) return null;
    filters.userType = source.userType.trim();
  }

  const numericFields = ["minArea", "maxArea", "minPrice", "maxPrice"] as const;
  for (const field of numericFields) {
    const value = source[field];
    if (value === undefined) continue;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return null;
    filters[field] = parsed;
  }

  if (
    filters.minArea !== undefined &&
    filters.maxArea !== undefined &&
    filters.minArea > filters.maxArea
  ) {
    return null;
  }

  if (
    filters.minPrice !== undefined &&
    filters.maxPrice !== undefined &&
    filters.minPrice > filters.maxPrice
  ) {
    return null;
  }

  return filters;
}

export function formatPrice(rub: number): string {
  if (rub >= 1_000_000) {
    return `${(rub / 1_000_000).toFixed(2)} млн ₽`;
  }
  return `${Math.round(rub).toLocaleString("ru-RU")} ₽`;
}

export function buildTemplateSummaryText(snapshot: AreaSnapshot): string {
  const byRooms = Object.entries(snapshot.counts.byRooms)
    .filter(([, value]) => value > 0)
    .map(([rooms, value]) => `${rooms}-к: ${value}`)
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

export function buildSummaryPrompt(snapshot: AreaSnapshot, maxChars: number): string {
  const byRooms = Object.entries(snapshot.counts.byRooms)
    .map(([rooms, value]) => `${rooms}-к: ${value}`)
    .join(", ");

  const cheapest = snapshot.topListings.cheapestByM2
    .slice(0, 5)
    .map((item, index) => `${index + 1}) ${item.rooms}-к, ${item.areaM2}м², ${item.pricePerM2} ₽/м², ${item.priceRub} ₽`)
    .join("; ");

  const expensive = snapshot.topListings.expensiveByM2
    .slice(0, 5)
    .map((item, index) => `${index + 1}) ${item.rooms}-к, ${item.areaM2}м², ${item.pricePerM2} ₽/м², ${item.priceRub} ₽`)
    .join("; ");

  const prompt = [
    "Ты аналитик рынка жилья. Сформируй краткую сводку на русском языке.",
    "Формат ответа: 1 короткий абзац (до 900 символов), без markdown.",
    `Район: ${snapshot.district.name} (${snapshot.district.id})`,
    `Набор данных: ${snapshot.dataset.mode}, updatedAt=${snapshot.dataset.updatedAt}`,
    `Объявлений: ${snapshot.counts.totalListings}`,
    `Цена: median=${snapshot.priceRub.median}, p25=${snapshot.priceRub.p25}, p75=${snapshot.priceRub.p75}`,
    `Цена за м²: median=${snapshot.pricePerM2Rub.median}, p25=${snapshot.pricePerM2Rub.p25}, p75=${snapshot.pricePerM2Rub.p75}`,
    `Площадь: median=${snapshot.areaM2.median}, p25=${snapshot.areaM2.p25}, p75=${snapshot.areaM2.p75}`,
    `Комнатность: ${byRooms}`,
    `Топ-5 дешевых по ₽/м²: ${cheapest}`,
    `Топ-5 дорогих по ₽/м²: ${expensive}`,
  ].join("\n");

  if (prompt.length <= maxChars) {
    return prompt;
  }

  return `${prompt.slice(0, maxChars - 64)}\n[truncated_for_safety=true]`;
}

function isTlsError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("tls") ||
    normalized.includes("ssl") ||
    normalized.includes("certificate") ||
    normalized.includes("self-signed") ||
    normalized.includes("unable to verify")
  );
}

export function getProviderFallbackReason(error: Error & { code?: string; status?: number }): SummaryFallbackReason {
  if (error.code === "LLM_PROVIDER_NOT_CONFIGURED") {
    return "provider_error_missing_credentials";
  }

  if (error.code === "LLM_PROVIDER_UNSUPPORTED_REGION") {
    return "provider_error_unsupported_region";
  }

  if (error.code === "LLM_PROVIDER_AUTH_FAILED") {
    return error.status === 400 ? "provider_error_auth_bad_request" : "provider_error_auth";
  }

  if (error.code === "LLM_PROVIDER_CHAT_FAILED") {
    return "provider_error_chat";
  }

  if (error.code === "LLM_PROVIDER_TIMEOUT" || error.code === "LLM_PROVIDER_REQUEST_FAILED") {
    return isTlsError(error.message) ? "provider_error_tls" : "provider_error_network";
  }

  if (error.code === "LLM_PROVIDER_EMPTY_RESPONSE") {
    return "template_fallback";
  }

  return "error";
}
