import { useState } from "react";
import { useNavigate } from "react-router";
import {
  ArrowLeft, ChevronRight, Repeat, Hourglass, Clock3, CalendarDays, Route,
  CalendarClock, GraduationCap, Package, ShieldCheck, Users, Bell, Crown,
} from "lucide-react";
import BottomNav from "@/components/BottomNav";
import Reveal from "@/components/Reveal";
import { useNotifications } from "@/contexts/NotificationsContext";
import { useLanguage } from "@/contexts/LanguageContext";

interface ServiceCard {
  id: string;
  titleKey: string;
  descriptionKey: string;
  icon: React.ElementType;
  from: string; // gradient start (icon badge + glow)
  to: string; // gradient end
  path?: string; // undefined = not built yet, shows "Launching soon"
}

const services: ServiceCard[] = [
  { id: "round-trip", titleKey: "services.roundTrip", descriptionKey: "services.roundTripDesc", icon: Repeat, from: "#6366F1", to: "#4338CA", path: "/user/round-trip" },
  { id: "wait-return", titleKey: "services.waitReturn", descriptionKey: "services.waitReturnDesc", icon: Hourglass, from: "#F59E0B", to: "#B45309", path: "/user/wait-return" },
  { id: "hourly-rental", titleKey: "services.hourlyRental", descriptionKey: "services.hourlyRentalDesc", icon: Clock3, from: "#3B82F6", to: "#1D4ED8", path: "/user/hourly-rental" },
  { id: "full-day-rental", titleKey: "services.fullDayRental", descriptionKey: "services.fullDayRentalDesc", icon: CalendarDays, from: "#22C55E", to: "#15803D", path: "/user/full-day-rental" },
  { id: "multi-stop", titleKey: "services.multiStop", descriptionKey: "services.multiStopDesc", icon: Route, from: "#F43F5E", to: "#BE123C", path: "/user/multi-stop" },
  { id: "scheduled-ride", titleKey: "services.scheduledRide", descriptionKey: "services.scheduledRideDesc", icon: CalendarClock, from: "#0EA5E9", to: "#0369A1", path: "/user/schedule" },
  { id: "school-ride", titleKey: "services.schoolRide", descriptionKey: "services.schoolRideDesc", icon: GraduationCap, from: "#FF6B00", to: "#C2410C", path: "/user/student-pass" },
  { id: "parcel", titleKey: "services.parcel", descriptionKey: "services.parcelDesc", icon: Package, from: "#A855F7", to: "#7C3AED", path: "/user/home?mode=parcel" },
  { id: "women-ride", titleKey: "services.womenRide", descriptionKey: "services.womenRideDesc", icon: ShieldCheck, from: "#EC4899", to: "#BE185D", path: "/user/safety" },
  { id: "shared-toto", titleKey: "services.sharedToto", descriptionKey: "services.sharedTotoDesc", icon: Users, from: "#14B8A6", to: "#0F766E", path: "/user/home?rideType=share" },
];

export default function UserServices() {
  const navigate = useNavigate();
  const { unreadCountFor } = useNotifications();
  const unread = unreadCountFor("rider");
  const [toast, setToast] = useState<string | null>(null);
  const { t } = useLanguage();

  const handleCardTap = (service: ServiceCard) => {
    if (service.path) {
      navigate(service.path);
      return;
    }
    setToast(`${t(service.titleKey)} ${t("services.launchingSoonToast")}`);
    setTimeout(() => setToast(null), 2200);
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0F172A] pb-24">
      {/* Header */}
      <div className="px-4 pt-0 pb-2">
        <div className="flex items-center justify-between mb-1">
          <button onClick={() => navigate("/user/home")} className="p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full">
            <ArrowLeft className="w-6 h-6 text-[#1A1A2E] dark:text-white" />
          </button>
          <button
            onClick={() => navigate("/user/notifications")}
            className="relative p-2 -mr-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full"
          >
            <Bell className="w-5 h-5 text-[#1A1A2E] dark:text-white" />
            {unread > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#FF6B00] rounded-full" />}
          </button>
        </div>
        <h1 className="text-center font-bold text-2xl">
          <span className="text-[#1A1A2E] dark:text-white">RidePay </span>
          <span className="bg-gradient-to-r from-[#FF6B00] to-[#FFD700] bg-clip-text text-transparent">{t("user.services")}</span>
        </h1>
        <p className="text-center text-xs text-[#6B7280] dark:text-white/50 mt-1">{t("services.chooseSubtitle")}</p>
      </div>

      {/* Service Cards */}
      <div className="px-4 pt-4 grid grid-cols-2 gap-3">
        {services.map((service, i) => (
          <Reveal key={service.id} delay={i * 50}>
            <button
              onClick={() => handleCardTap(service)}
              className="relative w-full h-[168px] bg-white dark:bg-[#1E293B] rounded-3xl border border-gray-100 dark:border-white/[0.06] shadow-sm p-3.5 text-left overflow-hidden hover:shadow-lg hover:-translate-y-1 active:scale-[0.97] transition-all duration-200"
            >
              {/* Glow blob */}
              <div
                className="absolute -right-6 -bottom-8 w-28 h-28 rounded-full blur-2xl opacity-25 dark:opacity-40 pointer-events-none"
                style={{ backgroundColor: service.to }}
              />
              {/* Ghost icon watermark */}
              <service.icon
                className="absolute -right-3 -bottom-3 w-20 h-20 opacity-[0.06] dark:opacity-[0.12] rotate-[-8deg] pointer-events-none"
                style={{ color: service.to }}
                strokeWidth={1.5}
              />

              <div className="relative z-10 flex flex-col h-full">
                <div
                  className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm"
                  style={{ background: `linear-gradient(135deg, ${service.from}, ${service.to})` }}
                >
                  <service.icon className="w-5 h-5 text-white" strokeWidth={2} />
                </div>

                <div className="mt-2.5 flex-1 min-w-0">
                  <p className="font-bold text-sm text-[#1A1A2E] dark:text-white leading-tight">{t(service.titleKey)}</p>
                  {!service.path && (
                    <span className="inline-block mt-1 text-[8px] font-bold uppercase tracking-wide text-[#FF6B00] bg-[#FFF5EB] dark:bg-[#FF6B00]/15 px-1.5 py-0.5 rounded-full">
                      {t("services.launchingSoon")}
                    </span>
                  )}
                  <p className="text-[11px] leading-snug text-[#6B7280] dark:text-white/50 mt-1 line-clamp-2">{t(service.descriptionKey)}</p>
                </div>

                <div className="flex justify-end mt-1">
                  <div className="w-7 h-7 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center">
                    <ChevronRight className="w-3.5 h-3.5 text-[#1A1A2E] dark:text-white" />
                  </div>
                </div>
              </div>
            </button>
          </Reveal>
        ))}
      </div>

      {/* RidePay Plus banner — links into the existing real subscription/plans page */}
      <div className="px-4 pt-4">
        <Reveal delay={services.length * 50}>
          <button
            onClick={() => navigate("/user/subscription")}
            className="w-full flex items-center gap-3 bg-gradient-to-r from-[#1A1A2E] to-[#2D2A4A] dark:from-[#12121C] dark:to-[#1E1B33] rounded-2xl p-4 text-left border border-white/[0.06]"
          >
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#FFD700] to-[#FF6B00] flex items-center justify-center flex-shrink-0">
              <Crown className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm text-[#FFD700]">{t("services.ridepayPlus")}</p>
              <p className="text-[11px] text-white/60 leading-snug">{t("services.ridepayPlusDesc")}</p>
            </div>
            <span className="flex items-center gap-1 text-xs font-semibold text-white bg-white/10 px-3 py-1.5 rounded-full flex-shrink-0">
              {t("profile.explore")} <ChevronRight className="w-3.5 h-3.5" />
            </span>
          </button>
        </Reveal>
      </div>

      {/* "Launching soon" toast */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[70] bg-[#1A1A2E] dark:bg-white text-white dark:text-[#1A1A2E] text-sm font-medium px-4 py-2.5 rounded-full shadow-lg animate-slide-up">
          {toast}
        </div>
      )}

      <BottomNav role="user" />
    </div>
  );
}
