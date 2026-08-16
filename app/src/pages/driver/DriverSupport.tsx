import { ArrowLeft, HelpCircle, Settings, LogOut, ChevronRight, Star, TrendingUp, Calendar, Headphones, AlertTriangle, Info, Phone, Mail } from "lucide-react";
import { useNavigate } from "react-router";
import BottomNav from "@/components/BottomNav";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { SUPPORT_EMAIL_MAILTO, SUPPORT_PHONE_TEL } from "@/lib/supportContact";

const DEFAULT_AVATAR = "/assets/driver-avatar.png";

const infoCards = [
  { icon: TrendingUp, titleKey: "dsupport.earnMore", descKey: "dsupport.earnMoreDesc", color: "#FF6B00", bg: "#FFF5EB" },
  { icon: Star, titleKey: "dsupport.lowCommission", descKey: "dsupport.lowCommissionDesc", color: "#138808", bg: "#E8F5E8" },
  { icon: Calendar, titleKey: "dsupport.dailySettlement", descKey: "dsupport.dailySettlementDesc", color: "#1E3A5F", bg: "#E8EEF5" },
  { icon: Headphones, titleKey: "dsupport.support24x7", descKey: "dsupport.support24x7Desc", color: "#FF6B00", bg: "#FFF5EB" },
];

export default function DriverSupport() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const logoutMutation = trpc.auth.logout.useMutation();
  const { user } = useAuth();
  const { data: driverProfile } = trpc.driver.getProfile.useQuery();

  const driver = {
    name: user?.name || "Driver",
    vehicle: driverProfile?.vehicleNumber || "—",
    type: driverProfile?.vehicleType || "—",
    rating: driverProfile ? Number(driverProfile.rating).toFixed(1) : "5.0",
    avatar: user?.avatar || DEFAULT_AVATAR,
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0F172A] pb-28">
      {/* Header */}
      <div className="bg-white dark:bg-[#1E293B] px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate("/driver/dashboard")} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full">
          <ArrowLeft className="w-5 h-5 text-[#1A1A2E] dark:text-[#E5E7EB]" />
        </button>
        <h1 className="font-bold text-lg text-[#1A1A2E] dark:text-[#E5E7EB]">{t("dsupport.title")}</h1>
      </div>

      {/* Profile Card */}
      <button
        onClick={() => navigate("/driver/profile")}
        className="w-full bg-white dark:bg-[#1E293B] px-6 py-6 text-left hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-4">
          <img
            src={driver.avatar}
            alt={driver.name}
            className="w-16 h-16 rounded-full object-cover border-3 border-[#FF6B00]"
          />
          <div className="flex-1">
            <h2 className="font-bold text-lg text-[#1A1A2E] dark:text-[#E5E7EB]">{driver.name}</h2>
            <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">{driver.vehicle}</p>
            <p className="text-sm text-[#9CA3AF] dark:text-[#64748B]">{driver.type}</p>
          </div>
          <div className="flex items-center gap-1 bg-[#FFF5EB] dark:bg-[#3A2A1A] px-2 py-1 rounded-lg flex-shrink-0">
            <span className="font-bold text-[#FF6B00]">{driver.rating}</span>
            <svg className="w-4 h-4 text-[#FF6B00] fill-[#FF6B00]" viewBox="0 0 24 24">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </div>
          <ChevronRight className="w-5 h-5 text-[#9CA3AF] dark:text-[#64748B] flex-shrink-0" />
        </div>
      </button>

      <div className="px-4 py-4 space-y-4">
        {/* Menu Items */}
        <div className="space-y-3">
          <button
            onClick={() => navigate("/driver/ai-chat")}
            className="w-full flex items-center gap-4 p-4 bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm text-left hover:shadow-md transition-shadow"
          >
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-[#FFF5EB] dark:bg-[#3A2A1A]">
              <HelpCircle className="w-5 h-5 text-[#FF6B00]" />
            </div>
            <span className="flex-1 font-medium text-[#1A1A2E] dark:text-[#E5E7EB] text-sm">{t("support.chatWithWingman")}</span>
            <ChevronRight className="w-5 h-5 text-[#9CA3AF] dark:text-[#64748B]" />
          </button>
          <button
            onClick={() => navigate("/help/faq")}
            className="w-full flex items-center gap-4 p-4 bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm text-left hover:shadow-md transition-shadow"
          >
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-[#E8EEF5] dark:bg-[#1A2A3A]">
              <Info className="w-5 h-5 text-[#1E3A5F] dark:text-[#93C5FD]" />
            </div>
            <span className="flex-1 font-medium text-[#1A1A2E] dark:text-[#E5E7EB] text-sm">{t("support.faq")}</span>
            <ChevronRight className="w-5 h-5 text-[#9CA3AF] dark:text-[#64748B]" />
          </button>
          <button
            onClick={() => navigate("/help/report-issue")}
            className="w-full flex items-center gap-4 p-4 bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm text-left hover:shadow-md transition-shadow"
          >
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-[#FEF2F2] dark:bg-[#3A1A1A]">
              <AlertTriangle className="w-5 h-5 text-[#DC2626]" />
            </div>
            <span className="flex-1 font-medium text-[#1A1A2E] dark:text-[#E5E7EB] text-sm">{t("support.reportIssue")}</span>
            <ChevronRight className="w-5 h-5 text-[#9CA3AF] dark:text-[#64748B]" />
          </button>
          <button
            onClick={() => { window.location.href = SUPPORT_PHONE_TEL; }}
            className="w-full flex items-center gap-4 p-4 bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm text-left hover:shadow-md transition-shadow"
          >
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-[#E8EEF5] dark:bg-[#1A2A3A]">
              <Phone className="w-5 h-5 text-[#1E3A5F] dark:text-[#93C5FD]" />
            </div>
            <span className="flex-1 font-medium text-[#1A1A2E] dark:text-[#E5E7EB] text-sm">{t("support.callSupport")}</span>
            <ChevronRight className="w-5 h-5 text-[#9CA3AF] dark:text-[#64748B]" />
          </button>
          <button
            onClick={() => { window.location.href = SUPPORT_EMAIL_MAILTO; }}
            className="w-full flex items-center gap-4 p-4 bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm text-left hover:shadow-md transition-shadow"
          >
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-[#E8EEF5] dark:bg-[#1A2A3A]">
              <Mail className="w-5 h-5 text-[#1E3A5F] dark:text-[#93C5FD]" />
            </div>
            <span className="flex-1 font-medium text-[#1A1A2E] dark:text-[#E5E7EB] text-sm">{t("support.contactUs")}</span>
            <ChevronRight className="w-5 h-5 text-[#9CA3AF] dark:text-[#64748B]" />
          </button>
          <button
            onClick={() => navigate("/about")}
            className="w-full flex items-center gap-4 p-4 bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm text-left hover:shadow-md transition-shadow"
          >
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-[#F3F4F6] dark:bg-gray-800">
              <Info className="w-5 h-5 text-[#6B7280] dark:text-[#9CA3AF]" />
            </div>
            <span className="flex-1 font-medium text-[#1A1A2E] dark:text-[#E5E7EB] text-sm">{t("support.aboutRidepay")}</span>
            <ChevronRight className="w-5 h-5 text-[#9CA3AF] dark:text-[#64748B]" />
          </button>
          <button
            onClick={() => navigate("/driver/settings")}
            className="w-full flex items-center gap-4 p-4 bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm text-left hover:shadow-md transition-shadow"
          >
            <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-[#F3F4F6] dark:bg-gray-800">
              <Settings className="w-5 h-5 text-[#6B7280] dark:text-[#9CA3AF]" />
            </div>
            <span className="flex-1 font-medium text-[#1A1A2E] dark:text-[#E5E7EB] text-sm">{t("settings")}</span>
            <ChevronRight className="w-5 h-5 text-[#9CA3AF] dark:text-[#64748B]" />
          </button>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-2 gap-3">
          {infoCards.map((card) => (
            <div key={card.titleKey} className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4">
              <div className="w-8 h-8 rounded-full flex items-center justify-center mb-2" style={{ backgroundColor: card.bg }}>
                <card.icon className="w-4 h-4" style={{ color: card.color }} />
              </div>
              <h3 className="font-semibold text-sm text-[#1A1A2E] dark:text-[#E5E7EB] mb-1">{t(card.titleKey)}</h3>
              <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">{t(card.descKey)}</p>
            </div>
          ))}
        </div>

        {/* Logout */}
        <button
          onClick={() => {
            // Must clear the real session cookie server-side first —
            // clearing only localStorage left the session valid, so /app's
            // own check immediately bounced back to the dashboard instead
            // of logging out.
            logoutMutation.mutate(undefined, {
              onSettled: () => {
                localStorage.removeItem("userRole");
                localStorage.removeItem("userPhone");
                // Straight back to this role's own login screen, not the
                // generic role picker.
                navigate("/login", { state: { role: "driver" }, replace: true });
              },
            });
          }}
          className="w-full flex items-center gap-4 p-4 bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm text-left hover:shadow-md transition-shadow"
        >
          <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-[#3A1A1A] flex items-center justify-center flex-shrink-0">
            <LogOut className="w-5 h-5 text-[#DC2626]" />
          </div>
          <span className="flex-1 font-medium text-[#DC2626] text-sm">{t("logOut")}</span>
          <ChevronRight className="w-5 h-5 text-[#9CA3AF] dark:text-[#64748B]" />
        </button>
      </div>

      <BottomNav role="driver" />
    </div>
  );
}
