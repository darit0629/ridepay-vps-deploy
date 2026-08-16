// Data types and content now live server-side (api/home-content-router.ts,
// home_content_settings table) — re-exported here so existing imports
// (`@/lib/mockHomeContent`) keep working unchanged. This file now only owns
// the admin UI's picker option lists, which have no reason to be server-side.
export type {
  PromoSlide, PromoSlideIcon, OfferTeaser, NearbyServiceItem, NearbyServiceIcon, QuickTile, QuickTileId, RideTypeConfig, RideTypeId,
} from "../../api/home-content-router";
import type { PromoSlideIcon, NearbyServiceIcon } from "../../api/home-content-router";

export const DESTINATION_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "No action (display only)" },
  { value: "/user/subscription", label: "Flying Plus (Subscription)" },
  { value: "/user/student-pass", label: "School Pass" },
  { value: "/user/refer", label: "Refer & Earn" },
  { value: "/user/offers", label: "Offers" },
  { value: "/user/wallet", label: "Wallet" },
  { value: "/user/safety", label: "Safety Center" },
  { value: "#parcel", label: "Switch to Parcel Mode" },
];

export const PROMO_ICON_OPTIONS: PromoSlideIcon[] = ["Crown", "GraduationCap", "Package", "Users", "Sparkles", "Megaphone", "Gift", "Car"];
export const NEARBY_ICON_OPTIONS: NearbyServiceIcon[] = ["Cross", "Shield", "ParkingCircle", "BatteryCharging", "MapPin", "Star"];
