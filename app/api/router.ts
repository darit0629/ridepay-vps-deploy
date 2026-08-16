import { authRouter } from "./auth-router";
import { userRouter } from "./user-router";
import { driverRouter } from "./driver-router";
import { rideRouter } from "./ride-router";
import { couponRouter } from "./coupon-router";
import { complaintRouter } from "./complaint-router";
import { adminRouter } from "./admin-router";
import { aiRouter } from "./ai-router";
import { notificationRouter } from "./notification-router";
import { parcelRouter } from "./parcel-router";
import { fareRouter } from "./fare-router";
import { commissionRouter } from "./commission-router";
import { settlementRouter } from "./settlement-router";
import { referralRouter } from "./referral-router";
import { cancellationRouter } from "./cancellation-router";
import { zoneRouter } from "./zone-router";
import { schoolRouter } from "./school-router";
import { schoolBillingRouter } from "./school-billing-router";
import { razorpayRouter } from "./razorpay-router";
import { adRouter } from "./ad-router";
import { plansRouter } from "./plans-router";
import { scheduleRouter } from "./schedule-router";
import { rentalRouter } from "./rental-router";
import { corporateRouter } from "./corporate-router";
import { sosRouter } from "./sos-router";
import { dispatchRouter } from "./dispatch-router";
import { routeRestrictionRouter } from "./route-restriction-router";
import { homeContentRouter } from "./home-content-router";
import { adminSearchRouter } from "./admin-search-router";
import { createRouter, publicQuery } from "./middleware";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,
  user: userRouter,
  driver: driverRouter,
  ride: rideRouter,
  coupon: couponRouter,
  complaint: complaintRouter,
  admin: adminRouter,
  ai: aiRouter,
  notification: notificationRouter,
  parcel: parcelRouter,
  fare: fareRouter,
  commission: commissionRouter,
  settlement: settlementRouter,
  referral: referralRouter,
  cancellation: cancellationRouter,
  zone: zoneRouter,
  school: schoolRouter,
  schoolBilling: schoolBillingRouter,
  razorpay: razorpayRouter,
  ad: adRouter,
  plans: plansRouter,
  schedule: scheduleRouter,
  rental: rentalRouter,
  corporate: corporateRouter,
  sos: sosRouter,
  dispatch: dispatchRouter,
  routeRestriction: routeRestrictionRouter,
  homeContent: homeContentRouter,
  adminSearch: adminSearchRouter,
});

export type AppRouter = typeof appRouter;
