import { useState } from "react";
import { Sparkles, MapPin, Trophy, RefreshCw } from "lucide-react";
import { SCORE_WEIGHTS, computeDriverScore, type DriverScoreFactors } from "@/lib/aiDriverMatching";
import AdminLayout from "@/components/admin/AdminLayout";

interface Candidate {
  id: number;
  name: string;
  vehicle: string;
  factors: DriverScoreFactors;
}

const baseCandidates: Candidate[] = [
  {
    id: 1,
    name: "Rakesh Kumar",
    vehicle: "Bajaj Maxima · WB 12 AB 1234",
    factors: { distance: 92, rating: 96, acceptanceRate: 88, cancellationRate: 95, fuelType: 70, vehicleHealth: 90, experience: 85, customerPreference: 80 },
  },
  {
    id: 2,
    name: "Anjali Sharma",
    vehicle: "Bajaj RE · WB 06 CD 5678",
    factors: { distance: 78, rating: 98, acceptanceRate: 92, cancellationRate: 98, fuelType: 100, vehicleHealth: 95, experience: 60, customerPreference: 90 },
  },
  {
    id: 3,
    name: "Sohail Khan",
    vehicle: "TVS King · WB 14 EF 9101",
    factors: { distance: 85, rating: 82, acceptanceRate: 70, cancellationRate: 80, fuelType: 70, vehicleHealth: 75, experience: 40, customerPreference: 65 },
  },
  {
    id: 4,
    name: "Vikash Singh",
    vehicle: "Piaggio Ape · WB 02 GH 1122",
    factors: { distance: 65, rating: 88, acceptanceRate: 95, cancellationRate: 90, fuelType: 70, vehicleHealth: 85, experience: 75, customerPreference: 70 },
  },
];

const rideRequest = {
  rider: "Priti Das",
  pickup: "Station Road, Ranaghat",
  destination: "Naihati Bus Stand",
};

function jitter(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value + (Math.random() * 10 - 5))));
}

function jitterFactors(factors: DriverScoreFactors): DriverScoreFactors {
  return {
    distance: jitter(factors.distance),
    rating: jitter(factors.rating),
    acceptanceRate: jitter(factors.acceptanceRate),
    cancellationRate: jitter(factors.cancellationRate),
    fuelType: jitter(factors.fuelType),
    vehicleHealth: jitter(factors.vehicleHealth),
    experience: jitter(factors.experience),
    customerPreference: jitter(factors.customerPreference),
  };
}

function reshuffle(candidates: Candidate[]): Candidate[] {
  return candidates.map((c) => ({ ...c, factors: jitterFactors(c.factors) }));
}

export default function AdminDispatchAI() {
  const [candidates, setCandidates] = useState<Candidate[]>(baseCandidates);

  const ranked = [...candidates]
    .map((c) => ({ ...c, score: computeDriverScore(c.factors) }))
    .sort((a, b) => b.score - a.score);

  return (
    <AdminLayout title="AI Dispatch">
      <div className="space-y-4 max-w-2xl">
        {/* Ride Request */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">Incoming Ride Request</h2>
            <button
              onClick={() => setCandidates(reshuffle(baseCandidates))}
              className="flex items-center gap-1 text-xs font-medium text-[#FF6B00] bg-[#FFF5EB] px-3 py-1.5 rounded-full"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Re-run Match
            </button>
          </div>
          <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] mb-2">Rider: {rideRequest.rider}</p>
          <div className="flex items-center gap-2 text-xs text-[#6B7280] dark:text-[#9CA3AF]">
            <MapPin className="w-3.5 h-3.5 text-[#138808]" /> {rideRequest.pickup}
            <span className="text-[#9CA3AF]">→</span>
            <MapPin className="w-3.5 h-3.5 text-[#FF6B00]" /> {rideRequest.destination}
          </div>
        </div>

        {/* Scoring Weights */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-[#7C3AED]" />
            <h2 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] text-sm">Driver Score Weights</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {SCORE_WEIGHTS.map((w) => (
              <span key={w.key} className="text-[10px] font-medium text-[#7C3AED] bg-[#F3E8FF] px-2.5 py-1 rounded-full">
                {w.label} {Math.round(w.weight * 100)}%
              </span>
            ))}
          </div>
        </div>

        {/* Ranked Candidates */}
        <div className="space-y-3">
          {ranked.map((driver, index) => (
            <div
              key={driver.id}
              className={`bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4 ${index === 0 ? "ring-2 ring-[#FF6B00]" : ""}`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#FFF5EB] flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-[#FF6B00]">{driver.name.charAt(0)}</span>
                  </div>
                  <div>
                    <p className="font-medium text-sm text-[#1A1A2E] dark:text-[#E5E7EB]">{driver.name}</p>
                    <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">{driver.vehicle}</p>
                  </div>
                </div>
                <div className="text-right">
                  {index === 0 && (
                    <div className="flex items-center gap-1 text-[10px] font-semibold text-[#FF6B00] mb-0.5">
                      <Trophy className="w-3 h-3" /> AI MATCHED
                    </div>
                  )}
                  <p className="text-xl font-bold text-[#1A1A2E] dark:text-[#E5E7EB]">{driver.score}</p>
                </div>
              </div>

              <div className="space-y-1.5">
                {SCORE_WEIGHTS.map((w) => (
                  <div key={w.key} className="flex items-center gap-2">
                    <span className="text-[10px] text-[#9CA3AF] w-28 flex-shrink-0">{w.label}</span>
                    <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#FF6B00] rounded-full transition-all"
                        style={{ width: `${driver.factors[w.key]}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF] w-8 text-right flex-shrink-0">{driver.factors[w.key]}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}
