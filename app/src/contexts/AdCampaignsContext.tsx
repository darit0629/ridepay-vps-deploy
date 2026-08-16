import { createContext, useContext, type ReactNode } from "react";
import { trpc } from "@/providers/trpc";
import type { AdCampaign, CampaignStatus } from "@/lib/mockAdCampaigns";

type UpdatableCampaignFields = Partial<
  Pick<AdCampaign, "name" | "targetArea" | "budget" | "startDate" | "endDate" | "cpm" | "cpc" | "vehicleCount" | "slotSeconds" | "driverSharePercent" | "allottedDriverIds">
>;

interface AdCampaignsContextType {
  campaigns: AdCampaign[];
  addCampaign: (
    campaign: Omit<AdCampaign, "id" | "spent" | "impressions" | "clicks" | "status" | "allottedDriverIds" | "cpm" | "cpc"> & {
      allottedDriverIds?: string[];
    }
  ) => void;
  setCampaignStatus: (id: string, status: CampaignStatus) => void;
  setCampaignDrivers: (id: string, driverIds: string[]) => void;
  updateCampaign: (id: string, updates: UpdatableCampaignFields) => void;
}

const AdCampaignsContext = createContext<AdCampaignsContextType | undefined>(undefined);

// Real, persistent campaigns (MySQL-backed via api/ad-router.ts) — replaces
// the old in-memory useState that reset to the same 4 seed campaigns on
// every reload. Keeps the exact same external interface so every consuming
// page (AdminAdvertising, AdvertiserDashboard, AdvertiserCampaignDetail,
// DriverAdOptIn) needed no changes for campaign CRUD itself.
export function AdCampaignsProvider({ children }: { children: ReactNode }) {
  const utils = trpc.useUtils();
  const { data } = trpc.ad.listCampaigns.useQuery(undefined, { refetchInterval: 10000, refetchIntervalInBackground: true });
  const campaigns = data ?? [];

  const invalidate = () => utils.ad.listCampaigns.invalidate();
  const createMutation = trpc.ad.createCampaign.useMutation({ onSuccess: invalidate });
  const setStatusMutation = trpc.ad.setCampaignStatus.useMutation({ onSuccess: invalidate });
  const setDriversMutation = trpc.ad.setCampaignDrivers.useMutation({ onSuccess: invalidate });
  const updateMutation = trpc.ad.updateCampaign.useMutation({ onSuccess: invalidate });

  const addCampaign: AdCampaignsContextType["addCampaign"] = (campaign) => {
    createMutation.mutate({
      advertiserName: campaign.advertiserName,
      name: campaign.name,
      adType: campaign.adType,
      targetArea: campaign.targetArea,
      budget: campaign.budget,
      startDate: campaign.startDate,
      endDate: campaign.endDate,
      vehicleCount: campaign.vehicleCount,
      slotSeconds: campaign.slotSeconds,
      driverSharePercent: campaign.driverSharePercent,
      allottedDriverIds: campaign.allottedDriverIds ?? [],
      creativeColor: campaign.creativeColor,
    });
  };

  const setCampaignStatus = (id: string, status: CampaignStatus) => {
    setStatusMutation.mutate({ id, status });
  };

  const setCampaignDrivers = (id: string, driverIds: string[]) => {
    setDriversMutation.mutate({ id, driverIds });
  };

  const updateCampaign = (id: string, updates: UpdatableCampaignFields) => {
    updateMutation.mutate({ id, updates });
  };

  return (
    <AdCampaignsContext.Provider value={{ campaigns, addCampaign, setCampaignStatus, setCampaignDrivers, updateCampaign }}>
      {children}
    </AdCampaignsContext.Provider>
  );
}

export function useAdCampaigns() {
  const context = useContext(AdCampaignsContext);
  if (context === undefined) {
    throw new Error("useAdCampaigns must be used within an AdCampaignsProvider");
  }
  return context;
}
