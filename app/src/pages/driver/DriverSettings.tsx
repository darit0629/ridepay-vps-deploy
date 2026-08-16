import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  ArrowLeft, Moon, Sun, Languages, Bell, Shield, User,
  Phone, HelpCircle, MessageCircle, Lock, Trash2, Info, ChevronRight,
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage, languageNames, type Language } from "@/contexts/LanguageContext";
import { useNotifications } from "@/contexts/NotificationsContext";
import { useAuth } from "@/hooks/useAuth";
import BottomNav from "@/components/BottomNav";
import { trpc } from "@/providers/trpc";

interface EmergencyContact {
  name: string;
  relation: string;
  phone: string;
}

const EMPTY_EMERGENCY_CONTACT: EmergencyContact = { name: "", relation: "", phone: "" };

export default function DriverSettings() {
  const navigate = useNavigate();
  const { theme, toggleTheme, setRole } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const { pushEnabled, requestNotificationPermission, rideUpdatesEnabled, setRideUpdatesEnabled } = useNotifications();
  const logoutMutation = trpc.auth.logout.useMutation();
  const { user } = useAuth();

  useEffect(() => {
    setRole("driver");
  }, [setRole]);

  // No backend model for a driver's emergency contact exists yet — persisted
  // per-device, keyed to this driver's real account, same pattern used for
  // bank/payout details on DriverProfile.tsx.
  const [emergencyContact, setEmergencyContact] = useState<EmergencyContact>(EMPTY_EMERGENCY_CONTACT);
  const [lastSyncedUserId, setLastSyncedUserId] = useState(user?.id);
  if (user?.id !== lastSyncedUserId) {
    setLastSyncedUserId(user?.id);
    if (user?.id) {
      const saved = localStorage.getItem(`ridepay_emergency_contact_${user.id}`);
      if (saved) {
        try {
          setEmergencyContact(JSON.parse(saved) as EmergencyContact);
        } catch {
          setEmergencyContact(EMPTY_EMERGENCY_CONTACT);
        }
      }
    }
  }
  const [isEditingContact, setIsEditingContact] = useState(false);
  const [draftContact, setDraftContact] = useState<EmergencyContact>(emergencyContact);

  const startEditingContact = () => {
    setDraftContact(emergencyContact);
    setIsEditingContact(true);
  };
  const saveContact = () => {
    setEmergencyContact(draftContact);
    if (user?.id) localStorage.setItem(`ridepay_emergency_contact_${user.id}`, JSON.stringify(draftContact));
    setIsEditingContact(false);
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0F172A] pb-28">
      <div className="bg-white dark:bg-[#1E293B] px-4 py-3 flex items-center gap-3 shadow-sm">
        <button onClick={() => navigate("/driver/dashboard")} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
          <ArrowLeft className="w-5 h-5 text-[#1A1A2E] dark:text-[#E5E7EB]" />
        </button>
        <h1 className="font-bold text-lg text-[#1A1A2E] dark:text-[#E5E7EB]">{t("settings")}</h1>
      </div>

      <div className="p-4 space-y-4">
        {/* Appearance Settings */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4 space-y-4">
          <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">{t("appearance")}</h3>

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

        {/* Emergency Contact */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Phone className="w-5 h-5 text-[#DC2626]" />
              <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">Emergency Contact</h3>
            </div>
            {!isEditingContact && (
              <button onClick={startEditingContact} className="text-xs text-[#FF6B00] font-medium">Edit</button>
            )}
          </div>
          {isEditingContact ? (
            <div className="space-y-2">
              <input
                value={draftContact.name}
                onChange={(e) => setDraftContact((d) => ({ ...d, name: e.target.value }))}
                placeholder="Name"
                className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-lg px-3 py-2 text-sm text-[#1A1A2E] dark:text-[#E5E7EB] border border-gray-200 dark:border-gray-700 focus:border-[#FF6B00] outline-none"
              />
              <input
                value={draftContact.relation}
                onChange={(e) => setDraftContact((d) => ({ ...d, relation: e.target.value }))}
                placeholder="Relation"
                className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-lg px-3 py-2 text-sm text-[#1A1A2E] dark:text-[#E5E7EB] border border-gray-200 dark:border-gray-700 focus:border-[#FF6B00] outline-none"
              />
              <input
                value={draftContact.phone}
                onChange={(e) => setDraftContact((d) => ({ ...d, phone: e.target.value }))}
                placeholder="Phone number"
                className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-lg px-3 py-2 text-sm text-[#1A1A2E] dark:text-[#E5E7EB] border border-gray-200 dark:border-gray-700 focus:border-[#FF6B00] outline-none"
              />
              <div className="flex gap-2 pt-1">
                <button onClick={() => setIsEditingContact(false)} className="flex-1 bg-gray-100 dark:bg-gray-800 text-[#1A1A2E] dark:text-[#E5E7EB] text-sm font-semibold py-2 rounded-lg">
                  Cancel
                </button>
                <button onClick={saveContact} className="flex-1 bg-[#FF6B00] text-white text-sm font-semibold py-2 rounded-lg">
                  Save
                </button>
              </div>
            </div>
          ) : emergencyContact.name || emergencyContact.phone ? (
            <div className="flex items-center gap-3 bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl p-3">
              <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-[#3D1414] flex items-center justify-center flex-shrink-0">
                <User className="w-5 h-5 text-[#DC2626]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">{emergencyContact.name}{emergencyContact.relation ? ` · ${emergencyContact.relation}` : ""}</p>
                <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">{emergencyContact.phone || "No phone number added"}</p>
              </div>
              {emergencyContact.phone && (
                <a href={`tel:${emergencyContact.phone.replace(/\s/g, "")}`} className="w-9 h-9 rounded-full bg-[#E8F5E8] dark:bg-[#1A2D1A] flex items-center justify-center flex-shrink-0">
                  <Phone className="w-4 h-4 text-[#138808]" />
                </a>
              )}
            </div>
          ) : (
            <p className="text-sm text-[#9CA3AF] text-center py-3">No emergency contact added yet.</p>
          )}
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
              onClick={() => !pushEnabled && requestNotificationPermission("driver")}
              className={`w-12 h-6 rounded-full p-1 transition-colors ${pushEnabled ? "bg-[#138808]" : "bg-gray-300"}`}
            >
              <div className={`w-4 h-4 rounded-full bg-white transition-transform ${pushEnabled ? "translate-x-6" : "translate-x-0"}`} />
            </button>
          </div>

          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-[#1A1A2E] dark:text-[#E5E7EB]" />
              <span className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">{t("rideRequests")}</span>
            </div>
            <button
              onClick={() => setRideUpdatesEnabled(!rideUpdatesEnabled)}
              className={`w-12 h-6 rounded-full p-1 transition-colors ${rideUpdatesEnabled ? "bg-[#138808]" : "bg-gray-300"}`}
            >
              <div className={`w-4 h-4 rounded-full bg-white transition-transform ${rideUpdatesEnabled ? "translate-x-6" : "translate-x-0"}`} />
            </button>
          </div>
        </div>

        {/* Help & Support */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4 space-y-1">
          <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] mb-2">Help & Support</h3>
          <button
            onClick={() => navigate("/driver/support")}
            className="flex items-center gap-3 py-3 w-full border-b border-gray-100 dark:border-gray-700"
          >
            <HelpCircle className="w-5 h-5 text-[#1A1A2E] dark:text-[#E5E7EB]" />
            <span className="flex-1 text-left text-sm text-[#6B7280] dark:text-[#9CA3AF]">Help Center</span>
            <ChevronRight className="w-4 h-4 text-[#9CA3AF]" />
          </button>
          <button
            onClick={() => navigate("/driver/ai-chat")}
            className="flex items-center gap-3 py-3 w-full border-b border-gray-100 dark:border-gray-700"
          >
            <MessageCircle className="w-5 h-5 text-[#1A1A2E] dark:text-[#E5E7EB]" />
            <span className="flex-1 text-left text-sm text-[#6B7280] dark:text-[#9CA3AF]">Support Chat</span>
            <ChevronRight className="w-4 h-4 text-[#9CA3AF]" />
          </button>
          <button onClick={() => navigate("/user/privacy")} className="flex items-center gap-3 py-3 w-full border-b border-gray-100 dark:border-gray-700">
            <Lock className="w-5 h-5 text-[#1A1A2E] dark:text-[#E5E7EB]" />
            <span className="flex-1 text-left text-sm text-[#6B7280] dark:text-[#9CA3AF]">Privacy Settings</span>
            <ChevronRight className="w-4 h-4 text-[#9CA3AF]" />
          </button>
          <button onClick={() => navigate("/legal/privacy-policy")} className="flex items-center gap-3 py-3 w-full border-b border-gray-100 dark:border-gray-700">
            <Lock className="w-5 h-5 text-[#1A1A2E] dark:text-[#E5E7EB]" />
            <span className="flex-1 text-left text-sm text-[#6B7280] dark:text-[#9CA3AF]">Privacy Policy</span>
            <ChevronRight className="w-4 h-4 text-[#9CA3AF]" />
          </button>
          <button onClick={() => navigate("/legal/terms")} className="flex items-center gap-3 py-3 w-full border-b border-gray-100 dark:border-gray-700">
            <Lock className="w-5 h-5 text-[#1A1A2E] dark:text-[#E5E7EB]" />
            <span className="flex-1 text-left text-sm text-[#6B7280] dark:text-[#9CA3AF]">Terms &amp; Conditions</span>
            <ChevronRight className="w-4 h-4 text-[#9CA3AF]" />
          </button>
          <button onClick={() => navigate("/legal/driver-agreement")} className="flex items-center gap-3 py-3 w-full border-b border-gray-100 dark:border-gray-700">
            <Lock className="w-5 h-5 text-[#1A1A2E] dark:text-[#E5E7EB]" />
            <span className="flex-1 text-left text-sm text-[#6B7280] dark:text-[#9CA3AF]">Driver Agreement</span>
            <ChevronRight className="w-4 h-4 text-[#9CA3AF]" />
          </button>
          <button onClick={() => navigate("/legal/cancellation-policy")} className="flex items-center gap-3 py-3 w-full border-b border-gray-100 dark:border-gray-700">
            <Lock className="w-5 h-5 text-[#1A1A2E] dark:text-[#E5E7EB]" />
            <span className="flex-1 text-left text-sm text-[#6B7280] dark:text-[#9CA3AF]">Cancellation Policy</span>
            <ChevronRight className="w-4 h-4 text-[#9CA3AF]" />
          </button>
          <button onClick={() => navigate("/user/safety")} className="flex items-center gap-3 py-3 w-full">
            <Shield className="w-5 h-5 text-[#1A1A2E] dark:text-[#E5E7EB]" />
            <span className="flex-1 text-left text-sm text-[#6B7280] dark:text-[#9CA3AF]">Safety Center</span>
            <ChevronRight className="w-4 h-4 text-[#9CA3AF]" />
          </button>
        </div>

        {/* Account Settings */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4 space-y-4">
          <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">{t("account")}</h3>

          <button
            onClick={() => navigate("/driver/profile")}
            className="flex items-center gap-3 py-3 w-full border-b border-gray-100 dark:border-gray-700"
          >
            <User className="w-5 h-5 text-[#1A1A2E] dark:text-[#E5E7EB]" />
            <span className="flex-1 text-left">
              <span className="block text-sm text-[#1A1A2E] dark:text-[#E5E7EB]">{t("editProfile")}</span>
              <span className="block text-xs text-[#9CA3AF]">Personal info, vehicle, bank & documents</span>
            </span>
            <ChevronRight className="w-4 h-4 text-[#9CA3AF]" />
          </button>

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
            className="flex items-center gap-3 py-3 w-full text-[#DC2626] border-b border-gray-100 dark:border-gray-700"
          >
            <Shield className="w-5 h-5" />
            <span className="text-sm">{t("logOut")}</span>
          </button>

          <button
            onClick={() => navigate("/account/delete")}
            className="flex items-center gap-3 py-3 w-full text-[#DC2626]"
          >
            <Trash2 className="w-5 h-5" />
            <span className="text-sm">Delete Account</span>
          </button>
        </div>

        {/* About / Version */}
        <button onClick={() => navigate("/about")} className="w-full bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4 text-left">
          <div className="flex items-center gap-3">
            <Info className="w-5 h-5 text-[#9CA3AF]" />
            <div className="flex-1">
              <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">Ridepay Driver</p>
              <p className="text-xs text-[#9CA3AF]">Version 1.0.0</p>
            </div>
            <ChevronRight className="w-4 h-4 text-[#9CA3AF]" />
          </div>
        </button>
      </div>

      <BottomNav role="driver" />
    </div>
  );
}
