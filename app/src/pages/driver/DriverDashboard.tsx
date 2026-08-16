import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import {
  Bell, Car, Star, IndianRupee, Wallet, Award, Megaphone, Sparkles,
  TrendingUp, ChevronRight, BatteryCharging, Clock, TrainFront, Cross, ShoppingBag, Gift, X, GraduationCap, Pencil,
} from "lucide-react";
import { BarChart, Bar, ResponsiveContainer, XAxis, Tooltip } from "recharts";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNotifications } from "@/contexts/NotificationsContext";
import { useDriverDocuments } from "@/contexts/DriverDocumentsContext";
import BottomNav from "@/components/BottomNav";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";

const DEFAULT_AVATAR = "/assets/driver-avatar.png";

// Gamification flourishes with no backing data model in this prototype
// (tier/acceptance-rate/membership-year aren't tracked anywhere) — kept as
// decorative, non-identity display, unlike name/rating/trip stats below
// which are now the driver's real data.
const cosmetic = {
  acceptanceRate: 98,
  memberSince: 2026,
};

const weeklyEarnings = [
  { day: "Mon", amount: 620 },
  { day: "Tue", amount: 540 },
  { day: "Wed", amount: 710 },
  { day: "Thu", amount: 480 },
  { day: "Fri", amount: 890 },
  { day: "Sat", amount: 1020 },
  { day: "Sun", amount: 560 },
];

const nearbyRequests = [
  { labelKey: "dashboard.station", distance: "1.2 km", icon: TrainFront },
  { labelKey: "dashboard.hospital", distance: "800 m", icon: Cross },
  { labelKey: "dashboard.market", distance: "2 km", icon: ShoppingBag },
];

const heatZones = [
  { labelKey: "dashboard.railwayStation", level: "hot" as const },
  { labelKey: "dashboard.market", level: "hot" as const },
  { labelKey: "dashboard.hospital", level: "normal" as const },
];

export default function DriverDashboard() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user } = useAuth();
  const driverName = user?.name || "Driver";
  const { unreadCountFor, pushEnabled, requestNotificationPermission } = useNotifications();
  const { hasExpiringDocs, hasPendingDocs } = useDriverDocuments();
  const unreadNotifications = unreadCountFor("driver");
  const [notifPromptDismissed, setNotifPromptDismissed] = useState(false);
  // Stays online across refreshes/remounts until the driver explicitly goes
  // offline again — previously this was in-memory only and silently reset.
  const [isOnline, setIsOnline] = useState(() => localStorage.getItem("driverOnline") === "true");
  const [showDocWarning, setShowDocWarning] = useState(false);
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState("");
  const { data: schoolStudents } = trpc.school.listMyAssignedStudents.useQuery(undefined, {
    enabled: !!user,
    refetchInterval: 15000,
    refetchIntervalInBackground: true,
  });
  const { data: dashboard } = trpc.driver.getDashboard.useQuery(undefined, {
    refetchInterval: 15000,
    refetchIntervalInBackground: true,
  });
  const { data: driverProfile, isLoading: driverProfileLoading } = trpc.driver.getProfile.useQuery();
  // Sends a driver who never finished (or never started) the onboarding
  // wizard back into it — covers both a returning driver who abandoned it
  // mid-way (Login.tsx only routes truly *new* signups to /driver/onboarding)
  // and anyone who navigates here directly by URL before submitting.
  //
  // Drivers registered before this wizard existed have onboardingStep stuck
  // at 0 forever (the old Register.tsx flow never touches it) but do have
  // real vehicleNumber/licenseNumber from that old form — grandfathered in
  // rather than forced through the new wizard retroactively. A driver stuck
  // mid-way through the *new* wizard is distinguishable from them by
  // onboardingStep being > 0 without onboardingSubmittedAt ever landing.
  useEffect(() => {
    if (driverProfileLoading || !driverProfile) return;
    const isLegacyComplete = driverProfile.onboardingStep === 0 && !!driverProfile.vehicleNumber && !!driverProfile.licenseNumber;
    if (!driverProfile.onboardingSubmittedAt && !isLegacyComplete) {
      navigate("/driver/onboarding", { replace: true });
    }
  }, [driverProfileLoading, driverProfile, navigate]);
  // Best-effort: persists real online/offline presence to driver_profiles
  // so the admin dashboard's "Active Drivers" count reflects reality. Fails
  // silently if this browser has no real driver session — the local toggle
  // still works either way, same as before this was wired to the server.
  const toggleOnlineMutation = trpc.driver.toggleOnline.useMutation();
  const utils = trpc.useUtils();
  const setDailyGoalMutation = trpc.driver.setDailyGoal.useMutation({
    onSuccess: () => utils.driver.getDashboard.invalidate(),
  });

  const handleGoOnlineToggle = () => {
    if (isOnline) {
      setIsOnline(false);
      return;
    }
    if (hasExpiringDocs || hasPendingDocs) {
      setShowDocWarning(true);
      return;
    }
    setIsOnline(true);
  };
  const stats = {
    todayRides: dashboard?.todayRides ?? 0,
    todayEarnings: dashboard?.todayEarnings ?? 0,
    rating: dashboard ? Number(dashboard.rating) : 5.0,
    completedRides: dashboard?.completedRides ?? 0,
    cancelledRides: dashboard?.cancelledRides ?? 0,
    platformDues: dashboard?.platformDues ?? "0",
  };
  const totalTrips = driverProfile?.totalRides ?? 0;

  useEffect(() => {
    localStorage.setItem("driverOnline", String(isOnline));
    // Attach a real GPS fix when going online so getNearbyDrivers/
    // listNearbySearching have something to match against immediately,
    // instead of waiting for the first watchPosition tick below.
    if (isOnline && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          toggleOnlineMutation.mutate({
            isOnline,
            lat: position.coords.latitude.toString(),
            lng: position.coords.longitude.toString(),
          });
        },
        () => toggleOnlineMutation.mutate({ isOnline }),
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      toggleOnlineMutation.mutate({ isOnline });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run on isOnline changes, not on every mutation object identity change
  }, [isOnline]);

  // Keeps this driver's real location fresh while online — nearest-driver
  // matching (getNearbyDrivers/listNearbySearching) is only as good as this.
  const updateLocationMutation = trpc.driver.updateLocation.useMutation();
  const lastLocationUpdateRef = useRef(0);
  useEffect(() => {
    if (!isOnline || !navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const now = Date.now();
        if (now - lastLocationUpdateRef.current < 5000) return;
        lastLocationUpdateRef.current = now;
        updateLocationMutation.mutate({
          lat: position.coords.latitude.toString(),
          lng: position.coords.longitude.toString(),
        });
      },
      (error) => console.error("Error watching driver location:", error),
      { enableHighAccuracy: true, maximumAge: 10000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

  // Real incoming-ride matching — the nearest still-"searching" ride within
  // range of this driver's own last-known location. Replaces the old fixed
  // 3-second fake redirect; this can take as long as it actually takes for a
  // real rider to book nearby, and re-checks on every reopen while online
  // (not just a fresh online toggle), so a driver who reopens the app mid-shift
  // doesn't miss a request that arrived while they were away.
  const { data: nearbyRides } = trpc.ride.listNearbySearching.useQuery(undefined, {
    enabled: isOnline,
    refetchInterval: 2000,
    refetchIntervalInBackground: true,
  });
  useEffect(() => {
    if (isOnline && nearbyRides && nearbyRides.length > 0) {
      navigate(`/driver/ride-request?rideId=${nearbyRides[0].id}`);
    }
  }, [isOnline, nearbyRides, navigate]);

  // Resume an already-accepted ride this driver never finished — otherwise
  // a driver who ends up back on the dashboard mid-ride (app restart, a
  // bounced navigation) has no way back in short of guessing the right URL.
  const { data: activeRide } = trpc.ride.getCurrent.useQuery();
  useEffect(() => {
    if (!activeRide) return;
    if (activeRide.status === "waiting") {
      navigate(`/driver/waiting?rideId=${activeRide.id}`);
    } else if (activeRide.status === "ongoing" && activeRide.isHourlyRental) {
      navigate(`/driver/rental-active?rideId=${activeRide.id}`);
    } else if (activeRide.status === "ongoing") {
      navigate(`/driver/ride-dropoff?rideId=${activeRide.id}`);
    } else {
      navigate(`/driver/ride-pickup?rideId=${activeRide.id}`);
    }
  }, [activeRide, navigate]);

  const dailyTarget = { current: stats.todayEarnings, goal: dashboard?.dailyGoal ?? 1200 };
  const targetPercent = Math.min(100, Math.round((dailyTarget.current / dailyTarget.goal) * 100));
  const remainingToGoal = Math.max(0, dailyTarget.goal - dailyTarget.current);

  const openGoalEditor = () => {
    setGoalInput(String(dailyTarget.goal));
    setEditingGoal(true);
  };
  const handleSaveGoal = () => {
    const value = Math.round(Number(goalInput));
    if (!Number.isFinite(value) || value <= 0) return;
    setDailyGoalMutation.mutate({ dailyGoal: value });
    setEditingGoal(false);
  };

  // pb-48 clears BOTH fixed footers stacked at the bottom — the Go
  // Online/Offline bar (fixed bottom-16, ~93px) sitting above BottomNav
  // (fixed bottom-0, ~76px) — not just the nav bar alone.
  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0F172A] pb-48">
      {/* Header */}
      <div className="bg-white dark:bg-[#1E293B] px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">{t("dashboard.goodMorning")},</p>
            <h1 className="font-bold text-xl text-[#1A1A2E] dark:text-[#E5E7EB]">{driverName}</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isOnline ? "bg-[#138808]" : "bg-[#9CA3AF]"}`} />
              <span className={`text-sm font-medium ${isOnline ? "text-[#138808]" : "text-[#9CA3AF]"}`}>
                {isOnline ? t("nav.online") : t("nav.offline")}
              </span>
            </div>
            <button
              onClick={() => navigate("/driver/notifications")}
              className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full relative"
            >
              <Bell className="w-5 h-5 text-[#1A1A2E] dark:text-[#E5E7EB]" />
              {unreadNotifications > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-[#FF6B00] rounded-full" />
              )}
            </button>
          </div>
        </div>

        {!pushEnabled && !notifPromptDismissed && (
          <div className="bg-[#FFF5EB] dark:bg-[#3A2A1A] border border-[#FFDDBB] dark:border-[#5A4020] rounded-xl px-3.5 py-2.5 flex items-center gap-2.5 mb-4">
            <Bell className="w-4 h-4 text-[#FF6B00] flex-shrink-0" />
            <p className="text-xs text-[#7A4A1A] dark:text-[#FFC98A] flex-1">
              {t("dashboard.enableNotifsPrompt")}
            </p>
            <button
              onClick={() => requestNotificationPermission("driver")}
              className="text-xs font-semibold text-[#FF6B00] flex-shrink-0"
            >
              {t("dashboard.enable")}
            </button>
            <button
              onClick={() => setNotifPromptDismissed(true)}
              className="p-0.5 text-[#9CA3AF] flex-shrink-0"
              aria-label="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {(schoolStudents ?? []).length > 0 && (
          <button
            onClick={() => navigate("/driver/school-mode")}
            className="w-full flex items-center gap-3 bg-gradient-to-r from-[#1E3A5F] to-[#2C5282] rounded-xl px-3.5 py-3 mb-4"
          >
            <GraduationCap className="w-5 h-5 text-white flex-shrink-0" />
            <span className="text-sm font-medium text-white flex-1 text-left">
              {t("dashboard.schoolDutyMode")} — {schoolStudents!.length} {t("dashboard.studentsAssignedToday")}
            </span>
            <ChevronRight className="w-4 h-4 text-white flex-shrink-0" />
          </button>
        )}

        {/* Today's Summary Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl p-3 text-center">
            <div className="w-8 h-8 rounded-full bg-[#FFF5EB] dark:bg-[#3D2914] flex items-center justify-center mx-auto mb-1">
              <Car className="w-4 h-4 text-[#FF6B00]" />
            </div>
            <p className="text-lg font-bold text-[#1A1A2E] dark:text-[#E5E7EB]">{stats.todayRides}</p>
            <p className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF]">{t("stats.todayRides")}</p>
          </div>
          <div className="bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl p-3 text-center">
            <div className="w-8 h-8 rounded-full bg-[#E8F5E8] dark:bg-[#1A2D1A] flex items-center justify-center mx-auto mb-1">
              <IndianRupee className="w-4 h-4 text-[#138808]" />
            </div>
            <p className="text-lg font-bold text-[#1A1A2E] dark:text-[#E5E7EB]">₹{stats.todayEarnings}</p>
            <p className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF]">{t("stats.todayEarnings")}</p>
          </div>
          <div className="bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl p-3 text-center">
            <div className="w-8 h-8 rounded-full bg-[#FFF5EB] dark:bg-[#3D2914] flex items-center justify-center mx-auto mb-1">
              <Star className="w-4 h-4 text-[#FF6B00]" />
            </div>
            <p className="text-lg font-bold text-[#1A1A2E] dark:text-[#E5E7EB]">{stats.rating}</p>
            <p className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF]">{t("stats.rating")}</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Driver Profile Card */}
        <button
          onClick={() => navigate("/driver/profile")}
          className="w-full bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4 text-left hover:shadow-md transition-shadow"
        >
          <div className="flex items-center gap-3">
            <img
              src={user?.avatar || DEFAULT_AVATAR}
              alt={driverName}
              className="w-14 h-14 rounded-full object-cover border-2 border-[#FFD700] flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-[#1A1A2E] dark:text-[#E5E7EB] truncate">{driverName}</p>
              <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="w-3 h-3 text-[#FFD700] fill-[#FFD700]" />
                ))}
                <span className="text-sm font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] ml-1">{stats.rating.toFixed(1)}</span>
                <span className="flex items-center gap-1 text-[10px] font-semibold text-[#CA8A04] dark:text-[#FBBF24] bg-[#FEF9C3] dark:bg-[#3D3410] px-2 py-0.5 rounded-full ml-1">
                  <Award className="w-2.5 h-2.5" /> {t("driver.goldDriver")}
                </span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 pt-3 mt-3 border-t border-gray-50 dark:border-gray-700">
            <div className="text-center">
              <p className="font-bold text-sm text-[#1A1A2E] dark:text-[#E5E7EB]">{totalTrips.toLocaleString("en-IN")}</p>
              <p className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF]">{t("driver.trips")}</p>
            </div>
            <div className="text-center border-x border-gray-50 dark:border-gray-700">
              <p className="font-bold text-sm text-[#1A1A2E] dark:text-[#E5E7EB]">{cosmetic.acceptanceRate}%</p>
              <p className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF]">{t("driver.acceptanceRate")}</p>
            </div>
            <div className="text-center">
              <p className="font-bold text-sm text-[#1A1A2E] dark:text-[#E5E7EB]">{cosmetic.memberSince}</p>
              <p className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF]">{t("driver.memberSince")}</p>
            </div>
          </div>
        </button>

        {/* Live AI Card */}
        <button
          onClick={() => navigate("/driver/demand-map")}
          className="w-full bg-gradient-to-br from-[#7C3AED] to-[#5B21B6] rounded-2xl p-4 text-left hover:opacity-95 transition-opacity"
        >
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-white" />
            <span className="text-xs font-semibold text-white/80">{t("dashboard.aiInsight")}</span>
          </div>
          <p className="text-sm font-semibold text-white mb-2">{t("dashboard.highDemandNearStation")}</p>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-[#4ADE80] bg-white/10 px-2 py-1 rounded-full mb-3">
            <TrendingUp className="w-3 h-3" /> {t("dashboard.moreEarningsPct")}
          </span>
          <div className="flex items-center justify-between">
            <p className="text-xs text-white/70">
              {t("dashboard.estimated")} <span className="font-bold text-white">₹450</span> {t("dashboard.inNextHour")}
            </p>
            <span className="flex items-center gap-1 text-xs font-semibold bg-white text-[#7C3AED] px-3 py-1.5 rounded-full flex-shrink-0">
              {t("dashboard.goNow")} <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </button>

        {/* Nearby Requests */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4">
          <h2 className="font-semibold text-sm text-[#1A1A2E] dark:text-[#E5E7EB] mb-3">{t("driver.nearbyRequests")}</h2>
          <div className="grid grid-cols-3 gap-2">
            {nearbyRequests.map((r) => (
              <div key={r.labelKey} className="flex flex-col items-center gap-1 bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl p-3">
                <div className="w-9 h-9 rounded-full bg-[#FFF5EB] dark:bg-[#3D2914] flex items-center justify-center">
                  <r.icon className="w-4 h-4 text-[#FF6B00]" />
                </div>
                <span className="text-xs font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">{t(r.labelKey)}</span>
                <span className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF]">{r.distance}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Daily Target */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-sm text-[#1A1A2E] dark:text-[#E5E7EB]">{t("dashboard.todaysGoal")}</h2>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">
                ₹{dailyTarget.current} / ₹{dailyTarget.goal}
              </span>
              <button
                onClick={openGoalEditor}
                aria-label="Edit today's goal"
                className="p-1 -m-1 text-[#9CA3AF] hover:text-[#FF6B00]"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div className="w-full h-2.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#FF6B00] to-[#FF8A3D] rounded-full transition-all duration-500"
              style={{ width: `${targetPercent}%` }}
            />
          </div>
          <p className="text-[10px] text-[#9CA3AF] mt-1.5">
            {remainingToGoal > 0 ? `₹${remainingToGoal} ${t("dashboard.moreToReachGoal")}` : t("dashboard.goalReached")}
          </p>
        </div>

        {/* Weekly Earnings Graph */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-sm text-[#1A1A2E] dark:text-[#E5E7EB]">{t("dashboard.weeklyEarnings")}</h2>
            <button onClick={() => navigate("/driver/earnings")} className="text-xs text-[#FF6B00] font-medium">
              {t("dashboard.viewAllLower")}
            </button>
          </div>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyEarnings}>
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: "transparent" }}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                  formatter={(value: number) => [`₹${value}`, t("driver.earnings")]}
                />
                <Bar dataKey="amount" radius={[6, 6, 0, 0]} fill="#138808" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Heat Map Preview */}
        <button
          onClick={() => navigate("/driver/demand-map")}
          className="w-full bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4 text-left hover:shadow-md transition-shadow"
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-sm text-[#1A1A2E] dark:text-[#E5E7EB]">{t("dashboard.demandHeatMap")}</h2>
            <ChevronRight className="w-4 h-4 text-[#9CA3AF]" />
          </div>
          <div className="flex flex-wrap gap-2">
            {heatZones.map((z) => (
              <span
                key={z.labelKey}
                className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-full ${
                  z.level === "hot" ? "bg-[#FEE2E2] dark:bg-[#3D1414] text-[#DC2626]" : "bg-[#E8F5E8] dark:bg-[#1A2D1A] text-[#138808]"
                }`}
              >
                {z.level === "hot" ? "🔥" : "🟢"} {t(z.labelKey)}
              </span>
            ))}
          </div>
        </button>

        {/* Detailed Stats */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4">
          <h2 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] mb-3">{t("stats.todayRides")}</h2>
          <div className="space-y-3">
            {[
              { label: t("stats.completedRides"), value: stats.completedRides, color: "#138808" },
              { label: t("stats.cancelledRides"), value: stats.cancelledRides, color: "#DC2626" },
              { label: t("stats.earnings"), value: `₹${stats.todayEarnings}`, color: "#1A1A2E" },
              { label: t("stats.platformDues"), value: `₹${stats.platformDues}`, color: "#FF6B00" },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between py-2 border-b border-gray-50 dark:border-gray-700 last:border-0">
                <span className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">{item.label}</span>
                <span className="font-semibold text-sm" style={{ color: item.color }}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => navigate("/driver/earnings")}
            className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4 text-center hover:shadow-md transition-shadow"
          >
            <div className="w-10 h-10 rounded-full bg-[#E8F5E8] dark:bg-[#1A2D1A] flex items-center justify-center mx-auto mb-2">
              <IndianRupee className="w-5 h-5 text-[#138808]" />
            </div>
            <p className="font-medium text-sm text-[#1A1A2E] dark:text-[#E5E7EB]">{t("driver.earnings")}</p>
          </button>
          <button
            onClick={() => navigate("/driver/trips")}
            className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4 text-center hover:shadow-md transition-shadow"
          >
            <div className="w-10 h-10 rounded-full bg-[#FFF5EB] dark:bg-[#3D2914] flex items-center justify-center mx-auto mb-2">
              <Clock className="w-5 h-5 text-[#FF6B00]" />
            </div>
            <p className="font-medium text-sm text-[#1A1A2E] dark:text-[#E5E7EB]">{t("driver.trips")}</p>
          </button>
          <button
            onClick={() => navigate("/driver/wallet")}
            className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4 text-center hover:shadow-md transition-shadow"
          >
            <div className="w-10 h-10 rounded-full bg-[#E0F2FE] dark:bg-[#0C2536] flex items-center justify-center mx-auto mb-2">
              <Wallet className="w-5 h-5 text-[#0EA5E9]" />
            </div>
            <p className="font-medium text-sm text-[#1A1A2E] dark:text-[#E5E7EB]">{t("driver.wallet")}</p>
          </button>
          <button
            onClick={() => navigate("/driver/rewards")}
            className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4 text-center hover:shadow-md transition-shadow"
          >
            <div className="w-10 h-10 rounded-full bg-[#F3E8FF] dark:bg-[#2D1B4E] flex items-center justify-center mx-auto mb-2">
              <Award className="w-5 h-5 text-[#7C3AED]" />
            </div>
            <p className="font-medium text-sm text-[#1A1A2E] dark:text-[#E5E7EB]">{t("driver.rewards")}</p>
          </button>
          <button
            onClick={() => navigate("/driver/ad-optin")}
            className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4 text-center hover:shadow-md transition-shadow"
          >
            <div className="w-10 h-10 rounded-full bg-[#F3E8FF] dark:bg-[#2D1B4E] flex items-center justify-center mx-auto mb-2">
              <Megaphone className="w-5 h-5 text-[#7C3AED]" />
            </div>
            <p className="font-medium text-sm text-[#1A1A2E] dark:text-[#E5E7EB]">{t("dashboard.adEarnings")}</p>
          </button>
          <button
            onClick={() => navigate("/driver/referral")}
            className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4 text-center hover:shadow-md transition-shadow"
          >
            <div className="w-10 h-10 rounded-full bg-[#E0F2FE] dark:bg-[#0C2536] flex items-center justify-center mx-auto mb-2">
              <Gift className="w-5 h-5 text-[#0EA5E9]" />
            </div>
            <p className="font-medium text-sm text-[#1A1A2E] dark:text-[#E5E7EB]">{t("dashboard.referral")}</p>
          </button>
        </div>
      </div>

      {/* Online/Offline Button */}
      <div className="fixed bottom-16 left-0 right-0 p-4 bg-white dark:bg-[#1E293B] border-t border-gray-100 dark:border-gray-700">
        <button
          onClick={handleGoOnlineToggle}
          className={`w-full py-4 text-lg font-semibold rounded-xl transition-all duration-300 ${
            isOnline
              ? "bg-[#FF6B00] text-white shadow-saffron"
              : "bg-[#138808] text-white shadow-green"
          }`}
        >
          {isOnline ? t("nav.goOffline") : t("nav.goOnline")}
        </button>
      </div>

      {/* Document Warning Sheet */}
      {showDocWarning && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-end" onClick={() => setShowDocWarning(false)}>
          <div className="bg-white dark:bg-[#1E293B] rounded-t-3xl w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-1 bg-gray-200 dark:bg-gray-600 rounded-full mx-auto mb-4" />
            <div className="flex items-center gap-3 mb-3">
              <div className="w-11 h-11 rounded-full bg-[#FFF5EB] dark:bg-[#3D2914] flex items-center justify-center flex-shrink-0">
                <BatteryCharging className="w-5 h-5 text-[#FF6B00]" />
              </div>
              <h2 className="font-bold text-lg text-[#1A1A2E] dark:text-[#E5E7EB]">{t("dashboard.documentAttentionNeeded")}</h2>
            </div>
            <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] mb-4">
              {hasPendingDocs
                ? `${t("dashboard.docsPendingVerification")} `
                : ""}
              {hasExpiringDocs ? `${t("dashboard.docsExpiringSoon")} ` : ""}
              {t("dashboard.reviewOrContinue")}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowDocWarning(false); navigate("/driver/vehicle-health"); }}
                className="flex-1 bg-gray-100 dark:bg-gray-800 text-[#1A1A2E] dark:text-[#E5E7EB] font-semibold py-3.5 rounded-xl"
              >
                {t("dashboard.reviewDocuments")}
              </button>
              <button
                onClick={() => { setShowDocWarning(false); setIsOnline(true); }}
                className="flex-1 bg-[#138808] text-white font-semibold py-3.5 rounded-xl hover:bg-[#1AA814] transition-colors"
              >
                {t("dashboard.goOnlineAnyway")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Today's Goal Sheet */}
      {editingGoal && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-end" onClick={() => setEditingGoal(false)}>
          <div className="bg-white dark:bg-[#1E293B] rounded-t-3xl w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-1 bg-gray-200 dark:bg-gray-600 rounded-full mx-auto mb-4" />
            <h2 className="font-bold text-lg text-[#1A1A2E] dark:text-[#E5E7EB] mb-3">{t("dashboard.setTodaysGoal")}</h2>
            <div className="flex items-center gap-2 bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-4 py-3 mb-4">
              <span className="text-[#6B7280] dark:text-[#9CA3AF] font-semibold">₹</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                autoFocus
                value={goalInput}
                onChange={(e) => setGoalInput(e.target.value)}
                className="flex-1 bg-transparent outline-none text-lg font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]"
                placeholder="1200"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setEditingGoal(false)}
                className="flex-1 bg-gray-100 dark:bg-gray-800 text-[#1A1A2E] dark:text-[#E5E7EB] font-semibold py-3.5 rounded-xl"
              >
                {t("cancel")}
              </button>
              <button
                onClick={handleSaveGoal}
                disabled={!Number.isFinite(Number(goalInput)) || Number(goalInput) <= 0}
                className="flex-1 bg-[#FF6B00] disabled:bg-[#9CA3AF] text-white font-semibold py-3.5 rounded-xl"
              >
                {t("save")}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav role="driver" />
    </div>
  );
}
