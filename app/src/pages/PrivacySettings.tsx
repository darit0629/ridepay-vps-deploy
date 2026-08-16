import { useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, MapPin, Users, BarChart3 } from "lucide-react";

const PRIVACY_KEYS = {
  shareLocation: "ridepay_privacy_share_location",
  showProfileToRiders: "ridepay_privacy_show_profile",
  shareUsageData: "ridepay_privacy_share_usage",
} as const;

function loadFlag(key: string, fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback;
  const raw = window.localStorage.getItem(key);
  return raw === null ? fallback : raw === "1";
}

export default function PrivacySettings() {
  const navigate = useNavigate();
  const [shareLocation, setShareLocation] = useState(() => loadFlag(PRIVACY_KEYS.shareLocation, true));
  const [showProfile, setShowProfile] = useState(() => loadFlag(PRIVACY_KEYS.showProfileToRiders, true));
  const [shareUsage, setShareUsage] = useState(() => loadFlag(PRIVACY_KEYS.shareUsageData, false));

  const toggle = (key: string, value: boolean, setter: (v: boolean) => void) => {
    setter(value);
    window.localStorage.setItem(key, value ? "1" : "0");
  };

  const rows = [
    {
      icon: MapPin,
      title: "Share live location",
      subtitle: "Lets your captain/rider see your live location during a trip",
      value: shareLocation,
      onChange: (v: boolean) => toggle(PRIVACY_KEYS.shareLocation, v, setShareLocation),
    },
    {
      icon: Users,
      title: "Show profile to other party",
      subtitle: "Your name and rating are visible to the rider/captain you're matched with",
      value: showProfile,
      onChange: (v: boolean) => toggle(PRIVACY_KEYS.showProfileToRiders, v, setShowProfile),
    },
    {
      icon: BarChart3,
      title: "Share usage data",
      subtitle: "Helps Ridepay improve matching and pricing — never sold to third parties",
      value: shareUsage,
      onChange: (v: boolean) => toggle(PRIVACY_KEYS.shareUsageData, v, setShareUsage),
    },
  ];

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0F172A] pb-10">
      <div className="bg-white dark:bg-[#1E293B] px-4 py-3 flex items-center gap-3 shadow-sm">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
          <ArrowLeft className="w-5 h-5 text-[#1A1A2E] dark:text-[#E5E7EB]" />
        </button>
        <h1 className="font-bold text-lg text-[#1A1A2E] dark:text-[#E5E7EB]">Privacy Settings</h1>
      </div>

      <div className="p-4 space-y-3">
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4 space-y-4">
          {rows.map((row, i) => (
            <div key={row.title} className={`flex items-center justify-between gap-3 py-1 ${i < rows.length - 1 ? "pb-4 border-b border-gray-100 dark:border-gray-700" : ""}`}>
              <div className="flex items-center gap-3 min-w-0">
                <row.icon className="w-5 h-5 text-[#1A1A2E] dark:text-[#E5E7EB] flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">{row.title}</p>
                  <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">{row.subtitle}</p>
                </div>
              </div>
              <button
                onClick={() => row.onChange(!row.value)}
                className={`w-12 h-6 rounded-full p-1 transition-colors flex-shrink-0 ${row.value ? "bg-[#138808]" : "bg-gray-300"}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white transition-transform ${row.value ? "translate-x-6" : "translate-x-0"}`} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
