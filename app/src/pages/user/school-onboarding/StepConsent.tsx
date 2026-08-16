import { CheckCircle2 } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { cardCls } from "./onboardingUi";
import type { SchoolOnboardingData } from "./onboardingTypes";

interface Props {
  data: SchoolOnboardingData;
  update: <K extends keyof SchoolOnboardingData>(key: K, value: SchoolOnboardingData[K]) => void;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">{label}</span>
      <span className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB] text-right">{value}</span>
    </div>
  );
}

export default function StepConsent({ data, update }: Props) {
  const { data: plans } = trpc.school.listPlans.useQuery();
  const plan = (plans ?? []).find((p) => p.id === data.planId);

  return (
    <div className="space-y-4">
      <div className={cardCls}>
        <h2 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">Review</h2>
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          <SummaryRow label="Child" value={data.studentName} />
          <SummaryRow label="School" value={data.schoolName} />
          <SummaryRow label="Morning Pickup" value={data.morningPickupTime} />
          <SummaryRow label="Afternoon Drop" value={data.returnPickupTime} />
          <SummaryRow label="Days" value="Monday – Friday" />
          <SummaryRow label="Plan" value={plan ? `${plan.name} · ₹${plan.pricePerMonth}/mo` : "—"} />
        </div>
      </div>

      <button
        onClick={() => update("consentAccepted", !data.consentAccepted)}
        className="w-full flex items-center gap-3 bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4"
      >
        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${data.consentAccepted ? "bg-[#138808] border-[#138808]" : "border-gray-300 dark:border-gray-600"}`}>
          {data.consentAccepted && <CheckCircle2 className="w-4 h-4 text-white" />}
        </div>
        <p className="text-sm text-[#1A1A2E] dark:text-[#E5E7EB] text-left">
          I consent to Ridepay verifying the above details and providing school transport for my child.
        </p>
      </button>
    </div>
  );
}
