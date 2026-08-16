import { createContext, useContext, type ReactNode } from "react";
import { trpc } from "@/providers/trpc";
import type {
  PromoSlide, OfferTeaser, NearbyServiceItem, QuickTile, RideTypeConfig, QuickTileId, RideTypeId,
} from "../../api/home-content-router";

export type { PromoSlide, PromoSlideIcon, OfferTeaser, NearbyServiceItem, NearbyServiceIcon, QuickTile, QuickTileId, RideTypeConfig, RideTypeId } from "../../api/home-content-router";

function moveItem<T>(list: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

interface HomeContentContextType {
  promoSlides: PromoSlide[];
  addPromoSlide: (slide: Omit<PromoSlide, "id">) => void;
  updatePromoSlide: (id: string, updates: Partial<PromoSlide>) => void;
  removePromoSlide: (id: string) => void;
  movePromoSlide: (id: string, direction: -1 | 1) => void;

  offerTeasers: OfferTeaser[];
  addOfferTeaser: (offer: Omit<OfferTeaser, "id">) => void;
  updateOfferTeaser: (id: string, updates: Partial<OfferTeaser>) => void;
  removeOfferTeaser: (id: string) => void;
  moveOfferTeaser: (id: string, direction: -1 | 1) => void;

  nearbyServices: NearbyServiceItem[];
  addNearbyService: (service: Omit<NearbyServiceItem, "id">) => void;
  updateNearbyService: (id: string, updates: Partial<NearbyServiceItem>) => void;
  removeNearbyService: (id: string) => void;
  moveNearbyService: (id: string, direction: -1 | 1) => void;

  quickTiles: QuickTile[];
  updateQuickTile: (id: QuickTileId, updates: Partial<QuickTile>) => void;

  rideTypes: RideTypeConfig[];
  updateRideType: (id: RideTypeId, updates: Partial<RideTypeConfig>) => void;
}

const HomeContentContext = createContext<HomeContentContextType | undefined>(undefined);

// Home Panel content now lives server-side (api/home-content-router.ts,
// home_content_settings singleton table) — admin edits used to be pure local
// React state here that reset on every refresh and never reached the rider
// app. Each helper computes the next full array client-side (same add/
// update/remove/reorder logic as before) then persists it in one mutation
// call, same "thin context over a real query" shape as OffersContext.tsx.
export function HomeContentProvider({ children }: { children: ReactNode }) {
  const utils = trpc.useUtils();
  const { data } = trpc.homeContent.get.useQuery();
  const updateMutation = trpc.homeContent.update.useMutation({ onSuccess: () => utils.homeContent.get.invalidate() });

  const promoSlides = data?.promoSlides ?? [];
  const offerTeasers = data?.offerTeasers ?? [];
  const nearbyServices = data?.nearbyServices ?? [];
  const quickTiles = data?.quickTiles ?? [];
  const rideTypes = data?.rideTypes ?? [];

  const addPromoSlide: HomeContentContextType["addPromoSlide"] = (slide) => {
    updateMutation.mutate({ promoSlides: [...promoSlides, { ...slide, id: `slide-${Date.now()}` }] });
  };
  const updatePromoSlide: HomeContentContextType["updatePromoSlide"] = (id, updates) => {
    updateMutation.mutate({ promoSlides: promoSlides.map((s) => (s.id === id ? { ...s, ...updates } : s)) });
  };
  const removePromoSlide = (id: string) => {
    updateMutation.mutate({ promoSlides: promoSlides.filter((s) => s.id !== id) });
  };
  const movePromoSlide = (id: string, direction: -1 | 1) => {
    updateMutation.mutate({ promoSlides: moveItem(promoSlides, promoSlides.findIndex((s) => s.id === id), direction) });
  };

  const addOfferTeaser: HomeContentContextType["addOfferTeaser"] = (offer) => {
    updateMutation.mutate({ offerTeasers: [...offerTeasers, { ...offer, id: `offer-${Date.now()}` }] });
  };
  const updateOfferTeaser: HomeContentContextType["updateOfferTeaser"] = (id, updates) => {
    updateMutation.mutate({ offerTeasers: offerTeasers.map((o) => (o.id === id ? { ...o, ...updates } : o)) });
  };
  const removeOfferTeaser = (id: string) => {
    updateMutation.mutate({ offerTeasers: offerTeasers.filter((o) => o.id !== id) });
  };
  const moveOfferTeaser = (id: string, direction: -1 | 1) => {
    updateMutation.mutate({ offerTeasers: moveItem(offerTeasers, offerTeasers.findIndex((o) => o.id === id), direction) });
  };

  const addNearbyService: HomeContentContextType["addNearbyService"] = (service) => {
    updateMutation.mutate({ nearbyServices: [...nearbyServices, { ...service, id: `svc-${Date.now()}` }] });
  };
  const updateNearbyService: HomeContentContextType["updateNearbyService"] = (id, updates) => {
    updateMutation.mutate({ nearbyServices: nearbyServices.map((s) => (s.id === id ? { ...s, ...updates } : s)) });
  };
  const removeNearbyService = (id: string) => {
    updateMutation.mutate({ nearbyServices: nearbyServices.filter((s) => s.id !== id) });
  };
  const moveNearbyService = (id: string, direction: -1 | 1) => {
    updateMutation.mutate({ nearbyServices: moveItem(nearbyServices, nearbyServices.findIndex((s) => s.id === id), direction) });
  };

  const updateQuickTile: HomeContentContextType["updateQuickTile"] = (id, updates) => {
    updateMutation.mutate({ quickTiles: quickTiles.map((t) => (t.id === id ? { ...t, ...updates } : t)) });
  };

  const updateRideType: HomeContentContextType["updateRideType"] = (id, updates) => {
    updateMutation.mutate({ rideTypes: rideTypes.map((r) => (r.id === id ? { ...r, ...updates } : r)) });
  };

  return (
    <HomeContentContext.Provider
      value={{
        promoSlides, addPromoSlide, updatePromoSlide, removePromoSlide, movePromoSlide,
        offerTeasers, addOfferTeaser, updateOfferTeaser, removeOfferTeaser, moveOfferTeaser,
        nearbyServices, addNearbyService, updateNearbyService, removeNearbyService, moveNearbyService,
        quickTiles, updateQuickTile,
        rideTypes, updateRideType,
      }}
    >
      {children}
    </HomeContentContext.Provider>
  );
}

export function useHomeContent() {
  const context = useContext(HomeContentContext);
  if (context === undefined) {
    throw new Error("useHomeContent must be used within a HomeContentProvider");
  }
  return context;
}
