import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { listZones, createZone, updateZone, removeZone, matchingZones, seedZonesIfEmpty, type ZoneInput } from "./queries/zones";

export type { PricingZone, ZoneRuleType, ZoneMatchSide } from "./queries/zones";
export { matchingZones } from "./queries/zones";

void seedZonesIfEmpty();

const ruleTypeSchema = z.enum(["flat", "percent"]);
const matchSideSchema = z.enum(["pickup", "drop", "either"]);

export const zoneRouter = createRouter({
  list: publicQuery.query(() => listZones()),

  create: publicQuery
    .input(
      z.object({
        name: z.string().trim().min(1).max(60),
        keywords: z.array(z.string().trim().min(1)).min(1),
        matchSide: matchSideSchema,
        ruleType: ruleTypeSchema,
        value: z.number(),
      })
    )
    .mutation(({ input }) => createZone(input as ZoneInput)),

  update: publicQuery
    .input(
      z.object({
        id: z.string(),
        updates: z.object({
          name: z.string().trim().min(1).max(60).optional(),
          keywords: z.array(z.string().trim().min(1)).min(1).optional(),
          matchSide: matchSideSchema.optional(),
          ruleType: ruleTypeSchema.optional(),
          value: z.number().optional(),
          enabled: z.boolean().optional(),
        }),
      })
    )
    .mutation(({ input }) => updateZone(input.id, input.updates)),

  remove: publicQuery.input(z.object({ id: z.string() })).mutation(async ({ input }) => {
    await removeZone(input.id);
    return { ok: true };
  }),

  // Lets the client preview which zones a pickup/drop pair would trigger,
  // without needing a full fare calculation.
  previewMatch: publicQuery
    .input(z.object({ pickupText: z.string().default(""), destinationText: z.string().default("") }))
    .query(({ input }) => matchingZones(input.pickupText, input.destinationText)),
});
