import { useNavigate } from "react-router";
import { TrendingUp, TrendingDown, Bell, Sparkles, AlertTriangle, ShieldAlert } from "lucide-react";
import { trpc } from "@/providers/trpc";
import AdminLayout from "@/components/admin/AdminLayout";

function parseTrend(trend: string): boolean {
  return trend.startsWith("+") || (trend !== "0%" && !trend.startsWith("-"));
}

export default function AdminDashboard() {
  const navigate = useNavigate();

  const { data: stats } = trpc.admin.getDashboardStats.useQuery();
  const { data: analytics } = trpc.admin.getRidesAnalytics.useQuery();
  const { data: ridesByType } = trpc.admin.getRidesByType.useQuery();
  const { data: statusSummary } = trpc.admin.getStatusSummary.useQuery();

  const statTiles = stats
    ? [
        { label: "Total Rides Today", value: String(stats.totalRidesToday), trend: stats.trends.rides, textClass: "text-[#FF6B00]" },
        { label: "Active Drivers", value: String(stats.activeDrivers), trend: null, textClass: "text-[#138808]" },
        { label: "Registered Customers", value: stats.registeredCustomers.toLocaleString("en-IN"), trend: stats.trends.customers, textClass: "text-[#1E3A5F] dark:text-[#93C5FD]" },
        { label: "Revenue / Commission", value: `₹${stats.revenue.toLocaleString("en-IN")}`, trend: stats.trends.revenue, textClass: "text-[#FF6B00]" },
      ]
    : [];

  const statusTiles = statusSummary
    ? [
        { label: "Completed Rides", value: String(statusSummary.completed), color: "#138808" },
        { label: "Cancelled Rides", value: String(statusSummary.cancelled), color: "#DC2626" },
        { label: "Ongoing Rides", value: String(statusSummary.ongoing), color: "#FF6B00" },
        { label: "Driver Cancelled", value: String(statusSummary.driverCancelled), color: "#9CA3AF" },
        { label: "Customer Cancelled", value: String(statusSummary.customerCancelled), color: "#6B7280" },
      ]
    : [];

  const statsSnapshot = stats && statusSummary
    ? statTiles.map((s) => `${s.label}: ${s.value}${s.trend ? ` (${s.trend})` : ""}`).join(". ") +
      `. ${statusTiles.map((s) => `${s.label}: ${s.value}`).join(", ")}.`
    : "";

  const { data: insightsData, isLoading: insightsLoading } = trpc.ai.insights.useQuery({ statsSnapshot }, { enabled: !!statsSnapshot });

  const insightStyle = {
    positive: { icon: TrendingUp, color: "#138808", bg: "#E8F5E8" },
    warning: { icon: AlertTriangle, color: "#FF6B00", bg: "#FFF5EB" },
    critical: { icon: ShieldAlert, color: "#DC2626", bg: "#FEE2E2" },
  } as const;

  const maxHourRides = Math.max(1, ...(analytics?.ridesByHour.map((h) => h.rides) ?? [1]));

  return (
    <AdminLayout
      title="Dashboard"
      headerActions={
        <>
          <span className="hidden sm:inline text-sm text-[#6B7280] dark:text-[#9CA3AF]">
            {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
          </span>
          <button
            onClick={() => navigate("/admin/notifications")}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full relative"
            aria-label="Push Notifications"
          >
            <Bell className="w-5 h-5 text-[#1A1A2E] dark:text-[#E5E7EB]" />
          </button>
        </>
      }
    >
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statTiles.map((stat) => (
          <div key={stat.label} className="bg-white dark:bg-[#1E293B] rounded-2xl p-4 shadow-sm">
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-2">{stat.label}</p>
            <div className="flex items-end justify-between">
              <p className={`text-2xl font-bold ${stat.textClass}`}>{stat.value}</p>
              {stat.trend && (
                <div className={`flex items-center gap-0.5 text-xs font-medium ${parseTrend(stat.trend) ? "text-[#138808]" : "text-[#DC2626]"}`}>
                  {parseTrend(stat.trend) ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {stat.trend}
                </div>
              )}
            </div>
            <p className="text-[10px] text-[#9CA3AF] mt-1">{stat.trend ? "vs yesterday" : "live"}</p>
          </div>
        ))}
      </div>

      {/* AI Insights */}
      <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-full bg-[#F3E8FF] flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-[#7C3AED]" />
          </div>
          <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">AI Insights</h3>
        </div>

        {insightsLoading || !insightsData ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 bg-gray-100 dark:bg-gray-700 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {insightsData?.insights.map((insight, i) => {
              const style = insightStyle[insight.type];
              return (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: style.bg }}>
                  <style.icon className="w-4 h-4 flex-shrink-0" style={{ color: style.color }} />
                  <p className="text-sm" style={{ color: style.color }}>{insight.text}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Rides Analytics */}
      <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-6">
        <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] mb-4">Rides Analytics — Today</h3>
        <div className="h-48 flex items-end justify-around gap-2">
          {(analytics?.ridesByHour ?? []).map((h, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full relative">
                <div
                  className="w-full bg-[#138808]/20 rounded-t"
                  style={{ height: `${Math.max(2, (h.rides / maxHourRides) * 160)}px` }}
                  title={`${h.rides} rides, ₹${h.revenue}`}
                />
              </div>
              {i % 4 === 0 && (
                <span className="text-[10px] text-[#9CA3AF]">{h.hour}</span>
              )}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 mt-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-[#138808]" />
            <span className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Rides settled per hour today</span>
          </div>
        </div>
      </div>

      {/* Rides by Type */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-6">
          <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] mb-4">Rides vs Parcels — Today</h3>
          <div className="flex items-center justify-center">
            <div className="relative w-32 h-32">
              <svg className="w-32 h-32 -rotate-90" viewBox="0 0 128 128">
                <circle cx="64" cy="64" r="56" fill="none" stroke="#FFF5EB" strokeWidth="16" />
                <circle cx="64" cy="64" r="56" fill="none" stroke="#FF6B00" strokeWidth="16"
                  strokeDasharray={`${((ridesByType?.percentages.rides ?? 0) / 100) * 352} 352`} />
                <circle cx="64" cy="64" r="36" fill="none" stroke="#E8F5E8" strokeWidth="16" />
                <circle cx="64" cy="64" r="36" fill="none" stroke="#138808" strokeWidth="16"
                  strokeDasharray={`${((ridesByType?.percentages.parcels ?? 0) / 100) * 226} 226`} />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xl font-bold text-[#1A1A2E] dark:text-[#E5E7EB]">{(ridesByType?.rides ?? 0) + (ridesByType?.parcels ?? 0)}</span>
              </div>
            </div>
          </div>
          <div className="flex justify-center gap-6 mt-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#FF6B00]" />
              <span className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Rides ({ridesByType?.percentages.rides ?? 0}%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#138808]" />
              <span className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Parcels ({ridesByType?.percentages.parcels ?? 0}%)</span>
            </div>
          </div>
        </div>

        {/* Status Summary */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-6">
          <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] mb-4">Status Summary — Today</h3>
          <div className="grid grid-cols-2 gap-3">
            {statusTiles.map((item) => (
              <div key={item.label} className="bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">{item.label}</span>
                </div>
                <p className="text-lg font-bold" style={{ color: item.color }}>{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
