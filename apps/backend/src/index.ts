import cors from "cors";
import { config as loadDotenv } from "dotenv";
import express, { type NextFunction, type Request, type Response } from "express";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import type { ApiError, Country } from "./types.js";
import v1Router from "./routes/v1/index.js";
import { loadDistricts } from "./services/loadDistricts.js";
import { getFilteredListings } from "./services/loadListings.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadBackendEnv(): void {
  const candidatePaths = [
    path.resolve(process.cwd(), "apps/backend/.env"),
    path.resolve(process.cwd(), ".env"),
    path.resolve(__dirname, "../.env"),
  ];

  const envPath = candidatePaths.find((candidate) => existsSync(candidate));
  if (!envPath) {
    return;
  }

  loadDotenv({ path: envPath });
  console.log(`BOOT: backend env loaded from ${envPath}`);
}

loadBackendEnv();

console.log("BOOT: active backend entrypoint: apps/backend/src/index.ts");

export const app = express();
const port = Number(process.env.PORT ?? 4000);

app.use(cors());
app.use(express.json());

// Store getCountries reference for use by other routers
app.locals.getCountries = null as (((...args: unknown[]) => Promise<Country[]>) | null);

const countriesFilePath = path.resolve(__dirname, "../data/countries.json");

let countriesCache: Country[] | null = null;

const countryCodeSchema = z
  .string()
  .trim()
  .regex(/^[A-Z]{2}$/, "countryCode must be ISO2 (two uppercase letters)");

async function getCountries(): Promise<Country[]> {
  if (countriesCache) {
    return countriesCache;
  }

  const fileContent = await readFile(countriesFilePath, "utf-8");
  const parsed = JSON.parse(fileContent) as Country[];
  countriesCache = parsed;
  return parsed;
}

function sendError(res: Response, status: number, error: ApiError): void {
  res.status(status).json({ error });
}

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "ai-data-map-backend",
    timestamp: new Date().toISOString()
  });
});

app.get("/api/countries", async (_req, res, next) => {
  try {
    const countries = await getCountries();
    res.json({ data: countries });
  } catch (error) {
    next(error);
  }
});

app.get("/api/countries/:countryCode", async (req, res, next) => {
  try {
    const parseResult = countryCodeSchema.safeParse(req.params.countryCode.toUpperCase());

    if (!parseResult.success) {
      sendError(res, 400, {
        code: "VALIDATION_ERROR",
        message: "Invalid countryCode",
        details: parseResult.error.flatten()
      });
      return;
    }

    const countries = await getCountries();
    const country = countries.find((item) => item.countryCode === parseResult.data);

    if (!country) {
      sendError(res, 404, {
        code: "COUNTRY_NOT_FOUND",
        message: `Country not found: ${parseResult.data}`
      });
      return;
    }

    res.json({
      data: {
        ...country,
        aiSummary:
          "MVP AI summary placeholder: add real model integration in a later sprint."
      }
    });
  } catch (error) {
    next(error);
  }
});

// Make getCountries available to sub-routers
app.locals.getCountries = getCountries;

app.use("/v1", v1Router);

// GET /api/areas - returns all Novosibirsk districts
app.get("/api/areas", async (_req, res, next) => {
  try {
    const districts = await loadDistricts();
    res.json({ data: districts });
  } catch (error) {
    next(error);
  }
});

// GET /api/listings - returns filtered listings
app.get("/api/listings", async (req, res, next) => {
  try {
    const { districtId, rooms, minArea, maxArea } = req.query;

    const roomsParsed = rooms !== undefined ? Number(rooms) : undefined;
    if (roomsParsed !== undefined && (isNaN(roomsParsed) || ![1, 2, 3, 4].includes(roomsParsed))) {
      sendError(res, 400, { code: "VALIDATION_ERROR", message: "rooms must be 1, 2, 3 or 4" });
      return;
    }

    const minAreaParsed = minArea !== undefined ? Number(minArea) : undefined;
    if (minAreaParsed !== undefined && isNaN(minAreaParsed)) {
      sendError(res, 400, { code: "VALIDATION_ERROR", message: "minArea must be a number" });
      return;
    }

    const maxAreaParsed = maxArea !== undefined ? Number(maxArea) : undefined;
    if (maxAreaParsed !== undefined && isNaN(maxAreaParsed)) {
      sendError(res, 400, { code: "VALIDATION_ERROR", message: "maxArea must be a number" });
      return;
    }

    const listings = await getFilteredListings({
      districtId: typeof districtId === "string" ? districtId : undefined,
      rooms: roomsParsed,
      minArea: minAreaParsed,
      maxArea: maxAreaParsed,
    });

    res.json({ data: listings });
  } catch (error) {
    next(error);
  }
});

app.use((_req, res) => {
  sendError(res, 404, {
    code: "NOT_FOUND",
    message: "Route not found"
  });
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(error);
  sendError(res, 500, {
    code: "INTERNAL_ERROR",
    message: "Internal server error"
  });
});

const isMainModule = process.argv[1] ? path.resolve(process.argv[1]) === __filename : false;

if (isMainModule) {
  app.listen(port, () => {
    console.log(`Backend listening on http://localhost:${port}`);
    console.log(`Health: http://localhost:${port}/health`);
    console.log(`API v1 Snapshot: http://localhost:${port}/v1/countries/US/snapshot`);
  });
}
