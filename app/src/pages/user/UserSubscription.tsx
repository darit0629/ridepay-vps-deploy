import { useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Check, Crown, Sparkles, Building2, ShieldCheck, Zap, Clock, X } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import Reveal from "@/components/Reveal";
import { useSubscriptionPlans } from "@/contexts/SubscriptionPlansContext";
import { useAuth } from "@/hooks/useAuth";
import { trpc } from "@/providers/trpc";
import type { PlanId, SubscriptionPlan } from "@/lib/mockSubscriptionPlans";

const planStyle: Record<PlanId, { color: string; bg: string; icon: typeof Crown }> = {
  free: { color: "#6B7280", bg: "#F3F4F6", icon: ShieldCheck },
  silver: { color: "#6B7280", bg: "#F3F4F6", icon: Sparkles },
  gold: { color: "#CA8A04", bg: "#FEF9C3", icon: Crown },
  corporate: { color: "#1E3A5F", bg: "#E8EEF5", icon: Building2 },
};

function formatPrice(plan: SubscriptionPlan) {
  return plan.price === null ? "Custom" : `₹${plan.price}`;
}

export default function UserSubscription() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { plans } = useSubscriptionPlans();
  const utils = trpc.useUtils();
  const { data: myPlanId } = trpc.plans.getMyPlan.useQuery(undefined, { enabled: !!user });
  const setMyPlanMutation = trpc.plans.setMyPlan.useMutation({
    onSuccess: () => utils.plans.getMyPlan.invalidate(),
  });
  const currentPlan = (myPlanId ?? "free") as PlanId;
  const [showConfirm, setShowConfirm] = useState<SubscriptionPlan | null>(null);

  const activePlans = plans.filter((p) => p.active);

  const handleConfirm = () => {
    if (showConfirm) setMyPlanMutation.mutate({ planId: showConfirm.id });
    setShowConfirm(null);
  };

  const utilsCorp = trpc.useUtils();
  const { data: corporateMembership } = trpc.corporate.getMine.useQuery(undefined, { enabled: !!user });
  const applyCorporateMutation = trpc.corporate.applyCorporate.useMutation({
    onSuccess: () => utilsCorp.corporate.getMine.invalidate(),
  });
  const [showCorporateForm, setShowCorporateForm] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [gstin, setGstin] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  const handleApplyCorporate = () => {
    if (!companyName.trim() || !contactPerson.trim() || !contactPhone.trim()) return;
    applyCorporateMutation.mutate(
      { companyName: companyName.trim(), gstin: gstin.trim() || undefined, contactPerson: contactPerson.trim(), contactPhone: contactPhone.trim() },
      { onSuccess: () => setShowCorporateForm(false) }
    );
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0F172A] pb-20">
      {/* Header */}
      <div className="bg-gradient-to-b from-[#1A1A2E] to-[#2D2D4A] px-4 pt-4 pb-8 animate-fade-slide">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => navigate("/user/profile")}>
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
          <h1 className="text-white font-semibold">Flying Plus</h1>
          <div className="w-6" />
        </div>
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mb-3">
            <Zap className="w-8 h-8 text-[#FFD700]" />
          </div>
          <h2 className="text-white font-bold text-xl">Flying Plus Membership</h2>
          <p className="text-white/70 text-sm mt-1">Save more on every ride</p>
        </div>
      </div>

      <div className="px-4 -mt-4 space-y-3">
        {activePlans.map((plan, i) => {
          const isCurrent = plan.id === currentPlan;
          const style = planStyle[plan.id];
          return (
          <Reveal key={plan.id} delay={i * 60}>
            <div className={`bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4 ${isCurrent ? "ring-2 ring-[#FF6B00]" : ""}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full flex items-center justify-center" style={{ backgroundColor: style.bg }}>
                    <style.icon className="w-5 h-5" style={{ color: style.color }} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">{plan.name}</h3>
                    <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">
                      <span className="font-bold text-[#1A1A2E] dark:text-[#E5E7EB]">{formatPrice(plan)}</span> {plan.period}
                    </p>
                  </div>
                </div>
                {isCurrent && (
                  <span className="text-[10px] font-semibold text-[#FF6B00] bg-[#FFF5EB] dark:bg-[#3A2A1A] px-2 py-1 rounded-full">
                    CURRENT
                  </span>
                )}
              </div>

              <div className="space-y-1.5 mb-4">
                {plan.perks.map((perk) => (
                  <div key={perk} className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-[#138808] flex-shrink-0" />
                    <span className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">{perk}</span>
                  </div>
                ))}
              </div>

              {plan.id === "corporate" ? (
                corporateMembership?.status === "active" ? (
                  <button
                    onClick={() => navigate("/user/corporate")}
                    className="w-full bg-[#138808] text-white font-medium py-2.5 rounded-xl text-sm"
                  >
                    View Corporate Account
                  </button>
                ) : corporateMembership?.status === "pending" ? (
                  <button disabled className="w-full flex items-center justify-center gap-1.5 bg-[#FFF5EB] dark:bg-[#3A2A1A] text-[#FF6B00] font-medium py-2.5 rounded-xl text-sm">
                    <Clock className="w-3.5 h-3.5" /> Application Pending Review
                  </button>
                ) : (
                  <button
                    onClick={() => setShowCorporateForm(true)}
                    className="w-full bg-[#1E3A5F] text-white font-medium py-2.5 rounded-xl text-sm hover:bg-[#2C5282] transition-colors"
                  >
                    {corporateMembership?.status === "rejected" ? "Re-apply for Corporate Account" : "Apply for Corporate Account"}
                  </button>
                )
              ) : isCurrent ? (
                <button disabled className="w-full bg-gray-100 dark:bg-gray-800 text-[#9CA3AF] dark:text-[#64748B] font-medium py-2.5 rounded-xl text-sm">
                  Current Plan
                </button>
              ) : (
                <button
                  onClick={() => setShowConfirm(plan)}
                  className="w-full bg-[#FF6B00] text-white font-medium py-2.5 rounded-xl text-sm hover:bg-[#E65A00] transition-colors"
                >
                  {plan.id === "free" ? "Switch to Free" : "Upgrade"}
                </button>
              )}
            </div>
          </Reveal>
          );
        })}
      </div>

      {/* Confirm Sheet */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-end" onClick={() => setShowConfirm(null)}>
          <div className="bg-white dark:bg-[#1E293B] rounded-t-3xl w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-1 bg-gray-200 dark:bg-gray-600 rounded-full mx-auto mb-4" />
            <h2 className="font-bold text-lg text-[#1A1A2E] dark:text-[#E5E7EB] mb-1">
              {showConfirm.id === "free" ? "Switch to Free plan?" : `Upgrade to ${showConfirm.name}`}
            </h2>
            <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] mb-4">
              {showConfirm.id === "free"
                ? "You'll lose your current membership perks at the end of this billing cycle."
                : `${formatPrice(showConfirm)} ${showConfirm.period} - billed to your default payment method.`}
            </p>
            <button onClick={handleConfirm} className="w-full btn-saffron py-4 text-lg">
              Confirm
            </button>
          </div>
        </div>
      )}

      {/* Corporate Application Sheet */}
      {showCorporateForm && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-end" onClick={() => setShowCorporateForm(false)}>
          <div className="bg-white dark:bg-[#1E293B] rounded-t-3xl w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-bold text-lg text-[#1A1A2E] dark:text-[#E5E7EB]">Apply for Corporate Account</h2>
              <button onClick={() => setShowCorporateForm(false)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full">
                <X className="w-5 h-5 text-[#6B7280] dark:text-[#9CA3AF]" />
              </button>
            </div>
            <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] mb-4">Our team will review and get back to you.</p>
            <div className="space-y-3">
              <input
                value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Company name"
                className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-4 py-3 text-sm outline-none border border-gray-200 dark:border-gray-700 text-[#1A1A2E] dark:text-[#E5E7EB]"
              />
              <input
                value={gstin} onChange={(e) => setGstin(e.target.value)} placeholder="GSTIN (optional)"
                className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-4 py-3 text-sm outline-none border border-gray-200 dark:border-gray-700 text-[#1A1A2E] dark:text-[#E5E7EB]"
              />
              <input
                value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} placeholder="Contact person"
                className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-4 py-3 text-sm outline-none border border-gray-200 dark:border-gray-700 text-[#1A1A2E] dark:text-[#E5E7EB]"
              />
              <input
                value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="Contact phone"
                className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-4 py-3 text-sm outline-none border border-gray-200 dark:border-gray-700 text-[#1A1A2E] dark:text-[#E5E7EB]"
              />
            </div>
            <button
              onClick={handleApplyCorporate}
              disabled={!companyName.trim() || !contactPerson.trim() || !contactPhone.trim() || applyCorporateMutation.isPending}
              className="w-full btn-saffron py-3.5 mt-4 disabled:opacity-50"
            >
              {applyCorporateMutation.isPending ? "Submitting..." : "Submit Application"}
            </button>
          </div>
        </div>
      )}

      <BottomNav role="user" />
    </div>
  );
}
