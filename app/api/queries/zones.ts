import { eq, sql } from "drizzle-orm";
import { getDb } from "./connection";
import { pricingZones, type PricingZoneRow } from "@db/schema";

export type ZoneRuleType = "flat" | "percent";
export type ZoneMatchSide = "pickup" | "drop" | "either";

export interface PricingZone {
  id: string;
  name: string;
  enabled: boolean;
  keywords: string[];
  matchSide: ZoneMatchSide;
  ruleType: ZoneRuleType;
  value: number;
}

function toView(row: PricingZoneRow): PricingZone {
  return {
    id: row.id,
    name: row.name,
    enabled: row.enabled,
    keywords: row.keywords,
    matchSide: row.matchSide,
    ruleType: row.ruleType,
    value: Number(row.value),
  };
}

const DEFAULT_ZONES: PricingZone[] = [
  { id: "zone-airport", name: "Airport Zone", enabled: true, keywords: ["airport"], matchSide: "either", ruleType: "flat", value: 40 },
  { id: "zone-station", name: "Railway Station Zone", enabled: true, keywords: ["station", "junction"], matchSide: "either", ruleType: "flat", value: 15 },
  { id: "zone-hospital", name: "Hospital Priority Zone", enabled: true, keywords: ["hospital", "medical"], matchSide: "either", ruleType: "percent", value: -10 },
  { id: "zone-mall", name: "Mall/Market Surge Zone", enabled: false, keywords: ["mall", "market", "bazaar"], matchSide: "either", ruleType: "percent", value: 10 },
];

export async function seedZonesIfEmpty(): Promise<void> {
  const db = getDb();
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(pricingZones);
  if (Number(count) > 0) return;
  await db.insert(pricingZones).values(
    DEFAULT_ZONES.map((z) => ({ id: z.id, name: z.name, enabled: z.enabled, keywords: z.keywords, matchSide: z.matchSide, ruleType: z.ruleType, value: String(z.value) }))
  );
}

export async function listZones(): Promise<PricingZone[]> {
  const rows = await getDb().select().from(pricingZones);
  return rows.map(toView);
}

export interface ZoneInput {
  name: string;
  keywords: string[];
  matchSide: ZoneMatchSide;
  ruleType: ZoneRuleType;
  value: number;
}

export async function createZone(input: ZoneInput): Promise<PricingZone> {
  const id = `zone-${Date.now()}-${Math.round(Math.random() * 1000)}`;
  await getDb().insert(pricingZones).values({ id, name: input.name, enabled: true, keywords: input.keywords, matchSide: input.matchSide, ruleType: input.ruleType, value: String(input.value) });
  const row = await getDb().query.pricingZones.findFirst({ where: eq(pricingZones.id, id) });
  return toView(row!);
}

export async function updateZone(id: string, updates: Partial<ZoneInput & { enabled: boolean }>): Promise<PricingZone[]> {
  const values: Record<string, unknown> = {};
  if (updates.name !== undefined) values.name = updates.name;
  if (updates.keywords !== undefined) values.keywords = updates.keywords;
  if (updates.matchSide !== undefined) values.matchSide = updates.matchSide;
  if (updates.ruleType !== undefined) values.ruleType = updates.ruleType;
  if (updates.value !== undefined) values.value = String(updates.value);
  if (updates.enabled !== undefined) values.enabled = updates.enabled;
  if (Object.keys(values).length > 0) {
    await getDb().update(pricingZones).set(values).where(eq(pricingZones.id, id));
  }
  return listZones();
}

export async function removeZone(id: string): Promise<void> {
  await getDb().delete(pricingZones).where(eq(pricingZones.id, id));
}

function matches(zone: PricingZone, pickupText: string, destinationText: string): boolean {
  const pickup = pickupText.toLowerCase();
  const drop = destinationText.toLowerCase();
  return zone.keywords.some((kw) => {
    const needle = kw.trim().toLowerCase();
    if (!needle) return false;
    if (zone.matchSide === "pickup") return pickup.includes(needle);
    if (zone.matchSide === "drop") return drop.includes(needle);
    return pickup.includes(needle) || drop.includes(needle);
  });
}

// Called by fare-router.ts's calculateFare — returns every enabled zone
// whose keywords match this trip's pickup/drop text, so the caller can
// itemize each as its own labeled line item (a trip can cross multiple
// zones, e.g. pickup at the station and drop at the airport).
export async function matchingZones(pickupText: string, destinationText: string): Promise<PricingZone[]> {
  if (!pickupText && !destinationText) return [];
  const zones = await listZones();
  return zones.filter((z) => z.enabled && matches(z, pickupText, destinationText));
}
