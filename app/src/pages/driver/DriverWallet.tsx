import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import {
  ArrowLeft, IndianRupee, Gift, Zap, AlertTriangle, Wrench, Megaphone,
  ArrowDownToLine, Building2, Clock, Smartphone, ShieldCheck, TrendingUp, ChevronRight, Fuel,
  Snowflake, XCircle, Loader2, ShieldAlert,
} from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { useNotifications } from "@/contexts/NotificationsContext";
import { useAdCampaigns } from "@/contexts/AdCampaignsContext";
import { CURRENT_DRIVER_ID } from "@/lib/mockDrivers";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";

const WITHDRAWAL_STATUS_META: Record<string, { labelKey: string; color: string }> = {
  pending: { labelKey: "status.pending", color: "#FF6B00" },
  approved: { labelKey: "dwallet.approved", color: "#0EA5E9" },
  processing: { labelKey: "dwallet.processing", color: "#7C3AED" },
  completed: { labelKey: "status.completed", color: "#138808" },
  rejected: { labelKey: "dwallet.rejected", color: "#DC2626" },
  failed: { labelKey: "dwallet.failed", color: "#DC2626" },
  cancelled: { labelKey: "status.cancelled", color: "#9CA3AF" },
};

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

export default function DriverWallet() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user } = useAuth();
  const driverName = user?.name ?? "";
  const { pushSystemNotification } = useNotifications();
  const { campaigns } = useAdCampaigns();
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawMethod, setWithdrawMethod] = useState<"bank" | "upi">("bank");
  const [withdrawError, setWithdrawError] = useState("");

  const utils = trpc.useUtils();
  const { data: wallet } = trpc.settlement.getWallet.useQuery(
    { walletType: "driver", ownerId: driverName },
    { enabled: !!driverName, refetchInterval: 5000, refetchIntervalInBackground: true }
  );
  const { data: transactions } = trpc.settlement.listTransactions.useQuery(
    { walletType: "driver", ownerId: driverName, limit: 50 },
    { enabled: !!driverName, refetchInterval: 5000, refetchIntervalInBackground: true }
  );
  const { data: withdrawalRequests } = trpc.settlement.listWithdrawalRequests.useQuery(
    { walletType: "driver", ownerId: driverName },
    { enabled: !!driverName, refetchInterval: 5000, refetchIntervalInBackground: true }
  );
  // Real bank/UPI + KYC status, filled in by the driver onboarding wizard
  // (DriverOnboarding.tsx) and reviewed by the admin — replaces the old
  // hardcoded "no bank account linked" placeholder.
  const { data: driverProfile } = trpc.driver.getProfile.useQuery();
  const { data: financeSettings } = trpc.settlement.getFinanceSettings.useQuery();
  const requestWithdrawalMutation = trpc.settlement.requestWithdrawal.useMutation({
    onSuccess: () => {
      utils.settlement.getWallet.invalidate();
      utils.settlement.listWithdrawalRequests.invalidate();
    },
  });
  const cancelWithdrawalMutation = trpc.settlement.cancelWithdrawal.useMutation({
    onSuccess: () => {
      utils.settlement.getWallet.invalidate();
      utils.settlement.listWithdrawalRequests.invalidate();
    },
  });

  const bankAccount = {
    bank: driverProfile?.bankName || t("dwallet.noBankLinked"),
    accountMasked: driverProfile?.bankAccountNumber ? `····${driverProfile.bankAccountNumber.slice(-4)}` : "",
    ifsc: driverProfile?.bankIfscCode ?? "",
    verified: driverProfile?.bankVerified ?? false,
  };
  const upiAccount = {
    vpa: driverProfile?.upiId || t("dwallet.notAdded"),
    verified: !!driverProfile?.upiId,
  };
  const kycApproved = driverProfile?.status === "approved";
  const walletFrozen = wallet?.frozen ?? false;

  // There's no per-driver push targeting in this app (admin notifications
  // only broadcast by audience) — so instead of trying to notify from the
  // admin side when a withdrawal is resolved, this device (this driver's
  // own polling wallet screen) detects a status transition itself and fires
  // the notification locally, same "watch a polled query for a status
  // change" pattern UserPayment.tsx uses for "payment confirmed by the captain".
  const knownWithdrawalStatuses = useRef<Map<string, string>>(new Map());
  useEffect(() => {
    if (!withdrawalRequests) return;
    for (const req of withdrawalRequests) {
      const previous = knownWithdrawalStatuses.current.get(req.id);
      if (previous && previous !== req.status && req.status !== "pending" && req.status !== "processing") {
        const messages: Record<string, string> = {
          completed: `Your withdrawal of ₹${req.amount.toLocaleString("en-IN")} has been sent to your ${req.method === "upi" ? "UPI" : "bank account"}.`,
          rejected: `Your withdrawal request of ₹${req.amount.toLocaleString("en-IN")} was rejected — the amount has been returned to your available balance.`,
          failed: `Your withdrawal of ₹${req.amount.toLocaleString("en-IN")} failed${req.failureReason ? `: ${req.failureReason}` : ""} — the amount has been returned to your available balance.`,
          cancelled: `Your withdrawal request of ₹${req.amount.toLocaleString("en-IN")} was cancelled.`,
        };
        const titles: Record<string, string> = {
          completed: "Withdrawal completed",
          rejected: "Withdrawal rejected",
          failed: "Withdrawal failed",
          cancelled: "Withdrawal cancelled",
        };
        if (messages[req.status]) {
          pushSystemNotification({ audience: "driver", title: titles[req.status], message: messages[req.status] });
        }
      }
      knownWithdrawalStatuses.current.set(req.id, req.status);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [withdrawalRequests]);

  const availableBalance = wallet?.availableBalance ?? 0;
  const pendingBalance = wallet?.pendingBalance ?? 0;
  const pendingCommission = wallet?.pendingCommission ?? 0;

  const sumByType = (type: string) => (transactions ?? []).filter((t) => t.type === type).reduce((s, t) => s + Number(t.amount), 0);
  const rideEarnings = Math.round(sumByType("commission_credit"));
  const bonusTotal = Math.round(sumByType("bonus"));
  const incentiveTotal = Math.round(sumByType("incentive"));
  const penaltyTotal = Math.round(Math.abs(sumByType("penalty")));
  const adjustmentTotal = Math.round(sumByType("adjustment"));

  // Real ad earnings, same derivation DriverAdOptIn.tsx uses (spend × this
  // driver's revenue-share % on campaigns actually allotted to them) — not a
  // separate hardcoded figure.
  const isAllotted = (c: (typeof campaigns)[number]) => c.allottedDriverIds.includes(CURRENT_DRIVER_ID);
  const myActiveCampaigns = campaigns.filter((c) => c.status === "active" && isAllotted(c));
  const adEarnings = Math.round(myActiveCampaigns.reduce((sum, c) => sum + (c.spent * c.driverSharePercent) / 100, 0));

  const breakdown = [
    { labelKey: "dwallet.rideEarnings", value: rideEarnings, icon: IndianRupee, color: "#FF6B00", bg: "#FFF5EB" },
    { labelKey: "earnings.bonus", value: bonusTotal, icon: Gift, color: "#7C3AED", bg: "#F3E8FF" },
    { labelKey: "earnings.incentives", value: incentiveTotal, icon: Zap, color: "#CA8A04", bg: "#FEF9C3" },
    { labelKey: "dwallet.advertising", value: adEarnings, icon: Megaphone, color: "#0EA5E9", bg: "#E0F2FE" },
    { labelKey: "earnings.penalties", value: penaltyTotal, icon: AlertTriangle, color: "#DC2626", bg: "#FEE2E2" },
    { labelKey: "dwallet.adjustments", value: adjustmentTotal, icon: Wrench, color: "#6B7280", bg: "#F3F4F6" },
  ];

  // AI Spending Analysis stays illustrative (no real fuel/maintenance expense
  // tracking exists anywhere in the app) but is now derived from this
  // driver's real monthly earnings instead of a static number.
  const monthlyEarnings = wallet?.earnings.monthly ?? 0;
  const spendingAnalysis = {
    fuel: Math.round(monthlyEarnings * 0.14),
    maintenance: Math.round(monthlyEarnings * 0.07),
    netProfit: Math.round(monthlyEarnings * 0.79),
  };

  const handleWithdrawRequest = () => {
    const amount = Number(withdrawAmount);
    if (!amount || amount <= 0 || !driverName) return;
    requestWithdrawalMutation.mutate(
      { walletType: "driver", ownerId: driverName, amount, method: withdrawMethod },
      {
        onSuccess: (result) => {
          if (!result.ok) {
            setWithdrawError(result.error);
            return;
          }
          setShowWithdraw(false);
          setWithdrawAmount("");
          setWithdrawError("");
          const automatic = result.request.payoutMode === "automatic";
          pushSystemNotification({
            audience: "driver",
            title: automatic ? "Withdrawal processing" : "Withdrawal requested",
            message: automatic
              ? `Your withdrawal of ₹${amount.toLocaleString("en-IN")} is being sent to your ${withdrawMethod === "upi" ? "UPI" : "bank account"}.`
              : `Your withdrawal of ₹${amount.toLocaleString("en-IN")} to your ${withdrawMethod === "upi" ? "UPI" : "bank account"} is pending admin approval.`,
          });
        },
      }
    );
  };

  const handleCancelWithdrawal = (id: string) => {
    if (!driverName) return;
    cancelWithdrawalMutation.mutate({ id, ownerId: driverName });
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0F172A] pb-28">
      {/* Header */}
      <div className="bg-gradient-to-b from-[#138808] to-[#1AA814] px-4 pt-4 pb-8">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => navigate("/driver/dashboard")}>
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
          <h1 className="text-white font-semibold">{t("driver.wallet")}</h1>
          <div className="w-6" />
        </div>
        <p className="text-white/80 text-sm mb-1">{t("dwallet.availableBalance")}</p>
        <h1 className="text-4xl font-bold text-white">₹{availableBalance.toLocaleString("en-IN")}</h1>
        <button
          onClick={() => { setShowWithdraw(true); setWithdrawError(""); }}
          disabled={walletFrozen}
          className="mt-4 bg-white text-[#138808] font-semibold px-5 py-2.5 rounded-xl text-sm flex items-center gap-2 shadow-md disabled:opacity-60"
        >
          <ArrowDownToLine className="w-4 h-4" />
          {t("dwallet.withdraw")}
        </button>
      </div>

      <div className="px-4 -mt-4 space-y-4">
        {walletFrozen && (
          <div className="bg-[#0EA5E9]/10 border border-[#0EA5E9]/30 rounded-2xl p-4 flex items-center gap-3">
            <Snowflake className="w-5 h-5 text-[#0EA5E9] flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#0EA5E9]">{t("dwallet.walletFrozen")}</p>
              <p className="text-xs text-[#0EA5E9]/80">{wallet?.frozenReason || t("dwallet.contactSupportDetails")} {t("dwallet.withdrawalsPaused")}</p>
            </div>
          </div>
        )}

        {/* Pending Settlement */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#FFF5EB] dark:bg-[#3D2914] flex items-center justify-center flex-shrink-0">
            <Clock className="w-5 h-5 text-[#FF6B00]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">{t("dwallet.pendingBalance")}</p>
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">{t("dwallet.withdrawalsBeingProcessed")}</p>
          </div>
          <span className="font-bold text-[#FF6B00] flex-shrink-0">₹{pendingBalance}</span>
        </div>

        {pendingCommission > 0 && (
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-[#3D1414] flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-[#DC2626]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">{t("dwallet.pendingCommission")}</p>
              <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">{t("dwallet.pendingCommissionDesc")}</p>
            </div>
            <span className="font-bold text-[#DC2626] flex-shrink-0">₹{pendingCommission}</span>
          </div>
        )}

        {/* Commission Breakdown */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4">
          <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] mb-3">{t("dwallet.commissionBreakdown")}</h3>
          <div className="grid grid-cols-3 gap-3">
            {breakdown.map((item) => (
              <div key={item.labelKey} className="text-center">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-1"
                  style={{ backgroundColor: item.bg }}
                >
                  <item.icon className="w-4 h-4" style={{ color: item.color }} />
                </div>
                <p className="font-bold text-sm text-[#1A1A2E] dark:text-[#E5E7EB]">₹{item.value}</p>
                <p className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF]">{t(item.labelKey)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Advertisement Earnings */}
        <button
          onClick={() => navigate("/driver/ad-optin")}
          className="w-full bg-gradient-to-br from-[#7C3AED] to-[#5B21B6] rounded-2xl p-4 text-left hover:opacity-95 transition-opacity"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-white" />
              <span className="text-sm font-semibold text-white">{t("dwallet.advertisementEarnings")}</span>
            </div>
            <ChevronRight className="w-4 h-4 text-white/70" />
          </div>
          {myActiveCampaigns.length === 0 ? (
            <p className="text-xs text-white/70">{t("dwallet.noActiveCampaigns")}</p>
          ) : (
            <div className="space-y-2">
              {myActiveCampaigns.map((c) => (
                <div key={c.id} className="flex items-center justify-between bg-white/10 rounded-xl p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{c.name}</p>
                    <p className="text-[10px] text-white/60">{t("status.active")}</p>
                  </div>
                  <span className="font-bold text-white flex-shrink-0">₹{Math.round((c.spent * c.driverSharePercent) / 100)}</span>
                </div>
              ))}
            </div>
          )}
        </button>

        {/* AI Spending Analysis */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-[#7C3AED]" />
            <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">{t("dwallet.aiSpendingAnalysis")}</h3>
            <span className="text-[10px] text-[#9CA3AF] ml-auto">{t("dwallet.thisMonth")}</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <Fuel className="w-4 h-4 text-[#CA8A04] mx-auto mb-1" />
              <p className="font-bold text-sm text-[#1A1A2E] dark:text-[#E5E7EB]">₹{spendingAnalysis.fuel}</p>
              <p className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF]">{t("dwallet.fuel")}</p>
            </div>
            <div className="border-x border-gray-50 dark:border-gray-700">
              <Wrench className="w-4 h-4 text-[#0EA5E9] mx-auto mb-1" />
              <p className="font-bold text-sm text-[#1A1A2E] dark:text-[#E5E7EB]">₹{spendingAnalysis.maintenance}</p>
              <p className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF]">{t("dwallet.maintenance")}</p>
            </div>
            <div>
              <IndianRupee className="w-4 h-4 text-[#138808] mx-auto mb-1" />
              <p className="font-bold text-sm text-[#138808]">₹{spendingAnalysis.netProfit}</p>
              <p className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF]">{t("dwallet.netProfit")}</p>
            </div>
          </div>
        </div>

        {/* Payout Methods: Bank + UPI — filled in during onboarding
            (DriverOnboarding.tsx's bank step), read-only here. DriverProfile.tsx
            has its own separate (older, not-yet-connected) bank-details editor —
            deliberately not linked to from here until those two are unified. */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4">
          <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] mb-3">{t("dwallet.payoutMethods")}</h3>
          {!kycApproved && (
            <div className="flex items-start gap-2 bg-[#FFF5EB] dark:bg-[#3D2914] rounded-xl p-3 mb-3">
              <ShieldAlert className="w-4 h-4 text-[#FF6B00] flex-shrink-0 mt-0.5" />
              <p className="text-xs text-[#FF6B00]">
                {t("dwallet.withdrawalsOpenOnceApproved")}{driverProfile?.status === "rejected" && driverProfile.rejectionReason ? ` (${driverProfile.rejectionReason})` : "."}
              </p>
            </div>
          )}
          <div className="space-y-2">
            <div className="flex items-center gap-3 bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl p-3">
              <div className="w-10 h-10 rounded-full bg-[#E8EEF5] dark:bg-[#1E3A5F]/40 flex items-center justify-center flex-shrink-0">
                <Building2 className="w-5 h-5 text-[#1E3A5F] dark:text-[#93C5FD]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">{bankAccount.bank}</p>
                {bankAccount.accountMasked && (
                  <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">{bankAccount.accountMasked} · {bankAccount.ifsc}</p>
                )}
              </div>
              {bankAccount.verified && (
                <span className="flex items-center gap-1 text-[10px] font-medium text-[#138808] bg-[#E8F5E8] dark:bg-[#1A2D1A] px-2 py-1 rounded-full flex-shrink-0">
                  <ShieldCheck className="w-3 h-3" /> {t("dwallet.verified")}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl p-3">
              <div className="w-10 h-10 rounded-full bg-[#E0F2FE] dark:bg-[#0C2536] flex items-center justify-center flex-shrink-0">
                <Smartphone className="w-5 h-5 text-[#0EA5E9]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">UPI</p>
                <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] truncate">{upiAccount.vpa}</p>
              </div>
              {upiAccount.verified && (
                <span className="flex items-center gap-1 text-[10px] font-medium text-[#138808] bg-[#E8F5E8] dark:bg-[#1A2D1A] px-2 py-1 rounded-full flex-shrink-0">
                  <ShieldCheck className="w-3 h-3" /> {t("dwallet.verified")}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Withdraw History */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4">
          <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] mb-3">{t("dwallet.withdrawHistory")}</h3>
          {(withdrawalRequests ?? []).length === 0 ? (
            <p className="text-sm text-[#9CA3AF]">{t("dwallet.noWithdrawalsYet")}</p>
          ) : (
            <div className="space-y-1">
              {withdrawalRequests!.map((req) => {
                const meta = WITHDRAWAL_STATUS_META[req.status];
                const StatusIcon = req.status === "processing" ? Loader2 : req.status === "completed" ? ShieldCheck : req.status === "cancelled" ? XCircle : Clock;
                return (
                  <div key={req.id} className="py-2.5 border-b border-gray-50 dark:border-gray-700 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#F3F4F6] dark:bg-[#0F172A] flex items-center justify-center flex-shrink-0">
                        <ArrowDownToLine className="w-4 h-4 text-[#6B7280] dark:text-[#9CA3AF]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB] truncate">
                          {req.method === "upi" ? `UPI · ${upiAccount.vpa}` : `${t("dwallet.bankTransfer")} · ${bankAccount.bank} ${bankAccount.accountMasked}`}
                        </p>
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs text-[#9CA3AF]">{formatDate(req.requestedAt)}</p>
                          <span className="flex items-center gap-0.5 text-[10px] font-medium" style={{ color: meta.color }}>
                            <StatusIcon className={`w-2.5 h-2.5 ${req.status === "processing" ? "animate-spin" : ""}`} /> {t(meta.labelKey)}
                          </span>
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] flex-shrink-0">₹{req.amount}</span>
                      {req.status === "pending" && (
                        <button
                          onClick={() => handleCancelWithdrawal(req.id)}
                          disabled={cancelWithdrawalMutation.isPending}
                          className="p-1.5 rounded-full text-[#9CA3AF] hover:text-[#DC2626] flex-shrink-0 disabled:opacity-50"
                          title="Cancel request"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    {req.status === "failed" && req.failureReason && (
                      <p className="text-[10px] text-[#DC2626] mt-1 ml-12">{req.failureReason} — {t("dwallet.amountReturned")}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Transaction History */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4">
          <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] mb-3">{t("wallet.recentTransactions")}</h3>
          {(transactions ?? []).length === 0 ? (
            <p className="text-sm text-[#9CA3AF]">{t("wallet.noTransactions")}</p>
          ) : (
            <div className="space-y-1">
              {transactions!.map((txn) => {
                const amount = Number(txn.amount);
                return (
                  <div key={txn.id} className="flex items-center gap-3 py-2.5 border-b border-gray-50 dark:border-gray-700 last:border-0">
                    <div className="w-9 h-9 rounded-full bg-[#F8F9FA] dark:bg-[#0F172A] flex items-center justify-center flex-shrink-0">
                      <IndianRupee className="w-4 h-4 text-[#6B7280] dark:text-[#9CA3AF]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB] truncate">{txn.description}</p>
                      <p className="text-xs text-[#9CA3AF]">{formatDate(txn.createdAt.getTime())}</p>
                    </div>
                    <span className={`text-sm font-semibold ${amount > 0 ? "text-[#138808]" : "text-[#1A1A2E] dark:text-[#E5E7EB]"}`}>
                      {amount > 0 ? "+" : ""}₹{Math.abs(amount)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Withdraw Sheet */}
      {showWithdraw && (
        <div
          className="fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center sm:justify-center"
          onClick={() => setShowWithdraw(false)}
        >
          <div
            className="bg-white dark:bg-[#1E293B] rounded-t-3xl sm:rounded-3xl sm:my-8 w-full sm:max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1 bg-gray-200 dark:bg-gray-600 rounded-full mx-auto mb-4 sm:hidden" />
            <h2 className="font-bold text-lg text-[#1A1A2E] dark:text-[#E5E7EB] mb-1">{t("dwallet.withdraw")}</h2>
            <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] mb-4">{t("dwallet.availableBalance")}: ₹{availableBalance.toLocaleString("en-IN")}</p>

            {/* Bank vs UPI — a real branch (method is what the backend
                validates and what the simulated payout engine records), not
                cosmetic like the old Standard/Instant toggle it replaces. */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <button
                onClick={() => setWithdrawMethod("bank")}
                className={`text-left p-3 rounded-xl border-2 transition-colors ${
                  withdrawMethod === "bank" ? "border-[#138808] bg-[#E8F5E8] dark:bg-[#1A2D1A]" : "border-gray-100 dark:border-gray-700"
                }`}
              >
                <p className="text-xs font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5" /> {t("dwallet.bank")}
                </p>
                <p className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF] truncate">
                  {bankAccount.verified ? `${bankAccount.bank} ${bankAccount.accountMasked}` : t("dwallet.notVerified")}
                </p>
              </button>
              <button
                onClick={() => setWithdrawMethod("upi")}
                className={`text-left p-3 rounded-xl border-2 transition-colors ${
                  withdrawMethod === "upi" ? "border-[#0EA5E9] bg-[#E0F2FE] dark:bg-[#0C2536]" : "border-gray-100 dark:border-gray-700"
                }`}
              >
                <p className="text-xs font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] flex items-center gap-1">
                  <Smartphone className="w-3.5 h-3.5" /> UPI
                </p>
                <p className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF] truncate">{upiAccount.verified ? upiAccount.vpa : t("dwallet.notAdded")}</p>
              </button>
            </div>

            <div className="relative mb-2">
              <IndianRupee className="w-5 h-5 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="number"
                value={withdrawAmount}
                onChange={(e) => { setWithdrawAmount(e.target.value); setWithdrawError(""); }}
                placeholder={t("dwallet.enterAmount")}
                className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-[#E5E7EB] dark:border-gray-700 bg-transparent focus:border-[#138808] outline-none text-lg font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]"
                max={availableBalance}
              />
            </div>
            {financeSettings && (
              <p className="text-[10px] text-[#9CA3AF] mb-4">
                {t("dwallet.min")} ₹{financeSettings.minWithdrawal} · {t("dwallet.max")} ₹{financeSettings.maxWithdrawal} · {t("dwallet.upTo")} {financeSettings.maxRequestsPerDay} {t("dwallet.requestsPerDay")}
                {financeSettings.automaticPayout ? ` · ${t("dwallet.processedAutomatically")}` : ` · ${t("dwallet.reviewedByAdmin")}`}
              </p>
            )}

            {withdrawError && <p className="text-xs text-[#DC2626] mb-3">{withdrawError}</p>}
            <button
              onClick={handleWithdrawRequest}
              disabled={
                !withdrawAmount ||
                Number(withdrawAmount) <= 0 ||
                Number(withdrawAmount) > availableBalance ||
                !driverName ||
                !kycApproved ||
                (withdrawMethod === "bank" && !bankAccount.verified) ||
                (withdrawMethod === "upi" && !upiAccount.verified) ||
                requestWithdrawalMutation.isPending
              }
              className="w-full btn-green py-4 text-lg disabled:opacity-50"
            >
              {requestWithdrawalMutation.isPending ? t("dwallet.requesting") : t("dwallet.requestWithdrawal")}
            </button>
          </div>
        </div>
      )}

      <BottomNav role="driver" />
    </div>
  );
}
