import { useNavigate } from "react-router";
import { Rocket, Play, Smartphone } from "lucide-react";
import CountdownBlock from "@/components/marketing/CountdownBlock";
import Hero3DVehicle from "@/components/Hero3DVehicle";
import { useCountdown } from "@/hooks/useCountdown";

const LAUNCH_DATE = new Date("2026-08-15T00:00:00+05:30");

export default function ComingSoon() {
  const navigate = useNavigate();
  const countdown = useCountdown(LAUNCH_DATE);

  return (
    <div className="min-h-screen bg-[#0B1220] relative overflow-hidden flex flex-col">
      <div className="absolute -top-24 -left-20 w-[26rem] h-[26rem] rounded-full bg-[#FF6B00]/20 blur-[110px] animate-blob pointer-events-none" />
      <div className="absolute -bottom-32 -right-16 w-[28rem] h-[28rem] rounded-full bg-[#138808]/20 blur-[120px] animate-blob pointer-events-none" style={{ animationDelay: "4s" }} />
      <div
        className="absolute inset-0 opacity-[0.15] pointer-events-none"
        style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.4) 1px, transparent 1px)", backgroundSize: "26px 26px" }}
      />

      <div className="relative z-10 px-6 py-5 flex items-center justify-between">
        <button onClick={() => navigate("/")} className="flex items-center gap-2">
          <img src="/assets/logo-light.png" alt="Ridepay" className="w-7 h-7 object-contain" />
          <span className="brand-font font-bold text-base text-white">Ridepay</span>
        </button>
      </div>

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-6 py-10">
        <span className="inline-flex items-center gap-1.5 bg-white/10 border border-white/15 backdrop-blur-sm text-white text-[11px] font-semibold px-3 py-1.5 rounded-full mb-6">
          <Rocket className="w-3 h-3 text-[#FF8533]" /> Launching 15 August — Independence Day
        </span>

        <h1 className="text-white text-3xl sm:text-4xl font-extrabold mb-3 max-w-lg">We're Almost There</h1>
        <p className="text-white/70 text-sm max-w-sm mb-8">
          Ridepay is putting the finishing touches on Ranaghat's smartest ride, parcel and school transport app. Downloads open on 15th August.
        </p>

        <Hero3DVehicle className="w-48 sm:w-56 mb-4" />

        {countdown.done ? (
          <p className="text-white font-semibold text-base mb-8">We're live — head to the app!</p>
        ) : (
          <div className="flex items-center gap-2.5 mb-9">
            <CountdownBlock value={countdown.days} label="Days" />
            <span className="text-white/40 text-lg pb-4">:</span>
            <CountdownBlock value={countdown.hours} label="Hrs" />
            <span className="text-white/40 text-lg pb-4">:</span>
            <CountdownBlock value={countdown.minutes} label="Min" />
            <span className="text-white/40 text-lg pb-4">:</span>
            <CountdownBlock value={countdown.seconds} label="Sec" />
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="p-[1.5px] rounded-xl bg-[linear-gradient(90deg,#FBBF24,#34D399,#38BDF8,#A78BFA,#FB7185)]">
            <div className="flex items-center gap-2.5 bg-[#0B0B0F] text-white px-4 py-2.5 rounded-[10px]">
              <Play className="w-4 h-4 text-[#34D399] fill-[#34D399] flex-shrink-0" />
              <div className="text-left leading-tight">
                <p className="text-[8px] uppercase tracking-wide text-white/60">Soon available on</p>
                <p className="text-xs font-extrabold">Play Store</p>
              </div>
            </div>
          </div>
          <div className="p-[1.5px] rounded-xl bg-[linear-gradient(90deg,#FBBF24,#34D399,#38BDF8,#A78BFA,#FB7185)]">
            <div className="flex items-center gap-2.5 bg-[#0B0B0F] text-white px-4 py-2.5 rounded-[10px]">
              <Smartphone className="w-4 h-4 text-white flex-shrink-0" />
              <div className="text-left leading-tight">
                <p className="text-[8px] uppercase tracking-wide text-white/60">Soon available on</p>
                <p className="text-xs font-extrabold">App Store</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
