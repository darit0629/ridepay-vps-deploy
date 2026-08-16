import { Clock, IndianRupee, Gift, Headset } from "lucide-react";

const BENEFITS = [
  { icon: Clock, label: "Flexible working hours", detail: "Drive whenever suits you" },
  { icon: IndianRupee, label: "Weekly/Daily payouts", detail: "Your earnings, on your schedule" },
  { icon: Gift, label: "Bonuses & Incentives", detail: "Earn more during peak hours" },
  { icon: Headset, label: "24×7 Support", detail: "We've got your back, always" },
];

export default function StepWelcome({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex flex-col min-h-[calc(100vh-3rem)]">
      <div className="flex-1 flex flex-col items-center text-center pt-10">
        <div className="w-20 h-20 rounded-[28px] bg-gradient-to-br from-[#FF6B00] to-[#FF8A3D] flex items-center justify-center shadow-[0_12px_32px_rgba(255,107,0,0.4)] mb-6">
          <img src="/assets/logo-light.png" alt="Ridepay" className="w-11 h-11 object-contain" />
        </div>
        <h1 className="text-3xl font-bold leading-tight mb-2">Become a RidePay Captain</h1>
        <p className="text-white/60 text-sm mb-10 max-w-xs">Earn money by driving with RidePay.</p>

        <div className="w-full space-y-3">
          {BENEFITS.map(({ icon: Icon, label, detail }) => (
            <div
              key={label}
              className="flex items-center gap-4 bg-white/5 backdrop-blur-xl border border-white/10 rounded-[24px] p-4 text-left"
            >
              <div className="w-11 h-11 rounded-2xl bg-[#FF6B00]/15 flex items-center justify-center flex-shrink-0">
                <Icon className="w-5 h-5 text-[#FF6B00]" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm">{label}</p>
                <p className="text-xs text-white/50">{detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={onStart}
        className="w-full bg-gradient-to-r from-[#FF6B00] to-[#FF8A3D] text-white font-semibold py-4 rounded-2xl shadow-[0_8px_24px_rgba(255,107,0,0.35)] active:scale-[0.98] transition-transform mt-8"
      >
        Get Started
      </button>
    </div>
  );
}
