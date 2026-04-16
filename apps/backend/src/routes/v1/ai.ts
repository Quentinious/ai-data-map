import { Router, type Request, type Response } from "express";
import { buildFactsPayload } from "../../ai/buildFactsPayload.js";
import { generateCountrySummary } from "../../ai/generateSummary.js";
import { buildCountrySnapshot } from "./buildCountrySnapshot.js";

const router = Router();

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

export default router;
