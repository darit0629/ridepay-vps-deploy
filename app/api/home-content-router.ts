import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getHomeContent, updateHomeContent } from "./queries/homeContent";

export type {
  HomeContent, PromoSlide, PromoSlideIcon, OfferTeaser,
  NearbyServiceItem, NearbyServiceIcon, QuickTile, QuickTileId, RideTypeConfig, RideTypeId,
} from "./queries/homeContent";

const promoSlideSchema = z.object({
  id: z.string(),
  title: z.string().trim().min(1).max(60),
  subtitle: z.string().trim().max(120),
  cta: z.string().trim().max(30),
  icon: z.enum(["Crown", "GraduationCap", "Package", "Users", "Sparkles", "Megaphone", "Gift", "Car"]),
  colorFrom: z.string(),
  colorTo: z.string(),
  destination: z.string(),
  enabled: z.boolean(),
});
const offerTeaserSchema = z.object({
  id: z.string(),
  title: z.string().trim().min(1).max(60),
  subtitle: z.string().trim().max(120),
  color: z.string(),
  bg: z.string(),
  enabled: z.boolean(),
});
const nearbyServiceSchema = z.object({
  id: z.string(),
  label: z.string().trim().min(1).max(40),
  icon: z.enum(["Cross", "Shield", "ParkingCircle", "BatteryCharging", "MapPin", "Star"]),
  enabled: z.boolean(),
});
const quickTileSchema = z.object({
  id: z.enum(["schoolPass", "sendParcel", "referEarn", "support"]),
  label: z.string().trim().min(1).max(40),
  enabled: z.boolean(),
});
const rideTypeSchema = z.object({
  id: z.enum(["share", "reserve", "auto", "women", "school", "corporate", "schedule"]),
  label: z.string().trim().min(1).max(40),
  enabled: z.boolean(),
});

export const homeContentRouter = createRouter({
  get: publicQuery.query(() => getHomeContent()),
  update: publicQuery
    .input(
      z.object({
        promoSlides: z.array(promoSlideSchema).optional(),
        offerTeasers: z.array(offerTeaserSchema).optional(),
        nearbyServices: z.array(nearbyServiceSchema).optional(),
        quickTiles: z.array(quickTileSchema).optional(),
        rideTypes: z.array(rideTypeSchema).optional(),
      })
    )
    .mutation(({ input }) => updateHomeContent(input)),
});
