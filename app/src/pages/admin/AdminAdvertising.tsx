import { useState } from "react";
import { Megaphone, IndianRupee, Clock, Check, X, ImageIcon, UserCog, Pencil, Plus, Car, Timer, CalendarDays, MapPin, Bell, ShieldCheck } from "lucide-react";
import { useAdCampaigns } from "@/contexts/AdCampaignsContext";
import { CAMPAIGN_STATUS_CONFIG, AD_TYPES, defaultSlotSeconds, defaultDriverSharePercent, type AdCampaign, type AdType } from "@/lib/mockAdCampaigns";
import { trpc } from "@/providers/trpc";
import AdminLayout from "@/components/admin/AdminLayout";

const DRIVER_ALLOTMENT_TYPES = ["Driver Screen", "Vehicle Wrap"];
const AD_COLORS = ["#FF6B00", "#138808", "#0EA5E9", "#7C3AED", "#DC2626"];

interface AdRate {
  baseRate: number;
  cpm: number;
  cpc: number;
  perDayRate: number;
  perVehicleRate: number;
  perSecondRate: number;
  driverSharePercent: number;
}

const initialRateCard: Record<AdType, AdRate> = {
  "In-App Banner": { baseRate: 5000, cpm: 45, cpc: 3, perDayRate: 150, perVehicleRate: 20, perSecondRate: 5, driverSharePercent: 0 },
  "Driver Screen": { baseRate: 8000, cpm: 70, cpc: 5, perDayRate: 250, perVehicleRate: 40, perSecondRate: 8, driverSharePercent: 35 },
  "Vehicle Wrap": { baseRate: 15000, cpm: 0, cpc: 0, perDayRate: 400, perVehicleRate: 300, perSecondRate: 0, driverSharePercent: 50 },
};

function daysBetween(start: string, end: string) {
  if (!start || !end) return 0;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(1, Math.round(ms / 86400000) + 1);
}

export default function AdminAdvertising() {
  const { campaigns, addCampaign, setCampaignStatus, setCampaignDrivers, updateCampaign } = useAdCampaigns();
  const { data: adOptedInDriversData } = trpc.ad.listAdOptedInDrivers.useQuery();
  const adOptedInDrivers = adOptedInDriversData ?? [];
  const [allotCampaign, setAllotCampaign] = useState<AdCampaign | null>(null);
  const [draftDriverIds, setDraftDriverIds] = useState<string[]>([]);

  const [approveCampaign, setApproveCampaign] = useState<AdCampaign | null>(null);
  const [approveDriverIds, setApproveDriverIds] = useState<string[]>([]);
  const [approveSharePercent, setApproveSharePercent] = useState("0");
  const [approveToast, setApproveToast] = useState<string | null>(null);

  const [editCampaign, setEditCampaign] = useState<AdCampaign | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftTargetArea, setDraftTargetArea] = useState("");
  const [draftBudget, setDraftBudget] = useState("");
  const [draftStartDate, setDraftStartDate] = useState("");
  const [draftEndDate, setDraftEndDate] = useState("");
  const [draftCpm, setDraftCpm] = useState("");
  const [draftCpc, setDraftCpc] = useState("");
  const [draftVehicleCount, setDraftVehicleCount] = useState("");
  const [draftSlotSeconds, setDraftSlotSeconds] = useState("");
  const [draftDriverSharePercent, setDraftDriverSharePercent] = useState("0");

  const [rateCard, setRateCard] = useState<Record<AdType, AdRate>>(initialRateCard);

  // Add Campaign (manual creation)
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAdvertiserName, setNewAdvertiserName] = useState("");
  const [newAdType, setNewAdType] = useState<AdType>("In-App Banner");
  const [newTargetArea, setNewTargetArea] = useState("");
  const [newBudget, setNewBudget] = useState("10000");
  const [newStartDate, setNewStartDate] = useState("");
  const [newEndDate, setNewEndDate] = useState("");
  const [newVehicleCount, setNewVehicleCount] = useState("10");
  const [newSlotSeconds, setNewSlotSeconds] = useState(String(defaultSlotSeconds["In-App Banner"]));
  const [newDriverIds, setNewDriverIds] = useState<string[]>([]);
  const [newDriverSharePercent, setNewDriverSharePercent] = useState(String(defaultDriverSharePercent["In-App Banner"]));

  const newNeedsDrivers = DRIVER_ALLOTMENT_TYPES.includes(newAdType);
  const canCreate = newName.trim().length > 2 && newAdvertiserName.trim().length > 1 && newTargetArea.trim().length > 2 && newStartDate && newEndDate;

  const handleNewAdTypeChange = (type: AdType) => {
    setNewAdType(type);
    setNewSlotSeconds(String(defaultSlotSeconds[type]));
    setNewDriverSharePercent(String(defaultDriverSharePercent[type]));
  };

  const handleNewDriverSelection = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setNewDriverIds(Array.from(e.target.selectedOptions).map((opt) => opt.value));
  };

  const resetCreateForm = () => {
    setNewName("");
    setNewAdvertiserName("");
    setNewAdType("In-App Banner");
    setNewTargetArea("");
    setNewBudget("10000");
    setNewStartDate("");
    setNewEndDate("");
    setNewVehicleCount("10");
    setNewSlotSeconds(String(defaultSlotSeconds["In-App Banner"]));
    setNewDriverIds([]);
    setNewDriverSharePercent(String(defaultDriverSharePercent["In-App Banner"]));
  };

  const handleCreate = () => {
    if (!canCreate) return;
    addCampaign({
      advertiserName: newAdvertiserName.trim(),
      name: newName.trim(),
      adType: newAdType,
      targetArea: newTargetArea.trim(),
      budget: Number(newBudget) || 0,
      startDate: newStartDate,
      endDate: newEndDate,
      vehicleCount: Number(newVehicleCount) || 0,
      slotSeconds: Number(newSlotSeconds) || 0,
      allottedDriverIds: newDriverIds,
      driverSharePercent: newNeedsDrivers ? Math.min(100, Math.max(0, Number(newDriverSharePercent) || 0)) : 0,
      creativeColor: AD_COLORS[campaigns.length % AD_COLORS.length],
    });
    resetCreateForm();
    setShowCreate(false);
  };

  const splitFor = (campaign: AdCampaign) => {
    const needsDrivers = DRIVER_ALLOTMENT_TYPES.includes(campaign.adType);
    const sharePercent = needsDrivers ? campaign.driverSharePercent : 0;
    const driverPayout = Math.round(campaign.spent * (sharePercent / 100));
    return { driverPayout, platformRevenue: campaign.spent - driverPayout, sharePercent, needsDrivers };
  };

  const totalRevenue = campaigns.reduce((sum, c) => sum + c.spent, 0);
  const totalDriverPayout = campaigns.reduce((sum, c) => sum + splitFor(c).driverPayout, 0);
  const totalPlatformRevenue = totalRevenue - totalDriverPayout;
  const activeCount = campaigns.filter((c) => c.status === "active").length;
  const pending = campaigns.filter((c) => c.status === "pending");
  const others = campaigns.filter((c) => c.status !== "pending");

  const openAllotment = (campaign: AdCampaign) => {
    setAllotCampaign(campaign);
    setDraftDriverIds(campaign.allottedDriverIds);
  };

  const handleDropdownSelection = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = Array.from(e.target.selectedOptions).map((opt) => opt.value);
    setDraftDriverIds(selected);
  };

  const saveAllotment = () => {
    if (!allotCampaign) return;
    setCampaignDrivers(allotCampaign.id, draftDriverIds);
    setAllotCampaign(null);
  };

  const needsDriversFor = (campaign: AdCampaign) => DRIVER_ALLOTMENT_TYPES.includes(campaign.adType);

  const openApprove = (campaign: AdCampaign) => {
    setApproveCampaign(campaign);
    setApproveDriverIds(campaign.allottedDriverIds.length > 0 ? campaign.allottedDriverIds : []);
    setApproveSharePercent(String(campaign.driverSharePercent || defaultDriverSharePercent[campaign.adType]));
  };

  const handleApproveDriverSelection = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setApproveDriverIds(Array.from(e.target.selectedOptions).map((opt) => opt.value));
  };

  const confirmApprove = () => {
    if (!approveCampaign) return;
    const needsDrivers = needsDriversFor(approveCampaign);
    updateCampaign(approveCampaign.id, {
      driverSharePercent: needsDrivers ? Math.min(100, Math.max(0, Number(approveSharePercent) || 0)) : 0,
      allottedDriverIds: needsDrivers ? approveDriverIds : [],
    });
    setCampaignStatus(approveCampaign.id, "active");
    if (needsDrivers && approveDriverIds.length > 0) {
      setApproveToast(`Notified ${approveDriverIds.length} driver${approveDriverIds.length > 1 ? "s" : ""} about "${approveCampaign.name}"`);
      setTimeout(() => setApproveToast(null), 3500);
    }
    setApproveCampaign(null);
  };

  const declineFromModal = () => {
    if (!approveCampaign) return;
    setCampaignStatus(approveCampaign.id, "rejected");
    setApproveCampaign(null);
  };

  const openEdit = (campaign: AdCampaign) => {
    setEditCampaign(campaign);
    setDraftName(campaign.name);
    setDraftTargetArea(campaign.targetArea);
    setDraftBudget(String(campaign.budget));
    setDraftStartDate(campaign.startDate);
    setDraftEndDate(campaign.endDate);
    setDraftCpm(String(campaign.cpm));
    setDraftCpc(String(campaign.cpc));
    setDraftVehicleCount(String(campaign.vehicleCount));
    setDraftSlotSeconds(String(campaign.slotSeconds));
    setDraftDriverSharePercent(String(campaign.driverSharePercent));
  };

  const saveEdit = () => {
    if (!editCampaign || !draftName.trim()) return;
    updateCampaign(editCampaign.id, {
      name: draftName.trim(),
      targetArea: draftTargetArea.trim(),
      budget: Number(draftBudget) || 0,
      startDate: draftStartDate,
      endDate: draftEndDate,
      cpm: Number(draftCpm) || 0,
      cpc: Number(draftCpc) || 0,
      vehicleCount: Number(draftVehicleCount) || 0,
      slotSeconds: Number(draftSlotSeconds) || 0,
      driverSharePercent: needsDriversFor(editCampaign) ? Math.min(100, Math.max(0, Number(draftDriverSharePercent) || 0)) : 0,
    });
    setEditCampaign(null);
  };

  const toggleOnOff = (campaign: AdCampaign) => {
    setCampaignStatus(campaign.id, campaign.status === "active" ? "paused" : "active");
  };

  const updateRate = (type: AdType, field: keyof AdRate, value: number) => {
    setRateCard((prev) => ({ ...prev, [type]: { ...prev[type], [field]: value } }));
  };

  return (
    <AdminLayout
      title="Advertisement Management"
      subtitle="Review campaigns and track ad revenue across the platform"
      headerActions={
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 bg-[#FF6B00] text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-[#E05F00] transition-colors flex-shrink-0"
        >
          <Plus className="w-4 h-4" /> Add Campaign
        </button>
      }
    >
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <IndianRupee className="w-4 h-4 text-[#138808]" />
              <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Total Ad Revenue</p>
            </div>
            <p className="text-2xl font-bold text-[#1A1A2E] dark:text-[#E5E7EB]">₹{totalRevenue.toLocaleString("en-IN")}</p>
          </div>
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <IndianRupee className="w-4 h-4 text-[#1E3A5F] dark:text-[#93C5FD]" />
              <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Your Revenue (Platform)</p>
            </div>
            <p className="text-2xl font-bold text-[#1E3A5F] dark:text-[#93C5FD]">₹{totalPlatformRevenue.toLocaleString("en-IN")}</p>
          </div>
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <Car className="w-4 h-4 text-[#7C3AED]" />
              <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Driver Payouts</p>
            </div>
            <p className="text-2xl font-bold text-[#7C3AED]">₹{totalDriverPayout.toLocaleString("en-IN")}</p>
          </div>
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <Megaphone className="w-4 h-4 text-[#FF6B00]" />
              <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Active Campaigns</p>
            </div>
            <p className="text-2xl font-bold text-[#1A1A2E] dark:text-[#E5E7EB]">{activeCount}</p>
          </div>
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-[#DC2626]" />
              <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Pending Approval</p>
            </div>
            <p className="text-2xl font-bold text-[#1A1A2E] dark:text-[#E5E7EB]">{pending.length}</p>
          </div>
        </div>

        {/* Approve/notify toast */}
        {approveToast && (
          <div className="flex items-center gap-2 bg-[#E8F5E8] dark:bg-[#1A2D1A] text-[#138808] dark:text-[#4ADE80] text-sm font-medium px-4 py-3 rounded-xl">
            <Bell className="w-4 h-4 flex-shrink-0" /> {approveToast}
          </div>
        )}

        {/* Pending Approvals */}
        {pending.length > 0 && (
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-5">
            <h2 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] mb-3">Pending Approval</h2>
            <div className="space-y-3">
              {pending.map((campaign) => {
                const needsDrivers = needsDriversFor(campaign);
                return (
                  <div key={campaign.id} className="bg-[#FFF5EB] dark:bg-[#3D2914] rounded-xl p-3">
                    <div className="flex items-center gap-3 mb-3">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `${campaign.creativeColor}20` }}
                      >
                        <ImageIcon className="w-5 h-5" style={{ color: campaign.creativeColor }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB] truncate">{campaign.name}</p>
                        <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] truncate">{campaign.advertiserName}</p>
                      </div>
                      <button
                        onClick={() => openApprove(campaign)}
                        className="w-9 h-9 rounded-full bg-[#138808] flex items-center justify-center flex-shrink-0 hover:opacity-90"
                        aria-label="Review & Approve"
                      >
                        <Check className="w-4 h-4 text-white" />
                      </button>
                      <button
                        onClick={() => setCampaignStatus(campaign.id, "rejected")}
                        className="w-9 h-9 rounded-full bg-[#DC2626] flex items-center justify-center flex-shrink-0 hover:opacity-90"
                        aria-label="Reject"
                      >
                        <X className="w-4 h-4 text-white" />
                      </button>
                    </div>

                    {/* Full details so admin can decide approve or decline */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-white/60 dark:bg-black/20 rounded-lg p-2.5">
                      <div>
                        <p className="text-[10px] text-[#9CA3AF]">Ad Type</p>
                        <p className="text-xs font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">{campaign.adType}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[#9CA3AF]">Budget</p>
                        <p className="text-xs font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">₹{campaign.budget.toLocaleString("en-IN")}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[#9CA3AF] flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5" /> Target Area</p>
                        <p className="text-xs font-medium text-[#1A1A2E] dark:text-[#E5E7EB] truncate">{campaign.targetArea}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[#9CA3AF] flex items-center gap-0.5"><CalendarDays className="w-2.5 h-2.5" /> Duration</p>
                        <p className="text-xs font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">{daysBetween(campaign.startDate, campaign.endDate)} days</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[#9CA3AF]">Start · End</p>
                        <p className="text-xs font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">{campaign.startDate} → {campaign.endDate}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[#9CA3AF] flex items-center gap-0.5"><Car className="w-2.5 h-2.5" /> Vehicles</p>
                        <p className="text-xs font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">{campaign.vehicleCount}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[#9CA3AF] flex items-center gap-0.5"><Timer className="w-2.5 h-2.5" /> Slot</p>
                        <p className="text-xs font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">{campaign.slotSeconds > 0 ? `${campaign.slotSeconds}s` : "—"}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[#9CA3AF]">CPM / CPC</p>
                        <p className="text-xs font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">₹{campaign.cpm} / ₹{campaign.cpc}</p>
                      </div>
                    </div>
                    {needsDrivers && (
                      <p className="text-[11px] text-[#7C3AED] mt-2 flex items-center gap-1">
                        <Car className="w-3 h-3" /> Runs on driver assets — approving requires selecting which drivers to notify
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* All Campaigns */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-5">
          <h2 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] mb-3">All Campaigns</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-[#6B7280] dark:text-[#9CA3AF] border-b border-gray-100 dark:border-gray-700">
                  <th className="pb-2 pr-4 font-medium">Campaign</th>
                  <th className="pb-2 pr-4 font-medium">Advertiser</th>
                  <th className="pb-2 pr-4 font-medium">Type</th>
                  <th className="pb-2 pr-4 font-medium">Budget</th>
                  <th className="pb-2 pr-4 font-medium">Spent</th>
                  <th className="pb-2 pr-4 font-medium">Revenue Split</th>
                  <th className="pb-2 pr-4 font-medium">CPM / CPC</th>
                  <th className="pb-2 pr-4 font-medium">Days / Vehicles / Sec</th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 pr-4 font-medium">On/Off</th>
                  <th className="pb-2 pr-4 font-medium">Drivers</th>
                  <th className="pb-2 font-medium">Edit</th>
                </tr>
              </thead>
              <tbody>
                {others.map((campaign) => {
                  const config = CAMPAIGN_STATUS_CONFIG[campaign.status];
                  const needsDrivers = DRIVER_ALLOTMENT_TYPES.includes(campaign.adType);
                  const toggleable = campaign.status === "active" || campaign.status === "paused";
                  const { driverPayout, platformRevenue, sharePercent } = splitFor(campaign);
                  const driverCount = campaign.allottedDriverIds.length;
                  return (
                    <tr key={campaign.id} className="border-b border-gray-50 dark:border-gray-700 last:border-0">
                      <td className="py-2.5 pr-4 text-[#1A1A2E] dark:text-[#E5E7EB] font-medium whitespace-nowrap">{campaign.name}</td>
                      <td className="py-2.5 pr-4 text-[#6B7280] dark:text-[#9CA3AF] whitespace-nowrap">{campaign.advertiserName}</td>
                      <td className="py-2.5 pr-4 text-[#6B7280] dark:text-[#9CA3AF] whitespace-nowrap">{campaign.adType}</td>
                      <td className="py-2.5 pr-4 text-[#6B7280] dark:text-[#9CA3AF] whitespace-nowrap">₹{campaign.budget.toLocaleString("en-IN")}</td>
                      <td className="py-2.5 pr-4 text-[#6B7280] dark:text-[#9CA3AF] whitespace-nowrap">₹{campaign.spent.toLocaleString("en-IN")}</td>
                      <td className="py-2.5 pr-4 whitespace-nowrap">
                        {needsDrivers ? (
                          <div className="text-xs leading-tight">
                            <p className="text-[#1E3A5F] dark:text-[#93C5FD] font-medium">You: ₹{platformRevenue.toLocaleString("en-IN")}</p>
                            <p className="text-[#7C3AED]">
                              Driver{driverCount > 1 ? "s" : ""}: ₹{driverPayout.toLocaleString("en-IN")}
                              {driverCount > 1 ? ` (₹${Math.round(driverPayout / driverCount).toLocaleString("en-IN")} ea.)` : ""}
                            </p>
                            <p className="text-[10px] text-[#9CA3AF]">{sharePercent}% to driver</p>
                          </div>
                        ) : (
                          <span className="text-xs text-[#9CA3AF]">All platform</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-4 text-[#6B7280] dark:text-[#9CA3AF] whitespace-nowrap">₹{campaign.cpm} / ₹{campaign.cpc}</td>
                      <td className="py-2.5 pr-4 text-[#6B7280] dark:text-[#9CA3AF] whitespace-nowrap">
                        {daysBetween(campaign.startDate, campaign.endDate)}d · {campaign.vehicleCount} veh · {campaign.slotSeconds > 0 ? `${campaign.slotSeconds}s` : "—"}
                      </td>
                      <td className="py-2.5 pr-4 whitespace-nowrap">
                        <span
                          className="text-xs font-medium px-2.5 py-1 rounded-full"
                          style={{ color: config.color, backgroundColor: config.bg }}
                        >
                          {config.label}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 whitespace-nowrap">
                        <button
                          onClick={() => toggleable && toggleOnOff(campaign)}
                          disabled={!toggleable}
                          aria-label={campaign.status === "active" ? "Turn ad off" : "Turn ad on"}
                          className={`w-11 h-6 rounded-full p-1 transition-colors ${
                            campaign.status === "active" ? "bg-[#138808]" : "bg-gray-300 dark:bg-gray-600"
                          } ${!toggleable ? "opacity-40 cursor-not-allowed" : ""}`}
                        >
                          <div className={`w-4 h-4 rounded-full bg-white transition-transform ${campaign.status === "active" ? "translate-x-5" : "translate-x-0"}`} />
                        </button>
                      </td>
                      <td className="py-2.5 pr-4 whitespace-nowrap">
                        {needsDrivers ? (
                          <button
                            onClick={() => openAllotment(campaign)}
                            className="flex items-center gap-1.5 text-xs font-medium text-[#0EA5E9] hover:underline"
                          >
                            <UserCog className="w-3.5 h-3.5" />
                            {campaign.allottedDriverIds.length > 0
                              ? `${campaign.allottedDriverIds.length} allotted`
                              : "Allot drivers"}
                          </button>
                        ) : (
                          <span className="text-xs text-[#9CA3AF]">—</span>
                        )}
                      </td>
                      <td className="py-2.5 whitespace-nowrap">
                        <button
                          onClick={() => openEdit(campaign)}
                          className="flex items-center gap-1.5 text-xs font-medium text-[#7C3AED] hover:underline"
                        >
                          <Pencil className="w-3.5 h-3.5" /> Edit
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Ad Pricing */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-5">
          <div className="flex items-center gap-2 mb-3">
            <IndianRupee className="w-4 h-4 text-[#138808]" />
            <h2 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">Ad Pricing</h2>
          </div>
          <div className="space-y-3">
            {AD_TYPES.map((type) => (
              <div key={type} className="bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl p-3">
                <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB] mb-2">{type}</p>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <div>
                    <label className="text-[10px] text-[#9CA3AF] mb-0.5 block">Base Rate (₹)</label>
                    <input
                      type="number"
                      value={rateCard[type].baseRate}
                      onChange={(e) => updateRate(type, "baseRate", Number(e.target.value))}
                      className="w-full bg-white dark:bg-[#1E293B] rounded-lg px-2 py-1.5 text-sm outline-none border border-gray-200 dark:border-gray-700 focus:border-[#FF6B00] text-[#1A1A2E] dark:text-[#E5E7EB]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#9CA3AF] mb-0.5 block">CPM (₹/1000)</label>
                    <input
                      type="number"
                      value={rateCard[type].cpm}
                      onChange={(e) => updateRate(type, "cpm", Number(e.target.value))}
                      className="w-full bg-white dark:bg-[#1E293B] rounded-lg px-2 py-1.5 text-sm outline-none border border-gray-200 dark:border-gray-700 focus:border-[#FF6B00] text-[#1A1A2E] dark:text-[#E5E7EB]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#9CA3AF] mb-0.5 block">CPC (₹/click)</label>
                    <input
                      type="number"
                      value={rateCard[type].cpc}
                      onChange={(e) => updateRate(type, "cpc", Number(e.target.value))}
                      className="w-full bg-white dark:bg-[#1E293B] rounded-lg px-2 py-1.5 text-sm outline-none border border-gray-200 dark:border-gray-700 focus:border-[#FF6B00] text-[#1A1A2E] dark:text-[#E5E7EB]"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-[#9CA3AF] mb-0.5 block flex items-center gap-1">
                      <CalendarDays className="w-2.5 h-2.5" /> Per Day (₹)
                    </label>
                    <input
                      type="number"
                      value={rateCard[type].perDayRate}
                      onChange={(e) => updateRate(type, "perDayRate", Number(e.target.value))}
                      className="w-full bg-white dark:bg-[#1E293B] rounded-lg px-2 py-1.5 text-sm outline-none border border-gray-200 dark:border-gray-700 focus:border-[#FF6B00] text-[#1A1A2E] dark:text-[#E5E7EB]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#9CA3AF] mb-0.5 block flex items-center gap-1">
                      <Car className="w-2.5 h-2.5" /> Per Vehicle (₹)
                    </label>
                    <input
                      type="number"
                      value={rateCard[type].perVehicleRate}
                      onChange={(e) => updateRate(type, "perVehicleRate", Number(e.target.value))}
                      className="w-full bg-white dark:bg-[#1E293B] rounded-lg px-2 py-1.5 text-sm outline-none border border-gray-200 dark:border-gray-700 focus:border-[#FF6B00] text-[#1A1A2E] dark:text-[#E5E7EB]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#9CA3AF] mb-0.5 block flex items-center gap-1">
                      <Timer className="w-2.5 h-2.5" /> Per Second (₹)
                    </label>
                    <input
                      type="number"
                      value={rateCard[type].perSecondRate}
                      onChange={(e) => updateRate(type, "perSecondRate", Number(e.target.value))}
                      disabled={type === "Vehicle Wrap"}
                      className="w-full bg-white dark:bg-[#1E293B] rounded-lg px-2 py-1.5 text-sm outline-none border border-gray-200 dark:border-gray-700 focus:border-[#FF6B00] text-[#1A1A2E] dark:text-[#E5E7EB] disabled:opacity-40"
                    />
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                  <label className="text-[10px] text-[#9CA3AF] mb-0.5 block flex items-center gap-1">
                    <Car className="w-2.5 h-2.5" /> Driver Payout Share (% of spend paid to allotted drivers)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={rateCard[type].driverSharePercent}
                      onChange={(e) => updateRate(type, "driverSharePercent", Math.min(100, Math.max(0, Number(e.target.value))))}
                      disabled={!DRIVER_ALLOTMENT_TYPES.includes(type)}
                      className="w-24 bg-white dark:bg-[#1E293B] rounded-lg px-2 py-1.5 text-sm outline-none border border-gray-200 dark:border-gray-700 focus:border-[#7C3AED] text-[#1A1A2E] dark:text-[#E5E7EB] disabled:opacity-40"
                    />
                    <span className="text-[11px] text-[#9CA3AF]">
                      {DRIVER_ALLOTMENT_TYPES.includes(type)
                        ? `You keep ${100 - rateCard[type].driverSharePercent}%, drivers get ${rateCard[type].driverSharePercent}%`
                        : "No driver allotment for this ad type — you keep 100%"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      {/* Approve Campaign Sheet */}
      {approveCampaign && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setApproveCampaign(null)} />
          <div className="relative bg-white dark:bg-[#1E293B] w-full max-w-md rounded-t-3xl sm:rounded-3xl sm:my-8 p-5 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-bold text-lg text-[#1A1A2E] dark:text-[#E5E7EB]">Review Campaign</h2>
              <button onClick={() => setApproveCampaign(null)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
                <X className="w-5 h-5 text-[#6B7280] dark:text-[#9CA3AF]" />
              </button>
            </div>
            <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB] mb-0.5">{approveCampaign.name}</p>
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-3">{approveCampaign.advertiserName}</p>

            <div className="grid grid-cols-2 gap-2 bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl p-3 mb-4">
              <div>
                <p className="text-[10px] text-[#9CA3AF]">Ad Type</p>
                <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">{approveCampaign.adType}</p>
              </div>
              <div>
                <p className="text-[10px] text-[#9CA3AF]">Budget</p>
                <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">₹{approveCampaign.budget.toLocaleString("en-IN")}</p>
              </div>
              <div>
                <p className="text-[10px] text-[#9CA3AF]">Target Area</p>
                <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">{approveCampaign.targetArea}</p>
              </div>
              <div>
                <p className="text-[10px] text-[#9CA3AF]">Duration</p>
                <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">
                  {daysBetween(approveCampaign.startDate, approveCampaign.endDate)} days ({approveCampaign.startDate} → {approveCampaign.endDate})
                </p>
              </div>
              <div>
                <p className="text-[10px] text-[#9CA3AF]">Vehicles / Slot</p>
                <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">
                  {approveCampaign.vehicleCount} veh · {approveCampaign.slotSeconds > 0 ? `${approveCampaign.slotSeconds}s` : "—"}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-[#9CA3AF]">CPM / CPC</p>
                <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">₹{approveCampaign.cpm} / ₹{approveCampaign.cpc}</p>
              </div>
            </div>

            {needsDriversFor(approveCampaign) ? (
              <>
                <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1 block flex items-center gap-1">
                  <Car className="w-3 h-3" /> Driver Revenue Share (%)
                </label>
                <div className="flex items-center gap-2 mb-4">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={approveSharePercent}
                    onChange={(e) => setApproveSharePercent(e.target.value)}
                    className="w-24 bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-4 py-2.5 text-sm outline-none border border-gray-100 dark:border-gray-700 focus:border-[#138808] text-[#1A1A2E] dark:text-[#E5E7EB]"
                  />
                  <span className="text-[11px] text-[#9CA3AF]">
                    You keep {100 - Math.min(100, Math.max(0, Number(approveSharePercent) || 0))}%, drivers get {Math.min(100, Math.max(0, Number(approveSharePercent) || 0))}%
                  </span>
                </div>

                <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1 block flex items-center gap-1">
                  <Bell className="w-3 h-3" /> Alert Drivers (required before approval)
                </label>
                <select
                  multiple
                  value={approveDriverIds}
                  onChange={handleApproveDriverSelection}
                  size={Math.max(1, Math.min(6, adOptedInDrivers.length))}
                  className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl p-2 text-sm outline-none border border-gray-200 dark:border-gray-700 focus:border-[#138808] text-[#1A1A2E] dark:text-[#E5E7EB]"
                >
                  {adOptedInDrivers.map((driver) => (
                    <option key={driver.id} value={driver.id} className="py-2 px-2">
                      {driver.name} · {driver.vehicle}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-[#9CA3AF] mt-1 mb-4">{approveDriverIds.length} driver(s) selected — they'll be notified once approved (Ctrl/Cmd-click for multiple)</p>
              </>
            ) : (
              <div className="flex items-start gap-2.5 bg-[#E0F2FE] dark:bg-[#0C2536] rounded-xl p-3 mb-4">
                <ShieldCheck className="w-4 h-4 text-[#0EA5E9] flex-shrink-0 mt-0.5" />
                <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">This ad type doesn't run on driver assets — no drivers to notify. Revenue is 100% platform.</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={declineFromModal}
                className="flex-1 py-3.5 rounded-xl text-sm font-semibold text-[#DC2626] bg-red-50 dark:bg-[#3D1414] hover:opacity-90 transition-opacity"
              >
                Decline
              </button>
              <button
                onClick={confirmApprove}
                disabled={needsDriversFor(approveCampaign) && approveDriverIds.length === 0}
                className="flex-1 py-3.5 rounded-xl text-sm font-semibold text-white bg-[#138808] hover:bg-[#1AA814] transition-colors disabled:opacity-50"
              >
                {needsDriversFor(approveCampaign) ? "Approve & Notify Drivers" : "Approve Campaign"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Driver Allotment Sheet */}
      {allotCampaign && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setAllotCampaign(null)} />
          <div className="relative bg-white dark:bg-[#1E293B] w-full max-w-md rounded-t-3xl sm:rounded-3xl sm:my-8 p-5 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-bold text-lg text-[#1A1A2E] dark:text-[#E5E7EB]">Allot Drivers</h2>
              <button onClick={() => setAllotCampaign(null)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
                <X className="w-5 h-5 text-[#6B7280] dark:text-[#9CA3AF]" />
              </button>
            </div>
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-4">
              {allotCampaign.name} · {allotCampaign.adType} — pick one or more ad-opted-in drivers from the dropdown (Ctrl/Cmd-click for multiple).
            </p>

            <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1 block">Allotted Drivers</label>
            <select
              multiple
              value={draftDriverIds}
              onChange={handleDropdownSelection}
              size={Math.max(1, Math.min(6, adOptedInDrivers.length))}
              className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl p-2 text-sm outline-none border border-gray-200 dark:border-gray-700 focus:border-[#0EA5E9] text-[#1A1A2E] dark:text-[#E5E7EB]"
            >
              {adOptedInDrivers.map((driver) => (
                <option key={driver.id} value={driver.id} className="py-2 px-2">
                  {driver.name} · {driver.vehicle}
                </option>
              ))}
            </select>

            <button
              onClick={saveAllotment}
              className="w-full bg-[#0EA5E9] text-white font-semibold py-3.5 rounded-xl mt-4 hover:bg-[#0284C7] transition-colors"
            >
              Save Allotment ({draftDriverIds.length} selected)
            </button>
          </div>
        </div>
      )}

      {/* Edit Campaign Sheet */}
      {editCampaign && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setEditCampaign(null)} />
          <div className="relative bg-white dark:bg-[#1E293B] w-full max-w-md rounded-t-3xl sm:rounded-3xl sm:my-8 p-5 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg text-[#1A1A2E] dark:text-[#E5E7EB]">Edit Campaign</h2>
              <button onClick={() => setEditCampaign(null)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
                <X className="w-5 h-5 text-[#6B7280] dark:text-[#9CA3AF]" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1 block">Campaign Name</label>
                <input
                  type="text"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-4 py-2.5 text-sm outline-none border border-gray-100 dark:border-gray-700 focus:border-[#7C3AED] text-[#1A1A2E] dark:text-[#E5E7EB]"
                />
              </div>
              <div>
                <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1 block">Target Area</label>
                <input
                  type="text"
                  value={draftTargetArea}
                  onChange={(e) => setDraftTargetArea(e.target.value)}
                  className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-4 py-2.5 text-sm outline-none border border-gray-100 dark:border-gray-700 focus:border-[#7C3AED] text-[#1A1A2E] dark:text-[#E5E7EB]"
                />
              </div>
              <div>
                <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1 block">Budget (₹)</label>
                <input
                  type="number"
                  value={draftBudget}
                  onChange={(e) => setDraftBudget(e.target.value)}
                  className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-4 py-2.5 text-sm outline-none border border-gray-100 dark:border-gray-700 focus:border-[#7C3AED] text-[#1A1A2E] dark:text-[#E5E7EB]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1 block">CPM (₹/1000 impressions)</label>
                  <input
                    type="number"
                    value={draftCpm}
                    onChange={(e) => setDraftCpm(e.target.value)}
                    className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-4 py-2.5 text-sm outline-none border border-gray-100 dark:border-gray-700 focus:border-[#7C3AED] text-[#1A1A2E] dark:text-[#E5E7EB]"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1 block">CPC (₹/click)</label>
                  <input
                    type="number"
                    value={draftCpc}
                    onChange={(e) => setDraftCpc(e.target.value)}
                    className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-4 py-2.5 text-sm outline-none border border-gray-100 dark:border-gray-700 focus:border-[#7C3AED] text-[#1A1A2E] dark:text-[#E5E7EB]"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1 block">Start Date</label>
                  <input
                    type="date"
                    value={draftStartDate}
                    onChange={(e) => setDraftStartDate(e.target.value)}
                    className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-4 py-2.5 text-sm outline-none border border-gray-100 dark:border-gray-700 focus:border-[#7C3AED] text-[#1A1A2E] dark:text-[#E5E7EB]"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1 block">End Date</label>
                  <input
                    type="date"
                    value={draftEndDate}
                    onChange={(e) => setDraftEndDate(e.target.value)}
                    className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-4 py-2.5 text-sm outline-none border border-gray-100 dark:border-gray-700 focus:border-[#7C3AED] text-[#1A1A2E] dark:text-[#E5E7EB]"
                  />
                </div>
              </div>
              <p className="text-[11px] text-[#9CA3AF] flex items-center gap-1">
                <CalendarDays className="w-3 h-3" /> Runs {daysBetween(draftStartDate, draftEndDate)} day(s)
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1 block">Vehicles</label>
                  <input
                    type="number"
                    min={0}
                    value={draftVehicleCount}
                    onChange={(e) => setDraftVehicleCount(e.target.value)}
                    className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-4 py-2.5 text-sm outline-none border border-gray-100 dark:border-gray-700 focus:border-[#7C3AED] text-[#1A1A2E] dark:text-[#E5E7EB]"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1 block">Slot Duration (sec)</label>
                  <input
                    type="number"
                    min={0}
                    value={draftSlotSeconds}
                    onChange={(e) => setDraftSlotSeconds(e.target.value)}
                    className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-4 py-2.5 text-sm outline-none border border-gray-100 dark:border-gray-700 focus:border-[#7C3AED] text-[#1A1A2E] dark:text-[#E5E7EB]"
                  />
                </div>
              </div>

              {editCampaign && needsDriversFor(editCampaign) ? (
                <div>
                  <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1 block flex items-center gap-1">
                    <Car className="w-3 h-3" /> Driver Revenue Share (%)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={draftDriverSharePercent}
                      onChange={(e) => setDraftDriverSharePercent(e.target.value)}
                      className="w-24 bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-4 py-2.5 text-sm outline-none border border-gray-100 dark:border-gray-700 focus:border-[#7C3AED] text-[#1A1A2E] dark:text-[#E5E7EB]"
                    />
                    <span className="text-[11px] text-[#9CA3AF]">
                      You keep {100 - Math.min(100, Math.max(0, Number(draftDriverSharePercent) || 0))}%, drivers get {Math.min(100, Math.max(0, Number(draftDriverSharePercent) || 0))}% of this campaign's spend
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-[#9CA3AF]">This ad type doesn't run on driver assets — revenue stays 100% platform.</p>
              )}
            </div>

            <button
              onClick={saveEdit}
              disabled={!draftName.trim()}
              className="w-full bg-[#7C3AED] text-white font-semibold py-3.5 rounded-xl mt-4 hover:bg-[#6D28D9] transition-colors disabled:opacity-50"
            >
              Save Changes
            </button>
          </div>
        </div>
      )}

      {/* Add Campaign Sheet (manual admin creation) */}
      {showCreate && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowCreate(false)} />
          <div className="relative bg-white dark:bg-[#1E293B] w-full max-w-md rounded-t-3xl sm:rounded-3xl sm:my-8 p-5 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg text-[#1A1A2E] dark:text-[#E5E7EB]">Add Campaign</h2>
              <button onClick={() => setShowCreate(false)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
                <X className="w-5 h-5 text-[#6B7280] dark:text-[#9CA3AF]" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1 block">Campaign Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Diwali Mega Sale"
                  className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-4 py-2.5 text-sm outline-none border border-gray-100 dark:border-gray-700 focus:border-[#FF6B00] text-[#1A1A2E] dark:text-[#E5E7EB]"
                />
              </div>
              <div>
                <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1 block">Advertiser Name</label>
                <input
                  type="text"
                  value={newAdvertiserName}
                  onChange={(e) => setNewAdvertiserName(e.target.value)}
                  placeholder="e.g. Sharma Textiles"
                  className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-4 py-2.5 text-sm outline-none border border-gray-100 dark:border-gray-700 focus:border-[#FF6B00] text-[#1A1A2E] dark:text-[#E5E7EB]"
                />
              </div>

              <div>
                <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1 block">Ad Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {AD_TYPES.map((type) => (
                    <button
                      key={type}
                      onClick={() => handleNewAdTypeChange(type)}
                      className={`py-2 rounded-lg text-[11px] font-medium transition-colors ${
                        newAdType === type ? "bg-[#FF6B00] text-white" : "bg-gray-100 dark:bg-gray-700 text-[#6B7280] dark:text-[#9CA3AF]"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1 block">Target Area</label>
                <input
                  type="text"
                  value={newTargetArea}
                  onChange={(e) => setNewTargetArea(e.target.value)}
                  placeholder="e.g. Ranaghat, Kalyani"
                  className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-4 py-2.5 text-sm outline-none border border-gray-100 dark:border-gray-700 focus:border-[#FF6B00] text-[#1A1A2E] dark:text-[#E5E7EB]"
                />
              </div>

              <div>
                <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1 block">Budget (₹)</label>
                <input
                  type="number"
                  min={1000}
                  value={newBudget}
                  onChange={(e) => setNewBudget(e.target.value)}
                  className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-4 py-2.5 text-sm outline-none border border-gray-100 dark:border-gray-700 focus:border-[#FF6B00] text-[#1A1A2E] dark:text-[#E5E7EB]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1 block">Start Date</label>
                  <input
                    type="date"
                    value={newStartDate}
                    onChange={(e) => setNewStartDate(e.target.value)}
                    className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-4 py-2.5 text-sm outline-none border border-gray-100 dark:border-gray-700 focus:border-[#FF6B00] text-[#1A1A2E] dark:text-[#E5E7EB]"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1 block">End Date</label>
                  <input
                    type="date"
                    value={newEndDate}
                    onChange={(e) => setNewEndDate(e.target.value)}
                    className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-4 py-2.5 text-sm outline-none border border-gray-100 dark:border-gray-700 focus:border-[#FF6B00] text-[#1A1A2E] dark:text-[#E5E7EB]"
                  />
                </div>
              </div>
              <p className="text-[11px] text-[#9CA3AF] flex items-center gap-1">
                <CalendarDays className="w-3 h-3" /> Runs {daysBetween(newStartDate, newEndDate)} day(s)
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1 block">Vehicles</label>
                  <input
                    type="number"
                    min={1}
                    value={newVehicleCount}
                    onChange={(e) => setNewVehicleCount(e.target.value)}
                    className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-4 py-2.5 text-sm outline-none border border-gray-100 dark:border-gray-700 focus:border-[#FF6B00] text-[#1A1A2E] dark:text-[#E5E7EB]"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1 block">Slot Duration (sec)</label>
                  <input
                    type="number"
                    min={0}
                    value={newSlotSeconds}
                    onChange={(e) => setNewSlotSeconds(e.target.value)}
                    disabled={newAdType === "Vehicle Wrap"}
                    placeholder={newAdType === "Vehicle Wrap" ? "N/A" : ""}
                    className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-4 py-2.5 text-sm outline-none border border-gray-100 dark:border-gray-700 focus:border-[#FF6B00] text-[#1A1A2E] dark:text-[#E5E7EB] disabled:opacity-40"
                  />
                </div>
              </div>
              <p className="text-[11px] text-[#9CA3AF]">
                Plays on the {newAdType === "In-App Banner" ? "in-app banner" : newAdType === "Driver Screen" ? "driver screen" : "vehicle wrap"}
                {newAdType !== "Vehicle Wrap" && ` for ${Number(newSlotSeconds) || 0}s per slot`}.
              </p>

              {/* Estimated cost from rate card */}
              <div className="bg-[#FFF5EB] dark:bg-[#3D2914] rounded-xl p-3 text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                Estimated cost: ₹
                {(
                  rateCard[newAdType].baseRate +
                  rateCard[newAdType].perDayRate * daysBetween(newStartDate, newEndDate) +
                  rateCard[newAdType].perVehicleRate * (Number(newVehicleCount) || 0) +
                  rateCard[newAdType].perSecondRate * (Number(newSlotSeconds) || 0)
                ).toLocaleString("en-IN")}{" "}
                <span className="text-[10px]">(base + days × per-day + vehicles × per-vehicle + seconds × per-second)</span>
              </div>

              {newNeedsDrivers && (
                <>
                  <div>
                    <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1 block flex items-center gap-1">
                      <Car className="w-3 h-3" /> Driver Revenue Share (%)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={newDriverSharePercent}
                        onChange={(e) => setNewDriverSharePercent(e.target.value)}
                        className="w-24 bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-4 py-2.5 text-sm outline-none border border-gray-100 dark:border-gray-700 focus:border-[#FF6B00] text-[#1A1A2E] dark:text-[#E5E7EB]"
                      />
                      <span className="text-[11px] text-[#9CA3AF]">
                        You keep {100 - Math.min(100, Math.max(0, Number(newDriverSharePercent) || 0))}%, drivers get {Math.min(100, Math.max(0, Number(newDriverSharePercent) || 0))}% of this campaign's spend
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1 block">Driver Selection</label>
                    <select
                      multiple
                      value={newDriverIds}
                      onChange={handleNewDriverSelection}
                      size={Math.max(1, Math.min(6, adOptedInDrivers.length))}
                      className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl p-2 text-sm outline-none border border-gray-100 dark:border-gray-700 focus:border-[#FF6B00] text-[#1A1A2E] dark:text-[#E5E7EB]"
                    >
                      {adOptedInDrivers.map((driver) => (
                        <option key={driver.id} value={driver.id} className="py-2 px-2">
                          {driver.name} · {driver.vehicle}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-[#9CA3AF] mt-1">{newDriverIds.length} driver(s) selected (Ctrl/Cmd-click for multiple)</p>
                  </div>
                </>
              )}
            </div>

            <button
              onClick={handleCreate}
              disabled={!canCreate}
              className="w-full bg-[#FF6B00] text-white font-semibold py-3.5 rounded-xl mt-4 hover:bg-[#E05F00] transition-colors disabled:opacity-50"
            >
              Create Campaign
            </button>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
