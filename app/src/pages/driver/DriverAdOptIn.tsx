import { useNavigate } from "react-router";
import { ArrowLeft, Megaphone, Smartphone, Car, IndianRupee, Info } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { useAdCampaigns } from "@/contexts/AdCampaignsContext";
import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/providers/trpc";

const IN_APP_ESTIMATE = "₹300–600";
const VEHICLE_WRAP_ESTIMATE = "₹1,500–3,000";

export default function DriverAdOptIn() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { campaigns } = useAdCampaigns();
  const utils = trpc.useUtils();
  const { data: prefs } = trpc.driver.getAdPreferences.useQuery();
  const setPrefsMutation = trpc.driver.setAdPreferences.useMutation({
    onSuccess: () => utils.driver.getAdPreferences.invalidate(),
  });

  const inAppAds = prefs?.inAppAds ?? true;
  const vehicleWrapAds = prefs?.vehicleWrapAds ?? false;

  const setInAppAds = (value: boolean) => setPrefsMutation.mutate({ inAppAds: value });
  const setVehicleWrapAds = (value: boolean) => setPrefsMutation.mutate({ vehicleWrapAds: value });

  const myDriverId = user?.id ? String(user.id) : null;
  const isAllotted = (campaign: (typeof campaigns)[number]) => myDriverId !== null && campaign.allottedDriverIds.includes(myDriverId);

  // Real earnings, derived from this driver's actual allotted+active campaigns
  // (spend × their revenue-share %) rather than a hardcoded number.
  const myActiveCampaigns = campaigns.filter((c) => c.status === "active" && isAllotted(c));
  const monthlyAdEarnings = Math.round(
    myActiveCampaigns.reduce((sum, c) => sum + (c.spent * c.driverSharePercent) / 100, 0)
  );

  const activeInAppCampaign = inAppAds && myActiveCampaigns.find((c) => c.adType === "Driver Screen");
  const activeWrapCampaign = vehicleWrapAds && myActiveCampaigns.find((c) => c.adType === "Vehicle Wrap");

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0F172A] pb-28">
      <div className="bg-white dark:bg-[#1E293B] px-4 py-3 flex items-center gap-3 shadow-sm">
        <button onClick={() => navigate("/driver/dashboard")} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full">
          <ArrowLeft className="w-5 h-5 text-[#1A1A2E] dark:text-[#E5E7EB]" />
        </button>
        <h1 className="font-bold text-lg text-[#1A1A2E] dark:text-[#E5E7EB]">Ad Earnings</h1>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Earnings Summary */}
        <div className="bg-gradient-to-br from-[#7C3AED] to-[#5B21B6] rounded-2xl p-5 text-white">
          <div className="flex items-center gap-2 mb-1">
            <IndianRupee className="w-4 h-4" />
            <p className="text-sm text-white/80">This Month's Ad Earnings</p>
          </div>
          <p className="text-3xl font-bold">₹{monthlyAdEarnings}</p>
        </div>

        {/* In-App Screen Ads */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#E0F2FE] dark:bg-[#0C2536] flex items-center justify-center flex-shrink-0">
                <Smartphone className="w-5 h-5 text-[#0EA5E9]" />
              </div>
              <div>
                <p className="font-medium text-sm text-[#1A1A2E] dark:text-[#E5E7EB]">In-App Screen Ads</p>
                <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Show ads on your driver app screen · {IN_APP_ESTIMATE}/mo</p>
              </div>
            </div>
            <button
              onClick={() => setInAppAds(!inAppAds)}
              className={`w-12 h-6 rounded-full p-1 transition-colors flex-shrink-0 ${inAppAds ? "bg-[#138808]" : "bg-gray-300 dark:bg-gray-600"}`}
            >
              <div className={`w-4 h-4 rounded-full bg-white transition-transform ${inAppAds ? "translate-x-6" : "translate-x-0"}`} />
            </button>
          </div>
          {activeInAppCampaign && (
            <div className="mt-3 flex items-center gap-3 bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl p-3">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: activeInAppCampaign.creativeColor }}
              >
                <Megaphone className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Currently showing</p>
                <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB] truncate">{activeInAppCampaign.name} · {activeInAppCampaign.advertiserName}</p>
              </div>
            </div>
          )}
          {!inAppAds && (
            <p className="mt-3 text-xs text-[#9CA3AF] dark:text-[#64748B]">Turned off — you won't be shown or earn from in-app ads.</p>
          )}
        </div>

        {/* Vehicle Wrap Ads */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#F3E8FF] dark:bg-[#2D1B4E] flex items-center justify-center flex-shrink-0">
                <Car className="w-5 h-5 text-[#7C3AED]" />
              </div>
              <div>
                <p className="font-medium text-sm text-[#1A1A2E] dark:text-[#E5E7EB]">Vehicle Wrap Ads</p>
                <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Brand your vehicle exterior · {VEHICLE_WRAP_ESTIMATE}/mo</p>
              </div>
            </div>
            <button
              onClick={() => setVehicleWrapAds(!vehicleWrapAds)}
              className={`w-12 h-6 rounded-full p-1 transition-colors flex-shrink-0 ${vehicleWrapAds ? "bg-[#138808]" : "bg-gray-300 dark:bg-gray-600"}`}
            >
              <div className={`w-4 h-4 rounded-full bg-white transition-transform ${vehicleWrapAds ? "translate-x-6" : "translate-x-0"}`} />
            </button>
          </div>
          {vehicleWrapAds && (
            <div className="mt-3 bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl p-3">
              <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                {activeWrapCampaign
                  ? `Matched with ${activeWrapCampaign.advertiserName} — installation team will contact you within 3 days.`
                  : "You'll be matched with an advertiser soon. We'll notify you when a wrap partner is found."}
              </p>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex items-start gap-3 bg-[#FFF5EB] dark:bg-[#3A2A1A] rounded-2xl p-4">
          <Info className="w-4 h-4 text-[#FF6B00] flex-shrink-0 mt-0.5" />
          <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">
            Ad earnings are credited to your wallet automatically at the end of each month, in addition to your ride earnings.
          </p>
        </div>
      </div>

      <BottomNav role="driver" />
    </div>
  );
}
