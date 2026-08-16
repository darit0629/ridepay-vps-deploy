export interface DriverScoreFactors {
  distance: number;
  rating: number;
  acceptanceRate: number;
  cancellationRate: number;
  fuelType: number;
  vehicleHealth: number;
  experience: number;
  customerPreference: number;
}

export interface ScoreWeight {
  key: keyof DriverScoreFactors;
  label: string;
  weight: number;
}

// Mirrors the weighting model in the product blueprint: each factor is a
// 0-100 normalized score, combined by weight to rank candidate drivers for
// a ride request - the highest score gets matched first.
export const SCORE_WEIGHTS: ScoreWeight[] = [
  { key: "distance", label: "Distance", weight: 0.25 },
  { key: "rating", label: "Rating", weight: 0.2 },
  { key: "acceptanceRate", label: "Acceptance Rate", weight: 0.2 },
  { key: "cancellationRate", label: "Cancellation", weight: 0.1 },
  { key: "fuelType", label: "Fuel Type", weight: 0.05 },
  { key: "vehicleHealth", label: "Vehicle Health", weight: 0.05 },
  { key: "experience", label: "Driver Experience", weight: 0.1 },
  { key: "customerPreference", label: "Customer Preference", weight: 0.05 },
];

export function computeDriverScore(factors: DriverScoreFactors): number {
  const total = SCORE_WEIGHTS.reduce((sum, { key, weight }) => sum + factors[key] * weight, 0);
  return Math.round(total);
}
