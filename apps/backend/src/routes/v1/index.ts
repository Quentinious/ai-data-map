import { Router, type Request, type Response } from "express";
import aiRouter from "./ai.js";
import { buildCountrySnapshot } from "./buildCountrySnapshot.js";
import { validateCountryCode } from "../../middleware/validateCountryCode.js";
import { buildAreaSnapshot } from "../../services/buildAreaSnapshot.js";

const router = Router();

type CodedError = Error & {
  code?: string;
  status?: number;
  details?: unknown;
};

router.get("/countries/:countryCode/snapshot", validateCountryCode, async (req: Request, res: Response) => {
  try {
    const snapshot = await buildCountrySnapshot(String(req.params.countryCode));
    res.json({ data: snapshot });
  } catch (error: unknown) {
    const codedError = error as CodedError;
    res.status(codedError.status ?? 500).json({
      error: {
        code: codedError.code ?? "INTERNAL_ERROR",
        message: codedError.message ?? "Internal server error",
        details: codedError.details
      }
    });
  }
});

router.get("/areas/:districtId/snapshot", async (req: Request, res: Response) => {
  const districtId = String(req.params.districtId).toLowerCase().trim();

  if (!districtId || !/^[a-z]+$/.test(districtId)) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "districtId must be a non-empty lowercase string"
      }
    });
    return;
  }

  try {
    const snapshot = await buildAreaSnapshot(districtId);
    res.json({ data: snapshot });
  } catch (error: unknown) {
    const codedError = error as CodedError;
    res.status(codedError.status ?? 500).json({
      error: {
        code: codedError.code ?? "INTERNAL_ERROR",
        message: codedError.message ?? "Internal server error",
        details: codedError.details
      }
    });
  }
});

router.use(aiRouter);

export default router;
