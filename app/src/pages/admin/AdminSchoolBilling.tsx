import { useState } from "react";
import {
  IndianRupee, AlertTriangle, RefreshCw, Settings as SettingsIcon, Clock3,
  CalendarOff, ShieldAlert, Check, X, Phone,
} from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import { trpc } from "@/providers/trpc";

const PAYMENT_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  paid: { label: "Paid", color: "#138808", bg: "#E8F5E8" },
  unpaid: { label: "Unpaid", color: "#6B7280", bg: "#F3F4F6" },
  overdue: { label: "Overdue", color: "#DC2626", bg: "#FEE2E2" },
};

function SubscriptionsTable() {
  const utils = trpc.useUtils();
  const { data: subs } = trpc.school.listAllSubscriptions.useQuery(undefined, { refetchInterval: 15000, refetchIntervalInBackground: true });
  const resyncMutation = trpc.schoolBilling.resyncFromRazorpay.useMutation({ onSuccess: () => utils.school.listAllSubscriptions.invalidate() });

  return (
    <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4">
      <h2 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] mb-3">Subscriptions</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-[#9CA3AF] border-b border-gray-100 dark:border-gray-700">
              <th className="pb-2 pr-3 font-medium">Student</th>
              <th className="pb-2 pr-3 font-medium">Payment</th>
              <th className="pb-2 pr-3 font-medium">Razorpay Status</th>
              <th className="pb-2 pr-3 font-medium">Valid Till</th>
              <th className="pb-2 pr-3 font-medium">Grace Ends</th>
              <th className="pb-2 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {(subs ?? []).map((sub) => {
              const badge = PAYMENT_BADGE[sub.paymentStatus];
              return (
                <tr key={sub.id} className="border-b border-gray-50 dark:border-gray-800 last:border-0">
                  <td className="py-2 pr-3">
                    <p className="font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">{sub.studentName}</p>
                    <p className="text-[10px] text-[#9CA3AF]">{sub.guardianPhone}</p>
                  </td>
                  <td className="py-2 pr-3">
                    <span className="px-2 py-0.5 rounded-full font-semibold" style={{ color: badge.color, backgroundColor: badge.bg }}>{badge.label}</span>
                  </td>
                  <td className="py-2 pr-3 text-[#6B7280] dark:text-[#9CA3AF]">{sub.razorpaySubscriptionStatus ?? "—"}</td>
                  <td className="py-2 pr-3 text-[#6B7280] dark:text-[#9CA3AF]">{sub.validTill}</td>
                  <td className="py-2 pr-3 text-[#6B7280] dark:text-[#9CA3AF]">{sub.graceEndsAt ?? "—"}</td>
                  <td className="py-2">
                    <button
                      onClick={() => resyncMutation.mutate({ subscriptionId: sub.id })}
                      disabled={!sub.razorpaySubscriptionId || resyncMutation.isPending}
                      className="flex items-center gap-1 text-[#0EA5E9] font-medium disabled:opacity-30"
                      title={sub.razorpaySubscriptionId ? "Re-fetch status from Razorpay" : "No Razorpay subscription yet"}
                    >
                      <RefreshCw className="w-3 h-3" /> Resync
                    </button>
                  </td>
                </tr>
              );
            })}
            {(subs ?? []).length === 0 && (
              <tr><td colSpan={6} className="text-center py-6 text-[#9CA3AF]">No subscriptions yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FailedPayments() {
  const { data: failed } = trpc.schoolBilling.listFailedPayments.useQuery(undefined, { refetchInterval: 20000 });
  return (
    <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-4 h-4 text-[#DC2626]" />
        <h2 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">Failed Payments</h2>
      </div>
      <div className="space-y-2">
        {(failed ?? []).map((p) => (
          <div key={p.id} className="flex items-center justify-between bg-red-50 dark:bg-[#3A1A1A] rounded-xl px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">{p.studentName ?? p.subscriptionId}</p>
              <p className="text-[11px] text-[#9CA3AF] truncate">{p.guardianPhone} · {p.failureReason || "No reason given"}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-sm font-semibold text-[#DC2626]">₹{p.amount}</p>
              <p className="text-[10px] text-[#9CA3AF]">{new Date(p.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</p>
            </div>
          </div>
        ))}
        {(failed ?? []).length === 0 && <p className="text-sm text-[#9CA3AF] text-center py-4">No failed payments.</p>}
      </div>
    </div>
  );
}

function BillingSettingsForm() {
  const utils = trpc.useUtils();
  const { data: settings } = trpc.schoolBilling.getBillingSettings.useQuery();
  const updateMutation = trpc.schoolBilling.updateBillingSettings.useMutation({ onSuccess: () => utils.schoolBilling.getBillingSettings.invalidate() });

  if (!settings) return null;

  return (
    <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4">
      <div className="flex items-center gap-2 mb-3">
        <SettingsIcon className="w-4 h-4 text-[#7C3AED]" />
        <h2 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">Billing Settings</h2>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1 block">Grace Period (days)</label>
          <input
            type="number"
            defaultValue={settings.gracePeriodDays}
            onBlur={(e) => updateMutation.mutate({ gracePeriodDays: Number(e.target.value) })}
            className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-lg px-3 py-2 text-sm outline-none border border-gray-200 dark:border-gray-700 text-[#1A1A2E] dark:text-[#E5E7EB]"
          />
        </div>
        <div>
          <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1 block">Total Billing Cycles</label>
          <input
            type="number"
            defaultValue={settings.totalBillingCycles}
            onBlur={(e) => updateMutation.mutate({ totalBillingCycles: Number(e.target.value) })}
            className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-lg px-3 py-2 text-sm outline-none border border-gray-200 dark:border-gray-700 text-[#1A1A2E] dark:text-[#E5E7EB]"
          />
        </div>
        <div>
          <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1 block">Nightly Generation Hour</label>
          <input
            type="number"
            min={0}
            max={23}
            defaultValue={settings.nightlyGenerationHour}
            onBlur={(e) => updateMutation.mutate({ nightlyGenerationHour: Number(e.target.value) })}
            className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-lg px-3 py-2 text-sm outline-none border border-gray-200 dark:border-gray-700 text-[#1A1A2E] dark:text-[#E5E7EB]"
          />
        </div>
      </div>
      <p className="text-[11px] text-[#9CA3AF] mt-2">Changes apply on the next worker tick (every 15 minutes) — see api/lib/schoolNightlyWorker.ts.</p>
    </div>
  );
}

function TimingRequests() {
  const utils = trpc.useUtils();
  const { data: requests } = trpc.school.listTimingRequests.useQuery({ status: "pending" }, { refetchInterval: 20000 });
  const resolveMutation = trpc.school.resolveTimingChange.useMutation({ onSuccess: () => utils.school.listTimingRequests.invalidate() });

  return (
    <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4">
      <div className="flex items-center gap-2 mb-3">
        <Clock3 className="w-4 h-4 text-[#0EA5E9]" />
        <h2 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">Pending Timing Requests</h2>
      </div>
      <div className="space-y-2">
        {(requests ?? []).map((r) => (
          <div key={r.id} className="flex items-center justify-between bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-xs font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">{r.field} → {r.requestedValue}</p>
              <p className="text-[10px] text-[#9CA3AF]">Subscription {r.subscriptionId}</p>
            </div>
            <div className="flex gap-1.5 flex-shrink-0">
              <button onClick={() => resolveMutation.mutate({ id: r.id, approve: true })} className="w-7 h-7 rounded-full bg-[#E8F5E8] dark:bg-[#1A3A22] flex items-center justify-center">
                <Check className="w-3.5 h-3.5 text-[#138808]" />
              </button>
              <button onClick={() => resolveMutation.mutate({ id: r.id, approve: false })} className="w-7 h-7 rounded-full bg-red-50 dark:bg-[#3A1A1A] flex items-center justify-center">
                <X className="w-3.5 h-3.5 text-[#DC2626]" />
              </button>
            </div>
          </div>
        ))}
        {(requests ?? []).length === 0 && <p className="text-sm text-[#9CA3AF] text-center py-4">No pending requests.</p>}
      </div>
    </div>
  );
}

function SkipRequestsList() {
  const { data: skips } = trpc.school.listAllSkipRequests.useQuery({ limit: 30 });
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = (skips ?? []).filter((s) => s.date >= today);

  return (
    <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4">
      <div className="flex items-center gap-2 mb-3">
        <CalendarOff className="w-4 h-4 text-[#FF6B00]" />
        <h2 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">Upcoming Skip Requests</h2>
      </div>
      <div className="space-y-1.5">
        {upcoming.map((s) => (
          <div key={s.id} className="flex items-center justify-between bg-[#F8F9FA] dark:bg-[#0F172A] rounded-lg px-3 py-2">
            <span className="text-xs text-[#1A1A2E] dark:text-[#E5E7EB]">{s.studentName ?? s.subscriptionId} — no pickup on {s.date}</span>
            {s.reason && <span className="text-[10px] text-[#9CA3AF] truncate ml-2">{s.reason}</span>}
          </div>
        ))}
        {upcoming.length === 0 && <p className="text-sm text-[#9CA3AF] text-center py-4">No upcoming skip requests.</p>}
      </div>
    </div>
  );
}

function OpenSchoolSOS() {
  const utils = trpc.useUtils();
  const { data: alerts } = trpc.sos.listOpen.useQuery(undefined, { refetchInterval: 10000 });
  const resolveMutation = trpc.sos.resolve.useMutation({ onSuccess: () => utils.sos.listOpen.invalidate() });
  const schoolAlerts = (alerts ?? []).filter((a) => a.subscriptionId != null);

  return (
    <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4">
      <div className="flex items-center gap-2 mb-3">
        <ShieldAlert className="w-4 h-4 text-[#DC2626]" />
        <h2 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">Open School SOS Alerts</h2>
        {schoolAlerts.length > 0 && <span className="bg-[#DC2626] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{schoolAlerts.length}</span>}
      </div>
      <div className="space-y-2">
        {schoolAlerts.map((a) => (
          <div key={a.id} className="flex items-center justify-between bg-red-50 dark:bg-[#3A1A1A] rounded-xl px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-xs font-medium text-[#DC2626]">Subscription {a.subscriptionId}</p>
              <p className="text-[11px] text-[#9CA3AF] truncate">{a.note || "No note"} · {new Date(a.createdAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</p>
            </div>
            <button onClick={() => resolveMutation.mutate({ id: a.id })} className="flex items-center gap-1 bg-white dark:bg-[#1E293B] text-[#DC2626] text-xs font-semibold px-3 py-1.5 rounded-lg flex-shrink-0">
              <Phone className="w-3.5 h-3.5" /> Resolve
            </button>
          </div>
        ))}
        {schoolAlerts.length === 0 && <p className="text-sm text-[#9CA3AF] text-center py-4">No open school-transport SOS alerts.</p>}
      </div>
    </div>
  );
}

export default function AdminSchoolBilling() {
  const { data: subs } = trpc.school.listAllSubscriptions.useQuery();
  const { data: failed } = trpc.schoolBilling.listFailedPayments.useQuery();
  const [tab, setTab] = useState<"overview" | "requests">("overview");

  const paid = (subs ?? []).filter((s) => s.paymentStatus === "paid").length;
  const overdue = (subs ?? []).filter((s) => s.paymentStatus === "overdue").length;

  return (
    <AdminLayout title="School Billing" subtitle="Subscriptions, payments, and guardian requests">
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl p-4 shadow-sm">
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1">Paid</p>
            <p className="text-2xl font-bold text-[#138808]">{paid}</p>
          </div>
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl p-4 shadow-sm">
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1">Overdue</p>
            <p className="text-2xl font-bold text-[#DC2626]">{overdue}</p>
          </div>
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-1.5 mb-1">
              <IndianRupee className="w-3.5 h-3.5 text-[#7C3AED]" />
              <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Failed Payments</p>
            </div>
            <p className="text-2xl font-bold text-[#1A1A2E] dark:text-[#E5E7EB]">{(failed ?? []).length}</p>
          </div>
        </div>

        <div className="flex gap-2">
          {(["overview", "requests"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
                tab === t ? "bg-[#FF6B00] text-white" : "bg-gray-100 dark:bg-gray-700 text-[#6B7280] dark:text-[#9CA3AF]"
              }`}
            >
              {t === "overview" ? "Billing Overview" : "Requests & Alerts"}
            </button>
          ))}
        </div>

        {tab === "overview" ? (
          <>
            <SubscriptionsTable />
            <FailedPayments />
            <BillingSettingsForm />
          </>
        ) : (
          <>
            <TimingRequests />
            <SkipRequestsList />
            <OpenSchoolSOS />
          </>
        )}
      </div>
    </AdminLayout>
  );
}
