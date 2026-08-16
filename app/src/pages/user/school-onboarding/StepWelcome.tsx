import { ShieldCheck, MapPin, Bell, Headset } from "lucide-react";

const BENEFITS = [
  { icon: ShieldCheck, label: "Verified drivers", detail: "Background-checked and approved before assignment" },
  { icon: MapPin, label: "Live tracking", detail: "See the vehicle on the map every morning and afternoon" },
  { icon: Bell, label: "Pickup & drop alerts", detail: "Know the moment your child is picked up or dropped" },
  { icon: Headset, label: "Emergency support", detail: "One-tap SOS reaches support and emergency contacts" },
];

export default function StepWelcome({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex flex-col min-h-[calc(100vh-3rem)]">
      <div className="flex-1 flex flex-col items-center text-center pt-6">
        <div className="w-20 h-20 rounded-[28px] bg-gradient-to-br from-[#FF6B00] to-[#FF8A3D] flex items-center justify-center shadow-lg mb-6">
          <img src="/assets/logo-light.png" alt="Ridepay" className="w-11 h-11 object-contain" />
        </div>
        <h1 className="text-2xl font-bold text-[#1A1A2E] dark:text-[#E5E7EB] leading-tight mb-2">School Ride Subscription</h1>
        <p className="text-[#6B7280] dark:text-[#9CA3AF] text-sm mb-10 max-w-xs">
          Safe, tracked daily school transport with a dedicated driver — set up in a few quick steps.
        </p>

        <div className="w-full space-y-3">
          {BENEFITS.map(({ icon: Icon, label, detail }) => (
            <div key={label} className="flex items-center gap-4 bg-white dark:bg-[#1E293B] shadow-sm rounded-[24px] p-4 text-left">
              <div className="w-11 h-11 rounded-2xl bg-[#FFF5EB] dark:bg-[#3D2914] flex items-center justify-center flex-shrink-0">
                <Icon className="w-5 h-5 text-[#FF6B00]" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm text-[#1A1A2E] dark:text-[#E5E7EB]">{label}</p>
                <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">{detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={onStart}
        className="w-full bg-gradient-to-r from-[#FF6B00] to-[#FF8A3D] text-white font-semibold py-4 rounded-2xl shadow-lg active:scale-[0.98] transition-transform mt-8"
      >
        Get Started
      </button>
    </div>
  );
}
