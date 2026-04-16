import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { District } from "../dto/listing.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const districtsFilePath = path.resolve(__dirname, "../../data/novosibirsk.districts.json");

let districtsCache: District[] | null = null;

export async function loadDistricts(): Promise<District[]> {
  if (districtsCache) {
    return districtsCache;
  }

  const fileContent = await readFile(districtsFilePath, "utf-8");
  districtsCache = JSON.parse(fileContent) as District[];
  return districtsCache;
}

export async function getDistrictById(id: string): Promise<District | null> {
  const districts = await loadDistricts();
  return districts.find((d) => d.id === id) ?? null;
}
