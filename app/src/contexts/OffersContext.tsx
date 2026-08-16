import { createContext, useContext, type ReactNode } from "react";
import { trpc } from "@/providers/trpc";
import type { Coupon } from "../../api/coupon-router";

export type { Coupon };

interface OffersContextType {
  coupons: Coupon[];
  createCoupon: (coupon: Omit<Coupon, "usedCount">) => void;
  updateCoupon: (code: string, updates: Partial<Coupon>) => void;
  toggleCouponStatus: (code: string) => void;
}

const OffersContext = createContext<OffersContextType | undefined>(undefined);

// Coupons now live server-side (api/coupon-router.ts) — this context stays a
// thin, always-defined view over that state so existing consumers
// (AdminOffers, UserOffers) don't need to handle loading states.
export function OffersProvider({ children }: { children: ReactNode }) {
  const utils = trpc.useUtils();
  const { data: coupons } = trpc.coupon.list.useQuery(undefined, { refetchInterval: 5000 });

  const createMutation = trpc.coupon.create.useMutation({ onSuccess: () => utils.coupon.list.invalidate() });
  const updateMutation = trpc.coupon.update.useMutation({ onSuccess: () => utils.coupon.list.invalidate() });
  const toggleMutation = trpc.coupon.toggleStatus.useMutation({ onSuccess: () => utils.coupon.list.invalidate() });

  const createCoupon = (coupon: Omit<Coupon, "usedCount">) => {
    createMutation.mutate(coupon);
  };

  const updateCoupon = (code: string, updates: Partial<Coupon>) => {
    updateMutation.mutate({ code, updates });
  };

  const toggleCouponStatus = (code: string) => {
    toggleMutation.mutate({ code });
  };

  return (
    <OffersContext.Provider value={{ coupons: coupons ?? [], createCoupon, updateCoupon, toggleCouponStatus }}>
      {children}
    </OffersContext.Provider>
  );
}

export function useOffers() {
  const context = useContext(OffersContext);
  if (context === undefined) {
    throw new Error("useOffers must be used within an OffersProvider");
  }
  return context;
}
