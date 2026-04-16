import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import type { ApiError, Country } from "./types.js";
import v1Router from "./routes/v1/index.js";

console.log("BOOT: active backend entrypoint: apps/backend/src/index.ts");

const app = express();
const port = Number(process.env.PORT ?? 4000);

app.use(cors());
app.use(express.json());

// Store getCountries reference for use by other routers
app.locals.getCountries = null as (((...args: unknown[]) => Promise<Country[]>) | null);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
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

app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
  console.log(`Health: http://localhost:${port}/health`);
  console.log(`API v1 Snapshot: http://localhost:${port}/v1/countries/US/snapshot`);
});
