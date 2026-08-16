import { z } from "zod";
import { createRouter, publicQuery, adminQuery } from "./middleware";
import {
  listActiveRentalPackages,
  seedHourlyRentalPackagesIfEmpty,
  listAllRentalPackages,
  updateRentalPackage,
  createRentalPackage,
} from "./queries/hourlyRental";

void seedHourlyRentalPackagesIfEmpty();

const vehicleTypeSchema = z.enum(["e-riksha", "auto-rickshaw", "car", "bike"]);

export const rentalRouter = createRouter({
  listPackages: publicQuery.query(() => listActiveRentalPackages()),

  // ---- Admin CRUD (Phase 11) --------------------------------------------
  adminListPackages: adminQuery.query(() => listAllRentalPackages()),

  adminUpdatePackage: adminQuery
    .input(
      z.object({
        id: z.number(),
        basePrice: z.number().positive().optional(),
        includedKm: z.number().int().nonnegative().optional(),
        extraHourRate: z.number().positive().optional(),
        active: z.boolean().optional(),
      })
    )
    .mutation(({ input: { id, ...updates } }) => updateRentalPackage(id, updates)),

  adminCreatePackage: adminQuery
    .input(
      z.object({
        vehicleType: vehicleTypeSchema,
        hours: z.number().int().positive().max(24),
        basePrice: z.number().positive(),
        includedKm: z.number().int().nonnegative(),
        extraHourRate: z.number().positive(),
      })
    )
    .mutation(({ input }) => createRentalPackage(input)),
});
