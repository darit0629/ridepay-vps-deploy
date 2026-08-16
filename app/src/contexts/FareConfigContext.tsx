import { createContext, useContext, type ReactNode } from "react";
import { trpc } from "@/providers/trpc";
import type { SurgeSettings, FareVehicleTypeId, FareVehicleConfig, FareTax } from "../../api/fare-router";
import { deriveFareVehicleId, type LegacyVehicleType, type LegacyRideSegment } from "@/lib/fareVehicleMapping";

export type { SurgeSettings, FareVehicleTypeId, FareVehicleConfig, FareTax };
export type { LegacyVehicleType, LegacyRideSegment };

// Loading-state fallback only (used until the first query resolves) — kept
// as a local, type-only-import-safe duplicate rather than importing the
// runtime values from api/fare-router.ts, which would pull the server's
// trpc/zod/middleware module chain into the client bundle.
const fallbackSurgeSettings: SurgeSettings = {
  enabled: true,
  maxSurgePercent: 50,
  minFare: 30,
  nightChargePercent: 10,
  festivalChargePercent: 20,
  emergencyOverride: false,
  rainActive: false,
  festivalActive: false,
  surgeMode: "manual",
  demandSurgePercent: 0,
  demandTiers: [
    { count: 3, percent: 15 },
    { count: 6, percent: 30 },
    { count: 10, percent: 50 },
  ],
  peakWindows: [
    { label: "Morning Peak", startHour: 8, endHour: 10 },
    { label: "Evening Peak", startHour: 18, endHour: 20 },
  ],
  aiPricingEnabled: true,
};

interface FareConfigContextType {
  surge: SurgeSettings;
  fareVehicleConfigs: FareVehicleConfig[];
  updateSurge: (updates: Partial<Omit<SurgeSettings, "surgeMode" | "demandTiers" | "peakWindows">>) => void;
  isVehicleEnabled: (vehicleType: LegacyVehicleType, segment: LegacyRideSegment) => boolean;
}

const FareConfigContext = createContext<FareConfigContextType | undefined>(undefined);

// All fare math lives server-side (api/fare-router.ts) — this context is now
// just a thin, always-defined view over that server state so existing
// consumers (UserHome, AdminSurgePricing) don't need to handle loading
// states, while admin edits persist server-side and reach every device.
export function FareConfigProvider({ children }: { children: ReactNode }) {
  const utils = trpc.useUtils();

  const { data: surge } = trpc.fare.getSurge.useQuery(undefined, { refetchInterval: 5000 });
  const { data: fareVehicleConfigs } = trpc.fare.listVehicleFareConfigs.useQuery(undefined, { refetchInterval: 5000 });

  // Optimistic update — without this, a toggle click (e.g. AI Suggested
  // Pricing) waited on a full mutate-then-invalidate round trip before the
  // switch visually moved, which on a slow connection reads as broken, and
  // a second click fired before that round trip finished would compute
  // `!surge.aiPricingEnabled` off the still-stale cached value and silently
  // cancel the first click out. Writing the new value into the query cache
  // immediately makes every click respond instantly and correctly; onError
  // rolls back if the mutation actually fails, onSettled reconciles with
  // the server's real state either way.
  const updateSurgeMutation = trpc.fare.updateSurge.useMutation({
    onMutate: async (patch) => {
      await utils.fare.getSurge.cancel();
      const previous = utils.fare.getSurge.getData();
      utils.fare.getSurge.setData(undefined, (old) => (old ? { ...old, ...patch } : old));
      return { previous };
    },
    onError: (_err, _patch, context) => {
      if (context?.previous) utils.fare.getSurge.setData(undefined, context.previous);
    },
    onSettled: () => utils.fare.getSurge.invalidate(),
  });

  // Only the plain scalar fields — surgeMode, demandTiers and peakWindows
  // each go through their own dedicated mutation (updateSurgeMode /
  // updateDemandTiers / updatePeakWindows) since the server's generic
  // updateSurge endpoint only accepts number/boolean values.
  const updateSurge = (updates: Partial<Omit<SurgeSettings, "surgeMode" | "demandTiers" | "peakWindows">>) => {
    updateSurgeMutation.mutate(updates);
  };

  const isVehicleEnabled = (vehicleType: LegacyVehicleType, segment: LegacyRideSegment) => {
    const id = deriveFareVehicleId(vehicleType, segment);
    return (fareVehicleConfigs ?? []).find((v) => v.id === id)?.enabled ?? true;
  };

  return (
    <FareConfigContext.Provider
      value={{
        surge: surge ?? fallbackSurgeSettings,
        fareVehicleConfigs: fareVehicleConfigs ?? [],
        updateSurge,
        isVehicleEnabled,
      }}
    >
      {children}
    </FareConfigContext.Provider>
  );
}

export function useFareConfig() {
  const context = useContext(FareConfigContext);
  if (context === undefined) {
    throw new Error("useFareConfig must be used within a FareConfigProvider");
  }
  return context;
}
