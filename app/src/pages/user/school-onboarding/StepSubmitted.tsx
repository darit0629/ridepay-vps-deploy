import { Check, Clock, ShieldCheck, Car } from "lucide-react";

const TIMELINE = [
  { icon: Check, label: "Details Submitted", done: true },
  { icon: Clock, label: "Under Verification", done: false, active: true },
  { icon: ShieldCheck, label: "Driver Assignment", done: false },
  { icon: Car, label: "Ready to Ride", done: false },
];

export default function StepSubmitted({ onGoToDashboard }: { onGoToDashboard: () => void }) {
  return (
    <div className="flex flex-col items-center text-center pt-6">
      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#138808] to-[#1AA814] flex items-center justify-center mb-5 shadow-lg">
        <span className="text-4xl">🎉</span>
      </div>
      <h1 className="text-2xl font-bold text-[#1A1A2E] dark:text-[#E5E7EB] mb-1">Request Submitted</h1>
      <p className="text-[#6B7280] dark:text-[#9CA3AF] text-sm mb-8 max-w-xs">
        Our team is reviewing your details. We'll notify you the moment your child is approved and a driver is assigned.
      </p>

      <div className="w-full bg-white dark:bg-[#1E293B] shadow-sm rounded-[24px] p-5 mb-8">
        {TIMELINE.map((step, i) => (
          <div key={step.label} className="flex items-center gap-3">
            <div className="flex flex-col items-center">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                  step.done ? "bg-[#138808]" : step.active ? "bg-[#FF6B00]" : "bg-gray-100 dark:bg-white/10"
                }`}
              >
                <step.icon className={`w-4.5 h-4.5 ${step.done || step.active ? "text-white" : "text-[#9CA3AF]"}`} />
              </div>
              {i < TIMELINE.length - 1 && <div className={`w-0.5 h-8 ${step.done ? "bg-[#138808]" : "bg-gray-100 dark:bg-white/10"}`} />}
            </div>
            <p className={`text-sm font-medium pb-8 ${step.done || step.active ? "text-[#1A1A2E] dark:text-[#E5E7EB]" : "text-[#9CA3AF]"}`}>{step.label}</p>
          </div>
        ))}
      </div>

      <button
        onClick={onGoToDashboard}
        className="w-full bg-gradient-to-r from-[#FF6B00] to-[#FF8A3D] text-white font-semibold py-4 rounded-2xl shadow-lg active:scale-[0.98] transition-transform"
      >
        Back to School Ride
      </button>
    </div>
  );
}
