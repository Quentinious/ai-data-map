/**
 * tools/geo/arcgis-boundary-to-geojson.ts
 *
 * Converts Novosibirsk district boundaries from ArcGIS JSON to GeoJSON.
 *
 * Usage:
 *   tsx tools/geo/arcgis-boundary-to-geojson.ts [input-file] [output-file]
 *
 * Defaults:
 *   input:  data/geo/novosibirsk-districts.arcgis.json  (repo-relative)
 *   output: data/geo/novosibirsk-districts.geojson      (repo-relative)
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

// ---------------------------------------------------------------------------
// District name → ID mapping
// ---------------------------------------------------------------------------

const DISTRICT_ID_MAP: Record<string, string> = {
  "Центральный": "centralny",
  "Железнодорожный": "zheleznodorozhny",
  "Заельцовский": "zaeltsovsky",
  "Калининский": "kalininsky",
  "Ленинский": "leninsky",
  "Кировский": "kirovsky",
  "Октябрьский": "oktyabrsky",
  "Советский": "sovetsky",
  "Дзержинский": "dzerzhinsky",
  "Первомайский": "pervomaysky",
};

// ---------------------------------------------------------------------------
// ArcGIS JSON types
// ---------------------------------------------------------------------------

type ArcGisFeature = {
  attributes: Record<string, unknown>;
  geometry: {
    rings: number[][][];
  };
};

type ArcGisFeatureSet = {
  geometryType: string;
  spatialReference?: {
    wkid?: number;
    latestWkid?: number;
  };
  features: ArcGisFeature[];
};

// ---------------------------------------------------------------------------
// GeoJSON types
// ---------------------------------------------------------------------------

type GeoJsonPolygon = {
  type: "Polygon";
  coordinates: number[][][];
};

type GeoJsonFeature = {
  type: "Feature";
  properties: {
    districtName: string;
    districtId: string | null;
  };
  geometry: GeoJsonPolygon;
};

type GeoJsonFeatureCollection = {
  type: "FeatureCollection";
  features: GeoJsonFeature[];
};

// ---------------------------------------------------------------------------
// Conversion
// ---------------------------------------------------------------------------

function extractDistrictName(attributes: Record<string, unknown>): string {
  // Prefer "District", fall back to common casing variants
  const value =
    attributes["District"] ??
    attributes["district"] ??
    attributes["DISTRICT"] ??
    attributes["Name"] ??
    attributes["name"] ??
    attributes["NAME"];

  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  return "(unknown)";
}

function convertToGeoJson(featureSet: ArcGisFeatureSet): GeoJsonFeatureCollection {
  const features: GeoJsonFeature[] = featureSet.features.map((f) => {
    const districtName = extractDistrictName(f.attributes);
    const districtId = DISTRICT_ID_MAP[districtName] ?? null;

    return {
      type: "Feature",
      properties: {
        districtName,
        districtId,
      },
      geometry: {
        type: "Polygon",
        // ArcGIS rings map 1-to-1 to GeoJSON polygon rings; coordinate order kept as-is [lng, lat]
        coordinates: f.geometry.rings,
      },
    };
  });

  return {
    type: "FeatureCollection",
    features,
  };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateSpatialReference(featureSet: ArcGisFeatureSet): void {
  const sr = featureSet.spatialReference;
  if (!sr) {
    console.warn("WARNING: spatialReference is missing; assuming WGS 84 (4326).");
    return;
  }
  const wkid = sr.latestWkid ?? sr.wkid;
  if (wkid !== 4326) {
    console.error(
      `ERROR: spatialReference.wkid (or latestWkid) is ${wkid}, expected 4326 (WGS 84).\n` +
        "Coordinates are not in [lng, lat] — reprojection is required before using this script."
    );
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  // Repo root is two levels up from tools/geo/
  const repoRoot = path.resolve(__dirname, "..", "..");

  const args = process.argv.slice(2);

  const inputPath = args[0]
    ? path.resolve(args[0])
    : path.join(repoRoot, "data", "geo", "novosibirsk-districts.arcgis.json");

  const outputPath = args[1]
    ? path.resolve(args[1])
    : path.join(repoRoot, "data", "geo", "novosibirsk-districts.geojson");

  // Read input
  let raw: string;
  try {
    raw = await readFile(inputPath, "utf-8");
  } catch (err) {
    console.error(`ERROR: Could not read input file: ${inputPath}`);
    console.error((err as Error).message);
    process.exit(1);
  }

  let featureSet: ArcGisFeatureSet;
  try {
    featureSet = JSON.parse(raw) as ArcGisFeatureSet;
  } catch (err) {
    console.error("ERROR: Input file is not valid JSON.");
    console.error((err as Error).message);
    process.exit(1);
  }

  // Validate geometry type
  if (featureSet.geometryType !== "esriGeometryPolygon") {
    console.warn(
      `WARNING: geometryType is "${featureSet.geometryType}", expected "esriGeometryPolygon".`
    );
  }

  // Validate spatial reference
  validateSpatialReference(featureSet);

  const featuresRead = featureSet.features.length;

  // Convert
  const geoJson = convertToGeoJson(featureSet);
  const featuresWritten = geoJson.features.length;

  // Ensure output directory exists
  await mkdir(path.dirname(outputPath), { recursive: true });

  // Write output
  await writeFile(outputPath, JSON.stringify(geoJson, null, 2), "utf-8");

  // Console report
  console.log(`\nArcGIS → GeoJSON conversion complete`);
  console.log(`  Features read:    ${featuresRead}`);
  console.log(`  Features written: ${featuresWritten}`);
  console.log(`\n  District mapping:`);

  for (const feature of geoJson.features) {
    const { districtName, districtId } = feature.properties;
    const id = districtId ?? "(no match)";
    console.log(`    ${districtName.padEnd(20)} → ${id}`);
  }

  const unmapped = geoJson.features.filter((f) => f.properties.districtId === null);
  if (unmapped.length > 0) {
    console.warn(
      `\nWARNING: ${unmapped.length} feature(s) had no districtId match:` +
        unmapped.map((f) => `\n    "${f.properties.districtName}"`).join("")
    );
  }

  console.log(`\n  Output: ${outputPath}`);
}

main().catch((err: unknown) => {
  console.error("Fatal error during ArcGIS to GeoJSON conversion:", err);
  process.exit(1);
});
