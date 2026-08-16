import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router";
import {
  Plus, IndianRupee, Smartphone, CreditCard, Gift, Users, Crown,
  ArrowUpRight, ArrowDownLeft, Clock, ChevronRight, Bell, HelpCircle, Eye, EyeOff, Copy,
  Wallet as WalletIcon, Ticket, FileText, PiggyBank, Car, Sparkles, Download,
} from "lucide-react";
import BottomNav from "@/components/BottomNav";
import Reveal from "@/components/Reveal";
import { useSubscriptionPlans } from "@/contexts/SubscriptionPlansContext";
import { useNotifications } from "@/contexts/NotificationsContext";
import { trpc } from "@/providers/trpc";
import { openRazorpayCheckout } from "@/lib/razorpayCheckout";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";

type TransactionType =
  | "commission_credit" | "bonus" | "incentive" | "penalty" | "adjustment" | "withdrawal"
  | "recharge" | "refund" | "cashback" | "promotional_credit" | "referral_credit" | "coupon_discount" | "debit";

const typeConfig: Record<TransactionType, { icon: typeof IndianRupee; color: string; bg: string }> = {
  recharge: { icon: ArrowDownLeft, color: "#138808", bg: "#E8F5E8" },
  debit: { icon: ArrowUpRight, color: "#1A1A2E", bg: "#F3F4F6" },
  cashback: { icon: Gift, color: "#7C3AED", bg: "#F3E8FF" },
  referral_credit: { icon: Users, color: "#0EA5E9", bg: "#E0F2FE" },
  refund: { icon: IndianRupee, color: "#FF6B00", bg: "#FFF5EB" },
  promotional_credit: { icon: Gift, color: "#7C3AED", bg: "#F3E8FF" },
  coupon_discount: { icon: IndianRupee, color: "#FF6B00", bg: "#FFF5EB" },
  commission_credit: { icon: IndianRupee, color: "#138808", bg: "#E8F5E8" },
  bonus: { icon: Gift, color: "#7C3AED", bg: "#F3E8FF" },
  incentive: { icon: Gift, color: "#7C3AED", bg: "#F3E8FF" },
  penalty: { icon: ArrowUpRight, color: "#DC2626", bg: "#FEE2E2" },
  adjustment: { icon: IndianRupee, color: "#6B7280", bg: "#F3F4F6" },
  withdrawal: { icon: ArrowUpRight, color: "#1A1A2E", bg: "#F3F4F6" },
};

const PAYMENT_METHOD_META = [
  { id: "upi" as const, label: "UPI", icon: Smartphone },
  { id: "card" as const, label: "Card", icon: CreditCard },
];

interface SavedPaymentDetails {
  upi: string;
  cardLast4: string;
}

const DEFAULT_PAYMENT_DETAILS: SavedPaymentDetails = { upi: "", cardLast4: "" };

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

export default function UserWallet() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user } = useAuth();
  const customerName = user?.name ?? "";
  const { plans } = useSubscriptionPlans();
  const { pushSystemNotification } = useNotifications();
  const [showAddMoney, setShowAddMoney] = useState(false);
  const [addAmount, setAddAmount] = useState("500");
  const [rechargeMethod, setRechargeMethod] = useState<"upi" | "card">("upi");
  const [razorpayError, setRazorpayError] = useState("");
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  // No backend model for saved payment methods exists in this prototype
  // (unlike the wallet balance itself) — persisted locally per device.
  const [paymentDetails, setPaymentDetails] = useState<SavedPaymentDetails>(() => {
    const saved = localStorage.getItem("ridepay_payment_details");
    if (saved) {
      try {
        return JSON.parse(saved) as SavedPaymentDetails;
      } catch {
        // Fall through to defaults on corrupt/old data.
      }
    }
    return DEFAULT_PAYMENT_DETAILS;
  });
  useEffect(() => {
    localStorage.setItem("ridepay_payment_details", JSON.stringify(paymentDetails));
  }, [paymentDetails]);

  const [showManagePayments, setShowManagePayments] = useState(false);
  const [editUpi, setEditUpi] = useState(paymentDetails.upi);
  const [editCardLast4, setEditCardLast4] = useState(paymentDetails.cardLast4);
  const [balanceHidden, setBalanceHidden] = useState(false);
  const [showAllTransactions, setShowAllTransactions] = useState(false);
  const { unreadCountFor } = useNotifications();
  const unread = unreadCountFor("rider");

  const openManagePayments = () => {
    setEditUpi(paymentDetails.upi);
    setEditCardLast4(paymentDetails.cardLast4);
    setShowManagePayments(true);
  };

  const handleSavePaymentDetails = () => {
    const last4 = editCardLast4.replace(/\D/g, "").slice(-4).padStart(4, "0");
    setPaymentDetails({
      upi: editUpi.trim() || paymentDetails.upi,
      cardLast4: last4 || paymentDetails.cardLast4,
    });
    setShowManagePayments(false);
  };

  const utils = trpc.useUtils();
  const { data: wallet } = trpc.settlement.getWallet.useQuery(
    { walletType: "customer", ownerId: customerName },
    { enabled: !!customerName, refetchInterval: 5000, refetchIntervalInBackground: true }
  );
  const { data: transactions } = trpc.settlement.listTransactions.useQuery(
    { walletType: "customer", ownerId: customerName, limit: 50 },
    { enabled: !!customerName, refetchInterval: 5000, refetchIntervalInBackground: true }
  );
  const rechargeMutation = trpc.settlement.rechargeWallet.useMutation({
    onSuccess: () => {
      utils.settlement.getWallet.invalidate({ walletType: "customer", ownerId: customerName });
      utils.settlement.listTransactions.invalidate({ walletType: "customer", ownerId: customerName });
    },
  });
  const createOrderMutation = trpc.razorpay.createOrder.useMutation();
  const verifyPaymentMutation = trpc.razorpay.verifyPayment.useMutation();

  const balance = wallet?.availableBalance ?? 0;
  // Coupons aren't wired up yet (that's its own feature); referral earnings
  // are real — they'll just read 0 until something actually credits a
  // "referral_credit" transaction for this wallet.
  const coupons = 3;
  const referralEarnings = Math.round(
    (transactions ?? []).filter((t) => t.type === "referral_credit").reduce((sum, t) => sum + Number(t.amount), 0)
  );
  const activePlan = plans.find((p) => p.active && p.id !== "free");

  const quickAmounts = [200, 500, 1000, 2000];

  // Cosmetic, derived — no wallet-ID field exists server-side, so this is
  // just a stable, display-only ID built from the real account id.
  const walletId = `RPW${String(user?.id ?? 0).padStart(9, "0")}`;
  const copyWalletId = () => { navigator.clipboard.writeText(walletId).catch(() => {}); };

  // "This Month" summary — computed entirely from the transactions already
  // fetched above (real data, no new query), compared against the same
  // window last month for the %-change indicators.
  const monthlySummary = useMemo(() => {
    const now = new Date();
    const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    const thisMonthStart = startOfMonth(now);
    const lastMonthStart = startOfMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1));

    const bucket = (fromTs: number, toTs: number) => (transactions ?? []).filter((t) => {
      const ts = t.createdAt.getTime();
      return ts >= fromTs && ts < toTs;
    });
    const thisMonth = bucket(thisMonthStart, Date.now());
    const lastMonth = bucket(lastMonthStart, thisMonthStart);

    const sumWhere = (rows: typeof thisMonth, pred: (t: (typeof thisMonth)[number]) => boolean) =>
      rows.filter(pred).reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);
    const pctChange = (current: number, prior: number) =>
      prior === 0 ? (current > 0 ? 100 : 0) : Math.round(((current - prior) / prior) * 100);

    const spentThis = sumWhere(thisMonth, (t) => Number(t.amount) < 0);
    const spentLast = sumWhere(lastMonth, (t) => Number(t.amount) < 0);
    const ridesThis = thisMonth.filter((t) => t.description.toLowerCase().includes("ride")).length;
    const ridesLast = lastMonth.filter((t) => t.description.toLowerCase().includes("ride")).length;
    const savedThis = sumWhere(thisMonth, (t) => t.type === "coupon_discount");
    const savedLast = sumWhere(lastMonth, (t) => t.type === "coupon_discount");
    const cashbackThis = sumWhere(thisMonth, (t) => t.type === "cashback");
    const cashbackLast = sumWhere(lastMonth, (t) => t.type === "cashback");

    return {
      spent: { value: spentThis, pct: pctChange(spentThis, spentLast) },
      rides: { value: ridesThis, pct: pctChange(ridesThis, ridesLast) },
      saved: { value: savedThis, pct: pctChange(savedThis, savedLast) },
      cashback: { value: cashbackThis, pct: pctChange(cashbackThis, cashbackLast) },
    };
  }, [transactions]);

  // Real CSV built from the same transactions already on screen — no
  // server-side "statements" feature exists, so this generates one
  // client-side from actual data rather than linking somewhere fake.
  const downloadStatement = () => {
    const rows = [
      ["Date", "Description", "Type", "Amount"],
      ...((transactions ?? []).map((t) => [formatDate(t.createdAt.getTime()), t.description, t.type, String(t.amount)])),
    ];
    const csv = rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ridepay-statement-${walletId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Real Razorpay Standard Checkout: create an order server-side, open the
  // modal with that order_id, then only credit the wallet once the payment
  // signature has been verified server-side too — the amount actually
  // credited comes from the verified order, not the client-entered value.
  const handleAddMoney = async () => {
    const amount = Number(addAmount);
    if (!amount || amount <= 0 || !customerName) return;
    setRazorpayError("");

    try {
      const order = await createOrderMutation.mutateAsync({
        amount: Math.round(amount * 100),
        currency: "INR",
        // Razorpay's Orders API caps receipt at 40 chars — a user's full
        // name is unbounded, so this must key off something length-safe.
        receipt: `wallet-${user?.id ?? "0"}-${Date.now()}`,
      });

      setCheckoutOpen(true);
      await openRazorpayCheckout({
        orderId: order.order_id,
        amount: order.amount,
        currency: order.currency,
        name: "Ridepay",
        description: "Add money to wallet",
        // contact + email (not just name) so Razorpay's payment-method
        // pre-selection/eligibility logic has what it needs — a bare name
        // prefill left UPI eligible-but-unshown in production.
        prefill: { name: customerName, contact: user?.phone ?? undefined, email: user?.email ?? undefined },
        onSuccess: async (result) => {
          try {
            const verified = await verifyPaymentMutation.mutateAsync(result);
            rechargeMutation.mutate(
              { ownerId: customerName, amount: verified.amount / 100, method: rechargeMethod },
              {
                onSuccess: (updatedWallet) => {
                  setShowAddMoney(false);
                  pushSystemNotification({
                    audience: "rider",
                    title: "Money added successfully",
                    message: `₹${(verified.amount / 100).toLocaleString("en-IN")} added via ${rechargeMethod.toUpperCase()}. Wallet balance: ₹${updatedWallet.availableBalance.toLocaleString("en-IN")}.`,
                  });
                },
              }
            );
          } catch {
            setRazorpayError(t("wallet.verifyFailed"));
          } finally {
            setCheckoutOpen(false);
          }
        },
        onDismiss: () => setCheckoutOpen(false),
        onFailure: (message) => {
          setCheckoutOpen(false);
          setRazorpayError(message);
        },
      });
    } catch {
      setCheckoutOpen(false);
      setRazorpayError(t("wallet.startFailed"));
    }
  };

  const visibleTransactions = showAllTransactions ? (transactions ?? []) : (transactions ?? []).slice(0, 3);

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0F172A] pb-24">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-start justify-between">
        <div>
          <h1 className="font-bold text-2xl text-[#1A1A2E] dark:text-white">{t("wallet.title")}</h1>
          <p className="text-xs text-[#6B7280] dark:text-white/50 mt-0.5">{t("wallet.manageBalance")}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate("/user/notifications")} className="relative p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/5">
            <Bell className="w-5 h-5 text-[#1A1A2E] dark:text-white" />
            {unread > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#FF6B00] rounded-full" />}
          </button>
          <button onClick={() => navigate("/user/support")} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/5">
            <HelpCircle className="w-5 h-5 text-[#1A1A2E] dark:text-white" />
          </button>
        </div>
      </div>

      <div className="px-4 space-y-4">
        {/* Total Balance */}
        <Reveal>
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#FF6B00] to-[#C2410C] p-5">
          <div className="absolute -right-6 -bottom-10 w-40 h-40 rounded-full bg-white/10 blur-2xl pointer-events-none" />
          <WalletIcon className="absolute right-3 bottom-3 w-24 h-24 text-white/10 rotate-[-12deg] pointer-events-none" strokeWidth={1.5} />
          <div className="relative z-10">
            <button onClick={() => setBalanceHidden((v) => !v)} className="flex items-center gap-1.5 text-white/80 text-xs mb-1.5">
              {t("wallet.balance")} {balanceHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
            <h2 className="text-4xl font-bold text-white mb-2">{balanceHidden ? "₹••••" : `₹${balance.toLocaleString("en-IN")}`}</h2>
            <button onClick={copyWalletId} className="flex items-center gap-1.5 text-white/70 text-xs mb-4">
              {t("wallet.walletId")}: {walletId} <Copy className="w-3 h-3" />
            </button>
            <button
              onClick={() => { setRazorpayError(""); setShowAddMoney(true); }}
              className="bg-white text-[#FF6B00] font-semibold px-5 py-2.5 rounded-xl text-sm flex items-center gap-2 shadow-md"
            >
              <Plus className="w-4 h-4" />
              {t("wallet.addMoney")}
            </button>
          </div>
        </div>
        </Reveal>

        {/* Quick Actions */}
        <Reveal delay={70}>
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm border border-gray-100 dark:border-white/[0.06] grid grid-cols-4 divide-x divide-gray-100 dark:divide-white/[0.06]">
          <button className="flex flex-col items-center gap-1.5 py-4 px-1">
            <Ticket className="w-5 h-5 text-[#A855F7]" />
            <span className="text-[11px] font-medium text-[#1A1A2E] dark:text-white">{t("wallet.coupons")}</span>
            <span className="text-[10px] text-[#A855F7] flex items-center">{coupons} {t("profile.available")} <ChevronRight className="w-2.5 h-2.5" /></span>
          </button>
          <button className="flex flex-col items-center gap-1.5 py-4 px-1">
            <Users className="w-5 h-5 text-[#0EA5E9]" />
            <span className="text-[11px] font-medium text-[#1A1A2E] dark:text-white">{t("wallet.referral")}</span>
            <span className="text-[10px] text-[#0EA5E9] flex items-center">₹{referralEarnings} <ChevronRight className="w-2.5 h-2.5" /></span>
          </button>
          <button onClick={() => navigate("/user/subscription")} className="flex flex-col items-center gap-1.5 py-4 px-1">
            <Crown className="w-5 h-5 text-[#EAB308]" />
            <span className="text-[11px] font-medium text-[#1A1A2E] dark:text-white truncate w-full text-center">{activePlan ? activePlan.name : t("wallet.corporate")}</span>
            <span className="text-[10px] text-[#EAB308] flex items-center">{t("profile.viewPlan")} <ChevronRight className="w-2.5 h-2.5" /></span>
          </button>
          <button onClick={downloadStatement} className="flex flex-col items-center gap-1.5 py-4 px-1">
            <FileText className="w-5 h-5 text-[#138808]" />
            <span className="text-[11px] font-medium text-[#1A1A2E] dark:text-white">{t("wallet.statements")}</span>
            <span className="text-[10px] text-[#138808] flex items-center">{t("download")} <Download className="w-2.5 h-2.5 ml-0.5" /></span>
          </button>
        </div>
        </Reveal>

        {/* Your Summary */}
        <div>
          <div className="flex items-center justify-between mb-2 px-0.5">
            <h3 className="font-semibold text-[#1A1A2E] dark:text-white">{t("wallet.yourSummary")}</h3>
            <span className="text-xs text-[#9CA3AF]">{t("wallet.thisMonth")}</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { id: "spent", labelKey: "wallet.totalSpent", value: `₹${monthlySummary.spent.value}`, pct: monthlySummary.spent.pct, icon: WalletIcon, color: "#138808", bg: "#E8F5E8" },
              { id: "rides", labelKey: "wallet.ridesTaken", value: String(monthlySummary.rides.value), pct: monthlySummary.rides.pct, icon: Car, color: "#FF6B00", bg: "#FFF5EB" },
              { id: "saved", labelKey: "wallet.youSaved", value: `₹${monthlySummary.saved.value}`, pct: monthlySummary.saved.pct, icon: PiggyBank, color: "#0EA5E9", bg: "#E0F2FE" },
              { id: "cashback", labelKey: "wallet.cashbackEarned", value: `₹${monthlySummary.cashback.value}`, pct: monthlySummary.cashback.pct, icon: Gift, color: "#A855F7", bg: "#F3E8FF" },
            ].map((stat) => (
              <div key={stat.id} className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm border border-gray-100 dark:border-white/[0.06] p-3.5">
                <div className="w-9 h-9 rounded-full flex items-center justify-center mb-2" style={{ backgroundColor: stat.bg }}>
                  <stat.icon className="w-4 h-4" style={{ color: stat.color }} />
                </div>
                <p className="text-xs text-[#6B7280] dark:text-white/50">{t(stat.labelKey)}</p>
                <p className="font-bold text-lg text-[#1A1A2E] dark:text-white">{stat.value}</p>
                <span className={`text-[10px] font-medium ${stat.pct >= 0 ? "text-[#138808]" : "text-[#DC2626]"}`}>
                  {stat.pct >= 0 ? "↑" : "↓"} {Math.abs(stat.pct)}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Upgrade to Flying Plus */}
        <button
          onClick={() => navigate("/user/subscription")}
          className="w-full relative overflow-hidden flex items-center gap-3 bg-gradient-to-r from-[#1A1A2E] to-[#2D2A4A] dark:from-[#12121C] dark:to-[#1E1B33] rounded-2xl p-4 text-left border border-white/[0.06]"
        >
          <Sparkles className="absolute right-3 top-2 w-4 h-4 text-[#FFD700]/40" />
          <Sparkles className="absolute right-10 bottom-3 w-3 h-3 text-[#FFD700]/30" />
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#FFD700] to-[#FF6B00] flex items-center justify-center flex-shrink-0">
            <Crown className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm text-white">{t("profile.upgradeToPrefix")} <span className="text-[#FFD700]">Flying Plus</span></p>
            <p className="text-[11px] text-white/60 leading-snug">{t("wallet.flyingPlusDesc")}</p>
          </div>
          <span className="flex items-center gap-1 text-xs font-semibold text-white bg-[#FF6B00] px-3 py-2 rounded-full flex-shrink-0">
            {t("profile.explore")} <ChevronRight className="w-3.5 h-3.5" />
          </span>
        </button>

        {/* Payment Methods */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm border border-gray-100 dark:border-white/[0.06] p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-[#1A1A2E] dark:text-white">{t("wallet.paymentMethods")}</h3>
            <button onClick={openManagePayments} className="text-xs text-[#FF6B00] font-medium">{t("wallet.manage")}</button>
          </div>
          <div className="space-y-2">
            {PAYMENT_METHOD_META.map((pm) => (
              <button
                key={pm.id}
                onClick={openManagePayments}
                className="w-full flex items-center gap-3 bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl p-3 text-left"
              >
                <div className="w-10 h-10 rounded-full bg-[#E8EEF5] dark:bg-[#1E3A5F]/40 flex items-center justify-center flex-shrink-0">
                  <pm.icon className="w-5 h-5 text-[#1E3A5F] dark:text-[#93C5FD]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#1A1A2E] dark:text-white">{pm.label}</p>
                  <p className="text-xs text-[#6B7280] dark:text-white/50 truncate">
                    {pm.id === "upi"
                      ? paymentDetails.upi || t("wallet.tapAddUpi")
                      : paymentDetails.cardLast4
                        ? `**** **** **** ${paymentDetails.cardLast4}`
                        : t("wallet.tapAddCard")}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-[#9CA3AF] flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm border border-gray-100 dark:border-white/[0.06] p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-[#1A1A2E] dark:text-white">{t("wallet.recentTransactions")}</h3>
            {(transactions ?? []).length > 3 && (
              <button onClick={() => setShowAllTransactions((v) => !v)} className="text-xs text-[#FF6B00] font-medium">
                {showAllTransactions ? t("wallet.showLess") : t("viewAll")}
              </button>
            )}
          </div>
          {(transactions ?? []).length === 0 ? (
            <p className="text-sm text-[#9CA3AF]">{t("wallet.noTransactions")}</p>
          ) : (
            <div className="space-y-1">
              {visibleTransactions.map((txn) => {
                const config = typeConfig[txn.type as TransactionType] ?? typeConfig.adjustment;
                const amount = Number(txn.amount);
                return (
                  <div key={txn.id} className="flex items-center gap-3 py-2.5 border-b border-gray-50 dark:border-white/[0.06] last:border-0">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: config.bg }}
                    >
                      <config.icon className="w-4 h-4" style={{ color: config.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#1A1A2E] dark:text-white truncate">{txn.description}</p>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-2.5 h-2.5 text-[#9CA3AF]" />
                        <p className="text-xs text-[#9CA3AF]">{formatDate(txn.createdAt.getTime())}</p>
                      </div>
                    </div>
                    <span className={`text-sm font-semibold ${amount > 0 ? "text-[#138808]" : "text-[#DC2626]"}`}>
                      {amount > 0 ? "+" : "-"}₹{Math.abs(amount)}
                    </span>
                  </div>
                );
              })}
              {!showAllTransactions && (transactions ?? []).length <= 3 && (
                <p className="text-center text-[11px] text-[#9CA3AF] pt-1">{t("wallet.noMoreTransactions")}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add Money Sheet */}
      {showAddMoney && (
        <div
          className="fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center justify-center"
          onClick={() => setShowAddMoney(false)}
        >
          <div
            className="bg-white dark:bg-[#1E293B] rounded-t-3xl sm:rounded-3xl sm:my-8 w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1 bg-gray-200 dark:bg-gray-600 rounded-full mx-auto mb-4 sm:hidden" />
            <h2 className="font-bold text-lg text-[#1A1A2E] dark:text-[#E5E7EB] mb-1">{t("wallet.addMoney")}</h2>
            <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] mb-4">{t("wallet.topUp")}</p>
            <div className="relative mb-3">
              <IndianRupee className="w-5 h-5 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="number"
                value={addAmount}
                onChange={(e) => setAddAmount(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-[#E5E7EB] dark:border-gray-700 bg-transparent focus:border-[#FF6B00] outline-none text-lg font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]"
              />
            </div>
            <div className="flex gap-2 mb-4">
              {quickAmounts.map((amt) => (
                <button
                  key={amt}
                  onClick={() => setAddAmount(String(amt))}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
                    addAmount === String(amt) ? "bg-[#FF6B00] text-white" : "bg-gray-100 dark:bg-gray-700 text-[#6B7280] dark:text-[#9CA3AF]"
                  }`}
                >
                  ₹{amt}
                </button>
              ))}
            </div>
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setRechargeMethod("upi")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                  rechargeMethod === "upi" ? "bg-[#1A1A2E] dark:bg-[#334155] text-white" : "bg-gray-100 dark:bg-gray-700 text-[#6B7280] dark:text-[#9CA3AF]"
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" /> UPI
              </button>
              <button
                onClick={() => setRechargeMethod("card")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                  rechargeMethod === "card" ? "bg-[#1A1A2E] dark:bg-[#334155] text-white" : "bg-gray-100 dark:bg-gray-700 text-[#6B7280] dark:text-[#9CA3AF]"
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" /> Card
              </button>
            </div>
            {razorpayError && (
              <p className="text-xs text-[#DC2626] mb-3">{razorpayError}</p>
            )}
            <button
              onClick={handleAddMoney}
              disabled={
                !addAmount ||
                Number(addAmount) <= 0 ||
                !customerName ||
                createOrderMutation.isPending ||
                verifyPaymentMutation.isPending ||
                rechargeMutation.isPending ||
                checkoutOpen
              }
              className="w-full btn-saffron py-3.5 disabled:opacity-50"
            >
              {checkoutOpen || createOrderMutation.isPending ? t("wallet.openingRazorpay") : verifyPaymentMutation.isPending || rechargeMutation.isPending ? t("wallet.confirmingPayment") : `${t("add")} ₹${addAmount || 0}`}
            </button>
          </div>
        </div>
      )}

      {/* Manage Payment Methods Sheet */}
      {showManagePayments && (
        <div
          className="fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center justify-center"
          onClick={() => setShowManagePayments(false)}
        >
          <div
            className="bg-white dark:bg-[#1E293B] rounded-t-3xl sm:rounded-3xl sm:my-8 w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1 bg-gray-200 dark:bg-gray-600 rounded-full mx-auto mb-4 sm:hidden" />
            <h2 className="font-bold text-lg text-[#1A1A2E] dark:text-[#E5E7EB] mb-1">{t("wallet.managePaymentMethods")}</h2>
            <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] mb-4">{t("wallet.updateSaved")}</p>

            <label className="text-xs font-medium text-[#6B7280] dark:text-[#9CA3AF] mb-1.5 block">{t("wallet.upiId")}</label>
            <div className="relative mb-4">
              <Smartphone className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={editUpi}
                onChange={(e) => setEditUpi(e.target.value)}
                placeholder="yourname@bank"
                className="w-full pl-9 pr-4 py-3 rounded-xl border-2 border-[#E5E7EB] dark:border-gray-700 bg-transparent focus:border-[#FF6B00] outline-none text-sm text-[#1A1A2E] dark:text-[#E5E7EB]"
              />
            </div>

            <label className="text-xs font-medium text-[#6B7280] dark:text-[#9CA3AF] mb-1.5 block">{t("wallet.cardLast4")}</label>
            <div className="relative mb-6">
              <CreditCard className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                inputMode="numeric"
                maxLength={4}
                value={editCardLast4}
                onChange={(e) => setEditCardLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="4521"
                className="w-full pl-9 pr-4 py-3 rounded-xl border-2 border-[#E5E7EB] dark:border-gray-700 bg-transparent focus:border-[#FF6B00] outline-none text-sm text-[#1A1A2E] dark:text-[#E5E7EB]"
              />
            </div>

            <button onClick={handleSavePaymentDetails} className="w-full btn-saffron py-3.5">
              {t("fare.saveChanges")}
            </button>
          </div>
        </div>
      )}

      <BottomNav role="user" />
    </div>
  );
}
