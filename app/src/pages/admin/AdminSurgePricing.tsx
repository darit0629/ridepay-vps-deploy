import { useState } from "react";
import { Zap, Clock, Users, Activity, Plus, Trash2, Sparkles } from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import { trpc } from "@/providers/trpc";
import { useFareConfig } from "@/contexts/FareConfigContext";
import type { DemandTier, PeakWindow } from "../../../api/fare-router";

export default function AdminSurgePricing() {
  const utils = trpc.useUtils();
  const { surge, updateSurge } = useFareConfig();
  const { data: status } = trpc.fare.getSurgeStatus.useQuery(undefined, {
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
  });
  const updateModeMutation = trpc.fare.updateSurgeMode.useMutation({ onSuccess: () => utils.fare.getSurge.invalidate() });
  const updateTiersMutation = trpc.fare.updateDemandTiers.useMutation({ onSuccess: () => utils.fare.getSurge.invalidate() });
  const updateWindowsMutation = trpc.fare.updatePeakWindows.useMutation({ onSuccess: () => utils.fare.getSurge.invalidate() });
  const [saved, setSaved] = useState(false);
  const flash = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };

  const setTiers = (tiers: DemandTier[]) => { updateTiersMutation.mutate(tiers); flash(); };
  const setWindows = (windows: PeakWindow[]) => { updateWindowsMutation.mutate(windows); flash(); };

  return (
    <AdminLayout title="Surge Pricing">
      <div className="max-w-[1400px] grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Live status */}
        <div className="lg:col-span-2 bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-[#DC2626]" />
              <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">Live Surge Status</h3>
            </div>
            {saved && <span className="text-xs font-medium text-[#138808]">Saved ✓</span>}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl p-3">
              <p className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF]">Surge Engine</p>
              <p className={`text-sm font-bold ${status?.surgeActive ? "text-[#138808]" : "text-[#DC2626]"}`}>
                {status?.surgeActive ? "Active" : "Off"}
              </p>
            </div>
            <div className="bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl p-3">
              <p className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF]">Active Rides Now</p>
              <p className="text-sm font-bold text-[#1A1A2E] dark:text-[#E5E7EB]">{status?.activeRideCount ?? 0}</p>
            </div>
            <div className="bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl p-3">
              <p className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF]">Peak Hour Now</p>
              <p className="text-sm font-bold text-[#1A1A2E] dark:text-[#E5E7EB]">{status?.isPeakNow ? "Yes" : "No"}</p>
            </div>
            <div className="bg-[#FFF5EB] dark:bg-[#3D2914] rounded-xl p-3">
              <p className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF]">Demand Surge</p>
              <p className="text-sm font-bold text-[#FF6B00]">{status?.effectiveDemandSurgePercent ?? 0}%</p>
            </div>
          </div>
        </div>

        {/* AI Suggested Pricing toggle */}
        <div className="lg:col-span-2 bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#FFF5EB] dark:bg-[#3D2914] flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5 text-[#FF6B00]" />
              </div>
              <div>
                <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">AI Suggested Pricing</h3>
                <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] max-w-md">
                  Shows riders a boosted fare (peak/night/demand/weather flourish) alongside the normal price. Turn off to always charge the plain configured fare, with no AI boost.
                </p>
              </div>
            </div>
            <button
              onClick={() => { updateSurge({ aiPricingEnabled: !surge.aiPricingEnabled }); flash(); }}
              role="switch"
              aria-checked={surge.aiPricingEnabled}
              className={`relative w-12 h-7 rounded-full flex-shrink-0 transition-colors ${
                surge.aiPricingEnabled ? "bg-[#FF6B00]" : "bg-gray-300 dark:bg-gray-600"
              }`}
            >
              <span
                className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                  surge.aiPricingEnabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>

        {/* Demand surge mode */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-6 space-y-5">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-[#FF6B00]" />
            <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">Demand Surge Mode</h3>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => { updateModeMutation.mutate({ surgeMode: "manual" }); flash(); }}
              className={`flex-1 py-3 rounded-xl text-sm font-semibold border-2 transition-colors ${
                surge.surgeMode === "manual" ? "border-[#FF6B00] bg-[#FFF5EB] dark:bg-[#3D2914] text-[#FF6B00]" : "border-transparent bg-[#F8F9FA] dark:bg-[#0F172A] text-[#6B7280] dark:text-[#9CA3AF]"
              }`}
            >
              Manual
            </button>
            <button
              onClick={() => { updateModeMutation.mutate({ surgeMode: "auto" }); flash(); }}
              className={`flex-1 py-3 rounded-xl text-sm font-semibold border-2 transition-colors ${
                surge.surgeMode === "auto" ? "border-[#FF6B00] bg-[#FFF5EB] dark:bg-[#3D2914] text-[#FF6B00]" : "border-transparent bg-[#F8F9FA] dark:bg-[#0F172A] text-[#6B7280] dark:text-[#9CA3AF]"
              }`}
            >
              Auto (live demand)
            </button>
          </div>

          {surge.surgeMode === "manual" ? (
            <div>
              <label className="text-sm text-[#6B7280] dark:text-[#9CA3AF] mb-2 block">Demand Surge (%)</label>
              <input
                type="number"
                min={0}
                value={surge.demandSurgePercent}
                onChange={(e) => { updateSurge({ demandSurgePercent: Number(e.target.value) }); flash(); }}
                className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-4 py-3 text-sm outline-none border border-gray-100 dark:border-gray-700 focus:border-[#FF6B00] text-[#1A1A2E] dark:text-[#E5E7EB]"
              />
            </div>
          ) : (
            <p className="text-xs text-[#9CA3AF]">
              Surge is computed automatically from how many rides are concurrently active across the app, using the tiers below.
            </p>
          )}
        </div>

        {/* Demand tiers */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-[#0EA5E9]" />
              <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">Demand Tiers</h3>
            </div>
            <button
              onClick={() => setTiers([...surge.demandTiers, { count: 1, percent: 10 }])}
              className="w-8 h-8 rounded-lg bg-[#E0F2FE] dark:bg-[#0C2536] flex items-center justify-center"
            >
              <Plus className="w-4 h-4 text-[#0EA5E9]" />
            </button>
          </div>
          <div className="space-y-2">
            {surge.demandTiers.map((tier, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs text-[#6B7280] dark:text-[#9CA3AF] flex-shrink-0">At</span>
                <input
                  type="number"
                  min={1}
                  value={tier.count}
                  onChange={(e) => {
                    const next = surge.demandTiers.map((t, idx) => (idx === i ? { ...t, count: Number(e.target.value) } : t));
                    setTiers(next);
                  }}
                  className="w-20 bg-[#F8F9FA] dark:bg-[#0F172A] rounded-lg px-2 py-2 text-sm outline-none border border-gray-100 dark:border-gray-700 text-[#1A1A2E] dark:text-[#E5E7EB]"
                />
                <span className="text-xs text-[#6B7280] dark:text-[#9CA3AF] flex-shrink-0">active rides → surge</span>
                <input
                  type="number"
                  min={0}
                  value={tier.percent}
                  onChange={(e) => {
                    const next = surge.demandTiers.map((t, idx) => (idx === i ? { ...t, percent: Number(e.target.value) } : t));
                    setTiers(next);
                  }}
                  className="w-20 bg-[#F8F9FA] dark:bg-[#0F172A] rounded-lg px-2 py-2 text-sm outline-none border border-gray-100 dark:border-gray-700 text-[#1A1A2E] dark:text-[#E5E7EB]"
                />
                <span className="text-xs text-[#6B7280] dark:text-[#9CA3AF] flex-shrink-0">%</span>
                <button
                  onClick={() => setTiers(surge.demandTiers.filter((_, idx) => idx !== i))}
                  className="w-8 h-8 rounded-lg bg-red-50 dark:bg-[#3A1A1A] flex items-center justify-center flex-shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5 text-[#DC2626]" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Peak hour windows */}
        <div className="lg:col-span-2 bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-[#7C3AED]" />
              <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">Peak Hour Windows</h3>
            </div>
            <button
              onClick={() => setWindows([...surge.peakWindows, { label: "New Window", startHour: 12, endHour: 13 }])}
              className="w-8 h-8 rounded-lg bg-[#F3E8FF] dark:bg-[#2D1B4E] flex items-center justify-center"
            >
              <Plus className="w-4 h-4 text-[#7C3AED]" />
            </button>
          </div>
          <p className="text-xs text-[#9CA3AF]">
            During these hours, the Peak Hour Multiplier from Fare Configuration applies. 24-hour clock, both hours inclusive.
          </p>
          <div className="space-y-2">
            {surge.peakWindows.map((w, i) => (
              <div key={i} className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-center">
                <input
                  type="text"
                  value={w.label}
                  onChange={(e) => {
                    const next = surge.peakWindows.map((win, idx) => (idx === i ? { ...win, label: e.target.value } : win));
                    setWindows(next);
                  }}
                  className="bg-[#F8F9FA] dark:bg-[#0F172A] rounded-lg px-3 py-2 text-sm outline-none border border-gray-100 dark:border-gray-700 text-[#1A1A2E] dark:text-[#E5E7EB]"
                />
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Start</span>
                  <input
                    type="number"
                    min={0}
                    max={23}
                    value={w.startHour}
                    onChange={(e) => {
                      const next = surge.peakWindows.map((win, idx) => (idx === i ? { ...win, startHour: Number(e.target.value) } : win));
                      setWindows(next);
                    }}
                    className="w-16 bg-[#F8F9FA] dark:bg-[#0F172A] rounded-lg px-2 py-2 text-sm outline-none border border-gray-100 dark:border-gray-700 text-[#1A1A2E] dark:text-[#E5E7EB]"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">End</span>
                  <input
                    type="number"
                    min={0}
                    max={23}
                    value={w.endHour}
                    onChange={(e) => {
                      const next = surge.peakWindows.map((win, idx) => (idx === i ? { ...win, endHour: Number(e.target.value) } : win));
                      setWindows(next);
                    }}
                    className="w-16 bg-[#F8F9FA] dark:bg-[#0F172A] rounded-lg px-2 py-2 text-sm outline-none border border-gray-100 dark:border-gray-700 text-[#1A1A2E] dark:text-[#E5E7EB]"
                  />
                </div>
                <button
                  onClick={() => setWindows(surge.peakWindows.filter((_, idx) => idx !== i))}
                  className="w-8 h-8 rounded-lg bg-red-50 dark:bg-[#3A1A1A] flex items-center justify-center"
                >
                  <Trash2 className="w-3.5 h-3.5 text-[#DC2626]" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
