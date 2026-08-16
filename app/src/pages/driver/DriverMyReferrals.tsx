import { ArrowLeft, Users, Gift } from "lucide-react";
import { useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";

export default function DriverMyReferrals() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user } = useAuth();

  const { data: mine } = trpc.referral.myCode.useQuery(undefined, { enabled: !!user });

  const history = mine?.history ?? [];
  const completedCount = history.filter((r) => r.status === "completed").length;
  const totalEarned = mine?.stats.totalEarned ?? 0;

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0F172A] pb-10">
      {/* Header */}
      <div className="bg-white dark:bg-[#1E293B] px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full">
          <ArrowLeft className="w-5 h-5 text-[#1A1A2E] dark:text-[#E5E7EB]" />
        </button>
        <h1 className="font-bold text-lg text-[#1A1A2E] dark:text-[#E5E7EB]">{t("refer.myReferrals")}</h1>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl p-4 text-center shadow-sm">
            <Users className="w-5 h-5 text-[#0EA5E9] mx-auto mb-1" />
            <p className="font-bold text-lg text-[#1A1A2E] dark:text-[#E5E7EB]">{history.length}</p>
            <p className="text-[11px] text-[#6B7280] dark:text-[#9CA3AF]">{t("refer.invited")}</p>
          </div>
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl p-4 text-center shadow-sm">
            <Gift className="w-5 h-5 text-[#138808] mx-auto mb-1" />
            <p className="font-bold text-lg text-[#1A1A2E] dark:text-[#E5E7EB]">{completedCount}</p>
            <p className="text-[11px] text-[#6B7280] dark:text-[#9CA3AF]">{t("status.completed")}</p>
          </div>
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl p-4 text-center shadow-sm">
            <span className="block text-[#FF6B00] font-bold text-lg mb-1">₹</span>
            <p className="font-bold text-lg text-[#1A1A2E] dark:text-[#E5E7EB]">{totalEarned}</p>
            <p className="text-[11px] text-[#6B7280] dark:text-[#9CA3AF]">{t("refer.earned")}</p>
          </div>
        </div>

        {/* Referral list */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4">
          <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] mb-3">{t("refer.referralHistory")}</h3>
          <div className="space-y-1">
            {history.length === 0 && (
              <p className="text-sm text-[#9CA3AF] dark:text-[#64748B] text-center py-6">
                {t("refer.noReferralsYet")}
              </p>
            )}
            {history
              .slice()
              .sort((a, b) => b.createdAt - a.createdAt)
              .map((r) => (
                <div key={r.id} className="flex items-center gap-3 py-3 border-b border-gray-50 dark:border-gray-700 last:border-0">
                  <div className="w-10 h-10 rounded-full bg-[#F8F9FA] dark:bg-[#0F172A] flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-[#6B7280] dark:text-[#9CA3AF]">
                      {r.refereeName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB] truncate">{r.refereeName}</p>
                    <p className="text-xs text-[#9CA3AF]">
                      {r.refereeRole === "driver" ? t("dreferral.captain") : t("refer.rider")} ·{" "}
                      {new Date(r.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-lg text-[10px] font-medium mb-1 ${
                        r.status === "completed"
                          ? "bg-[#E8F5E8] dark:bg-[#1A3A22] text-[#138808]"
                          : "bg-[#FFF5EB] dark:bg-[#3D2914] text-[#FF6B00]"
                      }`}
                    >
                      {r.status === "completed" ? t("refer.joined") : t("refer.pendingFirstRide")}
                    </span>
                    <p className={`text-sm font-semibold ${r.status === "completed" ? "text-[#138808]" : "text-[#9CA3AF]"}`}>
                      {r.status === "completed" ? `+₹${r.referrerBonus}` : "—"}
                    </p>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
