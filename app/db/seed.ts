import { getDb } from "../api/queries/connection";
import {
  users,
  driverProfiles,
  rides,
  coupons,
  fareSettings,
  complaints,
} from "./schema";

async function seed() {
  const db = getDb();

  // Seed fare settings
  await db.insert(fareSettings).values({
    baseFare: "20",
    perKmRate: "12",
    shareMultiplier: "0.60",
    reserveMultiplier: "1.30",
    commissionPerRide: "2.00",
    minFare: "20",
  });

  // Seed coupons
  await db.insert(coupons).values([
    {
      code: "FLYRIDE20",
      description: "Get \u20b920 off on min booking",
      discountType: "flat",
      discountValue: "20",
      minBooking: "100",
      validFrom: "2024-01-01",
      validTill: "2025-12-31",
      isActive: true,
    },
    {
      code: "FLY50",
      description: "Get \u20b950 off on your first ride",
      discountType: "flat",
      discountValue: "50",
      minBooking: "50",
      validFrom: "2024-01-01",
      validTill: "2025-12-31",
      isActive: true,
    },
    {
      code: "INDIA20",
      description: "Get 20% off on rides",
      discountType: "percentage",
      discountValue: "20",
      minBooking: "80",
      maxDiscount: "100",
      validFrom: "2024-01-01",
      validTill: "2025-12-31",
      isActive: true,
    },
    {
      code: "WELCOME10",
      description: "Get \u20b910 off for new users",
      discountType: "flat",
      discountValue: "10",
      minBooking: "30",
      validFrom: "2024-01-01",
      validTill: "2025-12-31",
      isActive: true,
    },
  ]);

  console.log("Seed completed successfully!");
}

seed().catch(console.error);
