import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import {
  ArrowLeft,
  Copy,
  Check,
  Tag,
  Car,
  Users,
  Wallet,
  Gift,
  UserPlus,
  Share2,
  MessageCircle,
  Facebook,
  Instagram,
  MoreHorizontal,
  QrCode,
  History,
} from "lucide-react";
import QRCode from "qrcode";
import BottomNav from "@/components/BottomNav";
import { trpc } from "@/providers/trpc";
import { useNotifications } from "@/contexts/NotificationsContext";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";

export default function DriverReferral() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user } = useAuth();
  const { pushSystemNotification } = useNotifications();
  const [copied, setCopied] = useState(false);
  const [friendCode, setFriendCode] = useState("");
  const [applyResult, setApplyResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const utils = trpc.useUtils();
  const { data: mine } = trpc.referral.myCode.useQuery(undefined, {
    enabled: !!user,
    refetchInterval: 10000,
    refetchIntervalInBackground: true,
  });

  // Referrer bonuses often land later (after the referee's first ride) —
  // this device detects the pending→completed transition on its own poll,
  // same pattern DriverWallet.tsx uses for withdrawal status changes.
  const knownReferralStatuses = useRef<Map<string, string>>(new Map());
  useEffect(() => {
    if (!mine) return;
    for (const record of mine.history) {
      const previous = knownReferralStatuses.current.get(record.id);
      if (previous === "pending" && record.status === "completed") {
        pushSystemNotification({
          audience: "driver",
          title: "Referral bonus earned!",
          message: `₹${record.referrerBonus} credited to your wallet — ${record.refereeName} completed their first ride.`,
        });
      }
      knownReferralStatuses.current.set(record.id, record.status);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mine]);

  const { data: config } = trpc.referral.getConfig.useQuery();
  const applyMutation = trpc.referral.applyCode.useMutation({
    onSuccess: (result) => {
      setApplyResult(result.ok ? { ok: true, text: result.message } : { ok: false, text: result.error });
      if (result.ok) {
        setFriendCode("");
        utils.referral.myCode.invalidate();
        utils.settlement.getWallet.invalidate();
      }
    },
  });
  const recordShareMutation = trpc.referral.recordShare.useMutation({
    onSuccess: () => utils.referral.myCode.invalidate(),
  });

  const referralCode = mine?.code ?? "········";
  // A driver's code pays out differently depending on whether the friend who
  // redeems it ends up a driver or a rider — shown as two explicit rates
  // rather than picking one, since the code itself doesn't ask which.
  const driverToDriver = config?.driverToDriver ?? { referrerBonus: 200, refereeBonus: 100 };
  const driverToRider = config?.driverToRider ?? { referrerBonus: 50, refereeBonus: 20 };
  const referralLink = mine?.code ? `${window.location.origin}/register?ref=${mine.code}` : "";
  const shareMessage = mine?.code
    ? `Join Ridepay with my referral code ${mine.code} and get a welcome bonus! 🚖\n${referralLink}`
    : "";
  const completedRides = mine?.history.filter((r) => r.status === "completed").length ?? 0;

  useEffect(() => {
    if (!mine?.code) {
      setQrDataUrl(null);
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(`${window.location.origin}/register?ref=${mine.code}`, { width: 160, margin: 1 })
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch((error) => console.error("Error generating referral QR code:", error));
    return () => {
      cancelled = true;
    };
  }, [mine?.code]);

  const showToast = (text: string) => {
    setToast(text);
    window.clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToast(null), 2500);
  };

  const handleCopy = () => {
    if (!mine?.code) return;
    navigator.clipboard.writeText(mine.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const bumpShareCount = () => {
    if (mine?.code) recordShareMutation.mutate();
  };

  const handleShareWhatsApp = () => {
    if (!shareMessage) return;
    bumpShareCount();
    window.open(`https://wa.me/?text=${encodeURIComponent(shareMessage)}`, "_blank", "noopener,noreferrer");
  };

  const handleShareFacebook = () => {
    if (!referralLink) return;
    bumpShareCount();
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralLink)}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  const handleShareInstagram = async () => {
    if (!shareMessage) return;
    bumpShareCount();
    try {
      await navigator.clipboard.writeText(shareMessage);
      showToast(t("refer.copiedForInstagram"));
    } catch {
      showToast(t("refer.couldntCopy"));
    }
  };

  const handleShareMore = () => {
    if (!shareMessage) return;
    bumpShareCount();
    if (navigator.share) {
      navigator.share({ title: "Ridepay Refer & Earn", text: shareMessage }).catch((error) => {
        if (error?.name !== "AbortError") {
          window.open(`https://wa.me/?text=${encodeURIComponent(shareMessage)}`, "_blank", "noopener,noreferrer");
        }
      });
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(shareMessage)}`, "_blank", "noopener,noreferrer");
    }
  };

  const handleApplyFriendCode = () => {
    const code = friendCode.trim().toUpperCase();
    if (!code) return;
    setApplyResult(null);
    applyMutation.mutate({ code });
  };

  const shareChannels = [
    { key: "whatsapp", label: "WhatsApp", icon: MessageCircle, bg: "bg-[#25D366]", onClick: handleShareWhatsApp },
    { key: "facebook", label: "Facebook", icon: Facebook, bg: "bg-[#1877F2]", onClick: handleShareFacebook },
    {
      key: "instagram",
      label: "Instagram",
      icon: Instagram,
      bg: "bg-gradient-to-br from-[#F58529] via-[#DD2A7B] to-[#8134AF]",
      onClick: handleShareInstagram,
    },
    { key: "more", label: t("refer.more"), icon: MoreHorizontal, bg: "bg-[#6B7280]", onClick: handleShareMore },
  ];

  const featureHighlights = [
    { icon: Car, text: t("dreferral.moreCaptainsMoreRewards") },
    { icon: Wallet, text: t("refer.instantCreditsForFriend") },
    { icon: Gift, text: t("refer.cashbackForYou") },
  ];

  const howItWorks = [
    { icon: Share2, text: t("refer.shareCodeWithFriends") },
    { icon: UserPlus, text: t("refer.friendSignsUp") },
    { icon: Wallet, text: t("dreferral.friendGetsWelcomeBonus") },
    { icon: Gift, text: t("dreferral.earnOnFirstRide") },
  ];

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0F172A] pb-24">
      {/* Header */}
      <div className="bg-white dark:bg-[#1E293B] px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/driver/dashboard")} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full">
            <ArrowLeft className="w-5 h-5 text-[#1A1A2E] dark:text-[#E5E7EB]" />
          </button>
          <h1 className="font-bold text-lg text-[#1A1A2E] dark:text-[#E5E7EB]">{t("refer.title")}</h1>
        </div>
        <button
          onClick={() => navigate("/driver/my-referrals")}
          className="flex items-center gap-1.5 bg-[#FFF5EB] dark:bg-[#3A2A1A] text-[#FF6B00] text-xs font-semibold px-3 py-2 rounded-full hover:bg-[#FFE8CC] dark:hover:bg-[#4A3320] transition-colors"
        >
          <History className="w-3.5 h-3.5" />
          {t("refer.myReferrals")}
        </button>
      </div>

      {/* Hero */}
      <div className="px-6 pt-8 pb-6 text-center bg-gradient-to-b from-white to-[#F8F9FA] dark:from-[#1E293B] dark:to-[#0F172A]">
        <img src="/assets/refer-illustration.png" alt="Refer" className="w-36 h-36 object-contain mx-auto mb-4" />
        <h2 className="text-3xl font-extrabold leading-tight tracking-tight">
          <span className="text-[#138808]">{t("dreferral.referCaptains")}</span>
          <br />
          <span className="text-[#FF6B00]">{t("refer.earnRewards")}</span>
        </h2>
        <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] mt-2 max-w-xs mx-auto">
          {t("dreferral.inviteSubtitle")}
        </p>

        <div className="grid grid-cols-3 gap-2 mt-6">
          {featureHighlights.map((f, i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <div className="w-11 h-11 rounded-full bg-white dark:bg-[#1E293B] shadow-sm flex items-center justify-center">
                <f.icon className="w-5 h-5 text-[#138808]" />
              </div>
              <p className="text-[11px] leading-tight text-[#6B7280] dark:text-[#9CA3AF]">{f.text}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 space-y-4">
        {/* Reward Rates — a driver's code pays out at one of two rates
            depending on whether the friend joins as a captain or a rider. */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4">
          <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] mb-3 text-sm">{t("dreferral.rewardRates")}</h3>
          <div className="space-y-2">
            <div className="flex items-center gap-3 bg-[#E8F5E8] dark:bg-[#1A3A22] rounded-xl p-3">
              <div className="w-9 h-9 rounded-full bg-white dark:bg-[#0F172A] flex items-center justify-center flex-shrink-0">
                <Car className="w-4 h-4 text-[#138808]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">{t("dreferral.referACaptain")}</p>
                <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                  {t("refer.youGet")} ₹{driverToDriver.referrerBonus} · {t("dreferral.theyGet")} ₹{driverToDriver.refereeBonus}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-[#FFF5EB] dark:bg-[#3A2A1A] rounded-xl p-3">
              <div className="w-9 h-9 rounded-full bg-white dark:bg-[#0F172A] flex items-center justify-center flex-shrink-0">
                <Users className="w-4 h-4 text-[#FF6B00]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">{t("dreferral.referARider")}</p>
                <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                  {t("refer.youGet")} ₹{driverToRider.referrerBonus} · {t("dreferral.theyGet")} ₹{driverToRider.refereeBonus}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Referral Code + QR */}
        <div className="bg-gradient-to-br from-[#0F5132] to-[#083D26] dark:from-[#0B3D22] dark:to-[#062814] rounded-2xl shadow-sm p-5">
          <p className="text-xs text-white/70 text-center mb-3">{t("refer.yourReferralCode")}</p>
          <div className="flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 bg-white/10 rounded-xl px-3 py-3">
                <span className="flex-1 text-center text-lg font-bold tracking-widest font-mono text-white">
                  {referralCode}
                </span>
                <button
                  onClick={handleCopy}
                  className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0 hover:bg-white/25 transition-colors"
                  aria-label="Copy referral code"
                >
                  {copied ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4 text-white" />}
                </button>
              </div>
              {copied && <p className="text-xs text-white/80 text-center mt-2">{t("refer.copiedToClipboard")}</p>}
            </div>
            <div className="flex flex-col items-center gap-1 flex-shrink-0">
              <div className="w-[76px] h-[76px] bg-white rounded-xl p-1.5 flex items-center justify-center">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="Referral QR code" className="w-full h-full" />
                ) : (
                  <QrCode className="w-8 h-8 text-[#0F5132]" />
                )}
              </div>
              <p className="text-[9px] text-white/70 text-center w-[76px] leading-tight">{t("refer.scanToShare")}</p>
            </div>
          </div>
        </div>

        {/* Share row */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4">
          <p className="text-sm font-semibold text-center text-[#1A1A2E] dark:text-[#E5E7EB] mb-3">{t("refer.shareCodeVia")}</p>
          <div className="grid grid-cols-4 gap-3">
            {shareChannels.map((c) => (
              <button
                key={c.key}
                onClick={c.onClick}
                disabled={!mine?.code}
                className="flex flex-col items-center gap-1.5 disabled:opacity-40"
              >
                <div className={`w-12 h-12 rounded-full ${c.bg} flex items-center justify-center text-white shadow-sm`}>
                  <c.icon className="w-5 h-5" />
                </div>
                <span className="text-[11px] text-[#6B7280] dark:text-[#9CA3AF]">{c.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Have a friend's code? One code per account, ever — once used, the
            whole option disappears (kept visible right after a successful
            apply so the confirmation message can be read). Lets an existing
            captain redeem another captain's code post-registration, since
            the onboarding wizard itself has no referral-code step. */}
        {(!mine?.hasUsedReferral || applyResult?.ok) && (
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4 border-2 border-dashed border-[#FF6B00]/30">
            <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] mb-3 flex items-center gap-2">
              <Tag className="w-4 h-4 text-[#FF6B00]" />
              {t("refer.haveFriendsCode")}
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={friendCode}
                onChange={(e) => {
                  setFriendCode(e.target.value.toUpperCase());
                  setApplyResult(null);
                }}
                placeholder={t("refer.enterReferralCode")}
                className="flex-1 bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-4 py-3 text-sm outline-none text-[#1A1A2E] dark:text-[#E5E7EB] placeholder:text-[#9CA3AF] font-mono tracking-wider"
              />
              <button
                onClick={handleApplyFriendCode}
                disabled={!friendCode.trim() || applyMutation.isPending}
                className="bg-[#FF6B00] disabled:bg-[#9CA3AF] text-white font-semibold px-5 rounded-xl text-sm hover:bg-[#FF8533] transition-colors"
              >
                {t("apply")}
              </button>
            </div>
            {applyResult && (
              <p className={`text-xs text-center mt-2 font-medium ${applyResult.ok ? "text-[#138808]" : "text-[#DC2626]"}`}>
                {applyResult.text}
              </p>
            )}
          </div>
        )}

        {/* How it works */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4">
          <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] mb-4 text-center">{t("refer.howItWorks")}</h3>
          <div className="grid grid-cols-2 gap-4">
            {howItWorks.map((step, i) => (
              <div key={i} className="flex flex-col items-center text-center gap-2">
                <div className="w-11 h-11 rounded-full bg-[#FFF5EB] dark:bg-[#3A2A1A] flex items-center justify-center flex-shrink-0">
                  <step.icon className="w-5 h-5 text-[#FF6B00]" />
                </div>
                <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] leading-tight">{step.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Stats footer */}
        <div className="bg-gradient-to-br from-[#0F5132] to-[#083D26] dark:from-[#0B3D22] dark:to-[#062814] rounded-2xl shadow-sm p-5">
          <div className="grid grid-cols-4 gap-2 text-center">
            <div>
              <p className="text-lg font-bold text-white">{mine?.shareCount ?? 0}</p>
              <p className="text-[10px] text-white/70 mt-0.5 leading-tight">{t("refer.friendsInvited")}</p>
            </div>
            <div>
              <p className="text-lg font-bold text-white">{mine?.history.length ?? 0}</p>
              <p className="text-[10px] text-white/70 mt-0.5 leading-tight">{t("refer.signedUp")}</p>
            </div>
            <div>
              <p className="text-lg font-bold text-white">{completedRides}</p>
              <p className="text-[10px] text-white/70 mt-0.5 leading-tight">{t("refer.completedRide")}</p>
            </div>
            <div>
              <p className="text-lg font-bold text-white">₹{mine?.stats.totalEarned ?? 0}</p>
              <p className="text-[10px] text-white/70 mt-0.5 leading-tight">{t("refer.rewardsEarned")}</p>
            </div>
          </div>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-[#1A1A2E] dark:bg-[#334155] text-white text-sm font-medium px-4 py-2.5 rounded-full shadow-lg max-w-[90vw] text-center">
          {toast}
        </div>
      )}

      <BottomNav role="driver" />
    </div>
  );
}
