import { Routes, Route } from "react-router";
import MarketingLanding from "./pages/MarketingLanding";
import ComingSoon from "./pages/ComingSoon";
import Landing from "./pages/Landing";
import VideoIntro from "./pages/VideoIntro";
import Login from "./pages/Login";
import AdminLogin from "./pages/AdminLogin";
import Register from "./pages/Register";
import UserHome from "./pages/user/UserHome";
import UserHistory from "./pages/user/UserHistory";
import UserOffers from "./pages/user/UserOffers";
import UserRefer from "./pages/user/UserRefer";
import UserMyReferrals from "./pages/user/UserMyReferrals";
import UserSupport from "./pages/user/UserSupport";
import UserAIChat from "./pages/user/UserAIChat";
import UserProfile from "./pages/user/UserProfile";
import UserSubscription from "./pages/user/UserSubscription";
import UserCorporateDashboard from "./pages/user/UserCorporateDashboard";
import UserWallet from "./pages/user/UserWallet";
import UserStudentPass from "./pages/user/UserStudentPass";
import SchoolSubscribe from "./pages/user/SchoolSubscribe";
import SchoolOnboardingWizard from "./pages/user/school-onboarding/SchoolOnboardingWizard";
import SchoolDashboard from "./pages/user/SchoolDashboard";
import DriverSchoolMode from "./pages/driver/DriverSchoolMode";
import SchoolTripHistory from "./pages/user/SchoolTripHistory";
import SchoolTransportId from "./pages/user/SchoolTransportId";
import UserSafety from "./pages/user/UserSafety";
import TripShare from "./pages/TripShare";
import ParcelTrack from "./pages/ParcelTrack";
import PrivacySettings from "./pages/PrivacySettings";
import UserScheduleRide from "./pages/user/UserScheduleRide";
import UserServices from "./pages/user/UserServices";
import UserRoundTrip from "./pages/user/UserRoundTrip";
import UserWaitReturn from "./pages/user/UserWaitReturn";
import UserHourlyRental from "./pages/user/UserHourlyRental";
import UserFullDayRental from "./pages/user/UserFullDayRental";
import UserMultiStop from "./pages/user/UserMultiStop";
import UserSettings from "./pages/user/UserSettings";
import UserNotifications from "./pages/user/UserNotifications";
import DriverOnboarding from "./pages/driver/onboarding/DriverOnboarding";
import DriverDashboard from "./pages/driver/DriverDashboard";
import DriverRideRequest from "./pages/driver/DriverRideRequest";
import DriverPickup from "./pages/driver/DriverPickup";
import DriverDropoff from "./pages/driver/DriverDropoff";
import DriverWaiting from "./pages/driver/DriverWaiting";
import DriverRentalActive from "./pages/driver/DriverRentalActive";
import DriverEndRide from "./pages/driver/DriverEndRide";
import DriverEarnings from "./pages/driver/DriverEarnings";
import DriverWallet from "./pages/driver/DriverWallet";
import DriverRewards from "./pages/driver/DriverRewards";
import DriverDemandMap from "./pages/driver/DriverDemandMap";
import DriverAdOptIn from "./pages/driver/DriverAdOptIn";
import DriverTrips from "./pages/driver/DriverTrips";
import DriverTripDetail from "./pages/driver/DriverTripDetail";
import DriverSupport from "./pages/driver/DriverSupport";
import DriverSettings from "./pages/driver/DriverSettings";
import DriverProfile from "./pages/driver/DriverProfile";
import DriverVehicleHealth from "./pages/driver/DriverVehicleHealth";
import DriverReferral from "./pages/driver/DriverReferral";
import DriverMyReferrals from "./pages/driver/DriverMyReferrals";
import DriverAIChat from "./pages/driver/DriverAIChat";
import DriverNotifications from "./pages/driver/DriverNotifications";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminTracking from "./pages/admin/AdminTracking";
import AdminDispatchAI from "./pages/admin/AdminDispatchAI";
import AdminDrivers from "./pages/admin/AdminDrivers";
import AdminDriverDetail from "./pages/admin/AdminDriverDetail";
import AdminCustomers from "./pages/admin/AdminCustomers";
import AdminRides from "./pages/admin/AdminRides";
import AdminRideDetail from "./pages/admin/AdminRideDetail";
import AdminComplaints from "./pages/admin/AdminComplaints";
import AdminComplaintDetail from "./pages/admin/AdminComplaintDetail";
import AdminFinancials from "./pages/admin/AdminFinancials";
import AdminTransactions from "./pages/admin/AdminTransactions";
import AdminOffers from "./pages/admin/AdminOffers";
import AdminSubscriptions from "./pages/admin/AdminSubscriptions";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminFareConfiguration from "./pages/admin/AdminFareConfiguration";
import AdminRentalPricing from "./pages/admin/AdminRentalPricing";
import AdminCommissionSettings from "./pages/admin/AdminCommissionSettings";
import AdminSettlementCenter from "./pages/admin/AdminSettlementCenter";
import AdminReferralProgram from "./pages/admin/AdminReferralProgram";
import AdminCancellationRules from "./pages/admin/AdminCancellationRules";
import AdminSurgePricing from "./pages/admin/AdminSurgePricing";
import AdminZonePricing from "./pages/admin/AdminZonePricing";
import AdminReports from "./pages/admin/AdminReports";
import AdminAdvertising from "./pages/admin/AdminAdvertising";
import AdminHomePanel from "./pages/admin/AdminHomePanel";
import AdminSchoolTransport from "./pages/admin/AdminSchoolTransport";
import AdminSchoolBilling from "./pages/admin/AdminSchoolBilling";
import AdminScheduleDashboard from "./pages/admin/AdminScheduleDashboard";
import AdminDispatchBoard from "./pages/admin/AdminDispatchBoard";
import AdminRouteRestrictions from "./pages/admin/AdminRouteRestrictions";
import AdminBlockRoute from "./pages/admin/AdminBlockRoute";
import AdminRouteRestrictionDetail from "./pages/admin/AdminRouteRestrictionDetail";
import AdminNotifications from "./pages/admin/AdminNotifications";
import ParentTracking from "./pages/school/ParentTracking";
import AdvertiserDashboard from "./pages/advertiser/AdvertiserDashboard";
import AdvertiserCampaignDetail from "./pages/advertiser/AdvertiserCampaignDetail";
import PrivacyPolicy from "./pages/legal/PrivacyPolicy";
import TermsAndConditions from "./pages/legal/TermsAndConditions";
import CancellationPolicy from "./pages/legal/CancellationPolicy";
import RefundPolicy from "./pages/legal/RefundPolicy";
import CommunityGuidelines from "./pages/legal/CommunityGuidelines";
import SafetyPolicy from "./pages/legal/SafetyPolicy";
import DriverAgreement from "./pages/legal/DriverAgreement";
import DataDeletionPolicy from "./pages/legal/DataDeletionPolicy";
import CookiePolicy from "./pages/legal/CookiePolicy";
import AccountDelete from "./pages/AccountDelete";
import HelpCenter from "./pages/HelpCenter";
import FAQ from "./pages/FAQ";
import ReportIssue from "./pages/ReportIssue";
import AboutRidepay from "./pages/AboutRidepay";
import NotFound from "./pages/NotFound";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<MarketingLanding />} />
      <Route path="/coming-soon" element={<ComingSoon />} />
      <Route path="/app" element={<Landing />} />
      <Route path="/intro" element={<VideoIntro />} />
      <Route path="/login" element={<Login />} />
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/register" element={<Register />} />
      <Route path="/trip/live/:id" element={<TripShare />} />
      <Route path="/track/:trackingId" element={<ParcelTrack />} />
      <Route path="/user/privacy" element={<PrivacySettings />} />

      {/* Legal & Compliance (shared across roles) */}
      <Route path="/legal/privacy-policy" element={<PrivacyPolicy />} />
      <Route path="/legal/terms" element={<TermsAndConditions />} />
      <Route path="/legal/cancellation-policy" element={<CancellationPolicy />} />
      <Route path="/legal/refund-policy" element={<RefundPolicy />} />
      <Route path="/legal/community-guidelines" element={<CommunityGuidelines />} />
      <Route path="/legal/safety-policy" element={<SafetyPolicy />} />
      <Route path="/legal/driver-agreement" element={<DriverAgreement />} />
      <Route path="/legal/data-deletion" element={<DataDeletionPolicy />} />
      <Route path="/legal/cookie-policy" element={<CookiePolicy />} />
      <Route path="/account/delete" element={<AccountDelete />} />
      <Route path="/help" element={<HelpCenter />} />
      <Route path="/help/faq" element={<FAQ />} />
      <Route path="/help/report-issue" element={<ReportIssue />} />
      <Route path="/about" element={<AboutRidepay />} />

      {/* User Routes */}
      <Route path="/user/home" element={<UserHome />} />
      <Route path="/user/history" element={<UserHistory />} />
      <Route path="/user/offers" element={<UserOffers />} />
      <Route path="/user/refer" element={<UserRefer />} />
      <Route path="/user/my-referrals" element={<UserMyReferrals />} />
      <Route path="/user/support" element={<UserSupport />} />
      <Route path="/user/ai-chat" element={<UserAIChat />} />
      <Route path="/user/profile" element={<UserProfile />} />
      <Route path="/user/subscription" element={<UserSubscription />} />
      <Route path="/user/corporate" element={<UserCorporateDashboard />} />
      <Route path="/user/wallet" element={<UserWallet />} />
      <Route path="/user/student-pass" element={<UserStudentPass />} />
      <Route path="/user/school-subscribe" element={<SchoolSubscribe />} />
      <Route path="/user/school-onboarding" element={<SchoolOnboardingWizard />} />
      <Route path="/user/school-dashboard/:id" element={<SchoolDashboard />} />
      <Route path="/driver/school-mode" element={<DriverSchoolMode />} />
      <Route path="/user/school-history/:id" element={<SchoolTripHistory />} />
      <Route path="/user/school-id/:id" element={<SchoolTransportId />} />
      <Route path="/user/safety" element={<UserSafety />} />
      <Route path="/user/schedule" element={<UserScheduleRide />} />
      <Route path="/user/services" element={<UserServices />} />
      <Route path="/user/round-trip" element={<UserRoundTrip />} />
      <Route path="/user/wait-return" element={<UserWaitReturn />} />
      <Route path="/user/hourly-rental" element={<UserHourlyRental />} />
      <Route path="/user/full-day-rental" element={<UserFullDayRental />} />
      <Route path="/user/multi-stop" element={<UserMultiStop />} />
      <Route path="/user/settings" element={<UserSettings />} />
      <Route path="/user/notifications" element={<UserNotifications />} />

      {/* Driver Routes */}
      <Route path="/driver/onboarding" element={<DriverOnboarding />} />
      <Route path="/driver/dashboard" element={<DriverDashboard />} />
      <Route path="/driver/ride-request" element={<DriverRideRequest />} />
      <Route path="/driver/ride-pickup" element={<DriverPickup />} />
      <Route path="/driver/ride-dropoff" element={<DriverDropoff />} />
      <Route path="/driver/waiting" element={<DriverWaiting />} />
      <Route path="/driver/rental-active" element={<DriverRentalActive />} />
      <Route path="/driver/end-ride" element={<DriverEndRide />} />
      <Route path="/driver/earnings" element={<DriverEarnings />} />
      <Route path="/driver/wallet" element={<DriverWallet />} />
      <Route path="/driver/rewards" element={<DriverRewards />} />
      <Route path="/driver/demand-map" element={<DriverDemandMap />} />
      <Route path="/driver/ad-optin" element={<DriverAdOptIn />} />
      <Route path="/driver/trips" element={<DriverTrips />} />
      <Route path="/driver/trips/:id" element={<DriverTripDetail />} />
      <Route path="/driver/support" element={<DriverSupport />} />
      <Route path="/driver/settings" element={<DriverSettings />} />
      <Route path="/driver/profile" element={<DriverProfile />} />
      <Route path="/driver/vehicle-health" element={<DriverVehicleHealth />} />
      <Route path="/driver/referral" element={<DriverReferral />} />
      <Route path="/driver/my-referrals" element={<DriverMyReferrals />} />
      <Route path="/driver/ai-chat" element={<DriverAIChat />} />
      <Route path="/driver/notifications" element={<DriverNotifications />} />

      {/* Admin Routes */}
      <Route path="/admin/dashboard" element={<AdminDashboard />} />
      <Route path="/admin/tracking" element={<AdminTracking />} />
      <Route path="/admin/dispatch-ai" element={<AdminDispatchAI />} />
      <Route path="/admin/drivers" element={<AdminDrivers />} />
      <Route path="/admin/drivers/:id" element={<AdminDriverDetail />} />
      <Route path="/admin/customers" element={<AdminCustomers />} />
      <Route path="/admin/rides" element={<AdminRides />} />
      <Route path="/admin/rides/:id" element={<AdminRideDetail />} />
      <Route path="/admin/complaints" element={<AdminComplaints />} />
      <Route path="/admin/complaints/:id" element={<AdminComplaintDetail />} />
      <Route path="/admin/financials" element={<AdminFinancials />} />
      <Route path="/admin/transactions" element={<AdminTransactions />} />
      <Route path="/admin/offers" element={<AdminOffers />} />
      <Route path="/admin/subscriptions" element={<AdminSubscriptions />} />
      <Route path="/admin/settings" element={<AdminSettings />} />
      <Route path="/admin/fare-configuration" element={<AdminFareConfiguration />} />
      <Route path="/admin/rental-pricing" element={<AdminRentalPricing />} />
      <Route path="/admin/commission-settings" element={<AdminCommissionSettings />} />
      <Route path="/admin/settlement-center" element={<AdminSettlementCenter />} />
      <Route path="/admin/referral-program" element={<AdminReferralProgram />} />
      <Route path="/admin/cancellation-rules" element={<AdminCancellationRules />} />
      <Route path="/admin/surge-pricing" element={<AdminSurgePricing />} />
      <Route path="/admin/zone-pricing" element={<AdminZonePricing />} />
      <Route path="/admin/reports" element={<AdminReports />} />
      <Route path="/admin/advertising" element={<AdminAdvertising />} />
      <Route path="/admin/home-panel" element={<AdminHomePanel />} />
      <Route path="/admin/school-transport" element={<AdminSchoolTransport />} />
      <Route path="/admin/school-billing" element={<AdminSchoolBilling />} />
      <Route path="/admin/schedule-dashboard" element={<AdminScheduleDashboard />} />
      <Route path="/admin/dispatch-board" element={<AdminDispatchBoard />} />
      <Route path="/admin/route-restrictions" element={<AdminRouteRestrictions />} />
      <Route path="/admin/route-restrictions/new" element={<AdminBlockRoute />} />
      <Route path="/admin/route-restrictions/:id" element={<AdminRouteRestrictionDetail />} />
      <Route path="/admin/notifications" element={<AdminNotifications />} />

      {/* School Transportation Routes */}
      <Route path="/parent/tracking/:id" element={<ParentTracking />} />

      {/* Advertiser Portal Routes */}
      <Route path="/advertiser/dashboard" element={<AdvertiserDashboard />} />
      <Route path="/advertiser/campaign/:id" element={<AdvertiserCampaignDetail />} />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
