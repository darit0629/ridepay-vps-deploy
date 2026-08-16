import { useState } from "react";
import { FileBarChart, Download, TrendingUp, XCircle, Gift, Tag, Wallet } from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import { trpc } from "@/providers/trpc";

type DateRange = "today" | "7d" | "30d" | "all";

const RANGE_MS: Record<DateRange, number | null> = {
  today: 86_400_000,
  "7d": 86_400_000 * 7,
  "30d": 86_400_000 * 30,
  all: null,
};

function withinRange(createdAt: number, range: DateRange): boolean {
  const windowMs = RANGE_MS[range];
  if (windowMs === null) return true;
  return createdAt >= Date.now() - windowMs;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Builds a CSV from an array of same-shaped row objects and triggers a
// browser download — purely client-side, no server round-trip or external
// upload, just saving locally-generated data (the standard "export report" pattern).
function downloadCsv(filename: string, rows: Record<string, string | number>[]) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(","), ...rows.map((r) => headers.map((h) => JSON.stringify(r[h] ?? "")).join(","))];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function RangePicker({ range, onChange }: { range: DateRange; onChange: (r: DateRange) => void }) {
  const options: { id: DateRange; label: string }[] = [
    { id: "today", label: "Today" },
    { id: "7d", label: "7 Days" },
    { id: "30d", label: "30 Days" },
    { id: "all", label: "All Time" },
  ];
  return (
    <div className="flex gap-2">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            range === o.id ? "bg-[#FF6B00] text-white" : "bg-[#F8F9FA] dark:bg-[#0F172A] text-[#6B7280] dark:text-[#9CA3AF]"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl p-3">
      <p className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF]">{label}</p>
      <p className={`text-lg font-bold ${accent ?? "text-[#1A1A2E] dark:text-[#E5E7EB]"}`}>{value}</p>
    </div>
  );
}

export default function AdminReports() {
  const [range, setRange] = useState<DateRange>("30d");

  const { data: commissionRecords } = trpc.commission.listRecords.useQuery(undefined, { refetchInterval: 15000, refetchIntervalInBackground: true });
  const { data: cancellationRecords } = trpc.cancellation.listRecords.useQuery(undefined, { refetchInterval: 15000, refetchIntervalInBackground: true });
  const { data: referralRecords } = trpc.referral.listRecords.useQuery(undefined, { refetchInterval: 15000, refetchIntervalInBackground: true });
  const { data: coupons } = trpc.coupon.list.useQuery(undefined, { refetchInterval: 15000, refetchIntervalInBackground: true });
  const { data: wallets } = trpc.settlement.listWallets.useQuery(undefined, { refetchInterval: 15000, refetchIntervalInBackground: true });

  const commissionInRange = (commissionRecords ?? []).filter((r) => withinRange(r.createdAt, range));
  const cancellationsInRange = (cancellationRecords ?? []).filter((r) => withinRange(r.createdAt, range));
  const referralsInRange = (referralRecords ?? []).filter((r) => withinRange(r.createdAt, range));

  const totalRevenue = round2(commissionInRange.reduce((s, r) => s + r.total, 0));
  const totalDriverPayout = round2(commissionInRange.reduce((s, r) => s + r.driverShare, 0));
  const totalCompanyNet = round2(commissionInRange.reduce((s, r) => s + r.companyNet, 0));
  const totalGatewayCharges = round2(commissionInRange.reduce((s, r) => s + r.paymentGatewayCharge + r.platformCharge, 0));
  const rideRevenue = round2(commissionInRange.filter((r) => r.source === "ride").reduce((s, r) => s + r.total, 0));
  const parcelRevenue = round2(commissionInRange.filter((r) => r.source === "parcel").reduce((s, r) => s + r.total, 0));

  const totalCancellations = cancellationsInRange.length;
  const cancellationFees = round2(cancellationsInRange.reduce((s, r) => s + r.feeCharged, 0));
  const cancellationsWaived = cancellationsInRange.filter((r) => r.feeWaived).length;
  const driverCompensationPaid = round2(cancellationsInRange.reduce((s, r) => s + r.driverCompensation, 0));

  const referralsCompleted = referralsInRange.filter((r) => r.status === "completed").length;
  const referralPayout = round2(referralsInRange.filter((r) => r.status === "completed").reduce((s, r) => s + r.referrerBonus + r.refereeBonus, 0));

  const activeCoupons = (coupons ?? []).filter((c) => c.status === "Active").length;
  const totalCouponRedemptions = (coupons ?? []).reduce((s, c) => s + c.usedCount, 0);

  return (
    <AdminLayout title="Reports">
      <div className="max-w-[1400px] grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <div className="lg:col-span-2 flex items-center justify-between flex-wrap gap-3">
          <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
            Every figure below is computed live from the actual payment/commission/cancellation/referral/coupon ledgers.
          </p>
          <RangePicker range={range} onChange={setRange} />
        </div>

        {/* Revenue & Commission */}
        <div className="lg:col-span-2 bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#138808]" />
              <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">Revenue & Commission</h3>
            </div>
            <button
              onClick={() => downloadCsv(`revenue-report-${range}.csv`, commissionInRange.map((r) => ({
                date: new Date(r.createdAt).toISOString(), source: r.source, driver: r.driverName, total: r.total,
                driverShare: r.driverShare, companyNet: r.companyNet, gatewayCharge: r.paymentGatewayCharge, platformCharge: r.platformCharge,
              })))}
              className="flex items-center gap-1.5 text-xs font-semibold text-[#0EA5E9] hover:underline"
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatCard label="Total Revenue" value={`₹${totalRevenue}`} />
            <StatCard label="Ride Revenue" value={`₹${rideRevenue}`} />
            <StatCard label="Parcel Revenue" value={`₹${parcelRevenue}`} />
            <StatCard label="Driver Payout" value={`₹${totalDriverPayout}`} accent="text-[#FF6B00]" />
            <StatCard label="Company Net" value={`₹${totalCompanyNet}`} accent="text-[#138808]" />
            <StatCard label="Gateway/Platform Fees" value={`₹${totalGatewayCharges}`} />
          </div>
          <p className="text-xs text-[#9CA3AF]">{commissionInRange.length} completed rides/deliveries in this period.</p>
        </div>

        {/* Cancellations */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-[#DC2626]" />
              <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">Cancellations</h3>
            </div>
            <button
              onClick={() => downloadCsv(`cancellation-report-${range}.csv`, cancellationsInRange.map((r) => ({
                date: new Date(r.createdAt).toISOString(), rider: r.riderName, vehicle: r.vehicleType, stage: r.stage,
                feeCharged: r.feeCharged, waived: r.feeWaived ? "yes" : "no", driverCompensation: r.driverCompensation,
              })))}
              className="flex items-center gap-1.5 text-xs font-semibold text-[#0EA5E9] hover:underline"
            >
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Total Cancellations" value={String(totalCancellations)} />
            <StatCard label="Fees Collected" value={`₹${cancellationFees}`} accent="text-[#DC2626]" />
            <StatCard label="Waived" value={String(cancellationsWaived)} accent="text-[#138808]" />
            <StatCard label="Driver Compensation" value={`₹${driverCompensationPaid}`} />
          </div>
        </div>

        {/* Referrals */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-[#FF6B00]" />
            <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">Referral Program</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Referrals" value={String(referralsInRange.length)} />
            <StatCard label="Completed" value={String(referralsCompleted)} accent="text-[#138808]" />
            <StatCard label="Payout" value={`₹${referralPayout}`} accent="text-[#FF6B00]" />
            <StatCard label="Pending" value={String(referralsInRange.length - referralsCompleted)} />
          </div>
        </div>

        {/* Coupons */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-[#7C3AED]" />
            <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">Coupons</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Active Coupons" value={String(activeCoupons)} />
            <StatCard label="Total Redemptions" value={String(totalCouponRedemptions)} accent="text-[#7C3AED]" />
          </div>
          <p className="text-xs text-[#9CA3AF]">Redemption counts are lifetime totals (coupons don't carry a per-use timestamp).</p>
        </div>

        {/* Wallet snapshot */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-[#0EA5E9]" />
            <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">Live Wallet Balances</h3>
          </div>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {(wallets ?? []).map((w) => (
              <div key={`${w.walletType}:${w.ownerId}`} className="flex items-center justify-between py-1.5 border-b border-gray-50 dark:border-gray-700/50 last:border-0">
                <div>
                  <span className="text-sm text-[#1A1A2E] dark:text-[#E5E7EB]">{w.ownerId}</span>
                  <span className="text-xs text-[#9CA3AF] ml-2">{w.walletType}</span>
                </div>
                <span className="text-sm font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">₹{w.availableBalance}</span>
              </div>
            ))}
            {(wallets ?? []).length === 0 && <p className="text-sm text-[#9CA3AF] text-center py-4">No wallet activity yet.</p>}
          </div>
        </div>

        <div className="lg:col-span-2 flex items-center gap-2 text-xs text-[#9CA3AF]">
          <FileBarChart className="w-3.5 h-3.5" />
          Reports refresh automatically every 15 seconds and reflect the live in-memory ledgers.
        </div>
      </div>
    </AdminLayout>
  );
}
