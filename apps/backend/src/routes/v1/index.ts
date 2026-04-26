import { Router, type Request, type Response } from "express";
import aiRouter from "./ai.js";
import { buildCountrySnapshot } from "./buildCountrySnapshot.js";
import { validateCountryCode } from "../../middleware/validateCountryCode.js";
import { buildAreaSnapshot } from "../../services/buildAreaSnapshot.js";
import type { SnapshotFilters, UserType } from "../../dto/areaSnapshot.js";

const router = Router();

type CodedError = Error & {
  code?: string;
  status?: number;
  details?: unknown;
};

function parsePositiveNumber(raw: unknown, name: string): { value: number } | { error: string } {
  if (raw === undefined) {
    return { value: NaN };
  }
  const n = Number(raw);
  if (Number.isNaN(n)) {
    return { error: `${name} must be a number` };
  }
  if (n < 0) {
    return { error: `${name} must be non-negative` };
  }
  return { value: n };
}

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

  const { rooms: roomsRaw, minArea: minAreaRaw, maxArea: maxAreaRaw, minPrice: minPriceRaw, maxPrice: maxPriceRaw, userType: userTypeRaw } = req.query;

  // Validate userType
  const VALID_USER_TYPES: UserType[] = ["any", "private", "agency"];
  let userType: UserType | undefined;
  if (userTypeRaw !== undefined) {
    const v = String(userTypeRaw).toLowerCase();
    if (!VALID_USER_TYPES.includes(v as UserType)) {
      res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: `userType must be one of: ${VALID_USER_TYPES.join(", ")}` }
      });
      return;
    }
    userType = v as UserType;
  }

  // Validate rooms
  let rooms: number | undefined;
  if (roomsRaw !== undefined) {
    const n = Number(roomsRaw);
    if (!Number.isInteger(n) || n < 1 || n > 4) {
      res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "rooms must be 1, 2, 3, or 4" }
      });
      return;
    }
    rooms = n;
  }

  // Validate numeric range params
  const minAreaResult = parsePositiveNumber(minAreaRaw, "minArea");
  if ("error" in minAreaResult) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: minAreaResult.error } });
    return;
  }

  const maxAreaResult = parsePositiveNumber(maxAreaRaw, "maxArea");
  if ("error" in maxAreaResult) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: maxAreaResult.error } });
    return;
  }

  const minPriceResult = parsePositiveNumber(minPriceRaw, "minPrice");
  if ("error" in minPriceResult) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: minPriceResult.error } });
    return;
  }

  const maxPriceResult = parsePositiveNumber(maxPriceRaw, "maxPrice");
  if ("error" in maxPriceResult) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: maxPriceResult.error } });
    return;
  }

  const minArea = !Number.isNaN(minAreaResult.value) ? minAreaResult.value : undefined;
  const maxArea = !Number.isNaN(maxAreaResult.value) ? maxAreaResult.value : undefined;
  const minPrice = !Number.isNaN(minPriceResult.value) ? minPriceResult.value : undefined;
  const maxPrice = !Number.isNaN(maxPriceResult.value) ? maxPriceResult.value : undefined;

  if (minArea !== undefined && maxArea !== undefined && minArea > maxArea) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "minArea must not exceed maxArea" } });
    return;
  }

  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "minPrice must not exceed maxPrice" } });
    return;
  }

  const filters: SnapshotFilters = {};
  if (rooms !== undefined) filters.rooms = rooms;
  if (minArea !== undefined) filters.minArea = minArea;
  if (maxArea !== undefined) filters.maxArea = maxArea;
  if (minPrice !== undefined) filters.minPrice = minPrice;
  if (maxPrice !== undefined) filters.maxPrice = maxPrice;
  if (userType !== undefined) filters.userType = userType;

  try {
    const snapshot = await buildAreaSnapshot(districtId, filters);
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
