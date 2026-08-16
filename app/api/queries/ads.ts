import { eq, sql } from "drizzle-orm";
import { getDb } from "./connection";
import { adCampaigns, driverProfiles, users, type AdCampaignRow } from "@db/schema";

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
  cpm: number;
  cpc: number;
  vehicleCount: number;
  slotSeconds: number;
  driverSharePercent: number;
}

// Same default performance-pricing the old AdCampaignsContext applied client-side
// when a new campaign was created, kept server-side now that creation is real.
const DEFAULT_AD_RATES: Record<AdType, { cpm: number; cpc: number }> = {
  "In-App Banner": { cpm: 45, cpc: 3 },
  "Driver Screen": { cpm: 70, cpc: 5 },
  "Vehicle Wrap": { cpm: 0, cpc: 0 },
};

function genId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 1000)}`;
}

function toView(row: AdCampaignRow): AdCampaign {
  return {
    id: row.id,
    advertiserName: row.advertiserName,
    name: row.name,
    adType: row.adType,
    targetArea: row.targetArea,
    budget: Number(row.budget),
    spent: Number(row.spent),
    impressions: row.impressions,
    clicks: row.clicks,
    startDate: row.startDate,
    endDate: row.endDate,
    status: row.status,
    creativeColor: row.creativeColor,
    allottedDriverIds: row.allottedDriverIds,
    cpm: Number(row.cpm),
    cpc: Number(row.cpc),
    vehicleCount: row.vehicleCount,
    slotSeconds: row.slotSeconds,
    driverSharePercent: row.driverSharePercent,
  };
}

// One-time seed matching the old mock dataset's 4 example campaigns, so the
// admin/advertiser portals aren't blank on first load — allottedDriverIds
// start empty since the old mock ids ("d1".."d5") don't correspond to any
// real driver account.
export async function seedAdCampaignsIfEmpty(): Promise<void> {
  const db = getDb();
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(adCampaigns);
  if (Number(count) > 0) return;
  await db.insert(adCampaigns).values([
    {
      id: genId("camp"), advertiserName: "Sharma Textiles", name: "Diwali Mega Sale", adType: "In-App Banner",
      targetArea: "Ranaghat, Kalyani", budget: "25000", spent: "14300", impressions: 84200, clicks: 2380,
      startDate: "2026-07-01", endDate: "2026-07-31", status: "active", creativeColor: "#FF6B00",
      allottedDriverIds: [], cpm: "45", cpc: "3", vehicleCount: 40, slotSeconds: 8, driverSharePercent: 0,
    },
    {
      id: genId("camp"), advertiserName: "Kalyani Multiplex", name: "Weekend Movie Offers", adType: "Driver Screen",
      targetArea: "Kalyani", budget: "12000", spent: "12000", impressions: 41500, clicks: 960,
      startDate: "2026-06-10", endDate: "2026-06-30", status: "ended", creativeColor: "#7C3AED",
      allottedDriverIds: [], cpm: "70", cpc: "5", vehicleCount: 12, slotSeconds: 15, driverSharePercent: 35,
    },
    {
      id: genId("camp"), advertiserName: "Sharma Textiles", name: "Vehicle Wrap - New Showroom", adType: "Vehicle Wrap",
      targetArea: "Ranaghat", budget: "40000", spent: "8600", impressions: 156000, clicks: 0,
      startDate: "2026-07-10", endDate: "2026-08-10", status: "active", creativeColor: "#0EA5E9",
      allottedDriverIds: [], cpm: "0", cpc: "0", vehicleCount: 2, slotSeconds: 0, driverSharePercent: 50,
    },
    {
      id: genId("camp"), advertiserName: "Ranaghat Public School", name: "Admissions Open 2026-27", adType: "In-App Banner",
      targetArea: "Ranaghat", budget: "8000", spent: "0", impressions: 0, clicks: 0,
      startDate: "2026-07-20", endDate: "2026-08-20", status: "pending", creativeColor: "#138808",
      allottedDriverIds: [], cpm: "45", cpc: "3", vehicleCount: 25, slotSeconds: 8, driverSharePercent: 0,
    },
  ]);
}

export async function listCampaigns(): Promise<AdCampaign[]> {
  const rows = await getDb().select().from(adCampaigns).orderBy(adCampaigns.createdAt);
  return rows.map(toView).reverse();
}

export interface CreateCampaignInput {
  advertiserName: string;
  name: string;
  adType: AdType;
  targetArea: string;
  budget: number;
  startDate: string;
  endDate: string;
  vehicleCount: number;
  slotSeconds: number;
  driverSharePercent: number;
  allottedDriverIds: string[];
  creativeColor: string;
}

export async function createCampaign(input: CreateCampaignInput): Promise<AdCampaign> {
  const db = getDb();
  const id = genId("camp");
  const rates = DEFAULT_AD_RATES[input.adType];
  await db.insert(adCampaigns).values({
    id,
    advertiserName: input.advertiserName,
    name: input.name,
    adType: input.adType,
    targetArea: input.targetArea,
    budget: String(input.budget),
    startDate: input.startDate,
    endDate: input.endDate,
    vehicleCount: input.vehicleCount,
    slotSeconds: input.slotSeconds,
    driverSharePercent: input.driverSharePercent,
    allottedDriverIds: input.allottedDriverIds,
    creativeColor: input.creativeColor,
    cpm: String(rates.cpm),
    cpc: String(rates.cpc),
    status: "pending",
  });
  const row = await db.query.adCampaigns.findFirst({ where: eq(adCampaigns.id, id) });
  return toView(row!);
}

export async function setCampaignStatus(id: string, status: CampaignStatus): Promise<void> {
  await getDb().update(adCampaigns).set({ status }).where(eq(adCampaigns.id, id));
}

export async function setCampaignDrivers(id: string, driverIds: string[]): Promise<void> {
  await getDb().update(adCampaigns).set({ allottedDriverIds: driverIds }).where(eq(adCampaigns.id, id));
}

export interface UpdateCampaignInput {
  name?: string;
  targetArea?: string;
  budget?: number;
  startDate?: string;
  endDate?: string;
  cpm?: number;
  cpc?: number;
  vehicleCount?: number;
  slotSeconds?: number;
  driverSharePercent?: number;
  allottedDriverIds?: string[];
}

export async function updateCampaign(id: string, updates: UpdateCampaignInput): Promise<void> {
  const db = getDb();
  const values: Partial<typeof adCampaigns.$inferInsert> = {};
  if (updates.name !== undefined) values.name = updates.name;
  if (updates.targetArea !== undefined) values.targetArea = updates.targetArea;
  if (updates.budget !== undefined) values.budget = String(updates.budget);
  if (updates.startDate !== undefined) values.startDate = updates.startDate;
  if (updates.endDate !== undefined) values.endDate = updates.endDate;
  if (updates.cpm !== undefined) values.cpm = String(updates.cpm);
  if (updates.cpc !== undefined) values.cpc = String(updates.cpc);
  if (updates.vehicleCount !== undefined) values.vehicleCount = updates.vehicleCount;
  if (updates.slotSeconds !== undefined) values.slotSeconds = updates.slotSeconds;
  if (updates.driverSharePercent !== undefined) values.driverSharePercent = updates.driverSharePercent;
  if (updates.allottedDriverIds !== undefined) values.allottedDriverIds = updates.allottedDriverIds;
  if (Object.keys(values).length === 0) return;
  await db.update(adCampaigns).set(values).where(eq(adCampaigns.id, id));
}

export interface AdOptedInDriver {
  id: string;
  name: string;
  vehicle: string;
}

// Real drivers who've opted into at least one ad type — replaces the old
// mockDrivers.filter(d => d.adOptedIn) roster.
export async function listAdOptedInDrivers(): Promise<AdOptedInDriver[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(driverProfiles)
    .where(sql`(${driverProfiles.adOptInAppAds} = true or ${driverProfiles.adOptInVehicleWrap} = true)`);

  const result: AdOptedInDriver[] = [];
  for (const profile of rows) {
    const user = await db.query.users.findFirst({ where: eq(users.id, profile.userId) });
    result.push({
      id: String(profile.userId),
      name: user?.name ?? "Driver",
      vehicle: `${profile.vehicleModel} · ${profile.vehicleNumber}`,
    });
  }
  return result;
}
