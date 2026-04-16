const OPENWEATHER_BASE_URL = process.env.OPENWEATHER_BASE_URL ?? "https://api.openweathermap.org";
const OPENWEATHER_TIMEOUT_MS = Number(process.env.OPENWEATHER_TIMEOUT_MS ?? 8000);
const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY ?? "";

export async function owFetchJson(path: string): Promise<any> {
  const url = new URL(path, OPENWEATHER_BASE_URL);
  url.searchParams.set("appid", OPENWEATHER_API_KEY);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), OPENWEATHER_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      throw new Error(`OpenWeather request failed: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}
