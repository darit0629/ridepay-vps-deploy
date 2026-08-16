import { z } from "zod";
import { createRouter, authedQuery, adminQuery } from "./middleware";
import { raiseSOS, listOpenSOS, resolveSOS, listMySOS } from "./queries/sos";

export const sosRouter = createRouter({
  // Persists a real, queryable alert — replaces the tel:-link-only "SOS"
  // buttons scattered across the app, none of which recorded that an alert
  // happened. subscriptionId is optional so this works for the general
  // Safety Center as well as school-context alerts.
  raise: authedQuery
    .input(
      z.object({
        role: z.enum(["user", "driver"]),
        subscriptionId: z.string().optional(),
        lat: z.number().optional(),
        lng: z.number().optional(),
        note: z.string().trim().max(300).optional(),
      })
    )
    .mutation(({ ctx, input }) => raiseSOS({ userId: ctx.user.id, ...input })),

  listMine: authedQuery.query(({ ctx }) => listMySOS(ctx.user.id)),

  listOpen: adminQuery.query(() => listOpenSOS()),

  resolve: adminQuery.input(z.object({ id: z.string() })).mutation(({ input }) => resolveSOS(input.id)),
});
