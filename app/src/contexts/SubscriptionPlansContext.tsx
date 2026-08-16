import { createContext, useContext, type ReactNode } from "react";
import { trpc } from "@/providers/trpc";
import type { SubscriptionPlan, PlanId } from "@/lib/mockSubscriptionPlans";

interface SubscriptionPlansContextType {
  plans: SubscriptionPlan[];
  updatePlan: (id: PlanId, updates: Partial<Pick<SubscriptionPlan, "price" | "period" | "perks" | "category" | "active">>) => void;
}

const SubscriptionPlansContext = createContext<SubscriptionPlansContextType | undefined>(undefined);

// Real, persistent plan catalog (MySQL-backed via api/plans-router.ts) —
// replaces the old in-memory useState that reset admin edits on every reload.
export function SubscriptionPlansProvider({ children }: { children: ReactNode }) {
  const utils = trpc.useUtils();
  const { data } = trpc.plans.listPlans.useQuery();
  const plans = (data ?? []) as SubscriptionPlan[];

  const updateMutation = trpc.plans.updatePlan.useMutation({
    onSuccess: () => utils.plans.listPlans.invalidate(),
  });

  const updatePlan: SubscriptionPlansContextType["updatePlan"] = (id, updates) => {
    updateMutation.mutate({ id, updates });
  };

  return (
    <SubscriptionPlansContext.Provider value={{ plans, updatePlan }}>
      {children}
    </SubscriptionPlansContext.Provider>
  );
}

export function useSubscriptionPlans() {
  const context = useContext(SubscriptionPlansContext);
  if (context === undefined) {
    throw new Error("useSubscriptionPlans must be used within a SubscriptionPlansProvider");
  }
  return context;
}
