import { useState } from "react";
import { ArrowLeft, Car } from "lucide-react";
import { useNavigate } from "react-router";
import BottomNav from "@/components/BottomNav";
import { trpc } from "@/providers/trpc";
import { useLanguage } from "@/contexts/LanguageContext";

const STATUS_LABEL: Record<string, { labelKey: string; color: string; bg: string }> = {
  completed: { labelKey: "status.completed", color: "#138808", bg: "#E8F5E8" },
  cancelled: { labelKey: "status.cancelled", color: "#DC2626", bg: "#FEE2E2" },
  driver_cancelled: { labelKey: "status.cancelled", color: "#DC2626", bg: "#FEE2E2" },
  searching: { labelKey: "status.searching", color: "#FF6B00", bg: "#FFF5EB" },
  accepted: { labelKey: "status.matched", color: "#0EA5E9", bg: "#E0F2FE" },
  pickup: { labelKey: "status.pickup", color: "#0EA5E9", bg: "#E0F2FE" },
  ongoing: { labelKey: "status.ongoing", color: "#0EA5E9", bg: "#E0F2FE" },
};

function formatDate(date: Date): string {
  return new Date(date).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function UserHistory() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState("All");
  const tabs: { id: string; labelKey: string }[] = [
    { id: "All", labelKey: "common.all" },
    { id: "Reserve", labelKey: "ride.reserveRide" },
    { id: "Share", labelKey: "ride.shareRide" },
  ];

  const { data } = trpc.user.getRideHistory.useQuery({ limit: 50 });
  const rideHistory = data?.items ?? [];

  const filtered =
    activeTab === "All" ? rideHistory : rideHistory.filter((r) => r.rideType === activeTab.toLowerCase());

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0F172A] pb-20">
      {/* Header */}
      <div className="bg-white dark:bg-[#1E293B] px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => navigate("/user/home")} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full">
          <ArrowLeft className="w-5 h-5 text-[#1A1A2E] dark:text-[#E5E7EB]" />
        </button>
        <h1 className="font-bold text-lg text-[#1A1A2E] dark:text-[#E5E7EB]">{t("history.title")}</h1>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-[#1E293B] px-4 pb-3 flex gap-6 border-b border-gray-100 dark:border-gray-700">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`pb-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "text-[#FF6B00] border-b-2 border-[#FF6B00]"
                : "text-[#6B7280] dark:text-[#9CA3AF]"
            }`}
          >
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      {/* Ride List */}
      <div className="px-4 py-4 space-y-3">
        {filtered.length === 0 && (
          <p className="text-center text-sm text-[#9CA3AF] py-6">{t("history.noRides")}</p>
        )}
        {filtered.map((ride) => {
          const status = STATUS_LABEL[ride.status] ?? STATUS_LABEL.completed;
          return (
            <div key={ride.id} className="bg-white dark:bg-[#1E293B] rounded-2xl p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-[#FFF5EB] dark:bg-[#3A2A1A] flex items-center justify-center flex-shrink-0">
                  <Car className="w-5 h-5 text-[#FF6B00]" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-medium text-[#1A1A2E] dark:text-[#E5E7EB] text-sm">
                      {ride.pickupAddress} → {ride.dropAddress}
                    </h3>
                    <span className="font-bold text-[#1A1A2E] dark:text-[#E5E7EB]">₹{Number(ride.totalFare)}</span>
                  </div>
                  <p className="text-xs text-[#9CA3AF] dark:text-[#64748B] mb-2">{formatDate(ride.createdAt)}</p>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        ride.rideType === "reserve"
                          ? "bg-[#FFF5EB] dark:bg-[#3A2A1A] text-[#FF6B00]"
                          : "bg-[#E8F5E8] dark:bg-[#1A3A22] text-[#138808]"
                      }`}
                    >
                      {ride.rideType === "reserve" ? t("ride.reserveRide") : t("ride.shareRide")}
                    </span>
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ color: status.color, backgroundColor: status.bg }}
                    >
                      {t(status.labelKey)}
                    </span>
                    {!!ride.rating && ride.rating > 0 && (
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: ride.rating }).map((_, i) => (
                          <svg key={i} className="w-3 h-3 text-[#FF6B00] fill-[#FF6B00]" viewBox="0 0 24 24">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                          </svg>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <BottomNav role="user" />
    </div>
  );
}
