const WB_BASE_URL = process.env.WB_BASE_URL ?? "https://api.worldbank.org/v2";
const WB_TIMEOUT_MS = Number(process.env.WB_TIMEOUT_MS ?? 8000);

export async function wbFetchJson(path: string): Promise<any> {
  const url = `${WB_BASE_URL}${path}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), WB_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      throw new Error(`World Bank request failed: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}
