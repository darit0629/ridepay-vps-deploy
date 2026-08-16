import { useState } from "react";
import { Wallet, Users2, Building2, Share2, Landmark, Check, X, Clock, Gift, Snowflake, Undo2, Settings2, RotateCw, Loader2 } from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import { useNotifications } from "@/contexts/NotificationsContext";
import { trpc } from "@/providers/trpc";

const ADJUSTMENT_TYPES = [
  { id: "bonus", label: "Bonus" },
  { id: "incentive", label: "Incentive" },
  { id: "penalty", label: "Penalty" },
  { id: "adjustment", label: "Adjustment" },
  { id: "festival_bonus", label: "Festival Bonus" },
  { id: "challenge_reward", label: "Challenge Reward" },
  { id: "peak_bonus", label: "Peak Bonus" },
] as const;

const WITHDRAWAL_STATUS_META: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending", color: "#FF6B00" },
  approved: { label: "Approved", color: "#0EA5E9" },
  processing: { label: "Processing", color: "#7C3AED" },
  completed: { label: "Completed", color: "#138808" },
  rejected: { label: "Rejected", color: "#DC2626" },
  failed: { label: "Failed", color: "#DC2626" },
  cancelled: { label: "Cancelled", color: "#9CA3AF" },
};

const WALLET_META: Record<string, { icon: typeof Wallet; label: string; color: string }> = {
  company: { icon: Building2, label: "Company Wallet", color: "#FF6B00" },
  fleet: { icon: Landmark, label: "Fleet Wallet", color: "#0EA5E9" },
  referral: { icon: Share2, label: "Referral Wallet", color: "#7C3AED" },
  franchise: { icon: Users2, label: "Franchise Wallet", color: "#138808" },
};

export default function AdminSettlementCenter() {
  const utils = trpc.useUtils();
  const { pushSystemNotification } = useNotifications();
  const { data: pooledWallets } = trpc.settlement.listWallets.useQuery(undefined, { refetchInterval: 5000 });
  const { data: pendingWithdrawals } = trpc.settlement.listWithdrawalRequests.useQuery({ status: "pending" }, { refetchInterval: 5000 });
  const { data: processingWithdrawals } = trpc.settlement.listWithdrawalRequests.useQuery({ status: "processing" }, { refetchInterval: 3000 });
  const { data: resolvedWithdrawals } = trpc.settlement.listWithdrawalRequests.useQuery({}, { refetchInterval: 5000 });
  const { data: recentTxns } = trpc.settlement.listTransactions.useQuery({ limit: 30 }, { refetchInterval: 5000 });
  const { data: financeSettings } = trpc.settlement.getFinanceSettings.useQuery(undefined, { refetchInterval: 10000 });

  const invalidateWalletViews = () => {
    utils.settlement.listWithdrawalRequests.invalidate();
    utils.settlement.listWallets.invalidate();
    utils.settlement.listTransactions.invalidate();
  };

  const resolveMutation = trpc.settlement.resolveWithdrawal.useMutation({ onSuccess: invalidateWalletViews });
  const retryMutation = trpc.settlement.retryPayout.useMutation({ onSuccess: invalidateWalletViews });
  const freezeMutation = trpc.settlement.freezeWallet.useMutation({ onSuccess: () => utils.settlement.listWallets.invalidate() });
  const unfreezeMutation = trpc.settlement.unfreezeWallet.useMutation({ onSuccess: () => utils.settlement.listWallets.invalidate() });
  const reverseMutation = trpc.settlement.reverseTransaction.useMutation({ onSuccess: invalidateWalletViews });
  const updateSettingsMutation = trpc.settlement.updateFinanceSettings.useMutation({
    onSuccess: () => utils.settlement.getFinanceSettings.invalidate(),
  });
  const adjustMutation = trpc.settlement.adjustWallet.useMutation({
    onSuccess: (_wallet, variables) => {
      utils.settlement.listWallets.invalidate();
      utils.settlement.listTransactions.invalidate();
      pushSystemNotification({
        audience: "driver",
        title: variables.amount >= 0 ? "Wallet credited" : "Wallet adjusted",
        message: `${variables.description} — ₹${Math.abs(variables.amount)} ${variables.amount >= 0 ? "added to" : "deducted from"} your wallet.`,
      });
      setAdjustDriver("");
      setAdjustAmount("");
      setAdjustDescription("");
      setAdjustSaved(true);
      setTimeout(() => setAdjustSaved(false), 2000);
    },
  });

  const [adjustDriver, setAdjustDriver] = useState("");
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustType, setAdjustType] = useState<(typeof ADJUSTMENT_TYPES)[number]["id"]>("bonus");
  const [adjustDescription, setAdjustDescription] = useState("");
  const [adjustSaved, setAdjustSaved] = useState(false);
  const [freezeTarget, setFreezeTarget] = useState<string | null>(null);
  const [freezeReason, setFreezeReason] = useState("");
  const [reverseTarget, setReverseTarget] = useState<string | null>(null);
  const [reverseNote, setReverseNote] = useState("");

  const handleFreeze = (ownerId: string) => {
    if (!freezeReason.trim()) return;
    freezeMutation.mutate(
      { walletType: "driver", ownerId, reason: freezeReason.trim() },
      {
        onSuccess: () => {
          setFreezeTarget(null);
          setFreezeReason("");
          pushSystemNotification({
            audience: "driver",
            title: "Wallet frozen",
            message: `Your wallet has been frozen: ${freezeReason.trim()}. Withdrawals are paused until it's resolved.`,
          });
        },
      }
    );
  };

  const handleReverse = (transactionId: string) => {
    if (!reverseNote.trim()) return;
    reverseMutation.mutate({ transactionId, adminNote: reverseNote.trim() }, { onSuccess: () => { setReverseTarget(null); setReverseNote(""); } });
  };

  const handleIssueAdjustment = () => {
    const amount = Number(adjustAmount);
    if (!adjustDriver.trim() || !amount || !adjustDescription.trim()) return;
    adjustMutation.mutate({
      walletType: "driver",
      ownerId: adjustDriver.trim(),
      amount: adjustType === "penalty" ? -Math.abs(amount) : amount,
      type: adjustType,
      description: adjustDescription.trim(),
    });
  };

  const driverWallets = (pooledWallets ?? []).filter((w) => w.walletType === "driver");
  const singleWallets = (pooledWallets ?? []).filter((w) => w.walletType !== "driver");
  const recentlyResolved = (resolvedWithdrawals ?? [])
    .filter((r) => r.status !== "pending" && r.status !== "processing")
    .slice(0, 10);

  return (
    <AdminLayout title="Settlement Center">
      <div className="max-w-[1400px] grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Pooled wallets */}
        <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {["company", "fleet", "referral", "franchise"].map((type) => {
            const wallet = singleWallets.find((w) => w.walletType === type);
            const meta = WALLET_META[type];
            return (
              <div key={type} className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4">
                <div className="w-9 h-9 rounded-full flex items-center justify-center mb-2" style={{ backgroundColor: `${meta.color}22` }}>
                  <meta.icon className="w-4 h-4" style={{ color: meta.color }} />
                </div>
                <p className="text-[11px] text-[#6B7280] dark:text-[#9CA3AF]">{meta.label}</p>
                <p className="text-lg font-bold text-[#1A1A2E] dark:text-[#E5E7EB]">₹{wallet?.availableBalance ?? 0}</p>
                <p className="text-[10px] text-[#9CA3AF]">Lifetime ₹{wallet?.lifetimeEarnings ?? 0}</p>
              </div>
            );
          })}
        </div>

        {/* Driver wallets */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-[#1A1A2E] dark:text-[#E5E7EB]" />
            <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">Driver Wallets</h3>
          </div>
          {driverWallets.length === 0 ? (
            <p className="text-sm text-[#9CA3AF]">No driver earnings recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {driverWallets.map((w) => (
                <div key={w.ownerId} className="bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl p-3">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB] truncate">{w.ownerId}</p>
                        {w.frozen && (
                          <span className="flex items-center gap-1 text-[9px] font-medium text-[#0EA5E9] bg-[#E0F2FE] dark:bg-[#0C2536] px-1.5 py-0.5 rounded-full flex-shrink-0">
                            <Snowflake className="w-2.5 h-2.5" /> Frozen
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-[#9CA3AF]">
                        Today ₹{w.earnings.daily} · This week ₹{w.earnings.weekly} · This month ₹{w.earnings.monthly}
                      </p>
                      {w.pendingCommission > 0 && (
                        <p className="text-[10px] text-[#DC2626]">Pending commission (cash) ₹{w.pendingCommission}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="text-right">
                        <p className="text-sm font-bold text-[#138808]">₹{w.availableBalance}</p>
                        {w.pendingBalance > 0 && <p className="text-[10px] text-[#FF6B00]">Pending ₹{w.pendingBalance}</p>}
                      </div>
                      {w.frozen ? (
                        <button
                          onClick={() =>
                            unfreezeMutation.mutate(
                              { walletType: "driver", ownerId: w.ownerId },
                              { onSuccess: () => pushSystemNotification({ audience: "driver", title: "Wallet unfrozen", message: "Your wallet has been unfrozen — withdrawals are available again." }) }
                            )
                          }
                          disabled={unfreezeMutation.isPending}
                          className="p-1.5 rounded-full bg-[#E8F5E8] dark:bg-[#1A2D1A] text-[#138808] disabled:opacity-50"
                          title="Unfreeze wallet"
                        >
                          <Snowflake className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          onClick={() => { setFreezeTarget(w.ownerId); setFreezeReason(""); }}
                          className="p-1.5 rounded-full bg-gray-100 dark:bg-white/5 text-[#6B7280] dark:text-[#9CA3AF]"
                          title="Freeze wallet"
                        >
                          <Snowflake className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  {freezeTarget === w.ownerId && (
                    <div className="mt-2 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        value={freezeReason}
                        onChange={(e) => setFreezeReason(e.target.value)}
                        placeholder="Reason for freezing this wallet"
                        className="flex-1 bg-white dark:bg-[#1E293B] rounded-lg px-3 py-1.5 text-xs outline-none border border-gray-200 dark:border-gray-700 focus:border-[#0EA5E9] text-[#1A1A2E] dark:text-[#E5E7EB]"
                      />
                      <button
                        onClick={() => handleFreeze(w.ownerId)}
                        disabled={!freezeReason.trim() || freezeMutation.isPending}
                        className="px-3 py-1.5 rounded-lg bg-[#0EA5E9] text-white text-xs font-medium disabled:opacity-50"
                      >
                        Freeze
                      </button>
                      <button onClick={() => setFreezeTarget(null)} className="px-2 py-1.5 text-xs text-[#9CA3AF]">
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Finance Settings */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-[#1A1A2E] dark:text-[#E5E7EB]" />
            <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">Finance Settings</h3>
          </div>
          {!financeSettings ? (
            <p className="text-sm text-[#9CA3AF]">Loading…</p>
          ) : (
            <div className="space-y-3">
              <label className="flex items-center justify-between bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl p-3 cursor-pointer">
                <div>
                  <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">Automatic Payout</p>
                  <p className="text-[10px] text-[#9CA3AF]">Approved requests process instantly, no admin review</p>
                </div>
                <input
                  type="checkbox"
                  checked={financeSettings.automaticPayout}
                  onChange={(e) =>
                    updateSettingsMutation.mutate({ automaticPayout: e.target.checked, manualApprovalRequired: !e.target.checked })
                  }
                  className="w-5 h-5 accent-[#FF6B00]"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-[#9CA3AF] block mb-1">Min Withdrawal (₹)</label>
                  <input
                    type="number"
                    defaultValue={financeSettings.minWithdrawal}
                    onBlur={(e) => e.target.value && updateSettingsMutation.mutate({ minWithdrawal: Number(e.target.value) })}
                    className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-lg px-3 py-2 text-sm outline-none border border-gray-100 dark:border-gray-700 focus:border-[#FF6B00] text-[#1A1A2E] dark:text-[#E5E7EB]"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#9CA3AF] block mb-1">Max Withdrawal (₹)</label>
                  <input
                    type="number"
                    defaultValue={financeSettings.maxWithdrawal}
                    onBlur={(e) => e.target.value && updateSettingsMutation.mutate({ maxWithdrawal: Number(e.target.value) })}
                    className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-lg px-3 py-2 text-sm outline-none border border-gray-100 dark:border-gray-700 focus:border-[#FF6B00] text-[#1A1A2E] dark:text-[#E5E7EB]"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#9CA3AF] block mb-1">Daily Withdrawal Limit (₹)</label>
                  <input
                    type="number"
                    defaultValue={financeSettings.dailyWithdrawalLimit}
                    onBlur={(e) => e.target.value && updateSettingsMutation.mutate({ dailyWithdrawalLimit: Number(e.target.value) })}
                    className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-lg px-3 py-2 text-sm outline-none border border-gray-100 dark:border-gray-700 focus:border-[#FF6B00] text-[#1A1A2E] dark:text-[#E5E7EB]"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#9CA3AF] block mb-1">Max Requests / Day</label>
                  <input
                    type="number"
                    defaultValue={financeSettings.maxRequestsPerDay}
                    onBlur={(e) => e.target.value && updateSettingsMutation.mutate({ maxRequestsPerDay: Number(e.target.value) })}
                    className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-lg px-3 py-2 text-sm outline-none border border-gray-100 dark:border-gray-700 focus:border-[#FF6B00] text-[#1A1A2E] dark:text-[#E5E7EB]"
                  />
                </div>
              </div>
              <label className="flex items-center justify-between bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl p-3 cursor-pointer">
                <p className="text-xs text-[#1A1A2E] dark:text-[#E5E7EB]">Pause settlements on holidays</p>
                <input
                  type="checkbox"
                  checked={financeSettings.holidaySettlementPause}
                  onChange={(e) => updateSettingsMutation.mutate({ holidaySettlementPause: e.target.checked })}
                  className="w-4 h-4 accent-[#FF6B00]"
                />
              </label>
            </div>
          )}
        </div>

        {/* Issue bonus/incentive/penalty/adjustment to a driver's wallet */}
        <div className="lg:col-span-2 bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-[#7C3AED]" />
            <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">Issue Bonus / Incentive / Penalty / Adjustment</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              value={adjustDriver}
              onChange={(e) => setAdjustDriver(e.target.value)}
              placeholder="Driver name e.g. Rakesh Kumar"
              className="bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-4 py-3 text-sm outline-none border border-gray-100 dark:border-gray-700 focus:border-[#FF6B00] text-[#1A1A2E] dark:text-[#E5E7EB]"
            />
            <input
              type="number"
              value={adjustAmount}
              onChange={(e) => setAdjustAmount(e.target.value)}
              placeholder="Amount (₹)"
              className="bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-4 py-3 text-sm outline-none border border-gray-100 dark:border-gray-700 focus:border-[#FF6B00] text-[#1A1A2E] dark:text-[#E5E7EB]"
            />
          </div>
          <div className="flex gap-2">
            {ADJUSTMENT_TYPES.map((t) => (
              <button
                key={t.id}
                onClick={() => setAdjustType(t.id)}
                className={`flex-1 py-2 rounded-xl text-xs font-medium transition-colors ${
                  adjustType === t.id ? "bg-[#7C3AED] text-white" : "bg-gray-100 dark:bg-[#0F172A] text-[#6B7280] dark:text-[#9CA3AF]"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <input
            value={adjustDescription}
            onChange={(e) => setAdjustDescription(e.target.value)}
            placeholder="Reason / description"
            className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-4 py-3 text-sm outline-none border border-gray-100 dark:border-gray-700 focus:border-[#FF6B00] text-[#1A1A2E] dark:text-[#E5E7EB]"
          />
          {adjustSaved && <p className="text-xs text-[#138808] font-medium">Applied to driver's wallet.</p>}
          <button
            onClick={handleIssueAdjustment}
            disabled={!adjustDriver.trim() || !adjustAmount || !adjustDescription.trim() || adjustMutation.isPending}
            className="w-full btn-saffron py-3 disabled:opacity-50"
          >
            Apply to Wallet
          </button>
        </div>

        {/* Withdrawal requests */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-[#FF6B00]" />
            <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">Withdrawal Requests</h3>
          </div>
          {(pendingWithdrawals ?? []).length === 0 ? (
            <p className="text-sm text-[#9CA3AF]">No pending withdrawal requests.</p>
          ) : (
            <div className="space-y-2">
              {pendingWithdrawals!.map((req) => (
                <div key={req.id} className="flex items-center justify-between bg-[#FFF5EB] dark:bg-[#3D2914] rounded-xl p-3">
                  <div>
                    <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">
                      {req.ownerId} <span className="text-[#9CA3AF] font-normal">· {req.walletType} · {req.method}</span>
                    </p>
                    <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">₹{req.amount} requested</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => resolveMutation.mutate({ id: req.id, approve: true })}
                      disabled={resolveMutation.isPending}
                      className="w-9 h-9 rounded-full bg-[#138808] flex items-center justify-center disabled:opacity-50"
                      title="Approve"
                    >
                      <Check className="w-4 h-4 text-white" />
                    </button>
                    <button
                      onClick={() => resolveMutation.mutate({ id: req.id, approve: false })}
                      disabled={resolveMutation.isPending}
                      className="w-9 h-9 rounded-full bg-[#DC2626] flex items-center justify-center disabled:opacity-50"
                      title="Reject"
                    >
                      <X className="w-4 h-4 text-white" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {(processingWithdrawals ?? []).length > 0 && (
            <div className="pt-3 border-t border-gray-100 dark:border-gray-700 space-y-2">
              <p className="text-xs font-medium text-[#9CA3AF]">Processing</p>
              {processingWithdrawals!.map((req) => (
                <div key={req.id} className="flex items-center justify-between bg-[#F3E8FF] dark:bg-[#2D1B4E] rounded-xl p-3">
                  <div>
                    <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">
                      {req.ownerId} <span className="text-[#9CA3AF] font-normal">· ₹{req.amount} · {req.payoutMode}</span>
                    </p>
                    <p className="text-xs text-[#7C3AED] flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> Sending to {req.method}…
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {recentlyResolved.length > 0 && (
            <div className="pt-3 border-t border-gray-100 dark:border-gray-700 space-y-2">
              <p className="text-xs font-medium text-[#9CA3AF]">Recently Resolved</p>
              {recentlyResolved.map((req) => {
                const meta = WITHDRAWAL_STATUS_META[req.status];
                return (
                  <div key={req.id} className="flex items-center justify-between text-xs gap-2">
                    <span className="text-[#6B7280] dark:text-[#9CA3AF] truncate flex-1">
                      {req.ownerId} · ₹{req.amount}
                      {req.status === "failed" && req.failureReason ? ` — ${req.failureReason}` : ""}
                    </span>
                    <span style={{ color: meta.color }} className="flex-shrink-0 font-medium">{meta.label}</span>
                    {req.status === "failed" && (
                      <button
                        onClick={() => retryMutation.mutate({ id: req.id })}
                        disabled={retryMutation.isPending}
                        className="flex items-center gap-1 text-[#FF6B00] font-medium flex-shrink-0 disabled:opacity-50"
                      >
                        <RotateCw className="w-3 h-3" /> Retry
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent transactions */}
        <div className="lg:col-span-2 bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-6 space-y-3">
          <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">Recent Settlement Activity</h3>
          {(recentTxns ?? []).length === 0 ? (
            <p className="text-sm text-[#9CA3AF]">No settlement activity yet.</p>
          ) : (
            <div className="space-y-1.5">
              {recentTxns!.map((t) => {
                const amount = Number(t.amount);
                const isReversal = t.type === "withdrawal_reversal";
                return (
                  <div key={t.id} className="py-1.5 border-b border-gray-50 dark:border-gray-800 last:border-0">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#6B7280] dark:text-[#9CA3AF] truncate flex-1">{t.description}</span>
                      <span className={`font-medium flex-shrink-0 ml-2 ${amount >= 0 ? "text-[#138808]" : "text-[#DC2626]"}`}>
                        {amount >= 0 ? "+" : ""}₹{amount}
                      </span>
                      {!isReversal && (
                        <button
                          onClick={() => { setReverseTarget(t.id); setReverseNote(""); }}
                          className="ml-2 p-1 rounded-full text-[#9CA3AF] hover:text-[#DC2626] flex-shrink-0"
                          title="Reverse this transaction"
                        >
                          <Undo2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    {reverseTarget === t.id && (
                      <div className="mt-1.5 flex items-center gap-2">
                        <input
                          value={reverseNote}
                          onChange={(e) => setReverseNote(e.target.value)}
                          placeholder="Reason for reversing this transaction"
                          className="flex-1 bg-[#F8F9FA] dark:bg-[#0F172A] rounded-lg px-2.5 py-1.5 text-xs outline-none border border-gray-200 dark:border-gray-700 focus:border-[#DC2626] text-[#1A1A2E] dark:text-[#E5E7EB]"
                        />
                        <button
                          onClick={() => handleReverse(t.id)}
                          disabled={!reverseNote.trim() || reverseMutation.isPending}
                          className="px-3 py-1.5 rounded-lg bg-[#DC2626] text-white text-xs font-medium disabled:opacity-50"
                        >
                          Reverse
                        </button>
                        <button onClick={() => setReverseTarget(null)} className="px-2 py-1.5 text-xs text-[#9CA3AF]">
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
