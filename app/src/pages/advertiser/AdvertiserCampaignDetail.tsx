import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Eye, MousePointerClick, Calendar, MapPin, Pause, Play } from "lucide-react";
import { useAdCampaigns } from "@/contexts/AdCampaignsContext";
import { CAMPAIGN_STATUS_CONFIG, AD_ANALYTICS_TREND } from "@/lib/mockAdCampaigns";

export default function AdvertiserCampaignDetail() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { campaigns, setCampaignStatus } = useAdCampaigns();

  const campaign = campaigns.find((c) => c.id === id);

  if (!campaign) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0F172A] flex flex-col items-center justify-center px-6 text-center">
        <p className="text-[#6B7280] dark:text-[#9CA3AF] mb-4">Campaign not found</p>
        <button onClick={() => navigate("/advertiser/dashboard")} className="btn-saffron px-6 py-2.5">
          Back to Dashboard
        </button>
      </div>
    );
  }

  const config = CAMPAIGN_STATUS_CONFIG[campaign.status];
  const budgetPercent = Math.min(100, Math.round((campaign.spent / campaign.budget) * 100));
  const ctr = campaign.impressions > 0 ? ((campaign.clicks / campaign.impressions) * 100).toFixed(2) : "0.00";
  const maxTrend = Math.max(...AD_ANALYTICS_TREND);

  const canToggle = campaign.status === "active" || campaign.status === "paused";

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0F172A] pb-6">
      <div className="bg-white dark:bg-[#1E293B] px-4 py-3 flex items-center gap-3 shadow-sm">
        <button onClick={() => navigate("/advertiser/dashboard")} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full">
          <ArrowLeft className="w-5 h-5 text-[#1A1A2E] dark:text-[#E5E7EB]" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-lg text-[#1A1A2E] dark:text-[#E5E7EB] truncate">{campaign.name}</h1>
          <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">{campaign.adType}</p>
        </div>
        <span
          className="text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0"
          style={{ color: config.color, backgroundColor: config.bg }}
        >
          {config.label}
        </span>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Ad Preview */}
        <div
          className="rounded-2xl p-6 flex flex-col items-center justify-center text-center h-32"
          style={{ backgroundColor: campaign.creativeColor }}
        >
          <p className="text-white font-bold text-lg">{campaign.name}</p>
          <p className="text-white/80 text-xs mt-1">{campaign.advertiserName}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <Eye className="w-4 h-4 text-[#0EA5E9]" />
              <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Impressions</p>
            </div>
            <p className="text-xl font-bold text-[#1A1A2E] dark:text-[#E5E7EB]">{campaign.impressions.toLocaleString("en-IN")}</p>
          </div>
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <MousePointerClick className="w-4 h-4 text-[#138808]" />
              <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Clicks · CTR</p>
            </div>
            <p className="text-xl font-bold text-[#1A1A2E] dark:text-[#E5E7EB]">{campaign.clicks.toLocaleString("en-IN")} <span className="text-xs text-[#6B7280] dark:text-[#9CA3AF] font-normal">({ctr}%)</span></p>
          </div>
        </div>

        {/* Budget */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] text-sm">Budget</h3>
            <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">₹{campaign.spent.toLocaleString("en-IN")} / ₹{campaign.budget.toLocaleString("en-IN")}</p>
          </div>
          <div className="h-2.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full bg-[#FF6B00] rounded-full" style={{ width: `${budgetPercent}%` }} />
          </div>
        </div>

        {/* Trend Chart */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4">
          <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] text-sm mb-3">Impressions Trend</h3>
          <div className="h-28 flex items-end justify-between gap-1.5">
            {AD_ANALYTICS_TREND.map((value, i) => (
              <div
                key={i}
                className="flex-1 bg-[#0EA5E9]/25 rounded-t"
                style={{ height: `${(value / maxTrend) * 100}%` }}
              />
            ))}
          </div>
        </div>

        {/* Details */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4 space-y-3">
          <div className="flex items-center gap-3">
            <MapPin className="w-4 h-4 text-[#6B7280] dark:text-[#9CA3AF] flex-shrink-0" />
            <p className="text-sm text-[#1A1A2E] dark:text-[#E5E7EB]">{campaign.targetArea}</p>
          </div>
          <div className="flex items-center gap-3">
            <Calendar className="w-4 h-4 text-[#6B7280] dark:text-[#9CA3AF] flex-shrink-0" />
            <p className="text-sm text-[#1A1A2E] dark:text-[#E5E7EB]">{campaign.startDate} → {campaign.endDate}</p>
          </div>
        </div>

        {canToggle && (
          <button
            onClick={() => setCampaignStatus(campaign.id, campaign.status === "active" ? "paused" : "active")}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold bg-white dark:bg-[#1E293B] shadow-sm text-[#1A1A2E] dark:text-[#E5E7EB] hover:bg-gray-50 dark:hover:bg-[#28374d] transition-colors"
          >
            {campaign.status === "active" ? (
              <>
                <Pause className="w-4 h-4" /> Pause Campaign
              </>
            ) : (
              <>
                <Play className="w-4 h-4" /> Resume Campaign
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
