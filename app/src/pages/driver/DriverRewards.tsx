import { useNavigate } from "react-router";
import { ArrowLeft, Award, Fuel, TrendingDown, IndianRupee, Lock, Check, Trophy, Star } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { trpc } from "@/providers/trpc";
import { useLanguage } from "@/contexts/LanguageContext";

interface Tier {
  nameKey: string;
  minRides: number;
  color: string;
  bg: string;
  perkKeys: string[];
}

const tiers: Tier[] = [
  { nameKey: "rewards.bronzeDriver", minRides: 0, color: "#B45309", bg: "#FEF3E2", perkKeys: ["rewards.perkStandardMatching"] },
  { nameKey: "rewards.silverDriver", minRides: 100, color: "#6B7280", bg: "#F3F4F6", perkKeys: ["rewards.perkPrioritySupport", "rewards.perkCommission1"] },
  { nameKey: "driver.goldDriver", minRides: 500, color: "#CA8A04", bg: "#FEF9C3", perkKeys: ["rewards.perkPriorityAllocation", "rewards.perkCommission2", "rewards.perkFuelVoucher200"] },
  { nameKey: "rewards.platinumDriver", minRides: 1000, color: "#0EA5E9", bg: "#E0F2FE", perkKeys: ["rewards.perkTopPriorityMatching", "rewards.perkCommission3", "rewards.perkFuelVoucher500"] },
  { nameKey: "rewards.eliteCaptain", minRides: 5000, color: "#7C3AED", bg: "#F3E8FF", perkKeys: ["rewards.perkHighestPriorityMatching", "rewards.perkCommission5", "rewards.perkDedicatedSupport", "rewards.perkAnnualBonus"] },
];

function getCurrentTier(rides: number): Tier {
  return [...tiers].reverse().find((t) => rides >= t.minRides) ?? tiers[0];
}

function getNextTier(rides: number): Tier | null {
  return tiers.find((t) => rides < t.minRides) ?? null;
}

const milestones = [
  { rides: 100, rewardKey: "rewards.milestone100" },
  { rides: 500, rewardKey: "rewards.milestone500" },
  { rides: 1000, rewardKey: "rewards.milestone1000" },
  { rides: 5000, rewardKey: "rewards.milestone5000" },
];

// Other drivers on the monthly leaderboard — no cross-driver ride-count
// aggregate exists in the backend yet, so these remain illustrative;
// only "You" reflects this driver's real lifetime ride count below.
const otherDrivers = [
  { name: "Sohail Khan", rides: 1240 },
  { name: "Pooja Das", rides: 980 },
  { name: "Anjali Sharma", rides: 540 },
  { name: "Vikash Singh", rides: 410 },
];

export default function DriverRewards() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { data: dashboard } = trpc.driver.getDashboard.useQuery();
  const completedRides = dashboard?.totalRides ?? 0;
  const currentTier = getCurrentTier(completedRides);
  const nextTier = getNextTier(completedRides);
  const progress = nextTier
    ? ((completedRides - currentTier.minRides) / (nextTier.minRides - currentTier.minRides)) * 100
    : 100;

  const achievementBadges = [
    { labelKey: "driver.goldDriver", icon: Award, unlocked: completedRides >= 500, color: "#CA8A04", bg: "#FEF9C3" },
    { labelKey: "rewards.silverDriver", icon: Award, unlocked: completedRides >= 100, color: "#6B7280", bg: "#F3F4F6" },
    { labelKey: "rewards.trips1000", icon: Trophy, unlocked: completedRides >= 1000, color: "#0EA5E9", bg: "#E0F2FE" },
    { labelKey: "rewards.topRated", icon: Star, unlocked: Number(dashboard?.rating ?? 5) >= 4.5, color: "#FF6B00", bg: "#FFF5EB" },
  ];

  const leaderboard = [
    ...otherDrivers.map((d) => ({ ...d, isYou: false })),
    { name: "You", rides: completedRides, isYou: true },
  ]
    .sort((a, b) => b.rides - a.rides)
    .map((entry, i) => ({ ...entry, rank: i + 1 }));

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0F172A] pb-28">
      {/* Header */}
      <div className="bg-gradient-to-b from-[#7C3AED] to-[#9333EA] px-4 pt-4 pb-8">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => navigate("/driver/dashboard")}>
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
          <h1 className="text-white font-semibold">{t("driver.rewards")}</h1>
          <div className="w-6" />
        </div>

        <div className="flex flex-col items-center text-center">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center mb-3 border-4 border-white/30"
            style={{ backgroundColor: currentTier.bg }}
          >
            <Award className="w-9 h-9" style={{ color: currentTier.color }} />
          </div>
          <h2 className="text-white font-bold text-xl">{t(currentTier.nameKey)}</h2>
          <p className="text-white/80 text-sm">{completedRides} {t("rewards.ridesCompleted")}</p>
        </div>

        {nextTier && (
          <div className="mt-5">
            <div className="flex items-center justify-between text-xs text-white/80 mb-1.5">
              <span>{completedRides} {t("rewards.rides")}</span>
              <span>{nextTier.minRides} {t("rewards.ridesFor")} {t(nextTier.nameKey)}</span>
            </div>
            <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-white rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-white/80 text-xs mt-1.5 text-center">
              {nextTier.minRides - completedRides} {t("rewards.moreRidesToReach")} {t(nextTier.nameKey)}
            </p>
          </div>
        )}
      </div>

      <div className="px-4 -mt-4 space-y-4">
        {/* Achievements */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4">
          <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] mb-3">{t("rewards.achievements")}</h3>
          <div className="grid grid-cols-4 gap-2">
            {achievementBadges.map((badge) => (
              <div key={badge.labelKey} className="flex flex-col items-center gap-1.5">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: badge.unlocked ? badge.bg : "#F3F4F6" }}
                >
                  {badge.unlocked ? (
                    <badge.icon className="w-5 h-5" style={{ color: badge.color }} />
                  ) : (
                    <Lock className="w-4 h-4 text-[#9CA3AF]" />
                  )}
                </div>
                <span className={`text-[10px] text-center font-medium ${badge.unlocked ? "text-[#1A1A2E] dark:text-[#E5E7EB]" : "text-[#9CA3AF] dark:text-[#64748B]"}`}>
                  {t(badge.labelKey)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Current Perks */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4">
          <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] mb-3">{t("rewards.yourPerks")}</h3>
          <div className="space-y-2">
            {currentTier.perkKeys.map((perkKey) => (
              <div key={perkKey} className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-[#E8F5E8] dark:bg-[#1A3A22] flex items-center justify-center flex-shrink-0">
                  <Check className="w-3 h-3 text-[#138808]" />
                </div>
                <span className="text-sm text-[#1A1A2E] dark:text-[#E5E7EB]">{t(perkKey)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Tier Ladder */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4">
          <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] mb-3">{t("rewards.tierLadder")}</h3>
          <div className="space-y-3">
            {tiers.map((tier) => {
              const unlocked = completedRides >= tier.minRides;
              const isCurrent = tier.nameKey === currentTier.nameKey;
              return (
                <div
                  key={tier.nameKey}
                  className={`flex items-center gap-3 p-3 rounded-xl ${isCurrent ? "bg-[#F3E8FF] dark:bg-[#2D1B4E]" : "bg-[#F8F9FA] dark:bg-[#0F172A]"}`}
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: unlocked ? tier.bg : "#F3F4F6" }}
                  >
                    {unlocked ? (
                      <Award className="w-5 h-5" style={{ color: tier.color }} />
                    ) : (
                      <Lock className="w-4 h-4 text-[#9CA3AF]" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${unlocked ? "text-[#1A1A2E] dark:text-[#E5E7EB]" : "text-[#9CA3AF] dark:text-[#64748B]"}`}>
                      {t(tier.nameKey)}
                    </p>
                    <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">{tier.minRides}+ {t("rewards.rides")}</p>
                  </div>
                  {isCurrent && (
                    <span className="text-[10px] font-semibold text-[#7C3AED] bg-white dark:bg-[#1E293B] px-2 py-1 rounded-full">
                      {t("rewards.current")}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Milestones */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4">
          <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] mb-3">{t("rewards.rideMilestones")}</h3>
          <div className="space-y-2">
            {milestones.map((m) => {
              const achieved = completedRides >= m.rides;
              return (
                <div key={m.rides} className="flex items-center gap-3 py-2 border-b border-gray-50 dark:border-gray-700 last:border-0">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      achieved ? "bg-[#E8F5E8] dark:bg-[#1A3A22]" : "bg-gray-100 dark:bg-gray-800"
                    }`}
                  >
                    {achieved ? (
                      <Check className="w-4 h-4 text-[#138808]" />
                    ) : (
                      <span className="text-[10px] font-bold text-[#9CA3AF] dark:text-[#64748B]">{m.rides}</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">{m.rides} {t("rewards.rides")}</p>
                    <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">{t(m.rewardKey)}</p>
                  </div>
                  {achieved && <IndianRupee className="w-4 h-4 text-[#138808]" />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Leaderboard */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="w-4 h-4 text-[#CA8A04]" />
            <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">{t("rewards.topDriversThisMonth")}</h3>
          </div>
          <div className="space-y-1">
            {leaderboard.map((entry) => (
              <div
                key={entry.rank}
                className={`flex items-center gap-3 py-2 px-2 rounded-lg ${entry.isYou ? "bg-[#FFF5EB] dark:bg-[#3A2A1A]" : ""}`}
              >
                <span
                  className={`w-6 text-sm font-bold text-center ${
                    entry.rank === 1 ? "text-[#CA8A04]" : entry.rank === 2 ? "text-[#6B7280] dark:text-[#9CA3AF]" : entry.rank === 3 ? "text-[#B45309]" : "text-[#9CA3AF] dark:text-[#64748B]"
                  }`}
                >
                  {entry.rank}
                </span>
                <span className={`flex-1 text-sm ${entry.isYou ? "font-semibold text-[#FF6B00]" : "text-[#1A1A2E] dark:text-[#E5E7EB]"}`}>
                  {entry.name}
                </span>
                <span className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">{entry.rides} rides</span>
              </div>
            ))}
          </div>
        </div>

        {/* Fuel & Commission note */}
        <div className="bg-[#E8F5E8] dark:bg-[#1A3A22] rounded-2xl p-4 flex items-start gap-3">
          <Fuel className="w-5 h-5 text-[#138808] flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-[#138808] dark:text-[#86EFAC]">{t("rewards.keepClimbing")}</p>
            <p className="text-xs text-[#138808]/80 dark:text-[#86EFAC]/80 mt-0.5 flex items-center gap-1">
              {t("rewards.higherTiersUnlock")} <TrendingDown className="w-3 h-3" /> {t("rewards.lowerCommissionAuto")}
            </p>
          </div>
        </div>
      </div>

      <BottomNav role="driver" />
    </div>
  );
}
