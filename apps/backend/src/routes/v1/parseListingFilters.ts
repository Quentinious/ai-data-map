import type { SnapshotFilters } from "../../dto/areaSnapshot.js";

type FilterError = {
  status: number;
  code: string;
  message: string;
};

type QueryValue = string | string[] | undefined;

function firstQueryValue(value: QueryValue): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function parsePositiveNumber(value: QueryValue, fieldName: string): { value?: number; error?: FilterError } {
  const rawValue = firstQueryValue(value);

  if (rawValue === undefined) {
    return {};
  }

  const parsed = Number(rawValue);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return {
      error: {
        status: 400,
        code: "VALIDATION_ERROR",
        message: `${fieldName} must be a non-negative number`
      }
    };
  }

  return { value: parsed };
}

export type ListingFilters = SnapshotFilters & {
  userType?: string;
};

export function parseListingFilters(query: {
  rooms?: QueryValue;
  minArea?: QueryValue;
  maxArea?: QueryValue;
  minPrice?: QueryValue;
  maxPrice?: QueryValue;
  userType?: QueryValue;
}): { filters?: ListingFilters; error?: FilterError } {
  const filters: ListingFilters = {};

  const roomsRaw = firstQueryValue(query.rooms);
  if (roomsRaw !== undefined) {
    const parsedRooms = Number(roomsRaw);
    if (!Number.isInteger(parsedRooms) || parsedRooms < 1 || parsedRooms > 4) {
      return {
        error: {
          status: 400,
          code: "VALIDATION_ERROR",
          message: "rooms must be 1, 2, 3, or 4"
        }
      };
    }

    filters.rooms = parsedRooms;
  }

  const userTypeRaw = firstQueryValue(query.userType);
  if (userTypeRaw !== undefined) {
    const normalizedUserType = userTypeRaw.trim();
    if (!normalizedUserType) {
      return {
        error: {
          status: 400,
          code: "VALIDATION_ERROR",
          message: "userType must be a non-empty string"
        }
      };
    }

    filters.userType = normalizedUserType;
  }

  const minAreaResult = parsePositiveNumber(query.minArea, "minArea");
  if (minAreaResult.error) return { error: minAreaResult.error };
  if (minAreaResult.value !== undefined) filters.minArea = minAreaResult.value;

  const maxAreaResult = parsePositiveNumber(query.maxArea, "maxArea");
  if (maxAreaResult.error) return { error: maxAreaResult.error };
  if (maxAreaResult.value !== undefined) filters.maxArea = maxAreaResult.value;

  const minPriceResult = parsePositiveNumber(query.minPrice, "minPrice");
  if (minPriceResult.error) return { error: minPriceResult.error };
  if (minPriceResult.value !== undefined) filters.minPrice = minPriceResult.value;

  const maxPriceResult = parsePositiveNumber(query.maxPrice, "maxPrice");
  if (maxPriceResult.error) return { error: maxPriceResult.error };
  if (maxPriceResult.value !== undefined) filters.maxPrice = maxPriceResult.value;

  if (
    filters.minArea !== undefined &&
    filters.maxArea !== undefined &&
    filters.minArea > filters.maxArea
  ) {
    return {
      error: {
        status: 400,
        code: "VALIDATION_ERROR",
        message: "minArea must be less than or equal to maxArea"
      }
    };
  }

  if (
    filters.minPrice !== undefined &&
    filters.maxPrice !== undefined &&
    filters.minPrice > filters.maxPrice
  ) {
    return {
      error: {
        status: 400,
        code: "VALIDATION_ERROR",
        message: "minPrice must be less than or equal to maxPrice"
      }
    };
  }

  return { filters };
}
