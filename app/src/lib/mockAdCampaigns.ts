export type AdType = "In-App Banner" | "Driver Screen" | "Vehicle Wrap";
export type CampaignStatus = "pending" | "active" | "paused" | "ended" | "rejected";

export interface AdCampaign {
  id: string;
  advertiserName: string;
  name: string;
  adType: AdType;
  targetArea: string;
  budget: number;
  spent: number;
  impressions: number;
  clicks: number;
  startDate: string;
  endDate: string;
  status: CampaignStatus;
  creativeColor: string;
  allottedDriverIds: string[];
  cpm: number; // cost per 1,000 impressions (₹)
  cpc: number; // cost per click (₹)
  vehicleCount: number; // number of vehicles the ad runs on
  slotSeconds: number; // seconds the ad plays per slot (screen/wrap loop, or banner display time)
  driverSharePercent: number; // % of this campaign's spend paid out to its allotted drivers
}

export const AD_TYPES: AdType[] = ["In-App Banner", "Driver Screen", "Vehicle Wrap"];

// Default driver revenue-share suggested when creating a campaign of this ad type.
// In-App Banner doesn't run on driver assets, so it defaults to 0% (all platform).
export const defaultDriverSharePercent: Record<AdType, number> = {
  "In-App Banner": 0,
  "Driver Screen": 35,
  "Vehicle Wrap": 50,
};

// Default slot duration (seconds the ad plays per view) shown as a starting point
// when a new campaign is created for a given ad type.
export const defaultSlotSeconds: Record<AdType, number> = {
  "In-App Banner": 8,
  "Driver Screen": 15,
  "Vehicle Wrap": 0,
};

export const CAMPAIGN_STATUS_CONFIG: Record<CampaignStatus, { label: string; color: string; bg: string }> = {
  pending: { label: "Pending Approval", color: "#FF6B00", bg: "#FFF5EB" },
  active: { label: "Active", color: "#138808", bg: "#E8F5E8" },
  paused: { label: "Paused", color: "#9CA3AF", bg: "#F3F4F6" },
  ended: { label: "Ended", color: "#6B7280", bg: "#F3F4F6" },
  rejected: { label: "Rejected", color: "#DC2626", bg: "#FEE2E2" },
};

export const AD_ANALYTICS_TREND = [32, 45, 38, 52, 60, 55, 68, 72, 64, 80, 76, 90];
