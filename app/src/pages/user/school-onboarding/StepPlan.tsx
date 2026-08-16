import { FileText } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { cardCls } from "./onboardingUi";
import type { SchoolOnboardingData } from "./onboardingTypes";

interface Props {
  data: SchoolOnboardingData;
  update: <K extends keyof SchoolOnboardingData>(key: K, value: SchoolOnboardingData[K]) => void;
}

export default function StepPlan({ data, update }: Props) {
  const { data: plans } = trpc.school.listPlans.useQuery();

  return (
    <div className="space-y-4">
      <div className={cardCls}>
        <h2 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] flex items-center gap-2">
          <FileText className="w-4 h-4 text-[#138808]" /> Choose a Plan
        </h2>
        <div className="space-y-2">
          {(plans ?? []).filter((p) => p.active).map((plan) => (
            <button
              key={plan.id}
              onClick={() => update("planId", plan.id)}
              className={`w-full text-left flex items-center justify-between p-3 rounded-xl border-2 transition-colors ${
                data.planId === plan.id ? "border-[#FF6B00] bg-[#FFF5EB] dark:bg-[#3D2914]" : "border-transparent bg-[#F8F9FA] dark:bg-[#0F172A]"
              }`}
            >
              <div>
                <p className="text-sm font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">{plan.name}</p>
                <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">{plan.description}</p>
              </div>
              <p className="text-sm font-bold text-[#FF6B00]">₹{plan.pricePerMonth}/mo</p>
            </button>
          ))}
        </div>
        <p className="text-xs text-[#9CA3AF]">Billed monthly via Razorpay — cancel or pause anytime from your School dashboard.</p>
      </div>
    </div>
  );
}
