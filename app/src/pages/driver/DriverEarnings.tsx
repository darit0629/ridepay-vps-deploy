import { useState } from "react";
import {
  ArrowLeft, IndianRupee, Car, Gift, Users, Megaphone, Zap, AlertTriangle, Sparkles,
} from "lucide-react";
import { useNavigate } from "react-router";
import { AreaChart, Area, ResponsiveContainer, XAxis, Tooltip } from "recharts";
import BottomNav from "@/components/BottomNav";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { useAdCampaigns } from "@/contexts/AdCampaignsContext";
import { CURRENT_DRIVER_ID } from "@/lib/mockDrivers";
import { useLanguage } from "@/contexts/LanguageContext";

type Period = "Daily" | "Weekly" | "Monthly" | "Yearly";
const PERIODS: Period[] = ["Daily", "Weekly", "Monthly", "Yearly"];
const PERIOD_LABEL_KEYS: Record<Period, string> = {
  Daily: "earnings.daily",
  Weekly: "earnings.weekly",
  Monthly: "earnings.monthly",
  Yearly: "earnings.yearly",
};

interface EarningsRide {
  amount: string | number;
  method: "cash" | "upi" | "wallet";
  driverEarnings: string | number;
  createdAt: Date;
}

// Buckets this driver's real completed rides into a chart series for the
// selected period — replaces what used to be entirely hardcoded sample data.
function buildChartSeries(rides: EarningsRide[], period: Period): { label: string; amount: number }[] {
  const now = new Date();

  if (period === "Daily") {
    const buckets = Array.from({ length: 8 }, (_, i) => ({ startHour: i * 3, amount: 0 }));
    for (const r of rides) {
      const d = new Date(r.createdAt);
      if (d.toDateString() !== now.toDateString()) continue;
      const idx = Math.floor(d.getHours() / 3);
      buckets[idx].amount += Number(r.driverEarnings);
    }
    return buckets.map((b) => ({
      label: new Date(2000, 0, 1, b.startHour).toLocaleTimeString("en-US", { hour: "numeric" }).replace(" ", ""),
      amount: Math.round(b.amount),
    }));
  }

  if (period === "Weekly") {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now);
      d.setDate(now.getDate() - (6 - i));
      d.setHours(0, 0, 0, 0);
      return d;
    });
    const totals = days.map(() => 0);
    for (const r of rides) {
      const d = new Date(r.createdAt);
      const idx = days.findIndex((day) => d.toDateString() === day.toDateString());
      if (idx >= 0) totals[idx] += Number(r.driverEarnings);
    }
    return days.map((d, i) => ({ label: d.toLocaleDateString("en-US", { weekday: "short" }), amount: Math.round(totals[i]) }));
  }

  if (period === "Monthly") {
    const totals = [0, 0, 0, 0, 0];
    for (const r of rides) {
      const d = new Date(r.createdAt);
      if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) continue;
      const week = Math.min(4, Math.floor((d.getDate() - 1) / 7));
      totals[week] += Number(r.driverEarnings);
    }
    return totals.slice(0, 5).map((amount, i) => ({ label: `W${i + 1}`, amount: Math.round(amount) }));
  }

  // Yearly — trailing 6 months including this one.
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return d;
  });
  const totals = months.map(() => 0);
  for (const r of rides) {
    const d = new Date(r.createdAt);
    const idx = months.findIndex((m) => d.getFullYear() === m.getFullYear() && d.getMonth() === m.getMonth());
    if (idx >= 0) totals[idx] += Number(r.driverEarnings);
  }
  return months.map((m, i) => ({ label: m.toLocaleDateString("en-US", { month: "short" }), amount: Math.round(totals[i]) }));
}

export default function DriverEarnings() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [period, setPeriod] = useState<Period>("Weekly");
  const { user } = useAuth();
  const driverName = user?.name ?? "";
  const { campaigns } = useAdCampaigns();

  const { data: dashboard } = trpc.driver.getDashboard.useQuery();
  const { data: earningsData } = trpc.driver.getEarnings.useQuery();
  const { data: transactions } = trpc.settlement.listTransactions.useQuery(
    { walletType: "driver", ownerId: driverName, limit: 500 },
    { enabled: !!driverName }
  );

  const rides = earningsData?.rides ?? [];
  const now = new Date();
  const todaysRides = rides.filter((r) => new Date(r.createdAt).toDateString() === now.toDateString());
  const cashToday = Math.round(todaysRides.filter((r) => r.method === "cash").reduce((s, r) => s + Number(r.amount), 0));
  const onlineToday = Math.round(
    todaysRides.filter((r) => r.method === "upi" || r.method === "wallet").reduce((s, r) => s + Number(r.amount), 0)
  );

  const earnings = {
    today: dashboard?.todayEarnings ?? 0,
    cash: cashToday,
    online: onlineToday,
    dues: Number(dashboard?.platformDues ?? 0),
    totalRides: dashboard?.todayRides ?? 0,
    completed: dashboard?.completedRides ?? 0,
    cancelled: dashboard?.cancelledRides ?? 0,
  };

  const sumByType = (type: string) => (transactions ?? []).filter((t) => t.type === type).reduce((s, t) => s + Number(t.amount), 0);
  const isAllotted = (c: (typeof campaigns)[number]) => c.allottedDriverIds.includes(CURRENT_DRIVER_ID);
  const adEarnings = campaigns
    .filter((c) => c.status === "active" && isAllotted(c))
    .reduce((sum, c) => sum + (c.spent * c.driverSharePercent) / 100, 0);

  const breakdown = [
    { labelKey: "earnings.rideIncome", value: Math.round(sumByType("commission_credit")), icon: Car, color: "#138808", bg: "#E8F5E8" },
    { labelKey: "earnings.bonus", value: Math.round(sumByType("bonus")), icon: Gift, color: "#7C3AED", bg: "#F3E8FF" },
    { labelKey: "earnings.incentives", value: Math.round(sumByType("incentive")), icon: Zap, color: "#CA8A04", bg: "#FEF9C3" },
    { labelKey: "dashboard.referral", value: Math.round(sumByType("referral_credit")), icon: Users, color: "#0EA5E9", bg: "#E0F2FE" },
    { labelKey: "earnings.advertisingIncome", value: Math.round(adEarnings), icon: Megaphone, color: "#DC2626", bg: "#FEE2E2" },
    { labelKey: "earnings.penalties", value: Math.round(Math.abs(sumByType("penalty"))), icon: AlertTriangle, color: "#6B7280", bg: "#F3F4F6" },
  ];

  const chartData = buildChartSeries(rides, period);

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0F172A] pb-28">
      {/* Header */}
      <div className="bg-gradient-to-b from-[#138808] to-[#1AA814] px-4 pt-4 pb-8">
        <button onClick={() => navigate("/driver/dashboard")} className="mb-4">
          <ArrowLeft className="w-6 h-6 text-white" />
        </button>
        <p className="text-white/80 text-sm mb-1">{t("earnings.todaysEarnings")}</p>
        <h1 className="text-4xl font-bold text-white">₹{earnings.today}</h1>
      </div>

      <div className="px-4 -mt-4 space-y-4">
        {/* Cash / Online / Dues */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl p-3 text-center shadow-sm">
            <div className="w-8 h-8 rounded-full bg-[#E8F5E8] dark:bg-[#1A2D1A] flex items-center justify-center mx-auto mb-1">
              <IndianRupee className="w-4 h-4 text-[#138808]" />
            </div>
            <p className="font-bold text-sm text-[#1A1A2E] dark:text-[#E5E7EB]">₹{earnings.cash}</p>
            <p className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF]">{t("earnings.cash")}</p>
          </div>
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl p-3 text-center shadow-sm">
            <div className="w-8 h-8 rounded-full bg-[#FFF5EB] dark:bg-[#3D2914] flex items-center justify-center mx-auto mb-1">
              <IndianRupee className="w-4 h-4 text-[#FF6B00]" />
            </div>
            <p className="font-bold text-sm text-[#1A1A2E] dark:text-[#E5E7EB]">₹{earnings.online}</p>
            <p className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF]">{t("earnings.online")}</p>
          </div>
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl p-3 text-center shadow-sm">
            <div className="w-8 h-8 rounded-full bg-red-50 dark:bg-[#3D1414] flex items-center justify-center mx-auto mb-1">
              <IndianRupee className="w-4 h-4 text-[#DC2626]" />
            </div>
            <p className="font-bold text-sm text-[#DC2626]">₹{earnings.dues}</p>
            <p className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF]">{t("earnings.dues")}</p>
          </div>
        </div>

        {/* Earnings Chart */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">{t("earnings.chart")}</h3>
          </div>
          <div className="flex gap-1.5 mb-3">
            {PERIODS.map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  period === p ? "bg-[#138808] text-white" : "bg-gray-100 dark:bg-[#0F172A] text-[#6B7280] dark:text-[#9CA3AF]"
                }`}
              >
                {t(PERIOD_LABEL_KEYS[p])}
              </button>
            ))}
          </div>
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="earningsFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#138808" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#138808" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ stroke: "#138808", strokeWidth: 1 }}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" }}
                  formatter={(value: number) => [`₹${value}`, t("driver.earnings")]}
                />
                <Area type="monotone" dataKey="amount" stroke="#138808" strokeWidth={2} fill="url(#earningsFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Breakdown */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4">
          <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] mb-3">{t("earnings.breakdown")}</h3>
          <div className="grid grid-cols-2 gap-3">
            {breakdown.map((item) => (
              <div key={item.labelKey} className="flex items-center gap-2.5 bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl p-2.5">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: item.bg }}
                >
                  <item.icon className="w-4 h-4" style={{ color: item.color }} />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-sm text-[#1A1A2E] dark:text-[#E5E7EB]">₹{item.value}</p>
                  <p className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF] truncate">{t(item.labelKey)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* AI Suggestion — illustrative, no real demand-forecasting model exists in this prototype. */}
        <div className="bg-gradient-to-br from-[#7C3AED] to-[#5B21B6] rounded-2xl p-4 text-white">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4" />
            <span className="text-xs font-semibold text-white/80">{t("earnings.aiSuggestion")}</span>
          </div>
          <p className="font-semibold text-sm mb-1">{t("earnings.tomorrowTimeRange")}</p>
          <p className="text-xs text-white/70 mb-3">{t("earnings.highDemandExpected")}</p>
          <div className="flex items-center justify-between bg-white/10 rounded-xl p-3">
            <span className="text-xs text-white/70">{t("earnings.expectedEarnings")}</span>
            <span className="font-bold text-lg">₹980</span>
          </div>
        </div>

        {/* Stats */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4">
          <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] mb-3">{t("earnings.todaysStats")}</h3>
          <div className="space-y-3">
            {[
              { key: "total", label: t("stats.totalRides"), value: earnings.totalRides },
              { key: "completed", label: t("stats.completedRides"), value: earnings.completed },
              { key: "cancelled", label: t("stats.cancelledRides"), value: earnings.cancelled },
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between py-2 border-b border-gray-50 dark:border-gray-700 last:border-0">
                <span className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">{item.label}</span>
                <span className="font-semibold text-sm text-[#1A1A2E] dark:text-[#E5E7EB]">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Platform Dues */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4">
          <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] mb-3">{t("earnings.platformDues")}</h3>
          <div className="flex justify-between text-sm">
            <span className="text-[#6B7280] dark:text-[#9CA3AF]">{t("earnings.todaysDuesPerRide")}</span>
            <span className="text-[#DC2626] font-medium">₹{earnings.dues}</span>
          </div>
          <p className="text-xs text-[#9CA3AF] mt-3">
            {t("earnings.duesDisclaimer")}
          </p>
        </div>
      </div>

      <BottomNav role="driver" />
    </div>
  );
}
