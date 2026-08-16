import { eq } from "drizzle-orm";
import { getDb } from "./connection";
import { homeContentSettings } from "@db/schema";

export type PromoSlideIcon = "Crown" | "GraduationCap" | "Package" | "Users" | "Sparkles" | "Megaphone" | "Gift" | "Car";
export interface PromoSlide {
  id: string;
  title: string;
  subtitle: string;
  cta: string;
  icon: PromoSlideIcon;
  colorFrom: string;
  colorTo: string;
  /** A real app route, the "#parcel" sentinel (switches to Parcel mode), or "" for no action. */
  destination: string;
  enabled: boolean;
}

export interface OfferTeaser {
  id: string;
  title: string;
  subtitle: string;
  color: string;
  bg: string;
  enabled: boolean;
}

export type NearbyServiceIcon = "Cross" | "Shield" | "ParkingCircle" | "BatteryCharging" | "MapPin" | "Star";
export interface NearbyServiceItem {
  id: string;
  label: string;
  icon: NearbyServiceIcon;
  enabled: boolean;
}

export type QuickTileId = "schoolPass" | "sendParcel" | "referEarn" | "support";
export interface QuickTile {
  id: QuickTileId;
  label: string;
  enabled: boolean;
}

export type RideTypeId = "share" | "reserve" | "auto" | "women" | "school" | "corporate" | "schedule";
export interface RideTypeConfig {
  id: RideTypeId;
  label: string;
  enabled: boolean;
}

export interface HomeContent {
  promoSlides: PromoSlide[];
  offerTeasers: OfferTeaser[];
  nearbyServices: NearbyServiceItem[];
  quickTiles: QuickTile[];
  rideTypes: RideTypeConfig[];
}

// Seed values for the singleton row's first-ever creation — same content the
// rider Home screen showed when this was hardcoded client-side state.
const seedPromoSlides: PromoSlide[] = [
  { id: "plus", title: "Flying Plus", subtitle: "Priority pickups & zero cancellation fees", cta: "Upgrade", icon: "Crown", colorFrom: "#1A1A2E", colorTo: "#2D2D4A", destination: "/user/subscription", enabled: true },
  { id: "school", title: "School Safe Rides", subtitle: "Verified drivers for your child's daily commute", cta: "Get Pass", icon: "GraduationCap", colorFrom: "#0EA5E9", colorTo: "#0369A1", destination: "/user/student-pass", enabled: true },
  { id: "parcel", title: "Free First Delivery", subtitle: "Send your first parcel free this week", cta: "Send Parcel", icon: "Package", colorFrom: "#7C3AED", colorTo: "#5B21B6", destination: "#parcel", enabled: true },
  { id: "refer", title: "Refer & Earn ₹100", subtitle: "Invite friends, you both get ride credit", cta: "Invite", icon: "Users", colorFrom: "#138808", colorTo: "#0F6606", destination: "/user/refer", enabled: true },
  { id: "offer", title: "Flat ₹50 OFF", subtitle: "On rides above ₹150, today only", cta: "View Offers", icon: "Sparkles", colorFrom: "#FF6B00", colorTo: "#E65A00", destination: "/user/offers", enabled: true },
];
const seedOfferTeasers: OfferTeaser[] = [
  { id: "off1", title: "Flat ₹50 OFF", subtitle: "On rides above ₹150", bg: "#FFF5EB", color: "#FF6B00", enabled: true },
  { id: "off2", title: "20% Cashback", subtitle: "First 3 rides this week", bg: "#F3E8FF", color: "#7C3AED", enabled: true },
  { id: "off3", title: "Free Delivery", subtitle: "On your first parcel", bg: "#E0F2FE", color: "#0EA5E9", enabled: true },
];
const seedNearbyServices: NearbyServiceItem[] = [
  { id: "hospital", label: "Hospital", icon: "Cross", enabled: true },
  { id: "police", label: "Police", icon: "Shield", enabled: true },
  { id: "parking", label: "Parking", icon: "ParkingCircle", enabled: true },
  { id: "ev", label: "EV Charge", icon: "BatteryCharging", enabled: true },
];
const seedQuickTiles: QuickTile[] = [
  { id: "schoolPass", label: "School Pass", enabled: true },
  { id: "sendParcel", label: "Send Parcel", enabled: true },
  { id: "referEarn", label: "Refer & Earn", enabled: true },
  { id: "support", label: "Support", enabled: true },
];
const seedRideTypes: RideTypeConfig[] = [
  { id: "share", label: "Share Ride", enabled: true },
  { id: "reserve", label: "Reserve Ride", enabled: true },
  { id: "women", label: "Women Ride", enabled: true },
  { id: "school", label: "School Ride", enabled: true },
  { id: "corporate", label: "Corporate Ride", enabled: true },
  { id: "schedule", label: "Schedule Ride", enabled: true },
];

const SETTINGS_ROW_ID = 1;

function toHomeContent(row: typeof homeContentSettings.$inferSelect): HomeContent {
  return {
    promoSlides: row.promoSlides as PromoSlide[],
    offerTeasers: row.offerTeasers as OfferTeaser[],
    nearbyServices: row.nearbyServices as NearbyServiceItem[],
    quickTiles: row.quickTiles as QuickTile[],
    rideTypes: row.rideTypes as RideTypeConfig[],
  };
}

// Ensures the singleton config row exists (seeded from the same defaults the
// rider app used to hardcode), then returns it — same get-or-create pattern
// as financeSettings/commission config.
export async function getHomeContent(): Promise<HomeContent> {
  const db = getDb();
  await db
    .insert(homeContentSettings)
    .values({
      id: SETTINGS_ROW_ID,
      promoSlides: seedPromoSlides,
      offerTeasers: seedOfferTeasers,
      nearbyServices: seedNearbyServices,
      quickTiles: seedQuickTiles,
      rideTypes: seedRideTypes,
    })
    .onDuplicateKeyUpdate({ set: { id: SETTINGS_ROW_ID } });
  const row = await db.query.homeContentSettings.findFirst({ where: eq(homeContentSettings.id, SETTINGS_ROW_ID) });
  return toHomeContent(row!);
}

export async function updateHomeContent(patch: Partial<HomeContent>): Promise<HomeContent> {
  const db = getDb();
  await getHomeContent();
  await db.update(homeContentSettings).set(patch).where(eq(homeContentSettings.id, SETTINGS_ROW_ID));
  return getHomeContent();
}
