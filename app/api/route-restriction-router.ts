import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createRouter, adminQuery, authedQuery } from "./middleware";
import { routeRestrictionReasonEnum, routeRestrictionSeverityEnum } from "@db/schema";
import {
  createRestriction,
  updateRestriction,
  unblockRestriction,
  listRestrictions,
  getRestrictionById,
  listRestrictionEvents,
  previewAffectedRides,
  listAffectedRides,
  getActiveRestrictionGeometries,
} from "./queries/routeRestrictions";
import { computeRestrictionAwareRoute, fetchGoogleDirections } from "./lib/googleDirectionsServer";
import { boundingBox, padBoundingBox, boxesOverlap } from "./lib/routeGeometry";

const latLngSchema = z.object({ lat: z.number(), lng: z.number() });

const segmentSchema = z.object({
  roadName: z.string().trim().min(1).max(120),
  geometry: z.array(latLngSchema).min(2),
});

const restrictionTypeSchema = z.enum(["road", "area"]);

const createInputSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    reason: z.enum(routeRestrictionReasonEnum),
    reasonNote: z.string().max(300).optional(),
    severity: z.enum(routeRestrictionSeverityEnum),
    restrictionType: restrictionTypeSchema,
    segments: z.array(segmentSchema).optional(),
    areaGeometry: z.array(latLngSchema).optional(),
    startTime: z.coerce.date(),
    endTime: z.coerce.date().optional().nullable(),
    isIndefinite: z.boolean().default(false),
  })
  .refine((v) => v.restrictionType !== "road" || (v.segments && v.segments.length >= 1), {
    message: "At least one road segment is required for a road-type restriction.",
    path: ["segments"],
  })
  .refine((v) => v.restrictionType !== "area" || (v.areaGeometry && v.areaGeometry.length >= 3), {
    message: "An area restriction needs at least 3 polygon points.",
    path: ["areaGeometry"],
  });

const updateInputSchema = z.object({
  id: z.string(),
  name: z.string().trim().min(1).max(120).optional(),
  reason: z.enum(routeRestrictionReasonEnum).optional(),
  reasonNote: z.string().max(300).optional(),
  severity: z.enum(routeRestrictionSeverityEnum).optional(),
  segments: z.array(segmentSchema).optional(),
  areaGeometry: z.array(latLngSchema).optional(),
  startTime: z.coerce.date().optional(),
  endTime: z.coerce.date().optional().nullable(),
  isIndefinite: z.boolean().optional(),
});

export const routeRestrictionRouter = createRouter({
  create: adminQuery.input(createInputSchema).mutation(({ ctx, input }) => createRestriction(input, ctx.user.id)),

  update: adminQuery.input(updateInputSchema).mutation(({ ctx, input }) => {
    const { id, ...patch } = input;
    return updateRestriction(id, patch, ctx.user.id);
  }),

  unblock: adminQuery
    .input(z.object({ id: z.string(), reason: z.string().max(300).optional() }))
    .mutation(({ ctx, input }) => unblockRestriction(input.id, ctx.user.id, input.reason)),

  list: adminQuery.query(() => listRestrictions()),

  getById: adminQuery.input(z.object({ id: z.string() })).query(async ({ input }) => {
    const restriction = await getRestrictionById(input.id);
    if (!restriction) throw new TRPCError({ code: "NOT_FOUND", message: "Restriction not found." });
    return restriction;
  }),

  events: adminQuery.input(z.object({ restrictionId: z.string() })).query(({ input }) => listRestrictionEvents(input.restrictionId)),

  // Live estimate while an admin is still filling out the "+ Block Route"
  // form — distinct from listAffectedRides, which is the definitive
  // post-creation drill-down built from actual logged events.
  previewAffectedRides: adminQuery
    .input(
      z.object({
        severity: z.enum(routeRestrictionSeverityEnum),
        restrictionType: restrictionTypeSchema,
        segments: z.array(segmentSchema).optional(),
        areaGeometry: z.array(latLngSchema).optional(),
      })
    )
    .query(({ input }) => previewAffectedRides(input)),

  listAffectedRides: adminQuery.input(z.object({ restrictionId: z.string() })).query(({ input }) => listAffectedRides(input.restrictionId)),

  // Lightweight geometry-only payload for the map Visual Layer — any
  // logged-in rider/driver, not just admins, since every real app caller is
  // already authenticated by the time it needs this.
  listActive: authedQuery.query(() => getActiveRestrictionGeometries()),

  // The authoritative Routing Layer both UserHome.tsx and the driver app
  // call before rendering a route — see src/hooks/useSafeRoute.ts.
  getSafeRoute: authedQuery
    .input(
      z.object({
        originLat: z.number(),
        originLng: z.number(),
        destLat: z.number(),
        destLng: z.number(),
      })
    )
    .query(async ({ input }) => {
      const origin = { lat: input.originLat, lng: input.originLng };
      const destination = { lat: input.destLat, lng: input.destLng };

      const active = await getActiveRestrictionGeometries();
      if (active.length === 0) {
        return { hasActiveRestrictions: false as const };
      }

      // Cheap bbox prefilter before spending a Directions call — if nothing
      // active is anywhere near the straight-line path, skip the check
      // entirely. Preserves today's zero-latency behavior for the
      // overwhelmingly common case where no restriction is nearby.
      const routeBox = padBoundingBox(boundingBox([origin, destination]), 3);
      const nearby = active.filter((r) => {
        const points = r.restrictionType === "road" ? (r.segments ?? []).flat() : (r.areaGeometry ?? []);
        if (points.length === 0) return false;
        return boxesOverlap(routeBox, boundingBox(points));
      });
      if (nearby.length === 0) {
        return { hasActiveRestrictions: false as const };
      }

      const result = await computeRestrictionAwareRoute(origin, destination, nearby);
      return { hasActiveRestrictions: true as const, ...result };
    }),

  // Plain distance/duration/polyline for a route with no restriction-
  // avoidance logic — used by the native app's map-based pickup/destination
  // picker to replace manual distance/duration entry with a real
  // Google-computed value. Same server key as getSafeRoute; degrades to
  // null (not an error) if the key is unset, matching that guard's pattern.
  getRoutePreview: authedQuery
    .input(
      z.object({
        originLat: z.number(),
        originLng: z.number(),
        destLat: z.number(),
        destLng: z.number(),
      })
    )
    .query(async ({ input }) => {
      const result = await fetchGoogleDirections(
        { lat: input.originLat, lng: input.originLng },
        { lat: input.destLat, lng: input.destLng },
        []
      );
      if (!result) return { ok: false as const };
      return { ok: true as const, distanceKm: result.distanceKm, durationMin: result.durationMin };
    }),
});
