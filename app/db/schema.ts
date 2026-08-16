import {
  mysqlTable,
  mysqlEnum,
  serial,
  varchar,
  text,
  timestamp,
  boolean,
  decimal,
  int,
  json,
  bigint,
  date,
  uniqueIndex,
  longtext,
} from "drizzle-orm/mysql-core";

// ─── Users ───────────────────────────────────────────
export const users = mysqlTable("users", {
  id: serial("id").primaryKey(),
  unionId: varchar("unionId", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 100 }),
  phone: varchar("phone", { length: 15 }),
  email: varchar("email", { length: 255 }),
  avatar: text("avatar"),
  dob: date("dob", { mode: "string" }),
  gender: varchar("gender", { length: 30 }),
  role: mysqlEnum("role", ["user", "driver", "admin"]).default("user").notNull(),
  // Only ever set for real admin accounts, created directly (never via the
  // rider/driver phone+OTP signup flow) — see api/lib/password.ts and
  // auth-router.ts's adminLogin procedure. Null for every rider/driver row.
  passwordHash: varchar("passwordHash", { length: 255 }),
  isVerified: boolean("isVerified").default(false).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  // Which Flying Plus plan this rider is on — real persistence, replacing
  // UserSubscription.tsx's old local-only useState that reset to "free" on
  // every reload.
  subscriptionPlanId: varchar("subscriptionPlanId", { length: 40 }).default("free").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  lastSignInAt: timestamp("lastSignInAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Driver Profiles ─────────────────────────────────
export const driverProfiles = mysqlTable("driver_profiles", {
  id: serial("id").primaryKey(),
  userId: bigint("userId", { mode: "number", unsigned: true })
    .notNull()
    .references(() => users.id)
    .unique(),
  vehicleType: varchar("vehicleType", { length: 50 }).notNull().default("Auto Rickshaw"),
  vehicleModel: varchar("vehicleModel", { length: 100 }).notNull().default(""),
  vehicleNumber: varchar("vehicleNumber", { length: 20 }).notNull().default(""),
  licenseNumber: varchar("licenseNumber", { length: 30 }).notNull().default(""),
  seatCapacity: int("seatCapacity").notNull().default(4),
  isOnline: boolean("isOnline").default(false).notNull(),
  currentLat: decimal("currentLat", { precision: 10, scale: 8 }),
  currentLng: decimal("currentLng", { precision: 11, scale: 8 }),
  rating: decimal("rating", { precision: 2, scale: 1 }).default("5.0").notNull(),
  totalRides: int("totalRides").default(0).notNull(),
  documents: json("documents").$type<{
    aadhaar?: string;
    license?: string;
    rc?: string;
    insurance?: string;
    pan?: string;
    pollution?: string;
    profilePhoto?: string;
    selfie?: string;
    vehiclePhoto?: string;
  }>(),
  status: mysqlEnum("status", ["pending", "approved", "rejected", "blocked"])
    .default("pending")
    .notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  // Real per-driver ad opt-in prefs (replaces anonymous, non-account-scoped
  // localStorage toggles on DriverAdOptIn.tsx).
  adOptInAppAds: boolean("adOptInAppAds").default(true).notNull(),
  adOptInVehicleWrap: boolean("adOptInVehicleWrap").default(false).notNull(),
  // Driver-editable target shown as "Today's Goal" progress on the dashboard.
  dailyGoal: decimal("dailyGoal", { precision: 10, scale: 2 }).default("1200").notNull(),

  // ─── Onboarding wizard fields (DriverOnboarding.tsx) ───
  emergencyContact: varchar("emergencyContact", { length: 20 }),
  address: varchar("address", { length: 255 }),
  landmark: varchar("landmark", { length: 100 }),
  city: varchar("city", { length: 60 }),
  state: varchar("state", { length: 60 }),
  pincode: varchar("pincode", { length: 10 }),
  vehicleBrand: varchar("vehicleBrand", { length: 60 }),
  manufacturingYear: varchar("manufacturingYear", { length: 4 }),
  vehicleColor: varchar("vehicleColor", { length: 30 }),
  bankAccountHolderName: varchar("bankAccountHolderName", { length: 100 }),
  bankName: varchar("bankName", { length: 100 }),
  // A real production schema would encrypt this at rest — out of scope for
  // this prototype, same as every other plaintext PII column here.
  bankAccountNumber: varchar("bankAccountNumber", { length: 30 }),
  bankIfscCode: varchar("bankIfscCode", { length: 11 }),
  bankBranchName: varchar("bankBranchName", { length: 150 }),
  upiId: varchar("upiId", { length: 60 }),
  bankVerified: boolean("bankVerified").default(false).notNull(),
  serviceType: mysqlEnum("serviceType", ["ride", "parcel", "both"]),
  availability: mysqlEnum("availability", ["fulltime", "parttime"]),
  operatingAreas: json("operatingAreas").$type<string[]>(),
  acceptedTermsAt: timestamp("acceptedTermsAt"),
  // Which step the wizard should resume at — advanced by saveOnboardingStep,
  // not by the client, so a driver can't skip ahead by replaying requests.
  onboardingStep: int("onboardingStep").default(0).notNull(),
  // Null while the wizard is still in progress; set once submitOnboarding
  // runs, which is what actually puts the driver in the admin's review queue
  // (status alone can't distinguish "mid-wizard" from "awaiting review" —
  // both are "pending").
  onboardingSubmittedAt: timestamp("onboardingSubmittedAt"),
  // rejectDriver has always accepted a `reason` param but never stored it —
  // this is that missing column.
  rejectionReason: varchar("rejectionReason", { length: 300 }),
});

export type DriverProfile = typeof driverProfiles.$inferSelect;

// ─── Rides ───────────────────────────────────────────
export const rides = mysqlTable("rides", {
  id: serial("id").primaryKey(),
  userId: bigint("userId", { mode: "number", unsigned: true })
    .notNull()
    .references(() => users.id),
  driverId: bigint("driverId", { mode: "number", unsigned: true })
    .references(() => users.id),
  pickupLat: decimal("pickupLat", { precision: 10, scale: 8 }).notNull(),
  pickupLng: decimal("pickupLng", { precision: 11, scale: 8 }).notNull(),
  pickupAddress: varchar("pickupAddress", { length: 255 }).notNull(),
  dropLat: decimal("dropLat", { precision: 10, scale: 8 }).notNull(),
  dropLng: decimal("dropLng", { precision: 11, scale: 8 }).notNull(),
  dropAddress: varchar("dropAddress", { length: 255 }).notNull(),
  rideType: mysqlEnum("rideType", ["reserve", "share"]).notNull(),
  // The real vehicle-type/segment pair booked (e.g. "e-riksha-share" vs
  // "e-riksha-reserve" vs "auto-rickshaw" vs "car"...) — rideType above
  // predates this and can't reconstruct it (auto/car/bike/women/school all
  // collapse to "reserve"). Nullable since rides booked before this column
  // existed have no value; per-vehicle-type commission (commission-router.ts)
  // falls back to a default when null. Uses fareVehicleTypeEnum, defined
  // further down this file with the Fare Configuration tables.
  fareVehicleType: varchar("fareVehicleType", { length: 30 }),
  // Raw booking inputs (fareVehicleType above is a derived 10-value ID that
  // can't be unambiguously reversed back into these) — needed so a ride's
  // fare can be legitimately recalculated later (e.g. Wait & Return's final
  // fare, computed only once the real wait time and return leg are known).
  // Nullable: rides booked before this column existed have no value.
  vehicleType: mysqlEnum("vehicleType", [
    "e-riksha", "auto-rickshaw", "car", "bike", "e-riksha-woman", "e-riksha-parcel", "bike-parcel", "e-riksha-school",
  ]),
  segment: mysqlEnum("segment", ["share", "reserve", "auto", "parcel", "school", "women"]),
  seats: int("seats").default(1).notNull(),
  distance: decimal("distance", { precision: 5, scale: 2 }).notNull(),
  estimatedTime: int("estimatedTime").notNull(),
  baseFare: decimal("baseFare", { precision: 8, scale: 2 }).notNull(),
  totalFare: decimal("totalFare", { precision: 8, scale: 2 }).notNull(),
  discount: decimal("discount", { precision: 8, scale: 2 }).default("0").notNull(),
  couponCode: varchar("couponCode", { length: 50 }),
  otp: varchar("otp", { length: 4 }).notNull(),
  paymentMethod: mysqlEnum("paymentMethod", ["cash", "upi", "wallet"]),
  // Wait & Return (Services hub): the SAME driver waits at the destination
  // then drives the rider back, billed as one ride with a real per-minute
  // waiting charge — as opposed to Round Trip (roundTripGroupId below),
  // where the return leg is a separately-scheduled, not-necessarily-same-
  // driver booking.
  isWaitAndReturn: boolean("isWaitAndReturn").default(false).notNull(),
  waitStartedAt: timestamp("waitStartedAt"),
  returnStartedAt: timestamp("returnStartedAt"),
  actualWaitingMin: int("actualWaitingMin"),
  // Hourly Rental (Services hub): no fixed destination — dropLat/Lng/Address
  // above are set to the pickup point / a placeholder label at booking time.
  // Package-priced (rentalPackagePrice), not distance-priced; rentalHours/
  // rentalExtraHourRate are locked in from hourlyRentalPackages at booking
  // time so a later admin price change can't retroactively affect an
  // in-progress rental.
  isHourlyRental: boolean("isHourlyRental").default(false).notNull(),
  rentalHours: int("rentalHours"),
  rentalPackagePrice: decimal("rentalPackagePrice", { precision: 8, scale: 2 }),
  rentalExtraHourRate: decimal("rentalExtraHourRate", { precision: 8, scale: 2 }),
  rentalStartedAt: timestamp("rentalStartedAt"),
  status: mysqlEnum("status", [
    "searching",
    "accepted",
    "pickup",
    "ongoing",
    "waiting",
    "completed",
    "cancelled",
    "driver_cancelled",
  ])
    .default("searching")
    .notNull(),
  rating: int("rating"),
  review: varchar("review", { length: 500 }),
  // Ties this ride's outbound leg to its return-trip scheduledRides entry
  // (see Round Trip on the Services hub) — client-generated per booking, not
  // a foreign key, since the two legs live in different tables and the
  // return leg may not exist yet (or ever, if never confirmed) when this
  // row is created.
  roundTripGroupId: varchar("roundTripGroupId", { length: 40 }),
  // Multi Stop (Services hub): intermediate waypoints between pickup and the
  // real final destination (dropLat/Lng/Address above) — currentStopIndex
  // tracks which one the driver is currently heading to; once it reaches
  // stops.length, the driver is heading to the real final drop. Reuses
  // DriverDropoff.tsx's existing arrival-geofence/map logic by generalizing
  // what counts as "the destination" (same pattern Wait & Return's return
  // leg already uses), rather than a separate multi-waypoint screen.
  stops: json("stops").$type<{ lat: string; lng: string; address: string }[]>(),
  currentStopIndex: int("currentStopIndex").default(0).notNull(),
  // Dispatch engine bookkeeping (api/lib/dispatchWorker.ts) — how many
  // sequential offer rounds this ride has gone through, when the worker last
  // touched it, and (once maxOfferRounds is exhausted with no accept) when
  // it was flagged as needing admin attention. Independent of `status`,
  // which stays exactly as it always has.
  dispatchRound: int("dispatchRound").default(0).notNull(),
  lastDispatchAttemptAt: timestamp("lastDispatchAttemptAt"),
  dispatchExhaustedAt: timestamp("dispatchExhaustedAt"),
  // Route Restriction system (api/lib/routeRestrictionWorker.ts) — set when
  // this ride's live route was found to cross an active road/area closure.
  // "rerouted" means an alternative was found and applied; "no_alternative"
  // means none exists and the driver/rider must be told explicitly, never
  // silently routed through the closure. Cleared by nothing automatically —
  // stays as the last-known notice until the next sweep changes it.
  routeRestrictionNotice: mysqlEnum("routeRestrictionNotice", ["rerouted", "no_alternative"]),
  routeRestrictionNoticeAt: timestamp("routeRestrictionNoticeAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type Ride = typeof rides.$inferSelect;

// ─── Dispatch Engine ─────────────────────────────────
// Sequential per-ride driver offers — one row per (ride, driver, round).
// Distinct from the existing broadcast-to-everyone-nearby push
// (notifyNearbyDriversOfNewRide in ride-router.ts, unchanged): that still
// fires immediately on booking and usually resolves a ride in seconds. This
// table only starts filling in once a ride sits unclaimed past
// dispatchSettings.firstOfferDelaySec — the sequential/exclusive fallback,
// not a replacement for the broadcast.
export const dispatchOfferStatusEnum = ["pending", "accepted", "rejected", "expired", "superseded"] as const;

export const dispatchOffers = mysqlTable("dispatch_offers", {
  id: serial("id").primaryKey(),
  rideId: bigint("rideId", { mode: "number", unsigned: true })
    .notNull()
    .references(() => rides.id),
  driverId: bigint("driverId", { mode: "number", unsigned: true })
    .notNull()
    .references(() => users.id),
  round: int("round").notNull(),
  radiusKm: decimal("radiusKm", { precision: 5, scale: 2 }),
  // Snapshot of the score that won this driver the offer — kept even after
  // acceptanceRate factors (derived from this very table) change in hindsight.
  score: int("score"),
  status: mysqlEnum("status", dispatchOfferStatusEnum).default("pending").notNull(),
  offeredAt: timestamp("offeredAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  respondedAt: timestamp("respondedAt"),
});

export type DispatchOffer = typeof dispatchOffers.$inferSelect;

// Append-only audit trail — every dispatch-relevant thing that happened to a
// ride, for the admin board's history view. Separate from the ride's own
// status column (which stays a simple current-state field, not a log).
export const dispatchEventTypeEnum = [
  "offer_sent",
  "offer_accepted",
  "offer_rejected",
  "offer_expired",
  "round_skipped_no_candidates",
  "no_driver_available",
  "admin_manual_assign",
  "admin_reassign",
  "availability_conflict_blocked",
] as const;

export const dispatchEvents = mysqlTable("dispatch_events", {
  id: varchar("id", { length: 60 }).primaryKey(),
  rideId: bigint("rideId", { mode: "number", unsigned: true })
    .notNull()
    .references(() => rides.id),
  eventType: mysqlEnum("eventType", dispatchEventTypeEnum).notNull(),
  driverId: bigint("driverId", { mode: "number", unsigned: true }).references(() => users.id),
  round: int("round"),
  actor: mysqlEnum("actor", ["system", "admin", "driver", "rider"]).default("system").notNull(),
  actorUserId: bigint("actorUserId", { mode: "number", unsigned: true }),
  detail: varchar("detail", { length: 500 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DispatchEvent = typeof dispatchEvents.$inferSelect;

// Admin-editable dispatch tuning — single row (id always 1), same convention
// as fareEngineConfig/surgeSettingsConfig below.
export const dispatchSettings = mysqlTable("dispatch_settings", {
  id: serial("id").primaryKey(),
  baseRadiusKm: decimal("baseRadiusKm", { precision: 5, scale: 2 }).default("5").notNull(),
  radiusExpansionKm: decimal("radiusExpansionKm", { precision: 5, scale: 2 }).default("3").notNull(),
  offerTimeoutSec: int("offerTimeoutSec").default(20).notNull(),
  maxOfferRounds: int("maxOfferRounds").default(4).notNull(),
  // How long a ride sits in "searching" untouched before the sequential
  // engine steps in — lets the existing broadcast resolve the easy cases
  // first (most rides today are claimed within a few seconds of booking).
  firstOfferDelaySec: int("firstOfferDelaySec").default(45).notNull(),
  // Added on top of a booking's own estimated duration when computing a
  // driver's occupied window (driverAvailability.ts) — realistic turnaround
  // slack, not zero-second back-to-back scheduling.
  reservationBufferMin: int("reservationBufferMin").default(15).notNull(),
  // Wait & Return's actual wait time isn't known until it happens — this
  // caps how long the driver is presumed occupied for conflict-checking
  // purposes before the wait actually starts.
  waitAndReturnMaxWaitMin: int("waitAndReturnMaxWaitMin").default(60).notNull(),
  riskMediumAfterSec: int("riskMediumAfterSec").default(300).notNull(),
  riskHighAfterSec: int("riskHighAfterSec").default(600).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type DispatchSettings = typeof dispatchSettings.$inferSelect;

// ─── Hourly Rental Packages ──────────────────────────
// Package-priced tiers a rider picks from on the Hourly Rental booking page
// — deliberately separate from fareVehicleConfigs (which is entirely
// distance/time-of-day priced per trip); a rental has no per-trip distance
// at all. Admin editing UI is a later phase — seeded with defaults for now,
// same bootstrapping pattern fareVehicleConfigs used before its own admin
// page existed.
export const hourlyRentalPackages = mysqlTable("hourly_rental_packages", {
  id: serial("id").primaryKey(),
  vehicleType: mysqlEnum("vehicleType", ["e-riksha", "auto-rickshaw", "car", "bike"]).notNull(),
  hours: int("hours").notNull(),
  basePrice: decimal("basePrice", { precision: 8, scale: 2 }).notNull(),
  // Informational only in this phase — shown to the rider as "up to X km
  // included," not live-metered/enforced (no continuous distance-tracking
  // infrastructure exists yet).
  includedKm: int("includedKm").notNull(),
  extraHourRate: decimal("extraHourRate", { precision: 8, scale: 2 }).notNull(),
  active: boolean("active").default(true).notNull(),
});

export type HourlyRentalPackage = typeof hourlyRentalPackages.$inferSelect;

// ─── Scheduled Rides ─────────────────────────────────
// A rider-owned template for a future/recurring ride — deliberately NOT an
// auto-booking engine (this app has no cron/job runner). scheduleRouter's
// checkDue lazily finds due entries and sends a real push reminder the rider
// taps to confirm through the normal ride.book flow, so pricing/driver
// availability are always current at actual booking time.
export const scheduledRides = mysqlTable("scheduled_rides", {
  id: serial("id").primaryKey(),
  userId: bigint("userId", { mode: "number", unsigned: true })
    .notNull()
    .references(() => users.id),
  label: varchar("label", { length: 60 }),
  pickupLat: decimal("pickupLat", { precision: 10, scale: 8 }).notNull(),
  pickupLng: decimal("pickupLng", { precision: 11, scale: 8 }).notNull(),
  pickupAddress: varchar("pickupAddress", { length: 255 }).notNull(),
  dropLat: decimal("dropLat", { precision: 10, scale: 8 }).notNull(),
  dropLng: decimal("dropLng", { precision: 11, scale: 8 }).notNull(),
  dropAddress: varchar("dropAddress", { length: 255 }).notNull(),
  // Same enums ride-router.ts's `book` input uses, so a schedule row can
  // prefill a real ride.book call directly.
  vehicleType: mysqlEnum("vehicleType", [
    "e-riksha", "auto-rickshaw", "car", "bike", "e-riksha-woman", "e-riksha-parcel", "bike-parcel", "e-riksha-school",
  ]).notNull(),
  segment: mysqlEnum("segment", ["share", "reserve", "auto", "parcel", "school", "women"]).notNull(),
  scheduledTime: varchar("scheduledTime", { length: 5 }).notNull(), // "HH:MM"
  frequency: mysqlEnum("frequency", ["once", "weekly", "monthly"]).notNull(),
  scheduledDate: date("scheduledDate", { mode: "string" }), // required when frequency = "once"
  daysOfWeek: json("daysOfWeek").$type<number[]>(), // 0-6, for "weekly"
  dayOfMonth: int("dayOfMonth"), // 1-31, for "monthly"
  reminderMinutesBefore: int("reminderMinutesBefore").default(15).notNull(),
  status: mysqlEnum("status", ["upcoming", "active", "completed", "cancelled", "expired"])
    .default("upcoming")
    .notNull(),
  lastTriggeredAt: timestamp("lastTriggeredAt"),
  linkedRideId: bigint("linkedRideId", { mode: "number", unsigned: true }).references(() => rides.id),
  // Set when this schedule entry is the return leg of a Round Trip booking —
  // matches the outbound ride row's own roundTripGroupId (rides table).
  roundTripGroupId: varchar("roundTripGroupId", { length: 40 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type ScheduledRide = typeof scheduledRides.$inferSelect;

// ─── Payments ────────────────────────────────────────
export const payments = mysqlTable("payments", {
  id: serial("id").primaryKey(),
  rideId: bigint("rideId", { mode: "number", unsigned: true })
    .notNull()
    .references(() => rides.id),
  userId: bigint("userId", { mode: "number", unsigned: true })
    .notNull()
    .references(() => users.id),
  driverId: bigint("driverId", { mode: "number", unsigned: true })
    .references(() => users.id),
  amount: decimal("amount", { precision: 8, scale: 2 }).notNull(),
  method: mysqlEnum("method", ["cash", "upi", "wallet"]).notNull(),
  status: mysqlEnum("status", ["pending", "completed", "failed", "refunded"])
    .default("pending")
    .notNull(),
  commission: decimal("commission", { precision: 8, scale: 2 }).default("0").notNull(),
  driverEarnings: decimal("driverEarnings", { precision: 8, scale: 2 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Payment = typeof payments.$inferSelect;

// ─── Coupons ─────────────────────────────────────────
export const coupons = mysqlTable("coupons", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  description: varchar("description", { length: 255 }).notNull(),
  discountType: mysqlEnum("discountType", ["percentage", "flat"]).notNull(),
  discountValue: decimal("discountValue", { precision: 8, scale: 2 }).notNull(),
  minBooking: decimal("minBooking", { precision: 8, scale: 2 }).default("0").notNull(),
  maxDiscount: decimal("maxDiscount", { precision: 8, scale: 2 }).default("0").notNull(),
  usageLimit: int("usageLimit").default(0).notNull(),
  usageCount: int("usageCount").default(0).notNull(),
  vehicleRestrictions: json("vehicleRestrictions").$type<string[]>().default([]).notNull(),
  areaRestrictions: json("areaRestrictions").$type<string[]>().default([]).notNull(),
  firstRideOnly: boolean("firstRideOnly").default(false).notNull(),
  repeatUserOnly: boolean("repeatUserOnly").default(false).notNull(),
  isReferralCoupon: boolean("isReferralCoupon").default(false).notNull(),
  isFestivalCoupon: boolean("isFestivalCoupon").default(false).notNull(),
  validFrom: date("validFrom", { mode: "string" }).notNull(),
  validTill: date("validTill", { mode: "string" }).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Coupon = typeof coupons.$inferSelect;

// ─── Referrals ───────────────────────────────────────
export const referrals = mysqlTable("referrals", {
  id: serial("id").primaryKey(),
  referrerId: bigint("referrerId", { mode: "number", unsigned: true })
    .notNull()
    .references(() => users.id),
  refereeId: bigint("refereeId", { mode: "number", unsigned: true })
    .notNull()
    .references(() => users.id)
    .unique(),
  code: varchar("code", { length: 50 }).notNull(),
  reward: decimal("reward", { precision: 8, scale: 2 }).default("20").notNull(),
  isClaimed: boolean("isClaimed").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Complaints ──────────────────────────────────────
export const complaints = mysqlTable("complaints", {
  id: serial("id").primaryKey(),
  ticketId: varchar("ticketId", { length: 20 }).notNull().unique(),
  userId: bigint("userId", { mode: "number", unsigned: true })
    .notNull()
    .references(() => users.id),
  rideId: bigint("rideId", { mode: "number", unsigned: true }).references(() => rides.id),
  category: mysqlEnum("category", [
    "ride_issue",
    "payment",
    "driver_behaviour",
    "safety",
    "app_issue",
    "other",
  ]).notNull(),
  subject: varchar("subject", { length: 255 }).notNull(),
  description: text("description").notNull(),
  status: mysqlEnum("status", ["open", "in_progress", "resolved", "closed"])
    .default("open")
    .notNull(),
  priority: mysqlEnum("priority", ["low", "medium", "high", "urgent"])
    .default("medium")
    .notNull(),
  assignedTo: bigint("assignedTo", { mode: "number", unsigned: true }).references(() => users.id),
  resolution: text("resolution"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type Complaint = typeof complaints.$inferSelect;

// ─── Fare Settings ───────────────────────────────────
export const fareSettings = mysqlTable("fare_settings", {
  id: serial("id").primaryKey(),
  baseFare: decimal("baseFare", { precision: 8, scale: 2 }).default("20").notNull(),
  perKmRate: decimal("perKmRate", { precision: 8, scale: 2 }).default("12").notNull(),
  shareMultiplier: decimal("shareMultiplier", { precision: 3, scale: 2 }).default("0.60").notNull(),
  reserveMultiplier: decimal("reserveMultiplier", { precision: 3, scale: 2 })
    .default("1.30")
    .notNull(),
  commissionPerRide: decimal("commissionPerRide", { precision: 8, scale: 2 })
    .default("2.00")
    .notNull(),
  minFare: decimal("minFare", { precision: 8, scale: 2 }).default("20").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type FareSettings = typeof fareSettings.$inferSelect;

// ─── Saved Places ────────────────────────────────────
export const savedPlaces = mysqlTable("saved_places", {
  id: serial("id").primaryKey(),
  userId: bigint("userId", { mode: "number", unsigned: true })
    .notNull()
    .references(() => users.id),
  name: varchar("name", { length: 50 }).notNull(),
  address: varchar("address", { length: 255 }).notNull(),
  lat: decimal("lat", { precision: 10, scale: 8 }).notNull(),
  lng: decimal("lng", { precision: 11, scale: 8 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ─── Wallets & Settlement ──────────────────────────────
// walletType/ownerId together are the ledger key — "driver"/"customer"
// wallets are keyed by name (no real per-account driver/rider identity
// exists yet outside auth), "company"/"fleet"/"referral"/"franchise" are
// single pooled wallets (ownerId repeats the wallet type as its own key).
export const walletTypeEnum = ["driver", "company", "fleet", "referral", "franchise", "customer"] as const;

export const wallets = mysqlTable(
  "wallets",
  {
    id: serial("id").primaryKey(),
    walletType: mysqlEnum("walletType", walletTypeEnum).notNull(),
    ownerId: varchar("ownerId", { length: 120 }).notNull(),
    availableBalance: decimal("availableBalance", { precision: 12, scale: 2 }).default("0").notNull(),
    pendingBalance: decimal("pendingBalance", { precision: 12, scale: 2 }).default("0").notNull(),
    lifetimeEarnings: decimal("lifetimeEarnings", { precision: 12, scale: 2 }).default("0").notNull(),
    duesOwed: decimal("duesOwed", { precision: 12, scale: 2 }).default("0").notNull(),
    // What a driver owes the platform from cash rides — they already
    // physically hold the full cash fare, so the commission portion never
    // touches availableBalance; it accrues here instead and is cleared off
    // the top of their next online-ride credit. Distinct from duesOwed
    // (cancellation-penalty shortfalls) even though the clearing mechanism
    // is the same shape, since the wallet dashboard shows them separately.
    pendingCommission: decimal("pendingCommission", { precision: 12, scale: 2 }).default("0").notNull(),
    frozen: boolean("frozen").default(false).notNull(),
    frozenReason: varchar("frozenReason", { length: 255 }),
  },
  (table) => [uniqueIndex("wallet_type_owner_idx").on(table.walletType, table.ownerId)],
);

export type Wallet = typeof wallets.$inferSelect;

export const walletTransactionTypeEnum = [
  "commission_credit", "bonus", "incentive", "penalty", "adjustment", "withdrawal",
  "recharge", "refund", "cashback", "promotional_credit", "referral_credit", "coupon_discount", "debit",
  "cancellation_fee", "cancellation_compensation", "subscription_payment",
  "cash_commission_pending", "cash_commission_cleared", "withdrawal_reversal",
  "festival_bonus", "challenge_reward", "peak_bonus",
] as const;

export const walletTransactions = mysqlTable("wallet_transactions", {
  id: varchar("id", { length: 60 }).primaryKey(),
  walletType: mysqlEnum("walletType", walletTypeEnum).notNull(),
  ownerId: varchar("ownerId", { length: 120 }).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  type: mysqlEnum("type", walletTransactionTypeEnum).notNull(),
  description: varchar("description", { length: 255 }).notNull(),
  sourceRecordId: varchar("sourceRecordId", { length: 60 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type WalletTransactionRow = typeof walletTransactions.$inferSelect;

export const withdrawalRequests = mysqlTable("withdrawal_requests", {
  id: varchar("id", { length: 60 }).primaryKey(),
  walletType: mysqlEnum("walletType", walletTypeEnum).notNull(),
  ownerId: varchar("ownerId", { length: 120 }).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  status: mysqlEnum("status", ["pending", "approved", "processing", "completed", "rejected", "failed", "cancelled"])
    .default("pending")
    .notNull(),
  method: mysqlEnum("method", ["bank", "upi"]).default("bank").notNull(),
  // Whether this request went through the no-approval-needed path (Finance
  // Settings' Automatic Payout toggle) or waited on an admin — kept per-row
  // since the setting can change after the request was made.
  payoutMode: mysqlEnum("payoutMode", ["automatic", "manual"]).default("manual").notNull(),
  failureReason: varchar("failureReason", { length: 255 }),
  // Set when the request enters "processing" — the simulated payout engine
  // lazily resolves any row that's been processing longer than its settle
  // delay the next time it's queried (see queries/payouts.ts).
  processingStartedAt: timestamp("processingStartedAt"),
  requestedAt: timestamp("requestedAt").defaultNow().notNull(),
  resolvedAt: timestamp("resolvedAt"),
});

export type WithdrawalRequestRow = typeof withdrawalRequests.$inferSelect;

// ─── Finance Settings (singleton) ───────────────────────
export const financeSettings = mysqlTable("finance_settings", {
  id: serial("id").primaryKey(),
  automaticPayout: boolean("automaticPayout").default(false).notNull(),
  automaticDailySettlement: boolean("automaticDailySettlement").default(false).notNull(),
  automaticWeeklySettlement: boolean("automaticWeeklySettlement").default(false).notNull(),
  minWithdrawal: decimal("minWithdrawal", { precision: 12, scale: 2 }).default("100").notNull(),
  maxWithdrawal: decimal("maxWithdrawal", { precision: 12, scale: 2 }).default("50000").notNull(),
  dailyWithdrawalLimit: decimal("dailyWithdrawalLimit", { precision: 12, scale: 2 }).default("50000").notNull(),
  maxRequestsPerDay: int("maxRequestsPerDay").default(3).notNull(),
  manualApprovalRequired: boolean("manualApprovalRequired").default(true).notNull(),
  holidaySettlementPause: boolean("holidaySettlementPause").default(false).notNull(),
});

export type FinanceSettingsRow = typeof financeSettings.$inferSelect;

// ─── Commission ──────────────────────────────────────
// Single-row config table (id is always 1) — same singleton pattern as
// commission-router.ts's old module-level `let commissionConfig`, just
// persisted so an admin's tuning survives a server restart.
export const commissionConfig = mysqlTable("commission_config", {
  id: serial("id").primaryKey(),
  driverSharePercent: decimal("driverSharePercent", { precision: 5, scale: 2 }).default("80").notNull(),
  paymentGatewayChargePercent: decimal("paymentGatewayChargePercent", { precision: 5, scale: 2 }).default("2").notNull(),
  platformChargePercent: decimal("platformChargePercent", { precision: 5, scale: 2 }).default("1").notNull(),
  referralCommissionPercent: decimal("referralCommissionPercent", { precision: 5, scale: 2 }).default("5").notNull(),
  fleetOwnerSharePercent: decimal("fleetOwnerSharePercent", { precision: 5, scale: 2 }).default("0").notNull(),
  franchiseSharePercent: decimal("franchiseSharePercent", { precision: 5, scale: 2 }).default("0").notNull(),
  partnerSharePercent: decimal("partnerSharePercent", { precision: 5, scale: 2 }).default("0").notNull(),
  promoDiscountSharePercent: decimal("promoDiscountSharePercent", { precision: 5, scale: 2 }).default("0").notNull(),
  cashbackSharePercent: decimal("cashbackSharePercent", { precision: 5, scale: 2 }).default("0").notNull(),
  taxDeductionPercent: decimal("taxDeductionPercent", { precision: 5, scale: 2 }).default("2").notNull(),
  tdsPercent: decimal("tdsPercent", { precision: 5, scale: 2 }).default("1").notNull(),
  gstOnCommissionPercent: decimal("gstOnCommissionPercent", { precision: 5, scale: 2 }).default("18").notNull(),
  insuranceFeePercent: decimal("insuranceFeePercent", { precision: 5, scale: 2 }).default("1").notNull(),
  emergencyFundPercent: decimal("emergencyFundPercent", { precision: 5, scale: 2 }).default("1").notNull(),
  donationEnabled: boolean("donationEnabled").default(false).notNull(),
  donationPercent: decimal("donationPercent", { precision: 5, scale: 2 }).default("1").notNull(),
});

export type CommissionConfigRow = typeof commissionConfig.$inferSelect;

// Every completed, paid ride/parcel gets one record here — the ledger
// Section 4 (Settlement) and Section 5 (Driver Wallet) read from.
export const commissionRecords = mysqlTable("commission_records", {
  id: varchar("id", { length: 60 }).primaryKey(),
  source: mysqlEnum("source", ["ride", "parcel"]).notNull(),
  sourceId: varchar("sourceId", { length: 60 }).notNull(),
  driverName: varchar("driverName", { length: 120 }).notNull(),
  paymentMethod: varchar("paymentMethod", { length: 20 }).notNull(),
  total: decimal("total", { precision: 12, scale: 2 }).notNull(),
  paymentGatewayCharge: decimal("paymentGatewayCharge", { precision: 12, scale: 2 }).notNull(),
  platformCharge: decimal("platformCharge", { precision: 12, scale: 2 }).notNull(),
  driverShare: decimal("driverShare", { precision: 12, scale: 2 }).notNull(),
  referralCommission: decimal("referralCommission", { precision: 12, scale: 2 }).notNull(),
  fleetOwnerShare: decimal("fleetOwnerShare", { precision: 12, scale: 2 }).notNull(),
  franchiseShare: decimal("franchiseShare", { precision: 12, scale: 2 }).notNull(),
  partnerShare: decimal("partnerShare", { precision: 12, scale: 2 }).notNull(),
  promoDiscountShare: decimal("promoDiscountShare", { precision: 12, scale: 2 }).notNull(),
  cashbackShare: decimal("cashbackShare", { precision: 12, scale: 2 }).notNull(),
  taxDeduction: decimal("taxDeduction", { precision: 12, scale: 2 }).notNull(),
  tds: decimal("tds", { precision: 12, scale: 2 }).notNull(),
  gstOnCommission: decimal("gstOnCommission", { precision: 12, scale: 2 }).notNull(),
  insuranceFee: decimal("insuranceFee", { precision: 12, scale: 2 }).notNull(),
  emergencyFund: decimal("emergencyFund", { precision: 12, scale: 2 }).notNull(),
  donation: decimal("donation", { precision: 12, scale: 2 }).notNull(),
  companyNet: decimal("companyNet", { precision: 12, scale: 2 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CommissionRecordRow = typeof commissionRecords.$inferSelect;

// ─── Referrals ───────────────────────────────────────
// Keyed by real userId; ownerName/referrerName/refereeName are kept for
// display and for pre-migration rows that predate the userId columns.
// (Distinct from the unused FK-based `referrals` table above, which
// predates this router and was never wired to a real auth session.)
export const referralRoleEnum = ["rider", "driver"] as const;

export const referralConfig = mysqlTable("referral_config", {
  id: serial("id").primaryKey(),
  enabled: boolean("enabled").default(true).notNull(),
  payoutTrigger: mysqlEnum("payoutTrigger", ["signup", "first_ride"]).default("first_ride").notNull(),
  riderToRiderReferrer: decimal("riderToRiderReferrer", { precision: 8, scale: 2 }).default("20").notNull(),
  riderToRiderReferee: decimal("riderToRiderReferee", { precision: 8, scale: 2 }).default("20").notNull(),
  riderToDriverReferrer: decimal("riderToDriverReferrer", { precision: 8, scale: 2 }).default("100").notNull(),
  riderToDriverReferee: decimal("riderToDriverReferee", { precision: 8, scale: 2 }).default("100").notNull(),
  driverToDriverReferrer: decimal("driverToDriverReferrer", { precision: 8, scale: 2 }).default("200").notNull(),
  driverToDriverReferee: decimal("driverToDriverReferee", { precision: 8, scale: 2 }).default("100").notNull(),
  driverToRiderReferrer: decimal("driverToRiderReferrer", { precision: 8, scale: 2 }).default("50").notNull(),
  driverToRiderReferee: decimal("driverToRiderReferee", { precision: 8, scale: 2 }).default("20").notNull(),
});

export type ReferralConfigRow = typeof referralConfig.$inferSelect;

// No longer unique-indexed on (ownerName, ownerRole) — that was the
// original identity key and is exactly the collision this table's
// ownerUserId column exists to fix (two real accounts, or a real account
// and stale seed data, can share a display name).
export const referralMembers = mysqlTable("referral_members", {
  code: varchar("code", { length: 20 }).primaryKey(),
  ownerUserId: bigint("ownerUserId", { mode: "number", unsigned: true })
    .references(() => users.id)
    .unique(),
  ownerName: varchar("ownerName", { length: 80 }).notNull(),
  ownerRole: mysqlEnum("ownerRole", referralRoleEnum).notNull(),
  shareCount: int("shareCount").default(0).notNull(),
});

export type ReferralMemberRow = typeof referralMembers.$inferSelect;

export const referralRecords = mysqlTable("referral_records", {
  id: varchar("id", { length: 60 }).primaryKey(),
  code: varchar("code", { length: 20 }).notNull(),
  referrerUserId: bigint("referrerUserId", { mode: "number", unsigned: true }).references(() => users.id),
  referrerName: varchar("referrerName", { length: 80 }).notNull(),
  referrerRole: mysqlEnum("referrerRole", referralRoleEnum).notNull(),
  refereeUserId: bigint("refereeUserId", { mode: "number", unsigned: true }).references(() => users.id),
  refereeName: varchar("refereeName", { length: 80 }).notNull(),
  refereeRole: mysqlEnum("refereeRole", referralRoleEnum).notNull(),
  status: mysqlEnum("status", ["pending", "completed"]).default("pending").notNull(),
  referrerBonus: decimal("referrerBonus", { precision: 8, scale: 2 }).notNull(),
  refereeBonus: decimal("refereeBonus", { precision: 8, scale: 2 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
});

export type ReferralRecordRow = typeof referralRecords.$inferSelect;

// ─── Cancellation Rules ──────────────────────────────
export const vehicleTypeEnum = [
  "e-riksha", "auto-rickshaw", "car", "bike", "e-riksha-woman", "e-riksha-parcel", "bike-parcel", "e-riksha-school",
] as const;

export const cancellationConfig = mysqlTable("cancellation_config", {
  id: serial("id").primaryKey(),
  freeCancellationWindowSec: int("freeCancellationWindowSec").default(60).notNull(),
  driverCompensationPercent: decimal("driverCompensationPercent", { precision: 5, scale: 2 }).default("70").notNull(),
});

export type CancellationConfigRow = typeof cancellationConfig.$inferSelect;

export const vehicleCancellationFees = mysqlTable("vehicle_cancellation_fees", {
  vehicleType: mysqlEnum("vehicleType", vehicleTypeEnum).primaryKey(),
  feeType: mysqlEnum("feeType", ["flat", "percent"]).notNull(),
  feeValue: decimal("feeValue", { precision: 8, scale: 2 }).notNull(),
  maxFee: decimal("maxFee", { precision: 8, scale: 2 }).notNull(),
});

export type VehicleCancellationFeeRow = typeof vehicleCancellationFees.$inferSelect;

export const cancellationRecords = mysqlTable("cancellation_records", {
  id: varchar("id", { length: 60 }).primaryKey(),
  vehicleType: mysqlEnum("vehicleType", vehicleTypeEnum).notNull(),
  // The real 10-type fare/cancellation vehicle id (e.g. "e-riksha-share" vs
  // "e-riksha-reserve", or "courier" — none of which the 8-value enum above
  // can represent). Nullable since records inserted before this column
  // existed have no value. `vehicleType` above is kept only for backward-
  // compat display; this is the authoritative field for anything reading
  // per-vehicle cancellation rules.
  fareVehicleType: varchar("fareVehicleType", { length: 30 }),
  stage: mysqlEnum("stage", ["searching", "matched"]).notNull(),
  initiator: mysqlEnum("initiator", ["rider", "driver"]).notNull(),
  reason: varchar("reason", { length: 200 }).notNull(),
  riderName: varchar("riderName", { length: 80 }).notNull(),
  driverName: varchar("driverName", { length: 80 }),
  fareAmount: decimal("fareAmount", { precision: 8, scale: 2 }).notNull(),
  feeCharged: decimal("feeCharged", { precision: 8, scale: 2 }).notNull(),
  feeWaived: boolean("feeWaived").notNull(),
  waiveReason: varchar("waiveReason", { length: 200 }),
  driverCompensation: decimal("driverCompensation", { precision: 8, scale: 2 }).notNull(),
  // Money owed FROM the driver — a distinct concept from feeCharged/
  // driverCompensation above (both rider-fee-oriented). Only set on
  // initiator="driver" records (Cancellation Rules Section B).
  driverPenalty: decimal("driverPenalty", { precision: 8, scale: 2 }).default("0").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CancellationRecordRow = typeof cancellationRecords.$inferSelect;

// ─── Zone Pricing ────────────────────────────────────
// Geographic zone pricing — matched by keyword against the pickup/drop text
// (no real polygon geofencing in this prototype).
export const pricingZones = mysqlTable("pricing_zones", {
  id: varchar("id", { length: 60 }).primaryKey(),
  name: varchar("name", { length: 60 }).notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  keywords: json("keywords").$type<string[]>().notNull(),
  matchSide: mysqlEnum("matchSide", ["pickup", "drop", "either"]).notNull(),
  ruleType: mysqlEnum("ruleType", ["flat", "percent"]).notNull(),
  value: decimal("value", { precision: 8, scale: 2 }).notNull(),
});

export type PricingZoneRow = typeof pricingZones.$inferSelect;

// ─── Route Restrictions ──────────────────────────────
// Admin-managed road/area closures. Two separate layers by design: the
// Visual Layer (this data, rendered as overlays on rider/driver maps) and
// the Routing Layer (api/lib/googleDirectionsServer.ts's server-side
// avoidance check) — the routing layer is authoritative, the client never
// re-derives avoidance from this geometry itself.
export const routeRestrictionReasonEnum = [
  "construction", "accident", "waterlogging", "traffic", "festival",
  "political_event", "police", "emergency", "other",
] as const;

export const routeRestrictionSeverityEnum = [
  "advisory", "restricted", "fully_blocked", "emergency_closure",
] as const;

export const routeRestrictionTypeEnum = ["road", "area"] as const;

export const routeRestrictions = mysqlTable("route_restrictions", {
  id: varchar("id", { length: 60 }).primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  reason: mysqlEnum("reason", routeRestrictionReasonEnum).notNull(),
  reasonNote: varchar("reasonNote", { length: 300 }),
  severity: mysqlEnum("severity", routeRestrictionSeverityEnum).notNull(),
  restrictionType: mysqlEnum("restrictionType", routeRestrictionTypeEnum).notNull(),
  // Only set when restrictionType="area" — a single closed polygon ring
  // (first point equals last point). Road-type geometry instead lives as
  // 1+ child rows in routeRestrictionSegments, since each blocked road
  // needs its own name/identity for the admin UI's removable-chip list.
  areaGeometry: json("areaGeometry").$type<{ lat: number; lng: number }[]>(),
  startTime: timestamp("startTime").notNull(),
  endTime: timestamp("endTime"),
  isIndefinite: boolean("isIndefinite").default(false).notNull(),
  // Worker-maintained (routeRestrictionWorker.ts), not derived live from
  // startTime/endTime on every read — every routing-layer read filters on
  // isActive=true directly, same "materialized status" role dispatchRound
  // plays for rides above.
  isActive: boolean("isActive").default(false).notNull(),
  unblockedAt: timestamp("unblockedAt"),
  unblockedByUserId: bigint("unblockedByUserId", { mode: "number", unsigned: true }), // no FK — actor-column convention, see dispatchEvents.actorUserId
  unblockReason: varchar("unblockReason", { length: 300 }),
  createdByUserId: bigint("createdByUserId", { mode: "number", unsigned: true }), // no FK — same convention
  // Dirty-flag for the worker's active-ride sweep: NULL or older than
  // updatedAt means "needs a sweep" (new restriction, or edited geometry).
  lastRideCheckAt: timestamp("lastRideCheckAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type RouteRestriction = typeof routeRestrictions.$inferSelect;

// Table name shortened to "route_restriction_roads" (not "..._segments")
// so drizzle's auto-generated FK constraint name stays under MySQL's
// 64-char identifier limit — "route_restriction_segments_restrictionId_
// route_restrictions_id_fk" alone was 65 chars.
export const routeRestrictionSegments = mysqlTable("route_restriction_roads", {
  id: varchar("id", { length: 60 }).primaryKey(),
  restrictionId: varchar("restrictionId", { length: 60 })
    .notNull()
    .references(() => routeRestrictions.id),
  roadName: varchar("roadName", { length: 120 }).notNull(),
  geometry: json("geometry").$type<{ lat: number; lng: number }[]>().notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type RouteRestrictionSegment = typeof routeRestrictionSegments.$inferSelect;

// Append-only audit trail — mirrors dispatchEvents' exact shape (actor +
// no-FK actorUserId, detail string) rather than inventing a new convention.
export const routeRestrictionEventTypeEnum = [
  "created", "activated", "edited", "unblocked", "auto_expired",
  "ride_rerouted", "no_alternative_route", "scheduled_ride_delay_flagged",
] as const;

export const routeRestrictionEvents = mysqlTable("route_restriction_events", {
  id: varchar("id", { length: 60 }).primaryKey(),
  restrictionId: varchar("restrictionId", { length: 60 })
    .notNull()
    .references(() => routeRestrictions.id),
  rideId: bigint("rideId", { mode: "number", unsigned: true }).references(() => rides.id), // nullable — only ride-linked events set this
  eventType: mysqlEnum("eventType", routeRestrictionEventTypeEnum).notNull(),
  actor: mysqlEnum("actor", ["system", "admin", "driver", "rider"]).default("system").notNull(),
  actorUserId: bigint("actorUserId", { mode: "number", unsigned: true }), // no FK — mirrors dispatchEvents.actorUserId
  detail: varchar("detail", { length: 500 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type RouteRestrictionEvent = typeof routeRestrictionEvents.$inferSelect;

// ─── Parcel Bookings ─────────────────────────────────
// Keyed by trackingId so a receiver on a completely different device/session
// can look a parcel up by code alone, without needing an authenticated session.
export const parcelBookings = mysqlTable("parcel_bookings", {
  trackingId: varchar("trackingId", { length: 20 }).primaryKey(),
  deliveryPin: varchar("deliveryPin", { length: 4 }).notNull(),
  pickup: varchar("pickup", { length: 255 }).notNull(),
  destination: varchar("destination", { length: 255 }).notNull(),
  pickupLat: decimal("pickupLat", { precision: 10, scale: 8 }).notNull(),
  pickupLng: decimal("pickupLng", { precision: 11, scale: 8 }).notNull(),
  destinationLat: decimal("destinationLat", { precision: 10, scale: 8 }).notNull(),
  destinationLng: decimal("destinationLng", { precision: 11, scale: 8 }).notNull(),
  category: varchar("category", { length: 60 }).notNull(),
  weightKg: decimal("weightKg", { precision: 6, scale: 2 }).notNull(),
  fragile: boolean("fragile").notNull(),
  notes: varchar("notes", { length: 300 }).default("").notNull(),
  cost: decimal("cost", { precision: 8, scale: 2 }).notNull(),
  paidBy: mysqlEnum("paidBy", ["sender", "receiver"]).notNull(),
  stage: mysqlEnum("stage", ["assigned", "picked_up", "arrived", "delivered"]).default("assigned").notNull(),
  paymentStatus: mysqlEnum("paymentStatus", ["unpaid", "confirmed"]).default("unpaid").notNull(),
  paymentMethod: mysqlEnum("paymentMethod", ["cash", "upi", "wallet"]),
  driverName: varchar("driverName", { length: 80 }).notNull(),
  driverPhone: varchar("driverPhone", { length: 20 }).notNull(),
  vehicle: varchar("vehicle", { length: 80 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  deliveredAt: timestamp("deliveredAt"),
});

export type ParcelBookingRow = typeof parcelBookings.$inferSelect;

// ─── Ride Payments ───────────────────────────────────
// This prototype only ever simulates one active ride at a time (see
// ride-payment-router.ts) — a singleton row (id is always 1) that gets
// overwritten by each new submit, same as the old in-memory
// `currentPayment` variable, just persisted across restarts.
export const currentRidePayment = mysqlTable("current_ride_payment", {
  id: serial("id").primaryKey(),
  paymentId: varchar("paymentId", { length: 60 }).notNull(),
  method: mysqlEnum("method", ["cash", "upi", "wallet"]).notNull(),
  amount: decimal("amount", { precision: 8, scale: 2 }).notNull(),
  passengerName: varchar("passengerName", { length: 80 }).notNull(),
  driverName: varchar("driverName", { length: 80 }).notNull(),
  status: mysqlEnum("status", ["pending", "confirmed"]).notNull(),
  createdAt: timestamp("createdAt").notNull(),
  confirmedAt: timestamp("confirmedAt"),
});

export type CurrentRidePaymentRow = typeof currentRidePayment.$inferSelect;

// ─── Notifications ───────────────────────────────────
export const appNotifications = mysqlTable("app_notifications", {
  id: varchar("id", { length: 60 }).primaryKey(),
  audience: mysqlEnum("audience", ["rider", "driver", "both"]).notNull(),
  kind: mysqlEnum("kind", ["banner", "text"]).notNull(),
  title: varchar("title", { length: 120 }).notNull(),
  message: varchar("message", { length: 500 }).notNull(),
  // Data URI when a banner image was uploaded — self-contained so it renders
  // on every device without needing file storage. Needs LONGTEXT: base64
  // images can run past the 64KB TEXT limit.
  bannerUrl: longtext("bannerUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AppNotificationRow = typeof appNotifications.$inferSelect;

export const pushSubscriptions = mysqlTable("push_subscriptions", {
  id: serial("id").primaryKey(),
  role: mysqlEnum("role", ["rider", "driver"]).notNull(),
  // Null for devices that subscribed before this column existed, or in the
  // (currently unused) case of a subscribe call with no session — those
  // still work for audience broadcasts, they just can't be targeted by
  // sendPushToUserIds for a single person (e.g. "new ride near you").
  userId: bigint("userId", { mode: "number", unsigned: true }),
  endpoint: varchar("endpoint", { length: 500 }).notNull().unique(),
  p256dh: varchar("p256dh", { length: 255 }).notNull(),
  auth: varchar("auth", { length: 255 }).notNull(),
  expirationTime: bigint("expirationTime", { mode: "number" }),
});

export type PushSubscriptionRow = typeof pushSubscriptions.$inferSelect;

// Devices running inside the wrapped native Android app register here
// instead of (or alongside) a web-push subscription above.
export const fcmTokens = mysqlTable("fcm_tokens", {
  id: serial("id").primaryKey(),
  role: mysqlEnum("role", ["rider", "driver"]).notNull(),
  userId: bigint("userId", { mode: "number", unsigned: true }),
  token: varchar("token", { length: 255 }).notNull().unique(),
});

export type FcmTokenRow = typeof fcmTokens.$inferSelect;

// ─── Fare Engine ─────────────────────────────────────
// Singleton config row (id is always 1) — every admin-tunable rate, fee,
// surcharge, and rule the fare engine reads from.
export const fareEngineConfig = mysqlTable("fare_engine_config", {
  id: serial("id").primaryKey(),
  baseFare: decimal("baseFare", { precision: 8, scale: 2 }).default("20").notNull(),
  perKmRate: decimal("perKmRate", { precision: 8, scale: 2 }).default("12").notNull(),
  perMinuteRate: decimal("perMinuteRate", { precision: 8, scale: 2 }).default("0.5").notNull(),
  waitingChargePerMin: decimal("waitingChargePerMin", { precision: 8, scale: 2 }).default("1").notNull(),
  shareMultiplier: decimal("shareMultiplier", { precision: 4, scale: 2 }).default("0.6").notNull(),
  reserveMultiplier: decimal("reserveMultiplier", { precision: 4, scale: 2 }).default("1.3").notNull(),
  autoMultiplier: decimal("autoMultiplier", { precision: 4, scale: 2 }).default("1.0").notNull(),
  commissionPerRide: decimal("commissionPerRide", { precision: 8, scale: 2 }).default("2").notNull(),
  trafficChargePercent: decimal("trafficChargePercent", { precision: 5, scale: 2 }).default("0").notNull(),
  nightChargePercent: decimal("nightChargePercent", { precision: 5, scale: 2 }).default("10").notNull(),
  peakHourMultiplier: decimal("peakHourMultiplier", { precision: 4, scale: 2 }).default("1.15").notNull(),
  rainMultiplier: decimal("rainMultiplier", { precision: 4, scale: 2 }).default("1.2").notNull(),
  festivalMultiplier: decimal("festivalMultiplier", { precision: 4, scale: 2 }).default("1.25").notNull(),
  airportPickupCharge: decimal("airportPickupCharge", { precision: 8, scale: 2 }).default("50").notNull(),
  airportDropCharge: decimal("airportDropCharge", { precision: 8, scale: 2 }).default("50").notNull(),
  tollChargesEnabled: boolean("tollChargesEnabled").default(true).notNull(),
  parkingChargesEnabled: boolean("parkingChargesEnabled").default(true).notNull(),
  driverIncentivePerRide: decimal("driverIncentivePerRide", { precision: 8, scale: 2 }).default("5").notNull(),
  bookingFee: decimal("bookingFee", { precision: 8, scale: 2 }).default("2").notNull(),
  platformFee: decimal("platformFee", { precision: 8, scale: 2 }).default("3").notNull(),
  convenienceFee: decimal("convenienceFee", { precision: 8, scale: 2 }).default("2").notNull(),
  gstPercent: decimal("gstPercent", { precision: 5, scale: 2 }).default("5").notNull(),
  cancellationCharge: decimal("cancellationCharge", { precision: 8, scale: 2 }).default("25").notNull(),
  minFare: decimal("minFare", { precision: 8, scale: 2 }).default("30").notNull(),
  maxFare: decimal("maxFare", { precision: 8, scale: 2 }).default("5000").notNull(),
  outstationChargePerKm: decimal("outstationChargePerKm", { precision: 8, scale: 2 }).default("14").notNull(),
  longDistanceDiscountPercent: decimal("longDistanceDiscountPercent", { precision: 5, scale: 2 }).default("8").notNull(),
  longDistanceThresholdKm: decimal("longDistanceThresholdKm", { precision: 6, scale: 2 }).default("25").notNull(),
  roundTripChargePercent: decimal("roundTripChargePercent", { precision: 5, scale: 2 }).default("10").notNull(),
  parcelBaseFare: decimal("parcelBaseFare", { precision: 8, scale: 2 }).default("25").notNull(),
  parcelPerKmRate: decimal("parcelPerKmRate", { precision: 8, scale: 2 }).default("8").notNull(),
  schoolRideMultiplier: decimal("schoolRideMultiplier", { precision: 4, scale: 2 }).default("0.85").notNull(),
  womenRideMultiplier: decimal("womenRideMultiplier", { precision: 4, scale: 2 }).default("1.0").notNull(),
  luxuryVehicleMultiplier: decimal("luxuryVehicleMultiplier", { precision: 4, scale: 2 }).default("1.8").notNull(),
});

export type FareEngineConfigRow = typeof fareEngineConfig.$inferSelect;

export const vehiclePricing = mysqlTable("vehicle_pricing", {
  id: mysqlEnum("id", vehicleTypeEnum).primaryKey(),
  label: varchar("label", { length: 80 }).notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  baseFare: decimal("baseFare", { precision: 8, scale: 2 }).notNull(),
  perKmRate: decimal("perKmRate", { precision: 8, scale: 2 }).notNull(),
  perMinuteRate: decimal("perMinuteRate", { precision: 8, scale: 2 }).notNull(),
  minFare: decimal("minFare", { precision: 8, scale: 2 }).notNull(),
});

export type VehiclePricingRow = typeof vehiclePricing.$inferSelect;

// Singleton row (id is always 1). demandTiers/peakWindows are small
// admin-edited lists, not query targets — JSON keeps them atomic with the
// rest of the surge config instead of needing separate join tables.
export const surgeSettingsConfig = mysqlTable("surge_settings", {
  id: serial("id").primaryKey(),
  enabled: boolean("enabled").default(true).notNull(),
  maxSurgePercent: decimal("maxSurgePercent", { precision: 5, scale: 2 }).default("50").notNull(),
  minFare: decimal("minFare", { precision: 8, scale: 2 }).default("30").notNull(),
  nightChargePercent: decimal("nightChargePercent", { precision: 5, scale: 2 }).default("10").notNull(),
  festivalChargePercent: decimal("festivalChargePercent", { precision: 5, scale: 2 }).default("20").notNull(),
  emergencyOverride: boolean("emergencyOverride").default(false).notNull(),
  rainActive: boolean("rainActive").default(false).notNull(),
  festivalActive: boolean("festivalActive").default(false).notNull(),
  surgeMode: mysqlEnum("surgeMode", ["manual", "auto"]).default("manual").notNull(),
  demandSurgePercent: decimal("demandSurgePercent", { precision: 5, scale: 2 }).default("0").notNull(),
  demandTiers: json("demandTiers").$type<{ count: number; percent: number }[]>().notNull(),
  peakWindows: json("peakWindows").$type<{ label: string; startHour: number; endHour: number }[]>().notNull(),
  // Gates the client's "AI Suggested Pricing" flourish (src/lib/aiFarePrediction.ts) —
  // a simulated peak/night/demand/weather multiplier, not a real prediction model.
  // Enforced server-side in calculateFare (not just hidden client-side) so a stale
  // client can't still charge a boosted total after an admin turns this off.
  aiPricingEnabled: boolean("aiPricingEnabled").default(true).notNull(),
});

export type SurgeSettingsRow = typeof surgeSettingsConfig.$inferSelect;

// ─── Fare Configuration (per-vehicle-type, redesigned) ──────────────────
// Distinct from `vehicleTypeEnum` above (driver profiles / 3D models /
// booking) — this is the fare-config page's own vehicle taxonomy. Notably
// it splits e-riksha share/reserve into two fully independent fare
// profiles (replacing the old global shareMultiplier/reserveMultiplier
// applied on top of one shared e-riksha rate) and adds "courier" as a
// selectable profile, matching the redesigned admin page's exact vehicle
// list. calculateFare (api/fare-router.ts) maps an incoming
// (vehicleType, segment) booking pair onto one of these ids.
export const fareVehicleTypeEnum = [
  "e-riksha-reserve", "e-riksha-share", "auto-rickshaw", "bike-taxi", "car",
  "e-riksha-women", "e-riksha-parcel", "courier", "e-riksha-school", "bike-parcel",
] as const;

export const feeTypeEnum = ["percent", "fixed"] as const;

// One row per fare vehicle type — every field on the redesigned Fare
// Configuration page lives here, so switching vehicle types is just
// switching which row is loaded. `taxes` is a JSON list (like
// surgeSettingsConfig's demandTiers/peakWindows above) since it's a small
// admin-edited list that should stay atomic with the rest of this row,
// not a separate join table.
export const fareVehicleConfigs = mysqlTable("fare_vehicle_configs", {
  id: mysqlEnum("id", fareVehicleTypeEnum).primaryKey(),
  label: varchar("label", { length: 80 }).notNull(),
  // Whether this vehicle type can be booked at all — surfaced to riders via
  // UserHome.tsx's isVehicleEnabled(), same role vehiclePricing.enabled
  // played before this table replaced it.
  enabled: boolean("enabled").default(true).notNull(),

  // Section A — Base Fare
  baseFare: decimal("baseFare", { precision: 8, scale: 2 }).notNull(),
  includedDistanceKm: decimal("includedDistanceKm", { precision: 6, scale: 2 }).default("0").notNull(),

  // Section B — Distance Pricing
  perKmCharge: decimal("perKmCharge", { precision: 8, scale: 2 }).notNull(),

  // Section C — Waiting Charges
  freeWaitingMin: int("freeWaitingMin").default(0).notNull(),
  waitingChargePerMin: decimal("waitingChargePerMin", { precision: 8, scale: 2 }).default("0").notNull(),

  // Section D — Time-Based Pricing (Night Charge)
  nightChargeEnabled: boolean("nightChargeEnabled").default(false).notNull(),
  nightChargeStart: varchar("nightChargeStart", { length: 5 }).default("22:00").notNull(), // "HH:MM"
  nightChargeEnd: varchar("nightChargeEnd", { length: 5 }).default("05:00").notNull(),
  nightChargeType: mysqlEnum("nightChargeType", feeTypeEnum).default("percent").notNull(),
  nightChargeValue: decimal("nightChargeValue", { precision: 8, scale: 2 }).default("0").notNull(),

  // Section D — Time-Based Pricing (Peak Hour Charge)
  peakChargeEnabled: boolean("peakChargeEnabled").default(false).notNull(),
  peakChargeStart: varchar("peakChargeStart", { length: 5 }).default("08:00").notNull(),
  peakChargeEnd: varchar("peakChargeEnd", { length: 5 }).default("10:00").notNull(),
  peakChargeType: mysqlEnum("peakChargeType", feeTypeEnum).default("percent").notNull(),
  peakChargeValue: decimal("peakChargeValue", { precision: 8, scale: 2 }).default("0").notNull(),

  // Section E — Weather Pricing (Rain; other conditions can add their own
  // enabled/type/value triplet later without touching this shape)
  rainChargeEnabled: boolean("rainChargeEnabled").default(false).notNull(),
  rainChargeType: mysqlEnum("rainChargeType", feeTypeEnum).default("percent").notNull(),
  rainChargeValue: decimal("rainChargeValue", { precision: 8, scale: 2 }).default("0").notNull(),

  // Section F — Taxes (multiple named entries, each independently enabled)
  taxes: json("taxes").$type<{ id: string; name: string; type: "percent" | "fixed"; value: number; enabled: boolean }[]>().notNull(),

  // Section G — Toll Charges
  tollEnabled: boolean("tollEnabled").default(true).notNull(),
  tollMode: mysqlEnum("tollMode", ["manual", "auto"]).default("manual").notNull(), // "auto" is future support — not computed yet

  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type FareVehicleConfigRow = typeof fareVehicleConfigs.$inferSelect;

// ─── Commission Configuration (per-vehicle-type) ────────────────────────
// Reuses fareVehicleTypeEnum above — same 10-vehicle taxonomy, since the
// redesigned Commission Settings page mirrors Fare Configuration's vehicle
// selector exactly. One row per vehicle type.
export const commissionMethodEnum = ["fixed", "percentage", "slab"] as const;

export const commissionVehicleConfigs = mysqlTable("commission_vehicle_configs", {
  id: mysqlEnum("id", fareVehicleTypeEnum).primaryKey(),
  label: varchar("label", { length: 80 }).notNull(),
  enabled: boolean("enabled").default(true).notNull(),

  // Section A — Commission Method
  method: mysqlEnum("method", commissionMethodEnum).default("percentage").notNull(),

  // Section B — Fixed Commission
  fixedAmount: decimal("fixedAmount", { precision: 8, scale: 2 }).default("5").notNull(),

  // Section C — Percentage Commission
  percentageValue: decimal("percentageValue", { precision: 5, scale: 2 }).default("10").notNull(),

  // Section D — Slab-Based Commission. maxFare null = open-ended ("701+").
  // Validated non-overlapping/ordered at the application layer (both here
  // and client-side) rather than in SQL, same JSON-list pattern
  // fareVehicleConfigs.taxes above uses for small admin-edited lists.
  slabs: json("slabs").$type<{ id: string; minFare: number; maxFare: number | null; type: "fixed" | "percentage"; value: number }[]>().notNull(),

  // Section E — Minimum & Maximum Commission (safety limits, both optional —
  // 0 means "no limit" for min, null means "no limit" for max)
  minCommission: decimal("minCommission", { precision: 8, scale: 2 }).default("0").notNull(),
  maxCommission: decimal("maxCommission", { precision: 8, scale: 2 }),

  // Section G — Advanced Rules (future-ready, off by default)
  applyAfterTax: boolean("applyAfterTax").default(false).notNull(),
  cashOverrideEnabled: boolean("cashOverrideEnabled").default(false).notNull(),
  cashMethod: mysqlEnum("cashMethod", commissionMethodEnum).default("percentage").notNull(),
  cashFixedAmount: decimal("cashFixedAmount", { precision: 8, scale: 2 }).default("5").notNull(),
  cashPercentageValue: decimal("cashPercentageValue", { precision: 5, scale: 2 }).default("10").notNull(),
  onlineOverrideEnabled: boolean("onlineOverrideEnabled").default(false).notNull(),
  onlineMethod: mysqlEnum("onlineMethod", commissionMethodEnum).default("percentage").notNull(),
  onlineFixedAmount: decimal("onlineFixedAmount", { precision: 8, scale: 2 }).default("5").notNull(),
  onlinePercentageValue: decimal("onlinePercentageValue", { precision: 5, scale: 2 }).default("10").notNull(),

  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type CommissionVehicleConfigRow = typeof commissionVehicleConfigs.$inferSelect;

// ─── Cancellation Rules (per-vehicle-type, redesigned) ──────────────────
// Reuses fareVehicleTypeEnum — same 10-vehicle taxonomy as Fare
// Configuration and Commission Settings. Replaces the old global
// cancellationConfig (freeCancellationWindowSec/driverCompensationPercent)
// + per-(8-type)-vehicle vehicleCancellationFees with one much richer
// per-vehicle-type row covering passenger rules, driver rules, no-show,
// auto-cancellation, reasons, and repeated-cancellation policy.
export const cancellationFeeTypeEnum = ["fixed", "percentage"] as const;
export const driverPenaltyTypeEnum = ["fixed", "percentage", "warning"] as const;

export const cancellationVehicleConfigs = mysqlTable("cancellation_vehicle_configs", {
  id: mysqlEnum("id", fareVehicleTypeEnum).primaryKey(),
  label: varchar("label", { length: 80 }).notNull(),

  // Section A — Passenger Cancellation Rules
  passengerCancellationEnabled: boolean("passengerCancellationEnabled").default(true).notNull(),
  passengerFreeCancellationMin: int("passengerFreeCancellationMin").default(2).notNull(),
  passengerFeeType: mysqlEnum("passengerFeeType", cancellationFeeTypeEnum).default("fixed").notNull(),
  passengerFeeFixedAmount: decimal("passengerFeeFixedAmount", { precision: 8, scale: 2 }).default("25").notNull(),
  passengerFeePercentage: decimal("passengerFeePercentage", { precision: 5, scale: 2 }).default("10").notNull(),
  /** null = no cap */
  passengerMaxFee: decimal("passengerMaxFee", { precision: 8, scale: 2 }).default("50"),

  // Section B — Driver Cancellation Rules
  driverCancellationEnabled: boolean("driverCancellationEnabled").default(true).notNull(),
  driverFreeCancellationMin: int("driverFreeCancellationMin").default(1).notNull(),
  driverPenaltyType: mysqlEnum("driverPenaltyType", driverPenaltyTypeEnum).default("warning").notNull(),
  driverPenaltyFixedAmount: decimal("driverPenaltyFixedAmount", { precision: 8, scale: 2 }).default("20").notNull(),
  driverPenaltyPercentage: decimal("driverPenaltyPercentage", { precision: 5, scale: 2 }).default("10").notNull(),

  // Section C — No-Show Rules
  passengerNoShowWaitMin: int("passengerNoShowWaitMin").default(5).notNull(),
  passengerNoShowCharge: decimal("passengerNoShowCharge", { precision: 8, scale: 2 }).default("25").notNull(),
  driverNoShowResponseMin: int("driverNoShowResponseMin").default(10).notNull(),

  // Section D — Auto Cancellation (each rule independently enabled)
  autoCancelDriverAcceptEnabled: boolean("autoCancelDriverAcceptEnabled").default(true).notNull(),
  autoCancelDriverAcceptMin: int("autoCancelDriverAcceptMin").default(5).notNull(),
  autoCancelPassengerConfirmEnabled: boolean("autoCancelPassengerConfirmEnabled").default(false).notNull(),
  autoCancelPassengerConfirmMin: int("autoCancelPassengerConfirmMin").default(3).notNull(),
  autoCancelDriverReachPickupEnabled: boolean("autoCancelDriverReachPickupEnabled").default(false).notNull(),
  autoCancelDriverReachPickupMin: int("autoCancelDriverReachPickupMin").default(20).notNull(),

  // Section E — Cancellation Reasons (order in the array = display/reorder order)
  passengerReasons: json("passengerReasons").$type<{ id: string; label: string; enabled: boolean }[]>().notNull(),
  driverReasons: json("driverReasons").$type<{ id: string; label: string; enabled: boolean }[]>().notNull(),

  // Section F — Repeated Cancellation Policy
  passengerMaxFreeCancellationsPerDay: int("passengerMaxFreeCancellationsPerDay").default(2).notNull(),
  passengerWarningThreshold: int("passengerWarningThreshold").default(3).notNull(),
  passengerRestrictionEnabled: boolean("passengerRestrictionEnabled").default(false).notNull(),
  passengerRestrictionHours: int("passengerRestrictionHours").default(24).notNull(),
  driverMaxDailyCancellations: int("driverMaxDailyCancellations").default(3).notNull(),
  driverWarningThreshold: int("driverWarningThreshold").default(4).notNull(),
  driverRestrictionEnabled: boolean("driverRestrictionEnabled").default(false).notNull(),
  driverRestrictionHours: int("driverRestrictionHours").default(24).notNull(),
  driverAccountReviewThreshold: int("driverAccountReviewThreshold").default(6).notNull(),

  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type CancellationVehicleConfigRow = typeof cancellationVehicleConfigs.$inferSelect;

// ─── School Transport ────────────────────────────────
export const schoolPlans = mysqlTable("school_plans", {
  id: varchar("id", { length: 40 }).primaryKey(),
  name: varchar("name", { length: 60 }).notNull(),
  pricePerMonth: decimal("pricePerMonth", { precision: 8, scale: 2 }).notNull(),
  description: varchar("description", { length: 200 }).notNull(),
  active: boolean("active").default(true).notNull(),
  // Nulled out by upsertPlan whenever pricePerMonth changes — Razorpay plans
  // are immutable, so existing subscriptions correctly keep billing their
  // original price and a fresh Razorpay Plan is created lazily next time one
  // is needed (getOrCreateRazorpayPlan in api/queries/schoolBilling.ts).
  razorpayPlanId: varchar("razorpayPlanId", { length: 60 }),
});

export type SchoolPlanRow = typeof schoolPlans.$inferSelect;

export const schoolSubscriptionStatusEnum = ["pending_review", "reupload_requested", "approved", "rejected", "suspended", "cancelled"] as const;

// Documents/photos are stored as base64 data URIs directly on the record
// (LONGTEXT — can run past the 64KB TEXT limit), same pattern
// app_notifications.bannerUrl uses.
export const schoolSubscriptions = mysqlTable("school_subscriptions", {
  id: varchar("id", { length: 60 }).primaryKey(),
  guardianPhone: varchar("guardianPhone", { length: 20 }).notNull(),
  guardianName: varchar("guardianName", { length: 80 }).notNull(),
  guardianPhotoUrl: longtext("guardianPhotoUrl"),
  guardianEmail: varchar("guardianEmail", { length: 120 }).default("").notNull(),
  emergencyContact: varchar("emergencyContact", { length: 20 }).notNull(),
  studentName: varchar("studentName", { length: 80 }).notNull(),
  studentPhotoUrl: longtext("studentPhotoUrl"),
  studentIdPhotoUrl: longtext("studentIdPhotoUrl"),
  schoolName: varchar("schoolName", { length: 120 }).notNull(),
  schoolAddress: varchar("schoolAddress", { length: 200 }).notNull(),
  // Real school office contact — replaces a hardcoded fake number that used
  // to sit in the app's "call school" button regardless of which school a
  // family actually subscribed for.
  schoolPhone: varchar("schoolPhone", { length: 20 }).default("").notNull(),
  className: varchar("className", { length: 20 }).notNull(),
  section: varchar("section", { length: 10 }).default("").notNull(),
  rollNumber: varchar("rollNumber", { length: 30 }).default("").notNull(),
  homeAddress: varchar("homeAddress", { length: 200 }).notNull(),
  pickupCoords: json("pickupCoords").$type<{ lat: number; lng: number }>().notNull(),
  dropCoords: json("dropCoords").$type<{ lat: number; lng: number }>().notNull(),
  morningPickupTime: varchar("morningPickupTime", { length: 10 }).notNull(),
  schoolReportingTime: varchar("schoolReportingTime", { length: 10 }).notNull(),
  schoolEndTime: varchar("schoolEndTime", { length: 10 }).notNull(),
  returnPickupTime: varchar("returnPickupTime", { length: 10 }).notNull(),
  medicalNotes: varchar("medicalNotes", { length: 500 }).default("").notNull(),
  allergies: varchar("allergies", { length: 300 }).default("").notNull(),
  specialInstructions: varchar("specialInstructions", { length: 500 }).default("").notNull(),
  authorizedPickupPersons: json("authorizedPickupPersons").$type<string[]>().default([]).notNull(),
  planId: varchar("planId", { length: 40 }).notNull(),
  consentAccepted: boolean("consentAccepted").notNull(),
  status: mysqlEnum("status", schoolSubscriptionStatusEnum).default("pending_review").notNull(),
  adminNote: varchar("adminNote", { length: 300 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  verifiedAt: timestamp("verifiedAt"),
  assignedDriverName: varchar("assignedDriverName", { length: 80 }),
  assignedVehicle: varchar("assignedVehicle", { length: 120 }),
  // Real driver account (users.id), same convention as rides.driverId — lets
  // the guardian's live-location view join to driverProfiles.currentLat/Lng
  // instead of the assignedDriverName/assignedVehicle text fields above,
  // which only ever held display copy, never a real identity.
  assignedDriverId: bigint("assignedDriverId", { mode: "number", unsigned: true }).references(() => users.id),
  pickupPin: varchar("pickupPin", { length: 4 }).notNull(),
  dropPin: varchar("dropPin", { length: 4 }).notNull(),
  paymentStatus: mysqlEnum("paymentStatus", ["unpaid", "paid", "overdue"]).default("unpaid").notNull(),
  validTill: date("validTill", { mode: "string" }).notNull(),
  autoRenew: boolean("autoRenew").default(true).notNull(),
  // Real account (users.id), server-derived from ctx.user.id only — never
  // client-supplied. Nullable because pre-existing rows predate real auth on
  // this router; every row created through the onboarding wizard has one.
  // Replaces guardianPhone as the authoritative "does this user own this
  // subscription" check (BottomNav's nav-swap, ownership-gated mutations).
  guardianUserId: bigint("guardianUserId", { mode: "number", unsigned: true }).references(() => users.id),
  routeId: varchar("routeId", { length: 60 }),
  // ── Razorpay Subscriptions billing (see api/queries/schoolBilling.ts) ──
  // One real Razorpay Subscription per child — each row already has its own
  // independent pause/cancel/upgrade today, so a shared subscription across
  // siblings would need fake partial-pause logic Razorpay doesn't support.
  razorpayPlanId: varchar("razorpayPlanId", { length: 60 }),
  razorpaySubscriptionId: varchar("razorpaySubscriptionId", { length: 60 }).unique(),
  // Mirrors Razorpay's own subscription.status verbatim — webhook-driven
  // only, never set by any other code path.
  razorpaySubscriptionStatus: varchar("razorpaySubscriptionStatus", { length: 20 }),
  paymentFailedAt: timestamp("paymentFailedAt"),
  graceEndsAt: date("graceEndsAt", { mode: "string" }),
  suspendedReason: mysqlEnum("suspendedReason", ["admin", "nonpayment"]),
  backupDriverId: bigint("backupDriverId", { mode: "number", unsigned: true }).references(() => users.id),
  backupDriverName: varchar("backupDriverName", { length: 80 }),
  backupVehicle: varchar("backupVehicle", { length: 120 }),
});

export type SchoolSubscriptionRow = typeof schoolSubscriptions.$inferSelect;

export const schoolTrips = mysqlTable("school_trips", {
  id: varchar("id", { length: 100 }).primaryKey(),
  subscriptionId: varchar("subscriptionId", { length: 60 }).notNull(),
  date: date("date", { mode: "string" }).notNull(),
  direction: mysqlEnum("direction", ["morning", "evening"]).notNull(),
  stageIndex: int("stageIndex").default(-1).notNull(),
  stageHistory: json("stageHistory").$type<{ stage: string; timestamp: number }[]>().default([]).notNull(),
  driverName: varchar("driverName", { length: 80 }).default("").notNull(),
  vehicle: varchar("vehicle", { length: 120 }).default("").notNull(),
  pickupPinVerified: boolean("pickupPinVerified").default(false).notNull(),
  dropPinVerified: boolean("dropPinVerified").default(false).notNull(),
  // Set when getOrCreateTodayTrip finds a matching schoolSkipRequests row for
  // this date — the guardian paused pickup for the day, so no stage timeline
  // should render.
  skipped: boolean("skipped").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SchoolTripRow = typeof schoolTrips.$inferSelect;

// Guardian-initiated "no pickup needed on this date" — distinct from
// schoolCalendarEvents below (admin-published, transport-wide holidays).
// Effective immediately, no admin approval, same as pauseSubscription.
export const schoolSkipRequests = mysqlTable("school_skip_requests", {
  id: varchar("id", { length: 60 }).primaryKey(),
  subscriptionId: varchar("subscriptionId", { length: 60 }).notNull(),
  date: date("date", { mode: "string" }).notNull(),
  reason: varchar("reason", { length: 300 }).default("").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SchoolSkipRequestRow = typeof schoolSkipRequests.$inferSelect;

export const schoolCalendarEvents = mysqlTable("school_calendar_events", {
  id: varchar("id", { length: 40 }).primaryKey(),
  date: date("date", { mode: "string" }).notNull(),
  type: mysqlEnum("type", ["holiday", "exam", "half_day", "event", "transport_closed"]).notNull(),
  title: varchar("title", { length: 100 }).notNull(),
});

export type SchoolCalendarEventRow = typeof schoolCalendarEvents.$inferSelect;

export const schoolTimingRequests = mysqlTable("school_timing_requests", {
  id: varchar("id", { length: 40 }).primaryKey(),
  subscriptionId: varchar("subscriptionId", { length: 60 }).notNull(),
  field: mysqlEnum("field", ["morningPickupTime", "schoolReportingTime", "schoolEndTime", "returnPickupTime"]).notNull(),
  requestedValue: varchar("requestedValue", { length: 10 }).notNull(),
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SchoolTimingRequestRow = typeof schoolTimingRequests.$inferSelect;

// Real replacement for AdminSchoolTransport.tsx's mock initialRoutes/
// mockDrivers local arrays. Billing stays 100% per-child via schoolPlans —
// monthlyFee here is a reference/reporting figure only, never charged.
export const schoolRoutes = mysqlTable("school_routes", {
  id: varchar("id", { length: 60 }).primaryKey(),
  name: varchar("name", { length: 80 }).notNull(),
  vehicleLabel: varchar("vehicleLabel", { length: 120 }).default("").notNull(),
  stops: json("stops").$type<string[]>().default([]).notNull(),
  primaryDriverId: bigint("primaryDriverId", { mode: "number", unsigned: true }).references(() => users.id),
  backupDriverId: bigint("backupDriverId", { mode: "number", unsigned: true }).references(() => users.id),
  monthlyFee: decimal("monthlyFee", { precision: 8, scale: 2 }).default("0").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SchoolRouteRow = typeof schoolRoutes.$inferSelect;

// Real invoice/payment ledger for school billing — replaces reading generic
// walletTransactions by sourceRecordId. Populated only from webhook-verified
// Razorpay events (api/queries/schoolBilling.ts), never client-writable.
export const schoolPaymentEvents = mysqlTable("school_payment_events", {
  id: varchar("id", { length: 60 }).primaryKey(),
  subscriptionId: varchar("subscriptionId", { length: 60 }).notNull(),
  razorpayPaymentId: varchar("razorpayPaymentId", { length: 60 }),
  razorpayInvoiceId: varchar("razorpayInvoiceId", { length: 60 }),
  amount: decimal("amount", { precision: 8, scale: 2 }).notNull(),
  status: mysqlEnum("status", ["captured", "failed"]).notNull(),
  failureReason: varchar("failureReason", { length: 300 }),
  // Raw Razorpay unix-seconds timestamp, stored as-is — deliberately NOT a
  // JS Date column. Any JS Date passed into a drizzle query mismatches this
  // MySQL session's timezone (see dispatchWorker.ts) and this table only
  // needs to display the value, never filter "now"-relative by it.
  occurredAt: bigint("occurredAt", { mode: "number" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SchoolPaymentEventRow = typeof schoolPaymentEvents.$inferSelect;

// Webhook idempotency + audit log. id = sha256(rawBody) hex — Razorpay
// retries an identical payload on any non-2xx response, so hashing the raw
// body IS the dedupe key; no reliance on a Razorpay-supplied event id.
export const razorpayWebhookEvents = mysqlTable("razorpay_webhook_events", {
  id: varchar("id", { length: 64 }).primaryKey(),
  eventType: varchar("eventType", { length: 60 }).notNull(),
  subscriptionId: varchar("subscriptionId", { length: 60 }),
  payload: longtext("payload").notNull(),
  processedAt: timestamp("processedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type RazorpayWebhookEventRow = typeof razorpayWebhookEvents.$inferSelect;

// Admin-editable school billing tuning — single row (id always 1), same
// convention as dispatchSettings/fareEngineConfig.
export const schoolBillingSettings = mysqlTable("school_billing_settings", {
  id: serial("id").primaryKey(),
  gracePeriodDays: int("gracePeriodDays").default(3).notNull(),
  totalBillingCycles: int("totalBillingCycles").default(60).notNull(),
  nightlyGenerationHour: int("nightlyGenerationHour").default(20).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type SchoolBillingSettings = typeof schoolBillingSettings.$inferSelect;

// ─── Complaints & Support Tickets ────────────────────
// Keyed by name/phone, same convention as every other router this session —
// the app has no real per-account identity outside the display name/phone
// used across the demo. Distinct from the unused FK-based `complaints`
// table above, which predates this and was never wired to the admin UI.
export const appComplaintStatusEnum = ["Open", "In Progress", "Resolved", "Closed"] as const;

export const appComplaints = mysqlTable("app_complaints", {
  id: varchar("id", { length: 20 }).primaryKey(),
  subject: varchar("subject", { length: 200 }).notNull(),
  description: text("description").notNull(),
  reporterName: varchar("reporterName", { length: 80 }).notNull(),
  reporterPhone: varchar("reporterPhone", { length: 20 }).notNull(),
  reporterType: mysqlEnum("reporterType", ["Customer", "Driver"]).notNull(),
  relatedRideId: varchar("relatedRideId", { length: 30 }),
  status: mysqlEnum("status", appComplaintStatusEnum).default("Open").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AppComplaintRow = typeof appComplaints.$inferSelect;

export const complaintMessages = mysqlTable("complaint_messages", {
  id: serial("id").primaryKey(),
  complaintId: varchar("complaintId", { length: 20 }).notNull(),
  sender: mysqlEnum("sender", ["admin", "reporter"]).notNull(),
  text: varchar("text", { length: 1000 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ComplaintMessageRow = typeof complaintMessages.$inferSelect;

// ─── Emergency SOS ───────────────────────────────────
// Real, persisted alerts — replaces the tel:-link-only "SOS" buttons
// scattered across SchoolDashboard/DriverSchoolMode/UserSafety, none of
// which ever recorded that an alert happened. Generic across rider/driver
// and school/non-school contexts (subscriptionId is optional).
export const sosAlerts = mysqlTable("sos_alerts", {
  id: varchar("id", { length: 60 }).primaryKey(),
  userId: bigint("userId", { mode: "number", unsigned: true })
    .notNull()
    .references(() => users.id),
  role: mysqlEnum("role", ["user", "driver"]).notNull(),
  subscriptionId: varchar("subscriptionId", { length: 60 }),
  lat: decimal("lat", { precision: 10, scale: 8 }),
  lng: decimal("lng", { precision: 11, scale: 8 }),
  note: varchar("note", { length: 300 }).default("").notNull(),
  status: mysqlEnum("status", ["open", "resolved"]).default("open").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  resolvedAt: timestamp("resolvedAt"),
});

export type SosAlertRow = typeof sosAlerts.$inferSelect;

// ─── Advertising ─────────────────────────────────────
// Replaces the old AdCampaignsContext in-memory React state (reset to the
// same 4 seed campaigns on every reload) with real, persistent campaigns.
export const adCampaignAdTypeEnum = ["In-App Banner", "Driver Screen", "Vehicle Wrap"] as const;
export const adCampaignStatusEnum = ["pending", "active", "paused", "ended", "rejected"] as const;

export const adCampaigns = mysqlTable("ad_campaigns", {
  id: varchar("id", { length: 40 }).primaryKey(),
  advertiserName: varchar("advertiserName", { length: 120 }).notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  adType: mysqlEnum("adType", adCampaignAdTypeEnum).notNull(),
  targetArea: varchar("targetArea", { length: 200 }).notNull(),
  budget: decimal("budget", { precision: 10, scale: 2 }).notNull(),
  spent: decimal("spent", { precision: 10, scale: 2 }).default("0").notNull(),
  impressions: int("impressions").default(0).notNull(),
  clicks: int("clicks").default(0).notNull(),
  startDate: varchar("startDate", { length: 10 }).notNull(),
  endDate: varchar("endDate", { length: 10 }).notNull(),
  status: mysqlEnum("status", adCampaignStatusEnum).default("pending").notNull(),
  creativeColor: varchar("creativeColor", { length: 10 }).notNull(),
  // Real driver user ids (users.id, stringified) — not the old "d1".."d5"
  // mock roster ids.
  allottedDriverIds: json("allottedDriverIds").$type<string[]>().default([]).notNull(),
  cpm: decimal("cpm", { precision: 8, scale: 2 }).default("0").notNull(),
  cpc: decimal("cpc", { precision: 8, scale: 2 }).default("0").notNull(),
  vehicleCount: int("vehicleCount").default(0).notNull(),
  slotSeconds: int("slotSeconds").default(0).notNull(),
  driverSharePercent: int("driverSharePercent").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AdCampaignRow = typeof adCampaigns.$inferSelect;

// ─── Subscription Plans (Flying Plus) ────────────────
// Fixed catalog (free/silver/gold/corporate) — admin edits price/perks/
// category/active in place; riders pick one via users.subscriptionPlanId.
export const subscriptionPlanCategoryEnum = ["Individual", "Corporate"] as const;

export const subscriptionPlans = mysqlTable("subscription_plans", {
  id: varchar("id", { length: 40 }).primaryKey(),
  name: varchar("name", { length: 60 }).notNull(),
  price: decimal("price", { precision: 8, scale: 2 }),
  period: varchar("period", { length: 30 }).default("").notNull(),
  perks: json("perks").$type<string[]>().default([]).notNull(),
  category: mysqlEnum("category", subscriptionPlanCategoryEnum).default("Individual").notNull(),
  active: boolean("active").default(true).notNull(),
});

// A rider applying for the "Corporate" plan above previously hit a dead
// "Contact Sales" button with no onClick — this is the real workflow behind
// it: apply with company details, admin approves/rejects, same
// pending→approved shape schoolSubscriptions already uses. Once active,
// BottomNav.tsx's dynamic nav swap picks this up (School > Corporate >
// RidePass priority).
export const corporateMemberships = mysqlTable("corporate_memberships", {
  id: serial("id").primaryKey(),
  userId: bigint("userId", { mode: "number", unsigned: true })
    .notNull()
    .references(() => users.id)
    .unique(),
  companyName: varchar("companyName", { length: 150 }).notNull(),
  gstin: varchar("gstin", { length: 20 }),
  contactPerson: varchar("contactPerson", { length: 100 }).notNull(),
  contactPhone: varchar("contactPhone", { length: 15 }).notNull(),
  status: mysqlEnum("status", ["pending", "active", "rejected"]).default("pending").notNull(),
  adminNote: varchar("adminNote", { length: 500 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  approvedAt: timestamp("approvedAt"),
});

export type CorporateMembership = typeof corporateMemberships.$inferSelect;

// ─── Razorpay Orders ──────────────────────────────────
// Real, persisted order tracking — replaces the old in-memory Map that lost
// every in-flight order on a server restart (verifyPayment would reject a
// legitimate checkout with "Unknown Razorpay order" if the process
// restarted between order creation and the user completing checkout).
export const razorpayOrders = mysqlTable("razorpay_orders", {
  orderId: varchar("orderId", { length: 60 }).primaryKey(),
  amount: int("amount").notNull(), // paise
  currency: varchar("currency", { length: 10 }).notNull(),
  receipt: varchar("receipt", { length: 100 }).notNull(),
  verifiedPaymentId: varchar("verifiedPaymentId", { length: 60 }),
  verifiedAt: timestamp("verifiedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type RazorpayOrderRow = typeof razorpayOrders.$inferSelect;

export type SubscriptionPlanRow = typeof subscriptionPlans.$inferSelect;

// ─── Home Panel Content (singleton) ──────────────────────
// Admin-editable content for the rider Home screen's pull-up panel — was
// previously pure in-memory React state (HomeContentContext.tsx) that reset
// on every refresh and never reached the rider app. Same singleton pattern
// as financeSettings/commission config (id is always 1).
export const homeContentSettings = mysqlTable("home_content_settings", {
  id: serial("id").primaryKey(),
  promoSlides: json("promoSlides").$type<{
    id: string; title: string; subtitle: string; cta: string;
    icon: "Crown" | "GraduationCap" | "Package" | "Users" | "Sparkles" | "Megaphone" | "Gift" | "Car";
    colorFrom: string; colorTo: string; destination: string; enabled: boolean;
  }[]>().notNull(),
  offerTeasers: json("offerTeasers").$type<{
    id: string; title: string; subtitle: string; color: string; bg: string; enabled: boolean;
  }[]>().notNull(),
  nearbyServices: json("nearbyServices").$type<{
    id: string; label: string;
    icon: "Cross" | "Shield" | "ParkingCircle" | "BatteryCharging" | "MapPin" | "Star";
    enabled: boolean;
  }[]>().notNull(),
  quickTiles: json("quickTiles").$type<{
    id: "schoolPass" | "sendParcel" | "referEarn" | "support"; label: string; enabled: boolean;
  }[]>().notNull(),
  rideTypes: json("rideTypes").$type<{
    id: "share" | "reserve" | "auto" | "women" | "school" | "corporate" | "schedule"; label: string; enabled: boolean;
  }[]>().notNull(),
});

export type HomeContentSettingsRow = typeof homeContentSettings.$inferSelect;
