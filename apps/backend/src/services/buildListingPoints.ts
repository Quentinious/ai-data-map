import type { MapListingPoint, MapListingsResponse } from "../dto/mapListings.js";
import type { Listing } from "../dto/listing.js";
import { getDatasetMode, getListingsSource, getListingsUpdatedAt, loadListings } from "./loadListings.js";
import { districtCentroidsNsk } from "./districtCentroids.nsk.js";
import type { ListingFilters } from "../routes/v1/parseListingFilters.js";

const MAX_LISTINGS = 500;
// ~600 m jitter radius in degrees
const JITTER_RANGE_DEG = 0.008;

function isValidListing(listing: Listing): boolean {
  return listing.areaM2 > 0 && listing.priceRub > 0 && listing.rooms >= 1 && listing.rooms <= 4;
}

/**
 * Returns a deterministic pseudo-random value in [-range, range] based on a string seed.
 * Using the same seed always yields the same offset so listing points stay stable
 * across repeated fetches (no visual jumping on re-renders).
 */
function deterministicJitter(seed: string, range: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) & 0xffffffff;
  }
  // Normalize to [-range, range]
  return ((hash & 0xffff) / 0xffff - 0.5) * 2 * range;
}

/**
 * Extract lat/lng from a listing.
 *
 * NOTE: In the source data produced by the restapp import tool the `lat` and `lon`
 * fields are stored with swapped semantics — `listing.lat` holds the geographic
 * *longitude* value (~82–83 for Novosibirsk) and `listing.lon` holds the geographic
 * *latitude* value (~54–55 for Novosibirsk).  We correct for this here.
 *
 * In sample mode listings have no coordinates at all; we generate a deterministic
 * jitter around the district centroid so the markers look plausible on the map.
 */
function extractCoords(
  listing: Listing,
  mode: "sample" | "real",
  districtId: string
): { lat: number; lng: number } | null {
  if (listing.lat !== undefined && listing.lon !== undefined) {
    // Swap: source `lat` field = longitude, source `lon` field = latitude
    return { lat: listing.lon, lng: listing.lat };
  }

  if (mode === "sample") {
    const centroid = districtCentroidsNsk[districtId];
    if (!centroid) {
      return null;
    }
    return {
      lat: centroid.lat + deterministicJitter(`${listing.id}-lat`, JITTER_RANGE_DEG),
      lng: centroid.lng + deterministicJitter(`${listing.id}-lng`, JITTER_RANGE_DEG),
    };
  }

  return null;
}

export async function buildListingPoints(
  districtId: string,
  filters: ListingFilters = {}
): Promise<MapListingsResponse> {
  const listings = await loadListings();
  const mode = getDatasetMode();
  const warnings: string[] = [];

  if (mode === "sample") {
    warnings.push(
      "DEMO данные: координаты объявлений рассчитаны детерминированно вокруг центроида района."
    );
  }

  const filtered = listings.filter((listing) => {
    if (!isValidListing(listing)) return false;
    if (listing.districtId !== districtId) return false;
    if (filters.rooms !== undefined && listing.rooms !== filters.rooms) return false;
    if (filters.userType !== undefined && listing.userType !== filters.userType) return false;
    if (filters.minArea !== undefined && listing.areaM2 < filters.minArea) return false;
    if (filters.maxArea !== undefined && listing.areaM2 > filters.maxArea) return false;
    if (filters.minPrice !== undefined && listing.priceRub < filters.minPrice) return false;
    if (filters.maxPrice !== undefined && listing.priceRub > filters.maxPrice) return false;
    return true;
  });

  const truncated = filtered.length > MAX_LISTINGS;
  if (truncated) {
    warnings.push(`Показаны первые ${MAX_LISTINGS} из ${filtered.length} объявлений.`);
  }

  const limited = truncated ? filtered.slice(0, MAX_LISTINGS) : filtered;

  const points: MapListingPoint[] = [];
  for (const listing of limited) {
    const coords = extractCoords(listing, mode, districtId);
    if (!coords) continue;

    points.push({
      id: listing.id,
      lat: coords.lat,
      lng: coords.lng,
      priceRub: listing.priceRub,
      areaM2: listing.areaM2,
      pricePerM2: Math.round(listing.priceRub / listing.areaM2),
      rooms: listing.rooms,
      userType: listing.userType,
      source: listing.source,
    });
  }

  return {
    dataset: {
      mode,
      source: getListingsSource(),
      updatedAt: getListingsUpdatedAt(),
    },
    districtId,
    listings: points,
    truncated,
    warnings,
  };
}
