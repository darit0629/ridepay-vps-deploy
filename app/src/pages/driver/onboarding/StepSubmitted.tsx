import { Check, Clock, ShieldCheck, Car } from "lucide-react";

const TIMELINE = [
  { icon: Check, label: "Documents Uploaded", done: true },
  { icon: Clock, label: "Under Verification", done: false, active: true },
  { icon: ShieldCheck, label: "Account Approval", done: false },
  { icon: Car, label: "Ready to Drive", done: false },
];

export default function StepSubmitted({ onGoToDashboard }: { onGoToDashboard: () => void }) {
  return (
    <div className="flex flex-col items-center text-center pt-8">
      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#138808] to-[#1AA814] flex items-center justify-center mb-5 shadow-[0_12px_32px_rgba(19,136,8,0.4)]">
        <span className="text-4xl">🎉</span>
      </div>
      <h1 className="text-2xl font-bold mb-1">Registration Submitted Successfully</h1>
      <p className="text-white/60 text-sm mb-8 max-w-xs">
        Our team is reviewing your details. We'll notify you the moment you're approved.
      </p>

      <div className="w-full bg-white/5 backdrop-blur-xl border border-white/10 rounded-[24px] p-5 mb-4">
        {TIMELINE.map((step, i) => (
          <div key={step.label} className="flex items-center gap-3">
            <div className="flex flex-col items-center">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                  step.done ? "bg-[#138808]" : step.active ? "bg-[#FF6B00]" : "bg-white/10"
                }`}
              >
                <step.icon className={`w-4.5 h-4.5 ${step.done || step.active ? "text-white" : "text-white/40"}`} />
              </div>
              {i < TIMELINE.length - 1 && <div className={`w-0.5 h-8 ${step.done ? "bg-[#138808]" : "bg-white/10"}`} />}
            </div>
            <p className={`text-sm font-medium pb-8 ${step.done || step.active ? "text-white" : "text-white/40"}`}>{step.label}</p>
          </div>
        ))}
      </div>

      <div className="w-full bg-[#FF6B00]/10 border border-[#FF6B00]/25 rounded-2xl p-4 mb-8">
        <p className="text-xs text-white/60 mb-1">Estimated Approval Time</p>
        <p className="text-lg font-bold text-[#FF6B00]">12–24 Hours</p>
      </div>

      <button
        onClick={onGoToDashboard}
        className="w-full bg-gradient-to-r from-[#FF6B00] to-[#FF8A3D] text-white font-semibold py-4 rounded-2xl shadow-[0_8px_24px_rgba(255,107,0,0.35)] active:scale-[0.98] transition-transform"
      >
        Go to Dashboard
      </button>
    </div>
  );
}
