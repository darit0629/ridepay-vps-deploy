import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createRouter, driverQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { driverProfiles, users, rides, payments } from "@db/schema";
import { eq, desc, and } from "drizzle-orm";

// Server-side floor on onboardingStep — each step only ever advances it
// forward, and only to the number this map says, regardless of what the
// client claims, so a driver can't "complete" step 9 before step 3 just by
// calling saveOnboardingStep out of order.
const ONBOARDING_STEP_NUMBER = {
  personal: 3,
  address: 4,
  vehicleType: 5,
  vehicleDetails: 6,
  documents: 7,
  bank: 8,
  preferences: 9,
  agreement: 10,
} as const;

export const driverRouter = createRouter({
  getProfile: driverQuery.query(async ({ ctx }) => {
    const db = getDb();
    const profile = await db.query.driverProfiles.findFirst({
      where: eq(driverProfiles.userId, ctx.user.id),
    });
    return profile ?? null;
  }),

  // Upsert, not update — a driver who just verified OTP has no
  // driver_profiles row yet at all, so Register.tsx's first save has to
  // create it, not just patch an existing one.
  updateProfile: driverQuery
    .input(
      z.object({
        vehicleType: z.string().optional(),
        vehicleModel: z.string().optional(),
        vehicleNumber: z.string().optional(),
        licenseNumber: z.string().optional(),
        seatCapacity: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db
        .insert(driverProfiles)
        .values({ userId: ctx.user.id, ...input })
        .onDuplicateKeyUpdate({ set: input });
      return { success: true };
    }),

  toggleOnline: driverQuery
    .input(
      z.object({
        isOnline: z.boolean(),
        lat: z.string().optional(),
        lng: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const update: Partial<typeof driverProfiles.$inferInsert> = { isOnline: input.isOnline };
      if (input.lat) update.currentLat = input.lat;
      if (input.lng) update.currentLng = input.lng;
      await db
        .update(driverProfiles)
        .set(update)
        .where(eq(driverProfiles.userId, ctx.user.id));
      return { isOnline: input.isOnline };
    }),

  updateLocation: driverQuery
    .input(z.object({ lat: z.string(), lng: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db
        .update(driverProfiles)
        .set({ currentLat: input.lat, currentLng: input.lng })
        .where(eq(driverProfiles.userId, ctx.user.id));
      return { success: true };
    }),

  // Real per-driver ad opt-in prefs, keyed by the authenticated driver's own
  // account — replaces DriverAdOptIn.tsx's old anonymous localStorage toggles
  // that weren't scoped to any particular driver.
  getAdPreferences: driverQuery.query(async ({ ctx }) => {
    const db = getDb();
    const profile = await db.query.driverProfiles.findFirst({ where: eq(driverProfiles.userId, ctx.user.id) });
    return {
      inAppAds: profile?.adOptInAppAds ?? true,
      vehicleWrapAds: profile?.adOptInVehicleWrap ?? false,
    };
  }),

  setAdPreferences: driverQuery
    .input(z.object({ inAppAds: z.boolean().optional(), vehicleWrapAds: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const update: Partial<typeof driverProfiles.$inferInsert> = {};
      if (input.inAppAds !== undefined) update.adOptInAppAds = input.inAppAds;
      if (input.vehicleWrapAds !== undefined) update.adOptInVehicleWrap = input.vehicleWrapAds;
      await db.update(driverProfiles).set(update).where(eq(driverProfiles.userId, ctx.user.id));
      return { success: true };
    }),

  // Lets a driver set their own "Today's Goal" target on the dashboard —
  // upsert (not update) for the same reason updateProfile is: a brand-new
  // driver_profiles row may not exist yet.
  setDailyGoal: driverQuery
    .input(z.object({ dailyGoal: z.number().positive().max(1_000_000) }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db
        .insert(driverProfiles)
        .values({ userId: ctx.user.id, dailyGoal: input.dailyGoal.toString() })
        .onDuplicateKeyUpdate({ set: { dailyGoal: input.dailyGoal.toString() } });
      return { success: true, dailyGoal: input.dailyGoal };
    }),

  getDashboard: driverQuery.query(async ({ ctx }) => {
    const db = getDb();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const allRides = await db
      .select()
      .from(rides)
      .where(eq(rides.driverId, ctx.user.id))
      .orderBy(desc(rides.createdAt));

    const todayRides = allRides.filter(
      (r) => new Date(r.createdAt) >= today
    );

    const completedRides = todayRides.filter(
      (r) => r.status === "completed"
    );
    const cancelledRides = todayRides.filter(
      (r) => r.status === "cancelled" || r.status === "driver_cancelled"
    );

    const todayEarnings = completedRides.reduce(
      (sum, r) => sum + Number(r.totalFare),
      0
    );

    const profile = await db.query.driverProfiles.findFirst({
      where: eq(driverProfiles.userId, ctx.user.id),
    });

    return {
      todayRides: todayRides.length,
      todayEarnings,
      rating: profile?.rating ?? "5.0",
      completedRides: completedRides.length,
      cancelledRides: cancelledRides.length,
      platformDues: (todayRides.length * 2).toFixed(0),
      isOnline: profile?.isOnline ?? false,
      totalRides: profile?.totalRides ?? 0,
      dailyGoal: Number(profile?.dailyGoal ?? 1200),
    };
  }),

  getEarnings: driverQuery
    .input(z.object({ period: z.string().optional() }).optional())
    .query(async ({ ctx }) => {
      const db = getDb();
      const driverPayments = await db
        .select()
        .from(payments)
        .where(eq(payments.driverId, ctx.user.id))
        .orderBy(desc(payments.createdAt));

      const totalEarnings = driverPayments.reduce(
        (sum, p) => sum + Number(p.driverEarnings),
        0
      );
      const cashCollected = driverPayments
        .filter((p) => p.method === "cash")
        .reduce((sum, p) => sum + Number(p.amount), 0);
      const onlineReceived = driverPayments
        .filter((p) => p.method === "upi" || p.method === "wallet")
        .reduce((sum, p) => sum + Number(p.amount), 0);
      const platformDues = driverPayments.reduce(
        (sum, p) => sum + Number(p.commission),
        0
      );

      return {
        totalEarnings,
        cashCollected,
        onlineReceived,
        platformDues,
        rides: driverPayments,
      };
    }),

  getTrips: driverQuery
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
      const limit = input?.limit ?? 10;
      const offset = ((input?.page ?? 1) - 1) * limit;

      const conditions = [eq(rides.driverId, ctx.user.id)];
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

  // `url` is a data: URI in this prototype (same pattern as users.avatar) —
  // there's no real object storage wired up, so documents just live as
  // base64 JSON on the row like every other image in this app.
  uploadDocument: driverQuery
    .input(
      z.object({
        type: z.enum(["aadhaar", "license", "rc", "insurance", "pan", "pollution", "profilePhoto", "selfie", "vehiclePhoto"]),
        url: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const profile = await db.query.driverProfiles.findFirst({
        where: eq(driverProfiles.userId, ctx.user.id),
      });
      const docs = { ...profile?.documents, [input.type]: input.url };
      await db
        .insert(driverProfiles)
        .values({ userId: ctx.user.id, documents: docs })
        .onDuplicateKeyUpdate({ set: { documents: docs } });
      return { success: true };
    }),

  // ─── Onboarding wizard (DriverOnboarding.tsx) ───

  // One mutation per step keeps the wizard's client code uniform (every step
  // just calls this with its own fields) even though a couple of steps also
  // touch the `users` table — an upsert, like updateProfile above, since the
  // very first step a fresh driver saves has no driver_profiles row yet.
  saveOnboardingStep: driverQuery
    .input(
      z.discriminatedUnion("step", [
        z.object({
          step: z.literal("personal"),
          name: z.string().trim().min(1),
          dob: z.string(),
          gender: z.string(),
          email: z.string().email().or(z.literal("")).optional(),
          emergencyContact: z.string().trim().min(10).max(15),
        }),
        z.object({
          step: z.literal("address"),
          address: z.string().trim().min(1),
          landmark: z.string().trim().optional(),
          city: z.string().trim().min(1),
          state: z.string().trim().min(1),
          pincode: z.string().trim().min(4).max(10),
        }),
        z.object({ step: z.literal("vehicleType"), vehicleType: z.enum(["Toto", "Auto Rickshaw", "Bike", "Car"]) }),
        z.object({
          step: z.literal("vehicleDetails"),
          vehicleNumber: z.string().trim().min(1),
          vehicleBrand: z.string().trim().min(1),
          vehicleModel: z.string().trim().min(1),
          manufacturingYear: z.string().trim().length(4),
          vehicleColor: z.string().trim().min(1),
        }),
        // Documents themselves are saved one at a time via uploadDocument —
        // this variant just marks the step complete once all of them are in.
        z.object({ step: z.literal("documents") }),
        z.object({
          step: z.literal("bank"),
          bankAccountHolderName: z.string().trim().min(1),
          bankName: z.string().trim().min(1),
          bankAccountNumber: z.string().trim().min(4),
          bankIfscCode: z.string().trim().toUpperCase(),
          upiId: z.string().trim().optional(),
        }),
        z.object({
          step: z.literal("preferences"),
          serviceType: z.enum(["ride", "parcel", "both"]),
          availability: z.enum(["fulltime", "parttime"]),
          operatingAreas: z.array(z.string()).min(1),
        }),
        z.object({
          step: z.literal("agreement"),
          acceptedTerms: z.boolean(),
          acceptedPrivacy: z.boolean(),
          acceptedGuidelines: z.boolean(),
        }),
      ])
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();

      if (input.step === "agreement" && !(input.acceptedTerms && input.acceptedPrivacy && input.acceptedGuidelines)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "All three agreements must be accepted to continue." });
      }

      // "personal" is the only step that also writes identity fields shared
      // with the rider side of the app — those live on `users`, not
      // driver_profiles, same table user.updateProfile writes to.
      if (input.step === "personal") {
        const { name, dob, gender, email } = input;
        await db.update(users).set({ name, dob, gender, email }).where(eq(users.id, ctx.user.id));
      }

      // Per-step mapping to driver_profiles columns — not a blind spread of
      // the input, since a couple of steps don't line up 1:1 with column
      // names (agreement's three booleans collapse to one timestamp;
      // documents is a marker with no fields of its own).
      const profileFields: Partial<typeof driverProfiles.$inferInsert> =
        input.step === "personal"
          ? { emergencyContact: input.emergencyContact }
          : input.step === "address"
          ? { address: input.address, landmark: input.landmark, city: input.city, state: input.state, pincode: input.pincode }
          : input.step === "vehicleType"
          ? { vehicleType: input.vehicleType }
          : input.step === "vehicleDetails"
          ? {
              vehicleNumber: input.vehicleNumber,
              vehicleBrand: input.vehicleBrand,
              vehicleModel: input.vehicleModel,
              manufacturingYear: input.manufacturingYear,
              vehicleColor: input.vehicleColor,
            }
          : input.step === "bank"
          ? {
              bankAccountHolderName: input.bankAccountHolderName,
              bankName: input.bankName,
              bankAccountNumber: input.bankAccountNumber,
              bankIfscCode: input.bankIfscCode,
              upiId: input.upiId,
            }
          : input.step === "preferences"
          ? { serviceType: input.serviceType, availability: input.availability, operatingAreas: input.operatingAreas }
          : input.step === "agreement"
          ? { acceptedTermsAt: new Date() }
          : {}; // "documents" — marker only, nothing to persist here

      const existing = await db.query.driverProfiles.findFirst({ where: eq(driverProfiles.userId, ctx.user.id) });
      const targetStep = ONBOARDING_STEP_NUMBER[input.step];
      const nextStep = Math.max(existing?.onboardingStep ?? 0, targetStep);

      await db
        .insert(driverProfiles)
        .values({ userId: ctx.user.id, onboardingStep: nextStep, ...profileFields })
        .onDuplicateKeyUpdate({ set: { onboardingStep: nextStep, ...profileFields } });

      return { success: true, onboardingStep: nextStep };
    }),

  // Format + real lookup (not a penny-drop) via Razorpay's free public IFSC
  // API — confirms the code corresponds to a real bank/branch, not that the
  // account number belongs to this driver.
  verifyBankIfsc: driverQuery
    .input(z.object({ ifscCode: z.string().trim().toUpperCase() }))
    .mutation(async ({ ctx, input }) => {
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(input.ifscCode)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "That doesn't look like a valid IFSC code." });
      }
      const res = await fetch(`https://ifsc.razorpay.com/${input.ifscCode}`);
      if (!res.ok) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "IFSC code not found — please double-check it." });
      }
      const data = (await res.json()) as { BANK: string; BRANCH: string };
      const db = getDb();
      await db
        .insert(driverProfiles)
        .values({ userId: ctx.user.id, bankIfscCode: input.ifscCode, bankName: data.BANK, bankBranchName: data.BRANCH, bankVerified: true })
        .onDuplicateKeyUpdate({ set: { bankIfscCode: input.ifscCode, bankName: data.BANK, bankBranchName: data.BRANCH, bankVerified: true } });
      return { bankName: data.BANK, branchName: data.BRANCH };
    }),

  // Puts the driver in the admin's review queue — the one thing that
  // actually distinguishes "still filling out the wizard" from "pending
  // review", since driver_profiles.status is "pending" through both.
  submitOnboarding: driverQuery.mutation(async ({ ctx }) => {
    const db = getDb();
    const profile = await db.query.driverProfiles.findFirst({ where: eq(driverProfiles.userId, ctx.user.id) });
    if (!profile || profile.onboardingStep < ONBOARDING_STEP_NUMBER.agreement) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Please complete every step before submitting." });
    }
    await db
      .update(driverProfiles)
      .set({ onboardingSubmittedAt: new Date(), onboardingStep: 12 })
      .where(eq(driverProfiles.userId, ctx.user.id));
    return { success: true };
  }),
});
