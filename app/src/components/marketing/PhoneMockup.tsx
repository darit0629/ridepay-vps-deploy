import type { ReactNode } from "react";

interface PhoneMockupProps {
  children: ReactNode;
  dark?: boolean;
  // "compact" is a real (not CSS-scaled) small frame for tight spaces like
  // the feature detail popup — scaling the default frame with a transform
  // left its full-size layout box behind, requiring fragile negative-margin
  // compensation that never quite matched across breakpoints.
  size?: "default" | "compact";
}

export default function PhoneMockup({ children, dark, size = "default" }: PhoneMockupProps) {
  if (size === "compact") {
    return (
      <div className="w-[104px] rounded-[1.1rem] bg-[#1A1A2E] p-1 shadow-[0_16px_40px_rgba(0,0,0,0.35)] border border-white/10 flex-shrink-0">
        <div className={`rounded-lg overflow-hidden h-[208px] relative ${dark ? "bg-[#0F172A]" : "bg-[#F8F9FA]"}`}>
          <div className="absolute top-0 inset-x-0 h-2.5 flex items-center justify-center z-20">
            <div className="w-7 h-1.5 bg-[#1A1A2E] rounded-b-md" />
          </div>
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className="w-[250px] sm:w-[270px] rounded-[2.5rem] bg-[#1A1A2E] p-2.5 shadow-[0_30px_80px_rgba(0,0,0,0.35)] border border-white/10 flex-shrink-0">
      <div className={`rounded-[2rem] overflow-hidden h-[500px] sm:h-[540px] relative ${dark ? "bg-[#0F172A]" : "bg-[#F8F9FA]"}`}>
        <div className="absolute top-0 inset-x-0 h-6 flex items-center justify-center z-20">
          <div className="w-24 h-4 bg-[#1A1A2E] rounded-b-2xl" />
        </div>
        {children}
      </div>
    </div>
  );
}
