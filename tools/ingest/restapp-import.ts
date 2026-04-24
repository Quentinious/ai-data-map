/**
 * tools/ingest/restapp-import.ts
 *
 * Ingests rest-app.net CSV/TSV or XLSX exports and converts them to the
 * internal listings JSON format used by apps/backend.
 *
 * Usage:
 *   npx tsx tools/ingest/restapp-import.ts <input-file> [output-file]
 *
 * If output-file is omitted, the result is written next to the input file
 * with a ".listings.json" suffix.
 *
 * Supported input formats:
 *   - TSV / CSV  (delimiter auto-detected: tab vs comma)
 *   - XLSX
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import * as XLSX from "@e965/xlsx";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BuildingType = "panel" | "brick" | "monolith" | "unknown";

type Listing = {
  id: string;
  source: "avito_restapp";
  url: string;
  districtId: string;
  address: string;
  rooms: 1 | 2 | 3 | 4;
  areaM2: number;
  priceRub: number;
  publishedAt: string;
  floor?: number;
  totalFloors?: number;
  buildingType: BuildingType;
  lat?: number;
  lon?: number;
  metro?: string;
  userType?: string;
  category?: string;
  subcategory?: string;
};

type ListingsFile = {
  updatedAt: string;
  source: "avito_restapp";
  listings: Listing[];
};

/** Raw row from the CSV/XLSX, keyed by column header */
type RawRow = Record<string, string>;

// ---------------------------------------------------------------------------
// District normalization map
//   Maps common variations of Novosibirsk district names (as they appear in
//   rest-app.net exports) to the district IDs used in
//   apps/backend/data/novosibirsk.districts.json.
// ---------------------------------------------------------------------------

const DISTRICT_MAP: Record<string, string> = {
  // Центральный
  "центральный": "centralny",
  "центральный район": "centralny",
  // Железнодорожный
  "железнодорожный": "zheleznodorozhny",
  "железнодорожный район": "zheleznodorozhny",
  // Заельцовский
  "заельцовский": "zaeltsovsky",
  "заельцовский район": "zaeltsovsky",
  // Калининский
  "калининский": "kalininsky",
  "калининский район": "kalininsky",
  // Ленинский
  "ленинский": "leninsky",
  "ленинский район": "leninsky",
  // Кировский
  "кировский": "kirovsky",
  "кировский район": "kirovsky",
  // Октябрьский
  "октябрьский": "oktyabrsky",
  "октябрьский район": "oktyabrsky",
  // Советский
  "советский": "sovetsky",
  "советский район": "sovetsky",
  // Дзержинский
  "дзержинский": "dzerzhinsky",
  "дзержинский район": "dzerzhinsky",
  // Первомайский
  "первомайский": "pervomaysky",
  "первомайский район": "pervomaysky",
};

function normalizeDistrict(raw: string): string | null {
  const key = raw.trim().toLowerCase();
  return DISTRICT_MAP[key] ?? null;
}

// ---------------------------------------------------------------------------
// Field parsers
// ---------------------------------------------------------------------------

/**
 * Parse Russian date string "DD.MM.YYYY H:mm" to ISO-8601.
 * Timestamps from rest-app.net are in Novosibirsk local time (UTC+7).
 * Returns null if parsing fails.
 */
function parseDate(raw: string): string | null {
  const trimmed = raw.trim();
  // Formats: "24.04.2024 14:30" or "24.04.2024 9:05"
  const m = /^(\d{1,2})\.(\d{2})\.(\d{4})\s+(\d{1,2}):(\d{2})$/.exec(trimmed);
  if (!m) return null;
  const [, dd, mm, yyyy, hh, min] = m;
  // Interpret as Novosibirsk time (UTC+07:00) and convert to UTC
  const date = new Date(
    `${yyyy}-${mm.padStart(2, "0")}-${(dd as string).padStart(2, "0")}T${(hh as string).padStart(2, "0")}:${min}:00+07:00`
  );
  if (isNaN(date.getTime())) return null;
  return date.toISOString();
}

/**
 * Parse price from a string like "3 500 000 ₽" or "3500000".
 * Returns null if not parseable.
 */
function parsePrice(raw: string): number | null {
  const cleaned = raw.replace(/[^\d]/g, "").trim();
  if (!cleaned) return null;
  const n = parseInt(cleaned, 10);
  return isNaN(n) ? null : n;
}

/**
 * Parse a parameters string like "Ключ: Значение; Ключ2: Значение2"
 * into a key-value map.
 */
function parseParams(raw: string): Record<string, string> {
  const result: Record<string, string> = {};
  // Entries separated by semicolons or newlines
  const entries = raw.split(/[;\n]+/);
  for (const entry of entries) {
    const colonIdx = entry.indexOf(":");
    if (colonIdx === -1) continue;
    const key = entry.slice(0, colonIdx).trim();
    const value = entry.slice(colonIdx + 1).trim();
    if (key) result[key.toLowerCase()] = value;
  }
  return result;
}

/**
 * Parse area from params map ("общая площадь" key) or from title like "62,4м²".
 */
function parseArea(params: Record<string, string>, title: string): number | null {
  const fromParams = params["общая площадь"] ?? params["площадь"];
  if (fromParams) {
    const cleaned = fromParams.replace(",", ".").replace(/[^\d.]/g, "");
    const n = parseFloat(cleaned);
    if (!isNaN(n) && n > 0) return n;
  }
  // Fallback: parse from title like "62,4м" or "62.4 м²"
  const m = /(\d+[,.]?\d*)\s*м/i.exec(title);
  if (m) {
    const n = parseFloat((m[1] as string).replace(",", "."));
    if (!isNaN(n) && n > 0) return n;
  }
  return null;
}

/**
 * Parse room count from params map or title like "2-к." / "3-комн.".
 * Returns 1-4 or null.
 */
function parseRooms(params: Record<string, string>, title: string): 1 | 2 | 3 | 4 | null {
  const fromParams =
    params["количество комнат"] ??
    params["кол-во комнат"] ??
    params["комнат"];
  if (fromParams) {
    const n = parseInt(fromParams.replace(/[^\d]/g, ""), 10);
    if (n >= 1 && n <= 4) return n as 1 | 2 | 3 | 4;
  }
  // Fallback: parse from title
  // "1-к.", "2-к.", "3-комн.", "4-комнатная"
  const m = /^(\d)-[кK]/.exec(title.trim());
  if (m) {
    const n = parseInt(m[1] as string, 10);
    if (n >= 1 && n <= 4) return n as 1 | 2 | 3 | 4;
  }
  // "студия" -> 1
  if (/студия/i.test(title)) return 1;
  return null;
}

/**
 * Parse floor info from params map.
 * Key "этаж" often looks like "5 из 17".
 */
function parseFloors(params: Record<string, string>): { floor?: number; totalFloors?: number } {
  const raw = params["этаж"];
  if (!raw) return {};
  const m = /^(\d+)\s*из\s*(\d+)$/.exec(raw.trim());
  if (m) {
    return { floor: parseInt(m[1] as string, 10), totalFloors: parseInt(m[2] as string, 10) };
  }
  const single = parseInt(raw.replace(/[^\d]/g, ""), 10);
  if (!isNaN(single)) return { floor: single };
  return {};
}

// ---------------------------------------------------------------------------
// Row -> Listing conversion
// ---------------------------------------------------------------------------

type ConvertResult =
  | { ok: true; listing: Listing }
  | { ok: false; reason: string };

function rowToListing(row: RawRow, index: number): ConvertResult {
  // Filtering rules
  const city = (row["город"] ?? row["Город"] ?? "").trim();
  if (city && city !== "Новосибирск") {
    return { ok: false, reason: `city="${city}" (not Новосибирск)` };
  }

  const category = (row["категория"] ?? row["Категория"] ?? "").trim();
  if (category && category !== "Недвижимость") {
    return { ok: false, reason: `category="${category}" (not Недвижимость)` };
  }

  const subcategory = (row["подкатегория"] ?? row["Подкатегория"] ?? "").trim();
  if (subcategory && subcategory !== "Квартиры") {
    return { ok: false, reason: `subcategory="${subcategory}" (not Квартиры)` };
  }

  // Required fields
  const uid = (row["uid"] ?? row["uID"] ?? "").trim();
  const id = uid ? `avito_${uid}` : `avito_idx_${index}`;

  const priceRaw = row["цена"] ?? row["Цена"] ?? "";
  const priceRub = parsePrice(priceRaw);
  if (priceRub === null || priceRub <= 0) {
    return { ok: false, reason: `invalid price: "${priceRaw}"` };
  }

  const title = (row["название"] ?? row["Название"] ?? "").trim();
  const paramsRaw = row["параметры"] ?? row["Параметры"] ?? "";
  const params = parseParams(paramsRaw);

  const areaM2 = parseArea(params, title);
  if (areaM2 === null) {
    return { ok: false, reason: `could not parse areaM2 from params="${paramsRaw}" title="${title}"` };
  }

  const rooms = parseRooms(params, title);
  if (rooms === null) {
    return { ok: false, reason: `could not parse rooms from params="${paramsRaw}" title="${title}"` };
  }

  const districtRaw = row["район"] ?? row["Район"] ?? "";
  const districtId = normalizeDistrict(districtRaw);
  if (!districtId) {
    return { ok: false, reason: `unknown district: "${districtRaw}"` };
  }

  // Optional / derived fields
  const dateRaw = row["дата"] ?? row["Дата"] ?? "";
  const publishedAt = parseDate(dateRaw) ?? new Date().toISOString();

  const addressRaw = (row["адрес"] ?? row["Адрес"] ?? "").trim();
  const address = addressRaw ? `Новосибирск, ${addressRaw}` : `Новосибирск, ${districtRaw}`;

  const url = (row["ссылка на объявление"] ?? row["Ссылка на объявление"] ?? "").trim();

  const { floor, totalFloors } = parseFloors(params);

  const latRaw = row["широта"] ?? row["Широта"] ?? "";
  const lonRaw = row["долгота"] ?? row["Долгота"] ?? "";
  const lat = latRaw ? parseFloat(latRaw.replace(",", ".")) : undefined;
  const lon = lonRaw ? parseFloat(lonRaw.replace(",", ".")) : undefined;

  const metro = (row["метро"] ?? row["Метро"] ?? "").trim() || undefined;
  const userType = (row["тип пользователя"] ?? row["Тип пользователя"] ?? "").trim() || undefined;

  const listing: Listing = {
    id,
    source: "avito_restapp",
    url,
    districtId,
    address,
    rooms,
    areaM2,
    priceRub,
    publishedAt,
    buildingType: "unknown",
    ...(floor !== undefined ? { floor } : {}),
    ...(totalFloors !== undefined ? { totalFloors } : {}),
    ...(lat !== undefined && !isNaN(lat) ? { lat } : {}),
    ...(lon !== undefined && !isNaN(lon) ? { lon } : {}),
    ...(metro !== undefined ? { metro } : {}),
    ...(userType !== undefined ? { userType } : {}),
    ...(category ? { category } : {}),
    ...(subcategory ? { subcategory } : {}),
  };

  return { ok: true, listing };
}

// ---------------------------------------------------------------------------
// CSV / TSV parsing
// ---------------------------------------------------------------------------

async function readDelimitedFile(filePath: string): Promise<RawRow[]> {
  const content = await readFile(filePath, "utf-8");
  const lines = content.split(/\r?\n/).filter((l: string) => l.trim().length > 0);

  if (lines.length === 0) return [];

  // Auto-detect delimiter from first line
  const firstLine = lines[0] as string;
  const tabCount = (firstLine.match(/\t/g) ?? []).length;
  const commaCount = (firstLine.match(/,/g) ?? []).length;
  const delimiter = tabCount >= commaCount ? "\t" : ",";

  const headers = parseDelimitedLine(firstLine, delimiter);
  const rows: RawRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseDelimitedLine(lines[i] as string, delimiter);
    if (values.every((v) => v === "")) continue;
    const row: RawRow = {};
    headers.forEach((h, idx) => {
      row[h.trim()] = (values[idx] ?? "").trim();
    });
    rows.push(row);
  }

  return rows;
}

/**
 * Simple RFC 4180-compatible line parser.
 * Handles quoted fields with embedded commas/tabs/quotes.
 */
function parseDelimitedLine(line: string, delimiter: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const ch = line[i] as string;

    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          // Escaped quote
          current += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        current += ch;
        i++;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        i++;
      } else if (line.startsWith(delimiter, i)) {
        fields.push(current);
        current = "";
        i += delimiter.length;
      } else {
        current += ch;
        i++;
      }
    }
  }

  fields.push(current);
  return fields;
}

// ---------------------------------------------------------------------------
// XLSX parsing via @e965/xlsx
// ---------------------------------------------------------------------------

async function readXlsxFile(filePath: string): Promise<RawRow[]> {
  const fileBuffer = await readFile(filePath);
  const workbook = XLSX.read(fileBuffer, { type: "buffer", cellDates: true });

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) throw new Error("No worksheets found in XLSX file");

  const worksheet = workbook.Sheets[firstSheetName];
  if (!worksheet) throw new Error("Worksheet is empty");

  // sheet_to_json returns an array of objects keyed by header row
  const rows = XLSX.utils.sheet_to_json<RawRow>(worksheet, {
    defval: "",
    raw: false,
  });

  return rows;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error(
      "Usage: tsx tools/ingest/restapp-import.ts <input-file> [output-file]\n" +
        "  <input-file>   Path to a rest-app.net CSV/TSV or XLSX export\n" +
        "  [output-file]  Output JSON path (default: <input>.listings.json)"
    );
    process.exit(1);
  }

  const inputPath = path.resolve(args[0] as string);
  const ext = path.extname(inputPath).toLowerCase();
  const outputPath = args[1]
    ? path.resolve(args[1])
    : inputPath.replace(/\.[^.]+$/, "") + ".listings.json";

  console.log(`Input:  ${inputPath}`);
  console.log(`Output: ${outputPath}`);

  // Read rows
  let rows: RawRow[];
  if (ext === ".xlsx") {
    console.log("Detected format: XLSX");
    rows = await readXlsxFile(inputPath);
  } else {
    console.log(`Detected format: delimited text (${ext || "no extension"})`);
    rows = await readDelimitedFile(inputPath);
  }

  console.log(`\nRead ${rows.length} data rows`);

  // Convert rows to listings
  let kept = 0;
  let skipped = 0;
  const listings: Listing[] = [];

  const skipReasons: Record<string, number> = {};

  for (let i = 0; i < rows.length; i++) {
    const result = rowToListing(rows[i] as RawRow, i);
    if (result.ok) {
      listings.push(result.listing);
      kept++;
    } else {
      skipped++;
      const key = result.reason.split(":")[0] ?? result.reason;
      skipReasons[key] = (skipReasons[key] ?? 0) + 1;
    }
  }

  console.log(`\nResults:`);
  console.log(`  Kept:    ${kept}`);
  console.log(`  Skipped: ${skipped}`);

  if (Object.keys(skipReasons).length > 0) {
    console.log(`\nSkip reasons:`);
    for (const [reason, count] of Object.entries(skipReasons).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${count.toString().padStart(5)}  ${reason}`);
    }
  }

  if (listings.length === 0) {
    console.warn("\nWARNING: No listings were produced. Check that the input file matches expected format.");
  }

  const output: ListingsFile = {
    updatedAt: new Date().toISOString(),
    source: "avito_restapp",
    listings,
  };

  await writeFile(outputPath, JSON.stringify(output, null, 2), "utf-8");
  console.log(`\nWritten ${listings.length} listings to: ${outputPath}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
