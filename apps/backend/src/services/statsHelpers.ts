/**
 * Statistical helpers for housing market analytics.
 * All functions operate on sorted numeric arrays for efficiency.
 */

export function sortedNumbers(values: number[]): number[] {
  return [...values].sort((a, b) => a - b);
}

/**
 * Compute a percentile (0–100) from a sorted array using linear interpolation.
 * Returns 0 for an empty array.
 */
export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];

  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);

  if (lower === upper) {
    return sorted[lower];
  }

  const weight = index - lower;
  return Math.round(sorted[lower] * (1 - weight) + sorted[upper] * weight);
}

export function median(sorted: number[]): number {
  return percentile(sorted, 50);
}

export type Stats = {
  median: number;
  p25: number;
  p75: number;
};

export function computeStats(values: number[]): Stats {
  const sorted = sortedNumbers(values);
  return {
    median: median(sorted),
    p25: percentile(sorted, 25),
    p75: percentile(sorted, 75),
  };
}
