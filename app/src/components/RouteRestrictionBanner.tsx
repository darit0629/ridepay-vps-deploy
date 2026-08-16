import { AlertTriangle, PhoneCall } from "lucide-react";

interface RouteRestrictionBannerProps {
  notice: "rerouted" | "no_alternative" | null;
  role: "rider" | "driver";
  onContactSupport?: () => void;
}

// "rerouted" is informational (an alternative was found and is already
// being used) — callers render this as a transient toast. "no_alternative"
// is the one case that must never be silently swallowed, so this component
// itself renders it as a persistent, non-dismissing banner for as long as
// the notice is set on the ride.
export default function RouteRestrictionBanner({ notice, role, onContactSupport }: RouteRestrictionBannerProps) {
  if (!notice) return null;

  if (notice === "rerouted") {
    return (
      <div className="flex items-center gap-2 bg-[#FFF5EB] dark:bg-[#3A2A1A] border border-[#FF6B00]/30 rounded-xl px-3 py-2.5">
        <AlertTriangle className="w-4 h-4 text-[#FF6B00] flex-shrink-0" />
        <p className="text-xs font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">
          {role === "driver"
            ? "Route Updated — road ahead is currently blocked, we've found an alternative route."
            : "Route Changed — your driver is taking an alternative route."}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-[#FEE2E2] dark:bg-[#3A1414] border border-[#DC2626]/40 rounded-xl px-3 py-3 space-y-2">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-[#DC2626] flex-shrink-0" />
        <p className="text-xs font-semibold text-[#DC2626]">No Alternative Route</p>
      </div>
      <p className="text-xs text-[#1A1A2E] dark:text-[#E5E7EB]">
        The road ahead is blocked and we couldn't find another way. Please contact support.
      </p>
      {onContactSupport && (
        <button
          onClick={onContactSupport}
          className="flex items-center gap-1.5 bg-[#DC2626] text-white text-xs font-semibold px-3 py-1.5 rounded-lg"
        >
          <PhoneCall className="w-3.5 h-3.5" /> Contact Support
        </button>
      )}
    </div>
  );
}
