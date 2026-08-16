import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router";
import { Home, ClipboardList, Wallet, LayoutGrid, UserCircle2, IndianRupee, Car, Map, BarChart3, Users, MoreHorizontal, Settings, GraduationCap, Building2, Crown } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";

interface NavItem {
  icon: React.ElementType;
  labelKey: string;
  path: string;
  center?: boolean;
}

const userNav: NavItem[] = [
  { icon: ClipboardList, labelKey: "user.history", path: "/user/history" },
  { icon: Wallet, labelKey: "user.wallet", path: "/user/wallet" },
  { icon: Home, labelKey: "user.home", path: "/user/home", center: true },
  { icon: LayoutGrid, labelKey: "user.services", path: "/user/services" },
  { icon: UserCircle2, labelKey: "user.profile", path: "/user/profile" },
];

const driverNav: NavItem[] = [
  { icon: Home, labelKey: "driver.home", path: "/driver/dashboard" },
  { icon: IndianRupee, labelKey: "driver.earnings", path: "/driver/earnings" },
  { icon: Wallet, labelKey: "driver.wallet", path: "/driver/wallet" },
  { icon: Car, labelKey: "driver.trips", path: "/driver/trips" },
  { icon: Settings, labelKey: "driver.settings", path: "/driver/settings" },
];

const adminNav: NavItem[] = [
  { icon: BarChart3, labelKey: "admin.dashboard", path: "/admin/dashboard" },
  { icon: Map, labelKey: "admin.tracking", path: "/admin/tracking" },
  { icon: Car, labelKey: "admin.rides", path: "/admin/rides" },
  { icon: Users, labelKey: "admin.customers", path: "/admin/customers" },
  { icon: MoreHorizontal, labelKey: "admin.more", path: "/admin/settings" },
];

export default function BottomNav({ role }: { role: "user" | "driver" | "admin" }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { t } = useLanguage();

  // The rider's "Services" nav slot dynamically swaps to reflect their
  // highest-priority active membership — normal ride booking and the
  // Services hub are otherwise unaffected (still reachable at
  // /user/services, just not from this one nav slot — each membership's own
  // dashboard has an "Explore More Services" link back in).
  //
  // Real-identity lookup (guardianUserId, server-derived) rather than the
  // old guardianPhone string match — and now requires paymentStatus==="paid"
  // alongside status==="approved": under real Razorpay billing, a child
  // suspended for nonpayment must not permanently park this slot on a
  // dead-end "School" tab (see api/queries/schoolBilling.ts's nightly
  // grace-period sweep, which flips status to "suspended" on lapse).
  const { data: mySubscriptions } = trpc.school.listMyActiveSubscriptions.useQuery(undefined, {
    enabled: role === "user" && !!user,
    refetchInterval: 30000,
    refetchIntervalInBackground: true,
  });
  const hasApprovedSchoolSubscription = (mySubscriptions ?? []).some((s) => s.status === "approved" && s.paymentStatus === "paid");

  const { data: corporateMembership } = trpc.corporate.getMine.useQuery(undefined, {
    enabled: role === "user" && !!user,
    refetchInterval: 30000,
    refetchIntervalInBackground: true,
  });
  const hasActiveCorporateMembership = corporateMembership?.status === "active";

  const { data: myPlanId } = trpc.plans.getMyPlan.useQuery(undefined, { enabled: role === "user" && !!user });
  const hasRidePassMembership = !!myPlanId && myPlanId !== "free" && myPlanId !== "corporate";

  // Priority ladder: School > Corporate > RidePass > Services (default).
  // Healthcare/Tour Package aren't real products yet (no schema, no signup
  // flow anywhere in the app) so they're intentionally not in this ladder.
  const servicesSlotOverride: NavItem | null = hasApprovedSchoolSubscription
    ? { icon: GraduationCap, labelKey: "nav.school", path: "/user/school-subscribe" }
    : hasActiveCorporateMembership
    ? { icon: Building2, labelKey: "wallet.corporate", path: "/user/corporate" }
    : hasRidePassMembership
    ? { icon: Crown, labelKey: "nav.ridePass", path: "/user/subscription" }
    : null;

  const navItems =
    role === "user"
      ? userNav.map((item): NavItem => (item.path === "/user/services" && servicesSlotOverride ? servicesSlotOverride : item))
      : role === "driver"
      ? driverNav
      : adminNav;
  // Which nav item is the "morph slot" — the override's path, or Services
  // itself when there's no override (e.g. reverting after a membership lapses).
  const morphSlotPath = servicesSlotOverride?.path ?? "/user/services";

  // BottomNav remounts on every page navigation (each page renders its own
  // <BottomNav />, there's no persistent layout wrapper), so a plain
  // mount-animation would replay the "morph" pop on every single nav tap.
  // Comparing against the last-seen slot in sessionStorage limits it to
  // actual membership-status changes instead.
  const [justMorphed, setJustMorphed] = useState(false);
  useEffect(() => {
    if (role !== "user") return;
    const previous = sessionStorage.getItem("bottomNavSlot");
    if (previous !== null && previous !== morphSlotPath) setJustMorphed(true);
    sessionStorage.setItem("bottomNavSlot", morphSlotPath);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [morphSlotPath]);

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 px-3 pb-3 pointer-events-none">
      <div className="max-w-lg mx-auto pointer-events-auto bg-white/80 dark:bg-[#1E293B]/80 backdrop-blur-xl rounded-[28px] shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-white/60 dark:border-white/10 flex items-center justify-around h-16 px-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const isMorphSlot = justMorphed && item.path === morphSlotPath;

          if (item.center) {
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className="relative flex flex-col items-center justify-center flex-1 h-full"
              >
                <div
                  className={`flex items-center justify-center rounded-full w-14 h-14 -translate-y-4 shadow-[0_6px_16px_rgba(255,107,0,0.45)] transition-transform active:scale-90 ${
                    isActive ? "bg-[#FF6B00]" : "bg-gradient-to-br from-[#FF6B00] to-[#FF8A3D]"
                  }`}
                >
                  <item.icon className="w-6 h-6 text-white" strokeWidth={2.25} />
                </div>
                <span className={`text-[10px] font-medium -mt-2 ${isActive ? "text-[#FF6B00]" : "text-[#9CA3AF]"}`}>
                  {t(item.labelKey)}
                </span>
              </button>
            );
          }

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-transform duration-300"
            >
              <div className={isMorphSlot ? "animate-nav-morph flex flex-col items-center gap-0.5" : "flex flex-col items-center gap-0.5"}>
                <div
                  className={`flex items-center justify-center rounded-2xl transition-all duration-300 ${
                    isActive ? "w-11 h-8 bg-[#FF6B00]/12 dark:bg-[#FF6B00]/20 -translate-y-0.5" : "w-11 h-8"
                  }`}
                >
                  <item.icon
                    className={`w-5 h-5 transition-colors ${isActive ? "text-[#FF6B00]" : "text-[#9CA3AF]"}`}
                    strokeWidth={isActive ? 2.5 : 1.75}
                  />
                </div>
                <span
                  className={`text-[10px] font-medium transition-colors ${isActive ? "text-[#FF6B00]" : "text-[#9CA3AF]"}`}
                >
                  {t(item.labelKey)}
                </span>
              </div>
              {isActive && <span className="absolute -top-0.5 w-1 h-1 rounded-full bg-[#FF6B00] shadow-[0_0_6px_rgba(255,107,0,0.8)]" />}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
