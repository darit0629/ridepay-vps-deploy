import { useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Megaphone, Eye, MousePointerClick, IndianRupee, Plus, X, ImageIcon } from "lucide-react";
import { useAdCampaigns } from "@/contexts/AdCampaignsContext";
import { AD_TYPES, CAMPAIGN_STATUS_CONFIG, defaultSlotSeconds, defaultDriverSharePercent, type AdType } from "@/lib/mockAdCampaigns";

const ADVERTISER_NAME = "Sharma Textiles";
const AD_COLORS = ["#FF6B00", "#138808", "#0EA5E9", "#7C3AED", "#DC2626"];

export default function AdvertiserDashboard() {
  const navigate = useNavigate();
  const { campaigns, addCampaign } = useAdCampaigns();
  const [showCreate, setShowCreate] = useState(false);

  const myCampaigns = campaigns.filter((c) => c.advertiserName === ADVERTISER_NAME);
  const activeCount = myCampaigns.filter((c) => c.status === "active").length;
  const totalImpressions = myCampaigns.reduce((sum, c) => sum + c.impressions, 0);
  const totalClicks = myCampaigns.reduce((sum, c) => sum + c.clicks, 0);
  const totalSpent = myCampaigns.reduce((sum, c) => sum + c.spent, 0);

  const [name, setName] = useState("");
  const [adType, setAdType] = useState<AdType>("In-App Banner");
  const [targetArea, setTargetArea] = useState("");
  const [budget, setBudget] = useState("10000");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [vehicleCount, setVehicleCount] = useState("10");
  const [slotSeconds, setSlotSeconds] = useState(String(defaultSlotSeconds["In-App Banner"]));

  const canSubmit = name.trim().length > 2 && targetArea.trim().length > 2 && startDate && endDate;

  const handleAdTypeChange = (type: AdType) => {
    setAdType(type);
    setSlotSeconds(String(defaultSlotSeconds[type]));
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    addCampaign({
      advertiserName: ADVERTISER_NAME,
      name,
      adType,
      targetArea,
      budget: Number(budget),
      startDate,
      endDate,
      vehicleCount: Number(vehicleCount) || 0,
      slotSeconds: Number(slotSeconds) || 0,
      driverSharePercent: defaultDriverSharePercent[adType],
      creativeColor: AD_COLORS[myCampaigns.length % AD_COLORS.length],
    });
    setName("");
    setTargetArea("");
    setBudget("10000");
    setStartDate("");
    setEndDate("");
    setVehicleCount("10");
    setSlotSeconds(String(defaultSlotSeconds["In-App Banner"]));
    setShowCreate(false);
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0F172A] pb-6">
      {/* Header */}
      <div className="bg-[#1E3A5F] px-4 pt-4 pb-6">
        <button onClick={() => navigate("/app")} className="mb-3">
          <ArrowLeft className="w-6 h-6 text-white" />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0">
            <Megaphone className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-white font-bold text-lg">{ADVERTISER_NAME}</h1>
            <p className="text-white/70 text-sm">Advertiser Portal</p>
          </div>
        </div>
      </div>

      <div className="px-4 -mt-2 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <Megaphone className="w-4 h-4 text-[#FF6B00]" />
              <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Active Campaigns</p>
            </div>
            <p className="text-2xl font-bold text-[#1A1A2E] dark:text-[#E5E7EB]">{activeCount}</p>
          </div>
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <Eye className="w-4 h-4 text-[#0EA5E9]" />
              <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Total Impressions</p>
            </div>
            <p className="text-2xl font-bold text-[#1A1A2E] dark:text-[#E5E7EB]">{totalImpressions.toLocaleString("en-IN")}</p>
          </div>
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <MousePointerClick className="w-4 h-4 text-[#138808]" />
              <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Total Clicks</p>
            </div>
            <p className="text-2xl font-bold text-[#1A1A2E] dark:text-[#E5E7EB]">{totalClicks.toLocaleString("en-IN")}</p>
          </div>
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <IndianRupee className="w-4 h-4 text-[#DC2626]" />
              <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Budget Spent</p>
            </div>
            <p className="text-2xl font-bold text-[#1A1A2E] dark:text-[#E5E7EB]">₹{totalSpent.toLocaleString("en-IN")}</p>
          </div>
        </div>

        {/* New Campaign */}
        <button
          onClick={() => setShowCreate(true)}
          className="w-full flex items-center justify-center gap-2 btn-saffron py-3.5"
        >
          <Plus className="w-4 h-4" />
          New Campaign
        </button>

        {/* Campaigns List */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4">
          <h2 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] mb-3">My Campaigns</h2>
          {myCampaigns.length === 0 ? (
            <p className="text-sm text-[#9CA3AF] dark:text-[#64748B] text-center py-6">No campaigns yet</p>
          ) : (
            <div className="space-y-2">
              {myCampaigns.map((campaign) => {
                const config = CAMPAIGN_STATUS_CONFIG[campaign.status];
                return (
                  <div
                    role="button"
                    tabIndex={0}
                    key={campaign.id}
                    onClick={() => navigate(`/advertiser/campaign/${campaign.id}`)}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && navigate(`/advertiser/campaign/${campaign.id}`)}
                    className="flex items-center gap-3 bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl p-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-[#1a2540] transition-colors"
                  >
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${campaign.creativeColor}20` }}
                    >
                      <ImageIcon className="w-5 h-5" style={{ color: campaign.creativeColor }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB] truncate">{campaign.name}</p>
                      <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">{campaign.adType} · {campaign.targetArea}</p>
                    </div>
                    <span
                      className="text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0"
                      style={{ color: config.color, backgroundColor: config.bg }}
                    >
                      {config.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* New Campaign Sheet */}
      {showCreate && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowCreate(false)} />
          <div className="relative bg-white dark:bg-[#1E293B] w-full max-w-md rounded-t-3xl p-5 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg text-[#1A1A2E] dark:text-[#E5E7EB]">New Campaign</h2>
              <button onClick={() => setShowCreate(false)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full">
                <X className="w-5 h-5 text-[#6B7280] dark:text-[#9CA3AF]" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1 block">Campaign Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Diwali Mega Sale"
                  className="w-full text-sm outline-none border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 focus:border-[#FF6B00] bg-white dark:bg-[#0F172A] text-[#1A1A2E] dark:text-[#E5E7EB]"
                />
              </div>

              <div>
                <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1 block">Ad Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {AD_TYPES.map((type) => (
                    <button
                      key={type}
                      onClick={() => handleAdTypeChange(type)}
                      className={`py-2 rounded-lg text-[11px] font-medium transition-colors ${
                        adType === type ? "bg-[#FF6B00] text-white" : "bg-gray-100 dark:bg-gray-800 text-[#6B7280] dark:text-[#9CA3AF]"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1 block">Vehicles</label>
                  <input
                    type="number"
                    min={1}
                    value={vehicleCount}
                    onChange={(e) => setVehicleCount(e.target.value)}
                    className="w-full text-sm outline-none border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 focus:border-[#FF6B00] bg-white dark:bg-[#0F172A] text-[#1A1A2E] dark:text-[#E5E7EB]"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1 block">Slot Duration (sec)</label>
                  <input
                    type="number"
                    min={0}
                    value={slotSeconds}
                    onChange={(e) => setSlotSeconds(e.target.value)}
                    disabled={adType === "Vehicle Wrap"}
                    placeholder={adType === "Vehicle Wrap" ? "N/A" : ""}
                    className="w-full text-sm outline-none border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 focus:border-[#FF6B00] bg-white dark:bg-[#0F172A] text-[#1A1A2E] dark:text-[#E5E7EB] disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:text-gray-400"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1 block">Target Area</label>
                <input
                  type="text"
                  value={targetArea}
                  onChange={(e) => setTargetArea(e.target.value)}
                  placeholder="e.g. Ranaghat, Kalyani"
                  className="w-full text-sm outline-none border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 focus:border-[#FF6B00] bg-white dark:bg-[#0F172A] text-[#1A1A2E] dark:text-[#E5E7EB]"
                />
              </div>

              <div>
                <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1 block">Budget (₹)</label>
                <input
                  type="number"
                  min={1000}
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  className="w-full text-sm outline-none border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 focus:border-[#FF6B00] bg-white dark:bg-[#0F172A] text-[#1A1A2E] dark:text-[#E5E7EB]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1 block">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full text-sm outline-none border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 focus:border-[#FF6B00] bg-white dark:bg-[#0F172A] text-[#1A1A2E] dark:text-[#E5E7EB]"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1 block">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full text-sm outline-none border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 focus:border-[#FF6B00] bg-white dark:bg-[#0F172A] text-[#1A1A2E] dark:text-[#E5E7EB]"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="w-full btn-saffron py-3.5 mt-4 disabled:opacity-50"
            >
              Submit for Approval
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
