export type PeakHourIntensity = "high" | "medium" | "low";

export function getMean(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function getStandardDeviation(values: number[], mean: number): number {
  if (values.length === 0) {
    return 0;
  }

  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;

  return Math.sqrt(variance);
}

export function classifyIntensity(
  orderCount: number,
  mean: number,
  standardDeviation: number
): PeakHourIntensity {
  if (orderCount <= 0) {
    return "low";
  }

  if (orderCount >= mean + standardDeviation) {
    return "high";
  }

  if (orderCount >= mean) {
    return "medium";
  }

  return "low";
}
