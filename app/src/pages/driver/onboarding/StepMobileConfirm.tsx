import { ShieldCheck, Smartphone } from "lucide-react";

// The real OTP verification already happened back on Login.tsx (SMS or
// WhatsApp) — a driver can't reach the onboarding wizard at all without a
// verified session, so re-asking for the code here would just be friction
// for no reason. This step exists to give that verification a visible,
// confidence-building moment in the flow rather than skipping straight past it.
export default function StepMobileConfirm({ phone }: { phone: string }) {
  return (
    <div className="flex flex-col items-center text-center pt-10">
      <div className="relative w-24 h-24 flex items-center justify-center mb-6">
        <div className="absolute inset-0 rounded-full bg-[#138808]/15 animate-pulse" />
        <div className="w-16 h-16 rounded-full bg-[#138808] flex items-center justify-center">
          <ShieldCheck className="w-8 h-8 text-white" />
        </div>
      </div>
      <h2 className="text-xl font-bold mb-1">Mobile Number Verified</h2>
      <p className="text-white/60 text-sm mb-8">You're already signed in with a verified number.</p>

      <div className="w-full flex items-center gap-3 bg-white/5 backdrop-blur-xl border border-white/10 rounded-[24px] p-4">
        <div className="w-11 h-11 rounded-2xl bg-[#FF6B00]/15 flex items-center justify-center flex-shrink-0">
          <Smartphone className="w-5 h-5 text-[#FF6B00]" />
        </div>
        <div className="min-w-0 text-left flex-1">
          <p className="text-xs text-white/50">Verified number</p>
          <p className="font-semibold">{phone ? `+91 ${phone}` : "—"}</p>
        </div>
        <ShieldCheck className="w-5 h-5 text-[#138808] flex-shrink-0" />
      </div>
    </div>
  );
}
