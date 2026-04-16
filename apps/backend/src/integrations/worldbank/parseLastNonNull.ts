export function parseLastNonNull(wbResponseJson: any): { value: number | null; year: number | null } {
  const dataArray = Array.isArray(wbResponseJson) ? wbResponseJson[1] : undefined;

  if (!Array.isArray(dataArray)) {
    return { value: null, year: null };
  }

  for (const item of dataArray) {
    if (!item || typeof item !== "object") {
      continue;
    }

    if (item.value == null) {
      continue;
    }

    const numericValue = Number(item.value);
    const numericYear = Number(item.date);

    return {
      value: Number.isFinite(numericValue) ? numericValue : null,
      year: Number.isFinite(numericYear) ? numericYear : null
    };
  }

  return { value: null, year: null };
}
