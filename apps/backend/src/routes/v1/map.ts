import { Router, type Request, type Response } from "express";
import { buildDistrictMapDataset } from "../../services/buildDistrictMapDataset.js";
import { getDatasetMode, getFilteredListings } from "../../services/loadListings.js";
import { parseListingFilters } from "./parseListingFilters.js";

const router = Router();

// Novosibirsk bounding box for coordinate validation
const NSK_BBOX = { latMin: 54.7, latMax: 55.2, lngMin: 82.4, lngMax: 83.5 };

type TopListingsSort = "publishedAt" | "priceRub" | "pricePerM2" | "areaM2";
const VALID_SORTS: TopListingsSort[] = ["publishedAt", "priceRub", "pricePerM2", "areaM2"];

function firstString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function isInNskBbox(lat: number, lon: number): boolean {
  return lat >= NSK_BBOX.latMin && lat <= NSK_BBOX.latMax && lon >= NSK_BBOX.lngMin && lon <= NSK_BBOX.lngMax;
}

function normalizeListingCoords(latRaw: number | undefined, lonRaw: number | undefined): {
  lat: number;
  lon: number;
  swapped: boolean;
} | null {
  if (latRaw === undefined || lonRaw === undefined) {
    return null;
  }

  if (!Number.isFinite(latRaw) || !Number.isFinite(lonRaw)) {
    return null;
  }

  if (isInNskBbox(latRaw, lonRaw)) {
    return { lat: latRaw, lon: lonRaw, swapped: false };
  }

  if (isInNskBbox(lonRaw, latRaw)) {
    return { lat: lonRaw, lon: latRaw, swapped: true };
  }

  return null;
}

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

/**
 * GET /v1/map/listings
 * Returns top listings for a district, filtered and sorted.
 * Query params:
 *   districtId (required)
 *   sort: publishedAt | priceRub | pricePerM2 | areaM2  (default: publishedAt = newest first)
 *   limit: 1–5 (default: 5)
 *   rooms, userType, minArea, maxArea, minPrice, maxPrice (optional filters)
 */
router.get("/map/listings", async (req: Request, res: Response) => {
  const query = req.query as Record<string, string | string[] | undefined>;

  // districtId is required
  const districtIdRaw = firstString(query.districtId);
  if (!districtIdRaw || !districtIdRaw.trim()) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "districtId is required" } });
    return;
  }
  const districtId = districtIdRaw.trim().toLowerCase();

  // Parse sort
  const sortRaw = firstString(query.sort);
  const sort: TopListingsSort =
    sortRaw && (VALID_SORTS as string[]).includes(sortRaw)
      ? (sortRaw as TopListingsSort)
      : "publishedAt";

  // Parse limit (max 5)
  const limitRaw = firstString(query.limit);
  const limitParsed = limitRaw ? Number.parseInt(limitRaw, 10) : 5;
  const limit = Number.isNaN(limitParsed) || limitParsed < 1 ? 5 : Math.min(limitParsed, 5);

  // Parse optional listing filters
  const parsed = parseListingFilters(query);
  if (parsed.error) {
    res.status(parsed.error.status).json({
      error: { code: parsed.error.code, message: parsed.error.message }
    });
    return;
  }

  try {
    const rawListings = await getFilteredListings({ districtId, ...parsed.filters });

    // Compute pricePerM2 and filter out invalid listings
    const withPpm2 = rawListings
      .filter((l) => l.areaM2 > 0 && l.priceRub > 0)
      .map((l) => ({ ...l, pricePerM2: Math.round(l.priceRub / l.areaM2) }));

    // Sort
    const sorted = [...withPpm2].sort((a, b) => {
      switch (sort) {
        case "priceRub":
          return a.priceRub - b.priceRub;
        case "pricePerM2":
          return a.pricePerM2 - b.pricePerM2;
        case "areaM2":
          return b.areaM2 - a.areaM2; // descending: largest area first
        case "publishedAt":
        default:
          return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
      }
    });

    // Build top-N from sorted listings using only mappable coordinates.
    const listings: Array<{
      id: string;
      districtId: string;
      url: string;
      address: string;
      rooms: 1 | 2 | 3 | 4;
      areaM2: number;
      priceRub: number;
      pricePerM2: number;
      publishedAt: string;
      metro?: string;
      userType?: string;
      lat: number;
      lon: number;
    }> = [];
    let skippedNoCoords = 0;
    let skippedOutOfBbox = 0;
    let swappedCount = 0;

    for (const listing of sorted) {
      if (listings.length >= limit) {
        break;
      }

      const normalizedCoords = normalizeListingCoords(listing.lat, listing.lon);
      if (!normalizedCoords) {
        if (listing.lat === undefined || listing.lon === undefined || !Number.isFinite(listing.lat) || !Number.isFinite(listing.lon)) {
          skippedNoCoords += 1;
        } else {
          skippedOutOfBbox += 1;
        }
        continue;
      }

      if (normalizedCoords.swapped) {
        swappedCount += 1;
      }

      listings.push({
        id: listing.id,
        districtId: listing.districtId,
        url: listing.url,
        address: listing.address,
        rooms: listing.rooms,
        areaM2: listing.areaM2,
        priceRub: listing.priceRub,
        pricePerM2: listing.pricePerM2,
        publishedAt: listing.publishedAt,
        ...(listing.metro !== undefined ? { metro: listing.metro } : {}),
        ...(listing.userType !== undefined ? { userType: listing.userType } : {}),
        lat: normalizedCoords.lat,
        lon: normalizedCoords.lon,
      });
    }

    const mappingMeta = {
      requested: limit,
      returned: listings.length,
      skippedNoCoords,
      skippedOutOfBbox,
      swappedCount,
    };

    const warnings: string[] = [];
    if (getDatasetMode() === "sample") {
      warnings.push("Данные синтетические (sample). Не используйте для реальных сделок.");
    }
    if (mappingMeta.returned < mappingMeta.requested) {
      warnings.push(`Показано ${mappingMeta.returned} объявлений с координатами (из ${mappingMeta.requested}).`);
    }

    res.json({
      data: {
        districtId,
        sort,
        total: withPpm2.length,
        listings,
        mappingMeta,
        warnings,
      }
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("District top listings failed", { message: err?.message, stack: err?.stack });
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to load listings" } });
  }
});

export default router;
