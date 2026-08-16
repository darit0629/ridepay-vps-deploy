export interface FarePrediction {
  normalFare: number;
  suggestedFare: number;
  multiplier: number;
  reasons: string[];
}

// Simulated AI fare prediction - a real implementation would weigh live
// traffic, weather, and supply/demand signals from a model; this uses
// time-of-day rules plus a randomized demand/weather factor to produce a
// believable suggested fare with reasoning, matching the same UX shape.
export function predictFare(normalFare: number): FarePrediction {
  const hour = new Date().getHours();
  const reasons: string[] = [];
  let multiplier = 1;

  const isPeakHour = (hour >= 8 && hour <= 10) || (hour >= 18 && hour <= 20);
  if (isPeakHour) {
    multiplier += 0.15;
    reasons.push("Peak Hours");
  }

  const isNight = hour >= 22 || hour < 5;
  if (isNight) {
    multiplier += 0.1;
    reasons.push("Night Charge");
  }

  if (Math.random() > 0.55) {
    multiplier += 0.12;
    reasons.push("High Demand");
  }

  if (Math.random() > 0.75) {
    multiplier += 0.1;
    reasons.push("Weather Conditions");
  }

  if (reasons.length === 0) reasons.push("Standard Pricing");

  return {
    normalFare,
    suggestedFare: Math.round(normalFare * multiplier),
    multiplier: Math.round(multiplier * 100) / 100,
    reasons,
  };
}
