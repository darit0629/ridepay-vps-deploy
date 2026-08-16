import { useEffect } from "react";
import { useNavigate } from "react-router";
import { Moon, Sun, Languages, ChevronRight, IndianRupee } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useLanguage, languageNames, type Language } from "@/contexts/LanguageContext";
import AdminLayout from "@/components/admin/AdminLayout";

export default function AdminSettings() {
  const navigate = useNavigate();
  const { theme, toggleTheme, setRole } = useTheme();
  const { language, setLanguage, t } = useLanguage();

  useEffect(() => {
    setRole("admin");
  }, [setRole]);

  return (
    <AdminLayout title={t("settings")}>
      <div className="max-w-2xl space-y-6">
        {/* Theme & Language Settings */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-6 space-y-4">
          <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">Appearance & Language</h3>

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

        {/* Link to Fare Configuration */}
        <button
          onClick={() => navigate("/admin/fare-configuration")}
          className="w-full flex items-center gap-4 bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4 hover:shadow-md transition-shadow"
        >
          <div className="w-10 h-10 rounded-full bg-[#FFF5EB] dark:bg-[#3D2914] flex items-center justify-center flex-shrink-0">
            <IndianRupee className="w-5 h-5 text-[#FF6B00]" />
          </div>
          <div className="flex-1 text-left">
            <p className="font-medium text-sm text-[#1A1A2E] dark:text-[#E5E7EB]">Fare Configuration</p>
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Base fares, surge pricing, AI suggestions</p>
          </div>
          <ChevronRight className="w-5 h-5 text-[#9CA3AF]" />
        </button>
      </div>
    </AdminLayout>
  );
}
