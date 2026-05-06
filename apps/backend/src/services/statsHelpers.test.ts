import { describe, it, expect } from "vitest";
import {
  sortedNumbers,
  percentile,
  median,
  computeStats,
} from "./statsHelpers.js";

describe("sortedNumbers", () => {
  it("returns a sorted copy of the input", () => {
    expect(sortedNumbers([5, 2, 8, 1])).toEqual([1, 2, 5, 8]);
  });

  it("does not mutate the original array", () => {
    const original = [3, 1, 2];
    sortedNumbers(original);
    expect(original).toEqual([3, 1, 2]);
  });

  it("handles an empty array", () => {
    expect(sortedNumbers([])).toEqual([]);
  });
});

describe("percentile", () => {
  it("returns 0 for an empty array", () => {
    expect(percentile([], 50)).toBe(0);
  });

  it("returns the only element for a single-element array", () => {
    expect(percentile([42], 50)).toBe(42);
  });

  it("computes the 50th percentile (median) correctly", () => {
    expect(percentile([1, 2, 3, 4, 5], 50)).toBe(3);
  });

  it("computes p25 correctly", () => {
    expect(percentile([10, 20, 30, 40], 25)).toBe(18);
  });

  it("computes p75 correctly", () => {
    expect(percentile([10, 20, 30, 40], 75)).toBe(33);
  });
});

describe("median", () => {
  it("returns the middle value for an odd-length sorted array", () => {
    expect(median([1, 2, 3])).toBe(2);
  });

  it("returns an interpolated value for even-length arrays", () => {
    expect(median([1, 2, 3, 4])).toBe(3); // linear interpolation at p50
  });

  it("returns 0 for an empty array", () => {
    expect(median([])).toBe(0);
  });
});

describe("computeStats", () => {
  it("returns correct median, p25, p75 for a sample dataset", () => {
    const values = [100_000, 200_000, 300_000, 400_000, 500_000];
    const stats = computeStats(values);
    expect(stats.median).toBe(300_000);
    expect(stats.p25).toBe(200_000);
    expect(stats.p75).toBe(400_000);
  });

  it("handles price-per-m2 values typical for Novosibirsk", () => {
    const pricesPerM2 = [60_000, 75_000, 82_000, 90_000, 110_000];
    const stats = computeStats(pricesPerM2);
    expect(stats.median).toBe(82_000);
    expect(stats.p25).toBeLessThan(stats.median);
    expect(stats.p75).toBeGreaterThan(stats.median);
  });

  it("returns zeros for an empty array", () => {
    const stats = computeStats([]);
    expect(stats.median).toBe(0);
    expect(stats.p25).toBe(0);
    expect(stats.p75).toBe(0);
  });
});
