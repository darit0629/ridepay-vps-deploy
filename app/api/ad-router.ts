import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import {
  listCampaigns,
  createCampaign,
  setCampaignStatus,
  setCampaignDrivers,
  updateCampaign,
  listAdOptedInDrivers,
  seedAdCampaignsIfEmpty,
} from "./queries/ads";

export type { AdType, CampaignStatus, AdCampaign, AdOptedInDriver } from "./queries/ads";

void seedAdCampaignsIfEmpty();

const adTypeSchema = z.enum(["In-App Banner", "Driver Screen", "Vehicle Wrap"]);
const statusSchema = z.enum(["pending", "active", "paused", "ended", "rejected"]);

export const adRouter = createRouter({
  // publicQuery, matching the rest of this app's admin/advertiser back-office
  // pages — none of them sit behind a real login gate.
  listCampaigns: publicQuery.query(() => listCampaigns()),

  createCampaign: publicQuery
    .input(
      z.object({
        advertiserName: z.string().trim().min(1).max(120),
        name: z.string().trim().min(1).max(120),
        adType: adTypeSchema,
        targetArea: z.string().trim().min(1).max(200),
        budget: z.number().nonnegative(),
        startDate: z.string().trim().min(1),
        endDate: z.string().trim().min(1),
        vehicleCount: z.number().int().nonnegative(),
        slotSeconds: z.number().int().nonnegative(),
        driverSharePercent: z.number().min(0).max(100),
        allottedDriverIds: z.array(z.string()).default([]),
        creativeColor: z.string().trim().min(1).max(10),
      })
    )
    .mutation(({ input }) => createCampaign(input)),

  setCampaignStatus: publicQuery
    .input(z.object({ id: z.string(), status: statusSchema }))
    .mutation(async ({ input }) => {
      await setCampaignStatus(input.id, input.status);
      return { success: true };
    }),

  setCampaignDrivers: publicQuery
    .input(z.object({ id: z.string(), driverIds: z.array(z.string()) }))
    .mutation(async ({ input }) => {
      await setCampaignDrivers(input.id, input.driverIds);
      return { success: true };
    }),

  updateCampaign: publicQuery
    .input(
      z.object({
        id: z.string(),
        updates: z.object({
          name: z.string().trim().min(1).max(120).optional(),
          targetArea: z.string().trim().min(1).max(200).optional(),
          budget: z.number().nonnegative().optional(),
          startDate: z.string().trim().min(1).optional(),
          endDate: z.string().trim().min(1).optional(),
          cpm: z.number().nonnegative().optional(),
          cpc: z.number().nonnegative().optional(),
          vehicleCount: z.number().int().nonnegative().optional(),
          slotSeconds: z.number().int().nonnegative().optional(),
          driverSharePercent: z.number().min(0).max(100).optional(),
          allottedDriverIds: z.array(z.string()).optional(),
        }),
      })
    )
    .mutation(async ({ input }) => {
      await updateCampaign(input.id, input.updates);
      return { success: true };
    }),

  listAdOptedInDrivers: publicQuery.query(() => listAdOptedInDrivers()),
});
