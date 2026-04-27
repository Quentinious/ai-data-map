import { Router, type Request, type Response } from "express";
import { buildDistrictMapDataset } from "../../services/buildDistrictMapDataset.js";
import { parseListingFilters } from "./parseListingFilters.js";

const router = Router();

router.get("/map/districts", async (req: Request, res: Response) => {
  const parsed = parseListingFilters(req.query as Record<string, string | string[] | undefined>);

  if (parsed.error) {
    res.status(parsed.error.status).json({
      error: {
        code: parsed.error.code,
        message: parsed.error.message
      }
    });
    return;
  }

  try {
    const payload = await buildDistrictMapDataset(parsed.filters);
    res.json({ data: payload });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("District map dataset generation failed", {
      message: err?.message,
      stack: err?.stack
    });

    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "Failed to build district map dataset"
      }
    });
  }
});

export default router;
