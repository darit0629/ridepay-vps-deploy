import { ArrowLeft, HelpCircle, AlertTriangle, Shield, Phone, Mail, Info, ChevronRight, Sparkles } from "lucide-react";
import { useNavigate } from "react-router";
import BottomNav from "@/components/BottomNav";
import { useLanguage } from "@/contexts/LanguageContext";
import { SUPPORT_EMAIL_MAILTO, SUPPORT_PHONE_TEL } from "@/lib/supportContact";

export default function UserSupport() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const supportOptions = [
    { icon: HelpCircle, titleKey: "support.faq", color: "#FF6B00", bg: "#FFF5EB", action: () => navigate("/help/faq") },
    { icon: AlertTriangle, titleKey: "support.reportIssue", color: "#DC2626", bg: "#FEF2F2", action: () => navigate("/help/report-issue") },
    { icon: Shield, titleKey: "support.safetyEmergency", color: "#138808", bg: "#E8F5E8", action: () => navigate("/user/safety") },
    { icon: Phone, titleKey: "support.callSupport", color: "#1E3A5F", bg: "#E8EEF5", action: () => { window.location.href = SUPPORT_PHONE_TEL; } },
    { icon: Mail, titleKey: "support.contactUs", color: "#1E3A5F", bg: "#E8EEF5", action: () => { window.location.href = SUPPORT_EMAIL_MAILTO; } },
    { icon: Info, titleKey: "support.aboutRidepay", color: "#6B7280", bg: "#F3F4F6", action: () => navigate("/about") },
  ];

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0F172A] pb-20">
      {/* Header */}
      <div className="bg-white dark:bg-[#1E293B] px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate("/user/home")} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full">
          <ArrowLeft className="w-5 h-5 text-[#1A1A2E] dark:text-[#E5E7EB]" />
        </button>
        <h1 className="font-bold text-lg text-[#1A1A2E] dark:text-[#E5E7EB]">{t("support.title")}</h1>
      </div>

      <div className="px-4 py-4 space-y-4">
        <h2 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] text-lg">{t("support.howCanWeHelp")}</h2>

        {/* AI Chat Entry */}
        <button
          onClick={() => navigate("/user/ai-chat")}
          className="w-full flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-[#7C3AED] to-[#9333EA] text-left hover:opacity-95 transition-opacity"
        >
          <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-white text-sm">{t("support.chatWithWingman")}</p>
            <p className="text-xs text-white/70">{t("support.instantAnswers")}</p>
          </div>
          <ChevronRight className="w-5 h-5 text-white/70" />
        </button>

        <div className="space-y-3">
          {supportOptions.map((option) => (
            <button
              key={option.titleKey}
              onClick={option.action}
              className="w-full flex items-center gap-4 p-4 bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm text-left hover:shadow-md transition-shadow"
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: option.bg }}
              >
                <option.icon className="w-6 h-6" style={{ color: option.color }} />
              </div>
              <span className="flex-1 font-medium text-[#1A1A2E] dark:text-[#E5E7EB] text-sm">{t(option.titleKey)}</span>
              <ChevronRight className="w-5 h-5 text-[#9CA3AF] dark:text-[#64748B]" />
            </button>
          ))}
        </div>

        {/* Emergency Card */}
        <div className="bg-red-50 dark:bg-[#3A1A1A] rounded-2xl p-4 border border-red-100 dark:border-[#5A2A2A]">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-[#4A2222] flex items-center justify-center">
              <Phone className="w-5 h-5 text-[#DC2626]" />
            </div>
            <div>
              <h3 className="font-semibold text-[#DC2626]">{t("support.emergencyHelpline")}</h3>
              <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">{t("support.availability24x7")}</p>
            </div>
          </div>
          <a href="tel:100" className="text-lg font-bold text-[#DC2626]">100</a>
        </div>
      </div>

      <BottomNav role="user" />
    </div>
  );
}
