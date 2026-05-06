import { Router, type Request, type Response } from "express";
import { createHash } from "node:crypto";
import { buildFactsPayload } from "../../ai/buildFactsPayload.js";
import { generateCountrySummary } from "../../ai/generateSummary.js";
import { buildCountrySnapshot } from "./buildCountrySnapshot.js";
import { buildAreaSnapshot } from "../../services/buildAreaSnapshot.js";
import { generateAreaSummary } from "../../ai/generateAreaSummary.js";
import { callLLM, getConfiguredLLMModel, getConfiguredLLMProvider } from "../../ai/llmProvider.js";
import type { AreaSnapshot, SnapshotFilters } from "../../dto/areaSnapshot.js";

const router = Router();

type SummaryResponseData = {
  summaryText: string;
  source: "openai" | "gemini" | "ollama" | "gigachat" | "template";
  provider: "openai" | "gemini" | "ollama" | "gigachat" | "template";
  reason?: "disabled_flag" | "missing_api_key" | "provider_error_unsupported_region" | "provider_error_auth" | "provider_error_chat" | "error";
  model?: string;
  district: {
    id: string;
    name: string;
  };
  dataset: {
    mode: string;
    updatedAt: string;
  };
  cache: {
    hit: boolean;
    key: string;
    ttlSeconds: number;
  };
  warnings: string[];
};

type SummaryCacheEntry = {
  expiresAt: number;
  value: SummaryResponseData;
};

const SUMMARY_CACHE_TTL_MS = 30 * 60 * 1000;
const SUMMARY_PROMPT_MAX_CHARS = 3800;
const SUMMARY_RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;
const SUMMARY_RATE_LIMIT_MAX = 20;

const summaryCache = new Map<string, SummaryCacheEntry>();
const summaryRateLimit = new Map<string, { windowStart: number; count: number }>();

function isSummaryEnabled(): boolean {
  return process.env.AI_SUMMARY_ENABLED?.trim().toLowerCase() === "true";
}

function cleanupSummaryCache(now = Date.now()): void {
  for (const [key, entry] of summaryCache.entries()) {
    if (entry.expiresAt <= now) {
      summaryCache.delete(key);
    }
  }
}

function parseFilters(raw: unknown): SnapshotFilters | null {
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

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const bucket = summaryRateLimit.get(ip);

  if (!bucket || now - bucket.windowStart > SUMMARY_RATE_LIMIT_WINDOW_MS) {
    summaryRateLimit.set(ip, { windowStart: now, count: 1 });
    return true;
  }

  if (bucket.count >= SUMMARY_RATE_LIMIT_MAX) {
    return false;
  }

  bucket.count += 1;
  summaryRateLimit.set(ip, bucket);
  return true;
}

function formatPrice(rub: number): string {
  if (rub >= 1_000_000) {
    return `${(rub / 1_000_000).toFixed(2)} млн ₽`;
  }
  return `${Math.round(rub).toLocaleString("ru-RU")} ₽`;
}

function buildTemplateSummaryText(snapshot: AreaSnapshot): string {
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

function buildSummaryPrompt(snapshot: AreaSnapshot): string {
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

  if (prompt.length <= SUMMARY_PROMPT_MAX_CHARS) {
    return prompt;
  }

  return `${prompt.slice(0, SUMMARY_PROMPT_MAX_CHARS - 64)}\n[truncated_for_safety=true]`;
}

router.post("/ai/country-summary", async (req: Request, res: Response) => {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Request body must be a JSON object"
      }
    });
    return;
  }

  const countryCodeRaw = (req.body as { countryCode?: unknown }).countryCode;

  if (typeof countryCodeRaw !== "string" || countryCodeRaw.trim().length === 0) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "countryCode must be a non-empty string"
      }
    });
    return;
  }

  const countryCode = countryCodeRaw.trim().toUpperCase();

  if (!/^[A-Z]{2}$/.test(countryCode)) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "countryCode must be ISO2 format (two letters)"
      }
    });
    return;
  }

  const languageRaw = (req.body as { language?: unknown }).language;
  const language = languageRaw === undefined ? "ru" : languageRaw;

  if (language !== "ru") {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "language must be 'ru'"
      }
    });
    return;
  }

  try {
    const snapshot = await buildCountrySnapshot(countryCode);
    const factsPayload = buildFactsPayload(snapshot);
    const summary = await generateCountrySummary(factsPayload, language);

    res.json(summary);
  } catch (error: unknown) {
    const err = error as Error;
    console.error("AI summary generation failed", {
      message: err?.message,
      stack: err?.stack
    });

    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to generate AI summary"
      }
    });
  }
});

router.post("/ai/area-summary", async (req: Request, res: Response) => {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Request body must be a JSON object"
      }
    });
    return;
  }

  const districtIdRaw = (req.body as { districtId?: unknown }).districtId;

  if (typeof districtIdRaw !== "string" || districtIdRaw.trim().length === 0) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "districtId must be a non-empty string"
      }
    });
    return;
  }

  const districtId = districtIdRaw.trim().toLowerCase();

  const languageRaw = (req.body as { language?: unknown }).language;
  const language = languageRaw === undefined ? "ru" : languageRaw;

  if (language !== "ru") {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "language must be 'ru'"
      }
    });
    return;
  }

  try {
    const snapshot = await buildAreaSnapshot(districtId);
    const summary = await generateAreaSummary(snapshot, language);

    res.json(summary);
  } catch (error: unknown) {
    const err = error as Error & { code?: string; status?: number };
    console.error("Area AI summary generation failed", {
      message: err?.message,
      stack: err?.stack
    });

    const status = err?.status ?? 500;
    res.status(status).json({
      error: {
        code: err?.code ?? "INTERNAL_ERROR",
        message: err?.message ?? "Failed to generate area summary"
      }
    });
  }
});

router.post("/ai/summary", async (req: Request, res: Response) => {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Request body must be a JSON object",
      },
    });
    return;
  }

  const ip = req.ip || "unknown";
  if (!checkRateLimit(ip)) {
    res.status(429).json({
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message: "Too many AI summary requests. Please retry later.",
      },
    });
    return;
  }

  const districtIdRaw = (req.body as { districtId?: unknown }).districtId;
  if (typeof districtIdRaw !== "string" || districtIdRaw.trim().length === 0) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "districtId must be a non-empty string",
      },
    });
    return;
  }

  const filters = parseFilters((req.body as { filters?: unknown }).filters);
  if (!filters) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "filters are invalid",
      },
    });
    return;
  }

  const districtId = districtIdRaw.trim().toLowerCase();
  const datasetHint = (req.body as { dataset?: unknown }).dataset;

  try {
    cleanupSummaryCache();

    const snapshot = await buildAreaSnapshot(districtId, filters);
    const cacheKeySource = {
      districtId,
      filters,
      dataset: datasetHint ?? snapshot.dataset.mode,
      dataVersion: snapshot.dataset.updatedAt,
    };
    const cacheKey = createHash("sha256").update(JSON.stringify(cacheKeySource)).digest("hex");
    const now = Date.now();

    const cached = summaryCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      res.json({ data: { ...cached.value, cache: { ...cached.value.cache, hit: true } } });
      return;
    }

    const warnings: string[] = [];
    let summaryText = buildTemplateSummaryText(snapshot);
    let source: SummaryResponseData["source"] = "template";
    let provider: SummaryResponseData["provider"] = "template";
    let reason: SummaryResponseData["reason"];
    let model: string | undefined;

    const summaryEnabled = isSummaryEnabled();
    const configuredProvider = getConfiguredLLMProvider();
    const configuredModel = getConfiguredLLMModel();
    const hasProviderConfig = Boolean(configuredProvider && configuredModel);

    if (!summaryEnabled) {
      reason = "disabled_flag";
      warnings.push("AI выключен (AI_SUMMARY_ENABLED!=true), использован template summary.");
    } else if (!hasProviderConfig) {
      reason = "missing_api_key";
      warnings.push("AI_PROVIDER или provider-specific credentials отсутствуют, использован template summary.");
    } else {
      model = configuredModel ?? undefined;
      try {
        const prompt = buildSummaryPrompt(snapshot);
        const result = await callLLM({
          messages: [
            {
              role: "system",
              content: "Ты аналитик рынка недвижимости. Пиши коротко, без художественных преувеличений.",
            },
            { role: "user", content: prompt },
          ],
          maxTokens: 320,
          temperature: 0.3,
        });

        summaryText = result.text;
        source = configuredProvider ?? "template";
        provider = configuredProvider ?? "template";
        reason = undefined;
      } catch (error: unknown) {
        const err = error as Error & { code?: string; status?: number; provider?: string };

        if (err?.code === "LLM_PROVIDER_UNSUPPORTED_REGION") {
          reason = "provider_error_unsupported_region";
          warnings.push("AI недоступен в этом регионе (unsupported_country_region_territory), использован template summary.");
        } else if (err?.code === "LLM_PROVIDER_AUTH_FAILED") {
          reason = "provider_error_auth";
          warnings.push(`Ошибка аутентификации ${configuredProvider}: ${err?.message ?? "unknown error"}, использован template summary.`);
        } else if (err?.code === "LLM_PROVIDER_CHAT_FAILED") {
          reason = "provider_error_chat";
          warnings.push(`Ошибка запроса к ${configuredProvider}: ${err?.message ?? "unknown error"}, использован template summary.`);
        } else {
          reason = "error";
          warnings.push(`LLM fallback: ${err?.message ?? "unknown error"}`);
        }
      }
    }

    if (snapshot.dataset.mode === "sample") {
      warnings.push("Внимание: данные синтетические (sample) и предназначены только для демонстрации.");
    }

    const data: SummaryResponseData = {
      summaryText,
      source,
      provider,
      reason,
      model,
      district: {
        id: snapshot.district.id,
        name: snapshot.district.name,
      },
      dataset: {
        mode: snapshot.dataset.mode,
        updatedAt: snapshot.dataset.updatedAt,
      },
      cache: {
        hit: false,
        key: cacheKey,
        ttlSeconds: Math.floor(SUMMARY_CACHE_TTL_MS / 1000),
      },
      warnings,
    };

    summaryCache.set(cacheKey, { expiresAt: now + SUMMARY_CACHE_TTL_MS, value: data });

    res.json({ data });
  } catch (error: unknown) {
    const err = error as Error & { code?: string; status?: number };
    console.error("AI summary generation failed", {
      message: err?.message,
      stack: err?.stack,
    });

    res.status(err?.status ?? 500).json({
      error: {
        code: err?.code ?? "INTERNAL_ERROR",
        message: err?.message ?? "Failed to generate AI summary",
      },
    });
  }
});

export default router;
