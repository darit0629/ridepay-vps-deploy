import { useState } from "react";
import { Crown, Sparkles, Building2, ShieldCheck, Plus, X, Save, Check, Clock } from "lucide-react";
import { useSubscriptionPlans } from "@/contexts/SubscriptionPlansContext";
import type { PlanId, PlanCategory } from "@/lib/mockSubscriptionPlans";
import AdminLayout from "@/components/admin/AdminLayout";
import { trpc } from "@/providers/trpc";

const planIcons: Record<PlanId, typeof Crown> = {
  free: ShieldCheck,
  silver: Sparkles,
  gold: Crown,
  corporate: Building2,
};

const categories: PlanCategory[] = ["Individual", "Corporate"];

export default function AdminSubscriptions() {
  const { plans, updatePlan } = useSubscriptionPlans();
  const [newPerkText, setNewPerkText] = useState<Record<PlanId, string>>({ free: "", silver: "", gold: "", corporate: "" });
  const [savedId, setSavedId] = useState<PlanId | null>(null);

  const utils = trpc.useUtils();
  const { data: applications } = trpc.corporate.listAll.useQuery();
  const reviewMutation = trpc.corporate.review.useMutation({
    onSuccess: () => utils.corporate.listAll.invalidate(),
  });
  const pendingApplications = (applications ?? []).filter((a) => a.status === "pending");

  const flashSaved = (id: PlanId) => {
    setSavedId(id);
    setTimeout(() => setSavedId((prev) => (prev === id ? null : prev)), 1500);
  };

  const handleAddPerk = (id: PlanId) => {
    const text = newPerkText[id].trim();
    if (!text) return;
    const plan = plans.find((p) => p.id === id);
    if (!plan) return;
    updatePlan(id, { perks: [...plan.perks, text] });
    setNewPerkText({ ...newPerkText, [id]: "" });
  };

  const handleRemovePerk = (id: PlanId, perk: string) => {
    const plan = plans.find((p) => p.id === id);
    if (!plan) return;
    updatePlan(id, { perks: plan.perks.filter((p) => p !== perk) });
  };

  return (
    <AdminLayout title="Subscription Management" subtitle="Flying Plus plan pricing, perks, and availability">
      {pendingApplications.length > 0 && (
        <div className="max-w-[1400px] mb-6">
          <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#FF6B00]" /> Corporate Applications Pending Review ({pendingApplications.length})
          </h3>
          <div className="space-y-2">
            {pendingApplications.map((app) => (
              <div key={app.id} className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium text-sm text-[#1A1A2E] dark:text-[#E5E7EB]">{app.companyName}</p>
                  <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-0.5">
                    {app.contactPerson} • {app.contactPhone} {app.gstin ? `• GSTIN: ${app.gstin}` : ""}
                  </p>
                  <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-0.5">
                    Applicant: {app.riderName ?? "Unknown"} ({app.riderPhone ?? "—"})
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => reviewMutation.mutate({ id: app.id, action: "reject" })}
                    disabled={reviewMutation.isPending}
                    className="w-9 h-9 rounded-xl bg-[#FEF2F2] dark:bg-[#3D1A1A] flex items-center justify-center disabled:opacity-50"
                  >
                    <X className="w-4 h-4 text-[#DC2626]" />
                  </button>
                  <button
                    onClick={() => reviewMutation.mutate({ id: app.id, action: "approve" })}
                    disabled={reviewMutation.isPending}
                    className="w-9 h-9 rounded-xl bg-[#E8F5E8] dark:bg-[#1A2D1A] flex items-center justify-center disabled:opacity-50"
                  >
                    <Check className="w-4 h-4 text-[#138808]" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="max-w-[1400px] grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {plans.map((plan) => {
          const Icon = planIcons[plan.id];
          return (
            <div key={plan.id} className={`bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-5 ${!plan.active ? "opacity-60" : ""}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#FFF5EB] dark:bg-[#3D2914] flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-[#FF6B00]" />
                  </div>
                  <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">{plan.name}</h3>
                </div>
                <button
                  onClick={() => updatePlan(plan.id, { active: !plan.active })}
                  className={`w-12 h-6 rounded-full p-1 transition-colors flex-shrink-0 ${plan.active ? "bg-[#138808]" : "bg-gray-300"}`}
                >
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform ${plan.active ? "translate-x-6" : "translate-x-0"}`} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1 block">Price (₹) — blank for Custom</label>
                  <input
                    type="number"
                    value={plan.price ?? ""}
                    onChange={(e) => updatePlan(plan.id, { price: e.target.value === "" ? null : Number(e.target.value) })}
                    placeholder="Custom"
                    className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-3 py-2 text-sm outline-none border border-gray-100 dark:border-gray-700 focus:border-[#FF6B00] text-[#1A1A2E] dark:text-[#E5E7EB]"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1 block">Billing Period</label>
                  <input
                    type="text"
                    value={plan.period}
                    onChange={(e) => updatePlan(plan.id, { period: e.target.value })}
                    placeholder="/month"
                    className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-3 py-2 text-sm outline-none border border-gray-100 dark:border-gray-700 focus:border-[#FF6B00] text-[#1A1A2E] dark:text-[#E5E7EB]"
                  />
                </div>
              </div>

              <div className="mb-3">
                <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1 block">Category</label>
                <div className="flex gap-2">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => updatePlan(plan.id, { category: cat })}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                        plan.category === cat ? "bg-[#FF6B00] text-white" : "bg-gray-100 dark:bg-gray-700 text-[#6B7280] dark:text-[#9CA3AF]"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-3">
                <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1 block">Perks</label>
                <div className="space-y-1.5 mb-2">
                  {plan.perks.map((perk) => (
                    <div key={perk} className="flex items-center gap-2 bg-[#F8F9FA] dark:bg-[#0F172A] rounded-lg px-3 py-1.5">
                      <span className="flex-1 text-xs text-[#1A1A2E] dark:text-[#E5E7EB]">{perk}</span>
                      <button onClick={() => handleRemovePerk(plan.id, perk)}>
                        <X className="w-3.5 h-3.5 text-[#DC2626]" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newPerkText[plan.id]}
                    onChange={(e) => setNewPerkText({ ...newPerkText, [plan.id]: e.target.value })}
                    onKeyDown={(e) => e.key === "Enter" && handleAddPerk(plan.id)}
                    placeholder="Add a perk..."
                    className="flex-1 bg-[#F8F9FA] dark:bg-[#0F172A] rounded-lg px-3 py-1.5 text-xs outline-none border border-gray-100 dark:border-gray-700 focus:border-[#FF6B00] text-[#1A1A2E] dark:text-[#E5E7EB]"
                  />
                  <button
                    onClick={() => handleAddPerk(plan.id)}
                    className="w-8 h-8 rounded-lg bg-[#E8F5E8] dark:bg-[#1A2D1A] flex items-center justify-center flex-shrink-0"
                  >
                    <Plus className="w-4 h-4 text-[#138808]" />
                  </button>
                </div>
              </div>

              <button
                onClick={() => flashSaved(plan.id)}
                className="w-full flex items-center justify-center gap-2 bg-[#1A1A2E] dark:bg-[#334155] text-white text-sm font-medium py-2.5 rounded-xl hover:opacity-90 transition-opacity"
              >
                <Save className="w-4 h-4" /> {savedId === plan.id ? "Saved" : "Save Plan"}
              </button>
            </div>
          );
        })}
      </div>
    </AdminLayout>
  );
}
