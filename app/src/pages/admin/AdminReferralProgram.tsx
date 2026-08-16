import { useState } from "react";
import { Gift, Users } from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import { trpc } from "@/providers/trpc";
import type { ReferralBonusPair, ReferralConfig } from "../../../api/referral-router";

type PairKey = "riderToRider" | "riderToDriver" | "driverToDriver" | "driverToRider";

const PAIR_LABELS: Record<PairKey, string> = {
  riderToRider: "Rider invites Rider",
  riderToDriver: "Rider invites Driver",
  driverToDriver: "Driver invites Driver",
  driverToRider: "Driver invites Rider",
};

function BonusPairRow({
  label, pair, onChange,
}: { label: string; pair: ReferralBonusPair; onChange: (pair: ReferralBonusPair) => void }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
      <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">{label}</p>
      <div>
        <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1 block">Referrer gets (₹)</label>
        <input
          type="number"
          min={0}
          value={pair.referrerBonus}
          onChange={(e) => onChange({ ...pair, referrerBonus: Number(e.target.value) })}
          className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-4 py-2.5 text-sm outline-none border border-gray-100 dark:border-gray-700 focus:border-[#FF6B00] text-[#1A1A2E] dark:text-[#E5E7EB]"
        />
      </div>
      <div>
        <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1 block">New user gets (₹)</label>
        <input
          type="number"
          min={0}
          value={pair.refereeBonus}
          onChange={(e) => onChange({ ...pair, refereeBonus: Number(e.target.value) })}
          className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-4 py-2.5 text-sm outline-none border border-gray-100 dark:border-gray-700 focus:border-[#FF6B00] text-[#1A1A2E] dark:text-[#E5E7EB]"
        />
      </div>
    </div>
  );
}

export default function AdminReferralProgram() {
  const utils = trpc.useUtils();
  const { data: config } = trpc.referral.getConfig.useQuery();
  const { data: records } = trpc.referral.listRecords.useQuery(undefined, {
    refetchInterval: 10000,
    refetchIntervalInBackground: true,
  });
  const updateMutation = trpc.referral.updateConfig.useMutation({
    onSuccess: () => utils.referral.getConfig.invalidate(),
  });
  const [saved, setSaved] = useState(false);

  if (!config) return <AdminLayout title="Referral Program">Loading...</AdminLayout>;

  const update = (updates: Partial<ReferralConfig>) => {
    updateMutation.mutate({ ...config, ...updates });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const totalPaidOut = (records ?? [])
    .filter((r) => r.status === "completed")
    .reduce((s, r) => s + r.referrerBonus + r.refereeBonus, 0);

  return (
    <AdminLayout title="Referral Program">
      <div className="max-w-[1400px] grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Program controls */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gift className="w-5 h-5 text-[#FF6B00]" />
              <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">Program Settings</h3>
            </div>
            {saved && <span className="text-xs font-medium text-[#138808]">Saved ✓</span>}
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">Referral program enabled</p>
              <p className="text-xs text-[#9CA3AF] mt-0.5">When off, new referral codes are rejected everywhere.</p>
            </div>
            <button
              onClick={() => update({ enabled: !config.enabled })}
              className={`w-12 h-7 rounded-full transition-colors relative ${config.enabled ? "bg-[#138808]" : "bg-gray-300 dark:bg-gray-600"}`}
            >
              <span className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all ${config.enabled ? "left-6" : "left-1"}`} />
            </button>
          </div>

          <div>
            <label className="text-sm text-[#6B7280] dark:text-[#9CA3AF] mb-2 block">Referrer bonus is paid…</label>
            <select
              value={config.payoutTrigger}
              onChange={(e) => update({ payoutTrigger: e.target.value as ReferralConfig["payoutTrigger"] })}
              className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-4 py-3 text-sm outline-none border border-gray-100 dark:border-gray-700 focus:border-[#FF6B00] text-[#1A1A2E] dark:text-[#E5E7EB]"
            >
              <option value="first_ride">After the new user's first completed ride (recommended)</option>
              <option value="signup">Instantly at signup</option>
            </select>
            <p className="text-xs text-[#9CA3AF] mt-2">
              The new user's own welcome bonus is always credited instantly. Delaying the referrer payout to the first
              completed ride prevents signup-farm abuse.
            </p>
          </div>
        </div>

        {/* Bonus amounts */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-6 space-y-5">
          <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">Bonus Amounts</h3>
          {(Object.keys(PAIR_LABELS) as PairKey[]).map((key) => (
            <BonusPairRow
              key={key}
              label={PAIR_LABELS[key]}
              pair={config[key]}
              onChange={(pair) => update({ [key]: pair })}
            />
          ))}
        </div>

        {/* Referral ledger */}
        <div className="lg:col-span-2 bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-[#0EA5E9]" />
              <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">All Referrals</h3>
            </div>
            <span className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
              {(records ?? []).length} referrals · ₹{totalPaidOut} paid out
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-[#6B7280] dark:text-[#9CA3AF] border-b border-gray-100 dark:border-gray-700">
                  <th className="py-2 pr-4 font-medium">REFERRER</th>
                  <th className="py-2 pr-4 font-medium">CODE</th>
                  <th className="py-2 pr-4 font-medium">NEW USER</th>
                  <th className="py-2 pr-4 font-medium">STATUS</th>
                  <th className="py-2 pr-4 font-medium">REFERRER BONUS</th>
                  <th className="py-2 pr-4 font-medium">NEW USER BONUS</th>
                  <th className="py-2 font-medium">DATE</th>
                </tr>
              </thead>
              <tbody>
                {(records ?? []).map((r) => (
                  <tr key={r.id} className="border-b border-gray-50 dark:border-gray-700/50 last:border-0">
                    <td className="py-3 pr-4 text-[#1A1A2E] dark:text-[#E5E7EB]">
                      {r.referrerName}
                      <span className="text-xs text-[#9CA3AF] ml-1">({r.referrerRole})</span>
                    </td>
                    <td className="py-3 pr-4 font-mono text-[#FF6B00]">{r.code}</td>
                    <td className="py-3 pr-4 text-[#1A1A2E] dark:text-[#E5E7EB]">
                      {r.refereeName}
                      <span className="text-xs text-[#9CA3AF] ml-1">({r.refereeRole})</span>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                        r.status === "completed"
                          ? "bg-[#E8F5E8] dark:bg-[#1A3A22] text-[#138808]"
                          : "bg-[#FFF5EB] dark:bg-[#3D2914] text-[#FF6B00]"
                      }`}>
                        {r.status === "completed" ? "Completed" : "Pending first ride"}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-[#1A1A2E] dark:text-[#E5E7EB]">₹{r.referrerBonus}</td>
                    <td className="py-3 pr-4 text-[#1A1A2E] dark:text-[#E5E7EB]">₹{r.refereeBonus}</td>
                    <td className="py-3 text-[#6B7280] dark:text-[#9CA3AF]">
                      {new Date(r.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </td>
                  </tr>
                ))}
                {(records ?? []).length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-[#9CA3AF]">No referrals yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
