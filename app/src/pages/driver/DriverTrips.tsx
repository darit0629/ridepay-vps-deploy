import { useState } from "react";
import { ArrowLeft, Car, Banknote, Smartphone, Route as RouteIcon, Clock } from "lucide-react";
import { useNavigate } from "react-router";
import BottomNav from "@/components/BottomNav";
import { trpc } from "@/providers/trpc";
import { useLanguage } from "@/contexts/LanguageContext";

const STATUS_LABEL: Record<string, string> = {
  completed: "Completed",
  cancelled: "Cancelled",
  driver_cancelled: "Cancelled",
  searching: "Searching",
  accepted: "Accepted",
  pickup: "Pickup",
  ongoing: "Ongoing",
};

const STATUS_LABEL_KEY: Record<string, string> = {
  completed: "status.completed",
  cancelled: "status.cancelled",
  driver_cancelled: "status.cancelled",
  searching: "status.searching",
  accepted: "status.matched",
  pickup: "status.pickup",
  ongoing: "status.ongoing",
};

function formatDate(date: Date): string {
  return new Date(date).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function DriverTrips() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState("All");
  const tabs: { id: string; labelKey: string }[] = [
    { id: "All", labelKey: "common.all" },
    { id: "Completed", labelKey: "status.completed" },
    { id: "Cancelled", labelKey: "status.cancelled" },
  ];

  const { data } = trpc.driver.getTrips.useQuery({ limit: 50 });
  const driverTrips = data?.items ?? [];

  const filtered =
    activeTab === "All"
      ? driverTrips
      : driverTrips.filter((t) => (STATUS_LABEL[t.status] ?? t.status) === activeTab);

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0F172A] pb-28">
      {/* Header */}
      <div className="bg-white dark:bg-[#1E293B] px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => navigate("/driver/dashboard")} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full">
          <ArrowLeft className="w-5 h-5 text-[#1A1A2E] dark:text-[#E5E7EB]" />
        </button>
        <h1 className="font-bold text-lg text-[#1A1A2E] dark:text-[#E5E7EB]">{t("dtrips.myTrips")}</h1>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-[#1E293B] px-4 pb-3 flex gap-6 border-b border-gray-100 dark:border-gray-700">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`pb-2 text-sm font-medium transition-colors ${
              activeTab === tab.id ? "text-[#FF6B00] border-b-2 border-[#FF6B00]" : "text-[#6B7280] dark:text-[#9CA3AF]"
            }`}
          >
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      {/* Trip List */}
      <div className="px-4 py-4 space-y-3">
        {filtered.length === 0 && (
          <p className="text-center text-sm text-[#9CA3AF] py-6">{t("dtrips.noTripsYet")}</p>
        )}
        {filtered.map((trip) => (
          <button
            key={trip.id}
            onClick={() => navigate(`/driver/trips/${trip.id}`)}
            className="w-full bg-white dark:bg-[#1E293B] rounded-2xl p-4 shadow-sm text-left hover:shadow-md transition-shadow"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-[#FFF5EB] dark:bg-[#3D2914] flex items-center justify-center flex-shrink-0">
                <Car className="w-5 h-5 text-[#FF6B00]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-medium text-sm text-[#1A1A2E] dark:text-[#E5E7EB] truncate">
                    {trip.pickupAddress} → {trip.dropAddress}
                  </h3>
                  <span className="font-bold text-[#1A1A2E] dark:text-[#E5E7EB] flex-shrink-0 ml-2">₹{Number(trip.totalFare)}</span>
                </div>
                <p className="text-xs text-[#9CA3AF] mb-2">{formatDate(trip.createdAt)}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    trip.rideType === "reserve" ? "bg-[#FFF5EB] dark:bg-[#3D2914] text-[#FF6B00]" : "bg-[#E8F5E8] dark:bg-[#1A2D1A] text-[#138808]"
                  }`}>
                    {trip.rideType === "reserve" ? t("ride.reserveRide") : t("ride.shareRide")}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 dark:bg-gray-800 text-[#6B7280] dark:text-[#9CA3AF]">
                    {STATUS_LABEL_KEY[trip.status] ? t(STATUS_LABEL_KEY[trip.status]) : trip.status}
                  </span>
                  {trip.paymentMethod && (
                    <span className="flex items-center gap-1 text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                      {trip.paymentMethod === "cash" ? <Banknote className="w-3 h-3" /> : <Smartphone className="w-3 h-3" />} {trip.paymentMethod}
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                    <RouteIcon className="w-3 h-3" /> {Number(trip.distance).toFixed(1)} km
                  </span>
                  <span className="flex items-center gap-1 text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                    <Clock className="w-3 h-3" /> {trip.estimatedTime} min
                  </span>
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>

      <BottomNav role="driver" />
    </div>
  );
}
