import { useEffect } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Moon, Sun, Languages, Bell, Shield, User, FileText, HelpCircle, Info, Trash2, ChevronRight } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage, languageNames, type Language } from "@/contexts/LanguageContext";
import { useNotifications } from "@/contexts/NotificationsContext";
import BottomNav from "@/components/BottomNav";
import { trpc } from "@/providers/trpc";

export default function UserSettings() {
  const navigate = useNavigate();
  const { theme, toggleTheme, setRole } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const { pushEnabled, requestNotificationPermission, rideUpdatesEnabled, setRideUpdatesEnabled } = useNotifications();
  const logoutMutation = trpc.auth.logout.useMutation();

  useEffect(() => {
    setRole("rider");
  }, [setRole]);

  // Must clear the real session cookie server-side first — clearing only
  // localStorage left the actual session valid, so /app's own session
  // check immediately bounced back to the dashboard instead of logging out.
  const handleLogOut = () => {
    logoutMutation.mutate(undefined, {
      onSettled: () => {
        localStorage.removeItem("userRole");
        localStorage.removeItem("userPhone");
        // Straight back to this role's own login screen, not the generic
        // role picker — a rider who just logged out wants to log back in
        // as a rider, not choose a role from scratch.
        navigate("/login", { state: { role: "user" }, replace: true });
      },
    });
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0F172A] pb-20">
      <div className="bg-white dark:bg-[#1E293B] px-4 py-3 flex items-center gap-3 shadow-sm">
        <button onClick={() => navigate("/user/home")} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
          <ArrowLeft className="w-5 h-5 text-[#1A1A2E] dark:text-[#E5E7EB]" />
        </button>
        <h1 className="font-bold text-lg text-[#1A1A2E] dark:text-[#E5E7EB]">{t("settings")}</h1>
      </div>

      <div className="p-4 space-y-4">
        {/* Appearance Settings */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4 space-y-4">
          <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">{t("appearance")}</h3>
          
          {/* Dark Mode Toggle */}
          <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-3">
              {theme === "dark" ? <Moon className="w-5 h-5 text-[#1A1A2E] dark:text-[#E5E7EB]" /> : <Sun className="w-5 h-5 text-[#1A1A2E] dark:text-[#E5E7EB]" />}
              <span className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">{t("darkMode")}</span>
            </div>
            <button
              onClick={toggleTheme}
              className={`w-12 h-6 rounded-full p-1 transition-colors ${theme === "dark" ? "bg-[#FF6B00]" : "bg-gray-300"}`}
            >
              <div className={`w-4 h-4 rounded-full bg-white transition-transform ${theme === "dark" ? "translate-x-6" : "translate-x-0"}`} />
            </button>
          </div>

          {/* Language Selector */}
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <Languages className="w-5 h-5 text-[#1A1A2E] dark:text-[#E5E7EB]" />
              <span className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">{t("language")}</span>
            </div>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as Language)}
              className="bg-[#F8F9FA] dark:bg-[#0F172A] rounded-lg px-3 py-2 text-sm text-[#1A1A2E] dark:text-[#E5E7EB] border border-gray-200 dark:border-gray-700 focus:border-[#FF6B00] outline-none"
            >
              {Object.entries(languageNames).map(([code, name]) => (
                <option key={code} value={code}>{name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Notification Settings */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4 space-y-4">
          <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">{t("notifications")}</h3>
          
          <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-[#1A1A2E] dark:text-[#E5E7EB]" />
              <span className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">{t("pushNotifications")}</span>
            </div>
            <button
              onClick={() => !pushEnabled && requestNotificationPermission("rider")}
              className={`w-12 h-6 rounded-full p-1 transition-colors ${pushEnabled ? "bg-[#138808]" : "bg-gray-300"}`}
            >
              <div className={`w-4 h-4 rounded-full bg-white transition-transform ${pushEnabled ? "translate-x-6" : "translate-x-0"}`} />
            </button>
          </div>

          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-[#1A1A2E] dark:text-[#E5E7EB]" />
              <span className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">{t("rideUpdates")}</span>
            </div>
            <button
              onClick={() => setRideUpdatesEnabled(!rideUpdatesEnabled)}
              className={`w-12 h-6 rounded-full p-1 transition-colors ${rideUpdatesEnabled ? "bg-[#138808]" : "bg-gray-300"}`}
            >
              <div className={`w-4 h-4 rounded-full bg-white transition-transform ${rideUpdatesEnabled ? "translate-x-6" : "translate-x-0"}`} />
            </button>
          </div>
        </div>

        {/* Account Settings */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4 space-y-4">
          <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">{t("account")}</h3>

          <button onClick={() => navigate("/user/profile")} className="flex items-center gap-3 py-3 w-full border-b border-gray-100 dark:border-gray-700">
            <User className="w-5 h-5 text-[#1A1A2E] dark:text-[#E5E7EB]" />
            <span className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">{t("editProfile")}</span>
          </button>

          <button onClick={() => navigate("/user/privacy")} className="flex items-center gap-3 py-3 w-full border-b border-gray-100 dark:border-gray-700">
            <Shield className="w-5 h-5 text-[#1A1A2E] dark:text-[#E5E7EB]" />
            <span className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">{t("privacySettings")}</span>
          </button>

          <button onClick={handleLogOut} className="flex items-center gap-3 py-3 w-full text-[#DC2626]">
            <Shield className="w-5 h-5" />
            <span className="text-sm">{t("logOut")}</span>
          </button>
        </div>

        {/* Legal & Support */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4 space-y-1">
          <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] mb-2">Legal &amp; Support</h3>

          <button onClick={() => navigate("/user/support")} className="flex items-center gap-3 py-3 w-full border-b border-gray-100 dark:border-gray-700">
            <HelpCircle className="w-5 h-5 text-[#1A1A2E] dark:text-[#E5E7EB]" />
            <span className="flex-1 text-left text-sm text-[#6B7280] dark:text-[#9CA3AF]">Help Center</span>
            <ChevronRight className="w-4 h-4 text-[#9CA3AF]" />
          </button>

          <button onClick={() => navigate("/legal/privacy-policy")} className="flex items-center gap-3 py-3 w-full border-b border-gray-100 dark:border-gray-700">
            <FileText className="w-5 h-5 text-[#1A1A2E] dark:text-[#E5E7EB]" />
            <span className="flex-1 text-left text-sm text-[#6B7280] dark:text-[#9CA3AF]">Privacy Policy</span>
            <ChevronRight className="w-4 h-4 text-[#9CA3AF]" />
          </button>

          <button onClick={() => navigate("/legal/terms")} className="flex items-center gap-3 py-3 w-full border-b border-gray-100 dark:border-gray-700">
            <FileText className="w-5 h-5 text-[#1A1A2E] dark:text-[#E5E7EB]" />
            <span className="flex-1 text-left text-sm text-[#6B7280] dark:text-[#9CA3AF]">Terms &amp; Conditions</span>
            <ChevronRight className="w-4 h-4 text-[#9CA3AF]" />
          </button>

          <button onClick={() => navigate("/legal/refund-policy")} className="flex items-center gap-3 py-3 w-full border-b border-gray-100 dark:border-gray-700">
            <FileText className="w-5 h-5 text-[#1A1A2E] dark:text-[#E5E7EB]" />
            <span className="flex-1 text-left text-sm text-[#6B7280] dark:text-[#9CA3AF]">Refund Policy</span>
            <ChevronRight className="w-4 h-4 text-[#9CA3AF]" />
          </button>

          <button onClick={() => navigate("/legal/cancellation-policy")} className="flex items-center gap-3 py-3 w-full border-b border-gray-100 dark:border-gray-700">
            <FileText className="w-5 h-5 text-[#1A1A2E] dark:text-[#E5E7EB]" />
            <span className="flex-1 text-left text-sm text-[#6B7280] dark:text-[#9CA3AF]">Cancellation Policy</span>
            <ChevronRight className="w-4 h-4 text-[#9CA3AF]" />
          </button>

          <button onClick={() => navigate("/user/safety")} className="flex items-center gap-3 py-3 w-full border-b border-gray-100 dark:border-gray-700">
            <Shield className="w-5 h-5 text-[#1A1A2E] dark:text-[#E5E7EB]" />
            <span className="flex-1 text-left text-sm text-[#6B7280] dark:text-[#9CA3AF]">Safety Center</span>
            <ChevronRight className="w-4 h-4 text-[#9CA3AF]" />
          </button>

          <button onClick={() => navigate("/about")} className="flex items-center gap-3 py-3 w-full">
            <Info className="w-5 h-5 text-[#1A1A2E] dark:text-[#E5E7EB]" />
            <span className="flex-1 text-left text-sm text-[#6B7280] dark:text-[#9CA3AF]">About Ridepay</span>
            <ChevronRight className="w-4 h-4 text-[#9CA3AF]" />
          </button>
        </div>

        {/* Danger Zone */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4">
          <button onClick={() => navigate("/account/delete")} className="flex items-center gap-3 py-1 w-full text-[#DC2626]">
            <Trash2 className="w-5 h-5" />
            <span className="text-sm font-medium">Delete Account</span>
          </button>
        </div>
      </div>

      <BottomNav role="user" />
    </div>
  );
}
