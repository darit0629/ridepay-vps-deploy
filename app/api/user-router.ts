import { z } from "zod";
import * as cookie from "cookie";
import { Session } from "@contracts/constants";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { getSessionCookieOptions } from "./lib/cookies";
import { users, savedPlaces, rides, driverProfiles } from "@db/schema";
import { eq, desc, and } from "drizzle-orm";

export const userRouter = createRouter({
  getProfile: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const user = await db.query.users.findFirst({
      where: eq(users.id, ctx.user.id),
    });
    return user ?? null;
  }),

  updateProfile: authedQuery
    .input(
      z.object({
        name: z.string().optional(),
        email: z.string().email().or(z.literal("")).optional(),
        avatar: z.string().optional(),
        phone: z.string().optional(),
        dob: z.string().optional(),
        gender: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db.update(users).set(input).where(eq(users.id, ctx.user.id));
      return { success: true };
    }),

  getRideHistory: authedQuery
    .input(
      z
        .object({
          status: z.string().optional(),
          page: z.number().default(1),
          limit: z.number().default(10),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const page = input?.page ?? 1;
      const limit = input?.limit ?? 10;
      const offset = (page - 1) * limit;

      const conditions = [eq(rides.userId, ctx.user.id)];
      if (input?.status) {
        conditions.push(eq(rides.status, input.status as (typeof rides.status.enumValues)[number]));
      }

      const items = await db
        .select()
        .from(rides)
        .where(and(...conditions))
        .orderBy(desc(rides.createdAt))
        .limit(limit)
        .offset(offset);

      const allItems = await db
        .select()
        .from(rides)
        .where(and(...conditions));

      return { items, total: allItems.length };
    }),

  getSavedPlaces: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    return db.select().from(savedPlaces).where(eq(savedPlaces.userId, ctx.user.id));
  }),

  savePlace: authedQuery
    .input(
      z.object({
        name: z.string(),
        address: z.string(),
        lat: z.string(),
        lng: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const [place] = await db
        .insert(savedPlaces)
        .values({ ...input, userId: ctx.user.id })
        .$returningId();
      return { id: place.id, ...input };
    }),

  deletePlace: authedQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(savedPlaces).where(eq(savedPlaces.id, input.id));
      return { success: true };
    }),

  // Google Play Account Deletion: permanently deactivates the account and
  // scrubs personal info. unionId is mutated (not just the phone column)
  // so the OTP-verified phone number is freed for a genuinely fresh
  // registration afterwards, rather than silently reactivating this row.
  //
  // Financial/ledger tables (wallets, commission_records, cancellation_records,
  // referral_records, school_subscriptions, parcel_bookings, complaints) are
  // keyed by the rider/driver's display name, not a user id — that's this
  // app's existing identity convention everywhere, not something this
  // mutation can safely rewrite without corrupting historical accounting
  // records. Those rows are intentionally left as-is, retained for the
  // legal/tax/fraud-prevention reasons disclosed in the Data Deletion
  // Policy — the account itself becomes permanently unusable (unionId is
  // scrambled, session is cleared, login is impossible), which is what
  // actually matters for the deletion guarantee.
  deleteAccount: authedQuery.mutation(async ({ ctx }) => {
    const db = getDb();
    const scrambledUnionId = `deleted:${Date.now()}:${ctx.user.unionId}`;

    await db
      .update(users)
      .set({
        unionId: scrambledUnionId,
        name: "Deleted User",
        phone: null,
        email: null,
        avatar: null,
        dob: null,
        gender: null,
        isActive: false,
      })
      .where(eq(users.id, ctx.user.id));

    if (ctx.user.role === "driver") {
      await db
        .update(driverProfiles)
        .set({
          vehicleNumber: "",
          licenseNumber: "",
          documents: null,
          isOnline: false,
        })
        .where(eq(driverProfiles.userId, ctx.user.id));
    }

    const cookieOpts = getSessionCookieOptions(ctx.req.headers);
    ctx.resHeaders.append(
      "set-cookie",
      cookie.serialize(Session.cookieName, "", {
        httpOnly: cookieOpts.httpOnly,
        path: cookieOpts.path,
        sameSite: cookieOpts.sameSite?.toLowerCase() as "lax" | "none",
        secure: cookieOpts.secure,
        maxAge: 0,
      })
    );

    return { success: true };
  }),
});
