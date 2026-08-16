import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Clock, Phone, MessageCircle, ShieldAlert, IndianRupee, Hourglass } from "lucide-react";
import { trpc } from "@/providers/trpc";

function formatElapsed(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function DriverWaiting() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const rideId = Number(searchParams.get("rideId"));

  const { data: ride } = trpc.ride.getById.useQuery(
    { id: rideId },
    { enabled: Number.isFinite(rideId) && rideId > 0, refetchInterval: 3000, refetchIntervalInBackground: true }
  );
  const { data: vehicleConfigs } = trpc.fare.listVehicleFareConfigs.useQuery();

  // The rider started the return trip elsewhere (or the driver reloaded
  // mid-return) — either way, this screen's job is done.
  useEffect(() => {
    if (!ride) return;
    if (ride.status === "ongoing") navigate(`/driver/ride-dropoff?rideId=${rideId}`);
    else if (ride.status !== "waiting") navigate("/driver/dashboard");
  }, [ride, rideId, navigate]);

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const waitStartedAt = ride?.waitStartedAt ? new Date(ride.waitStartedAt).getTime() : null;
  const elapsedMs = waitStartedAt ? now - waitStartedAt : 0;
  const elapsedMin = Math.floor(elapsedMs / 60000);

  const vehicleConfig = vehicleConfigs?.find((v) => v.id === ride?.fareVehicleType);
  const chargeableMin = vehicleConfig ? Math.max(0, elapsedMin - vehicleConfig.freeWaitingMin) : 0;
  const estimatedWaitCharge = vehicleConfig ? chargeableMin * vehicleConfig.waitingChargePerMin : 0;

  const passenger = { name: ride?.riderName || "Rider", phone: ride?.riderPhone || "" };

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0F172A] flex flex-col">
      <div className="bg-[#1E3A5F] px-4 pt-4 pb-8 text-center">
        <div className="w-14 h-14 rounded-full bg-white/15 flex items-center justify-center mx-auto mb-3">
          <Hourglass className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-white font-bold text-lg">Waiting for {passenger.name}</h1>
        <p className="text-white/70 text-sm mt-1">They'll start the return trip when ready</p>
      </div>

      <div className="flex-1 px-4 -mt-4 space-y-4">
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-6 text-center">
          <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1 flex items-center justify-center gap-1">
            <Clock className="w-3.5 h-3.5" /> Time waiting
          </p>
          <p className="text-4xl font-bold text-[#1A1A2E] dark:text-[#E5E7EB] tabular-nums">{formatElapsed(elapsedMs)}</p>
          {vehicleConfig && (
            <p className="text-xs text-[#9CA3AF] dark:text-[#64748B] mt-2">
              First {vehicleConfig.freeWaitingMin} min free, then ₹{vehicleConfig.waitingChargePerMin}/min
            </p>
          )}
        </div>

        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4 flex items-center justify-between">
          <span className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">Estimated waiting charge so far</span>
          <span className="flex items-center font-bold text-lg text-[#1A1A2E] dark:text-[#E5E7EB]">
            <IndianRupee className="w-4 h-4" />{estimatedWaitCharge}
          </span>
        </div>

        <div className="flex items-center gap-3 bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4">
          <img src="/assets/user-avatar.png" alt={passenger.name} className="w-11 h-11 rounded-full object-cover flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB] truncate">{passenger.name}</p>
            <p className="text-xs text-[#9CA3AF]">Waiting at {ride?.dropAddress}</p>
          </div>
          <a href={`tel:${passenger.phone.replace(/\s/g, "")}`} className="w-9 h-9 rounded-full bg-[#E8F5E8] dark:bg-[#1A3A22] flex items-center justify-center flex-shrink-0" aria-label="Call">
            <Phone className="w-4 h-4 text-[#138808]" />
          </a>
          <a href={`sms:${passenger.phone.replace(/\s/g, "")}`} className="w-9 h-9 rounded-full bg-[#E0F2FE] dark:bg-[#0C2536] flex items-center justify-center flex-shrink-0" aria-label="Message">
            <MessageCircle className="w-4 h-4 text-[#0EA5E9]" />
          </a>
          <a href="tel:100" className="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0" aria-label="Emergency">
            <ShieldAlert className="w-4 h-4 text-[#DC2626]" />
          </a>
        </div>
      </div>

      <div className="p-4 text-center text-xs text-[#9CA3AF] dark:text-[#64748B]">
        This screen updates automatically the moment they're ready.
      </div>
    </div>
  );
}
