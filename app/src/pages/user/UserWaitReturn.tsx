import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, IndianRupee, Car, Bike, CircleDot, Zap, Hourglass } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import LocationPickerModal from "@/components/LocationPickerModal";
import { trpc } from "@/providers/trpc";
import { hasGoogleMapsKey, loadGoogleMaps } from "@/lib/googleMaps";
import { fetchGoogleRoute } from "@/lib/googleDirections";

const RANAGHAT_COORDS = { lat: 22.69, lng: 88.37 };

type VehicleType = "e-riksha" | "auto-rickshaw" | "car" | "bike";

const VEHICLE_OPTIONS: { id: VehicleType; label: string; icon: typeof Car }[] = [
  { id: "e-riksha", label: "E-Riksha", icon: Zap },
  { id: "auto-rickshaw", label: "Auto", icon: CircleDot },
  { id: "car", label: "Car", icon: Car },
  { id: "bike", label: "Bike", icon: Bike },
];

interface Point {
  address: string;
  lat: number;
  lng: number;
}

export default function UserWaitReturn() {
  const navigate = useNavigate();
  const [pickup, setPickup] = useState<Point | null>(null);
  const [drop, setDrop] = useState<Point | null>(null);
  const [pickerTarget, setPickerTarget] = useState<"pickup" | "drop" | null>(null);
  const [vehicleType, setVehicleType] = useState<VehicleType>("e-riksha");
  const [routeInfo, setRouteInfo] = useState<{ distanceKm: number; durationMin: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!pickup || !drop || !hasGoogleMapsKey) return;
    let cancelled = false;
    (async () => {
      await loadGoogleMaps();
      const route = await fetchGoogleRoute(pickup, drop);
      if (!cancelled && route) setRouteInfo({ distanceKm: route.distanceKm, durationMin: route.durationMin });
    })();
    return () => { cancelled = true; };
  }, [pickup, drop]);

  const { data: fare } = trpc.fare.calculateFare.useQuery(
    {
      vehicleType, segment: "reserve",
      distanceKm: routeInfo?.distanceKm ?? 0, durationMin: routeInfo?.durationMin ?? 0,
      isRoundTrip: true, aiMultiplier: 1,
    },
    { enabled: !!routeInfo }
  );

  const bookMutation = trpc.ride.book.useMutation();
  const canSubmit = !!pickup && !!drop && !!routeInfo;

  const handleBook = async () => {
    if (!pickup || !drop) return;
    setError(null);
    try {
      await bookMutation.mutateAsync({
        pickupLat: String(pickup.lat), pickupLng: String(pickup.lng), pickupAddress: pickup.address,
        dropLat: String(drop.lat), dropLng: String(drop.lng), dropAddress: drop.address,
        vehicleType, segment: "reserve", aiMultiplier: 1,
        isWaitAndReturn: true,
      });
      navigate("/user/home");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't book Wait & Return. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0F172A] pb-24">
      <div className="bg-white dark:bg-[#1E293B] px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate("/user/services")} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full">
          <ArrowLeft className="w-5 h-5 text-[#1A1A2E] dark:text-[#E5E7EB]" />
        </button>
        <h1 className="font-bold text-lg text-[#1A1A2E] dark:text-[#E5E7EB]">Wait & Return</h1>
      </div>

      <div className="px-4 py-4 space-y-4">
        <div className="flex items-start gap-3 bg-[#FFF5EB] dark:bg-[#3A2A1A] rounded-2xl p-4">
          <Hourglass className="w-5 h-5 text-[#FF6B00] flex-shrink-0 mt-0.5" />
          <p className="text-xs text-[#7A4A1A] dark:text-[#FFC98A]">
            Your driver waits for you at the destination and brings you back — same driver, one booking.
            Waiting is billed per minute after a short free window, added to your fare when the trip ends.
          </p>
        </div>

        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4">
          <h2 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] mb-3">Where to?</h2>
          <div className="space-y-3">
            <button onClick={() => setPickerTarget("pickup")} className="w-full flex items-center gap-3 text-left">
              <div className="w-3 h-3 rounded-full bg-[#138808] flex-shrink-0" />
              <span className={`flex-1 text-sm border-b border-gray-100 dark:border-gray-700 pb-2 truncate ${pickup ? "text-[#1A1A2E] dark:text-[#E5E7EB]" : "text-[#9CA3AF]"}`}>
                {pickup?.address || "Pickup location"}
              </span>
            </button>
            <button onClick={() => setPickerTarget("drop")} className="w-full flex items-center gap-3 text-left">
              <div className="w-3 h-3 rounded-full bg-[#FF6B00] flex-shrink-0" />
              <span className={`flex-1 text-sm border-b border-gray-100 dark:border-gray-700 pb-2 truncate ${drop ? "text-[#1A1A2E] dark:text-[#E5E7EB]" : "text-[#9CA3AF]"}`}>
                {drop?.address || "Destination — where your driver will wait"}
              </span>
            </button>
          </div>

          <div className="mt-4">
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-2">Vehicle</p>
            <div className="grid grid-cols-4 gap-2">
              {VEHICLE_OPTIONS.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setVehicleType(v.id)}
                  className={`flex flex-col items-center gap-1 py-2 rounded-lg text-[11px] font-medium transition-colors ${
                    vehicleType === v.id ? "bg-[#FF6B00] text-white" : "bg-gray-100 dark:bg-gray-800 text-[#6B7280] dark:text-[#9CA3AF]"
                  }`}
                >
                  <v.icon className="w-4 h-4" /> {v.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {routeInfo && fare && (
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">Estimated fare so far</span>
              <span className="flex items-center font-bold text-lg text-[#1A1A2E] dark:text-[#E5E7EB]">
                <IndianRupee className="w-4 h-4" />{fare.total}
              </span>
            </div>
            <p className="text-[11px] text-[#9CA3AF] dark:text-[#64748B]">
              {routeInfo.distanceKm.toFixed(1)} km one-way · final fare includes waiting time + the return leg
            </p>
          </div>
        )}

        {error && <p className="text-sm text-[#DC2626] text-center">{error}</p>}

        <button
          onClick={handleBook}
          disabled={!canSubmit || bookMutation.isPending}
          className="w-full btn-saffron py-3.5 disabled:opacity-50"
        >
          {bookMutation.isPending ? "Booking..." : "Book Wait & Return"}
        </button>
      </div>

      {pickerTarget && (
        <LocationPickerModal
          open
          title={pickerTarget === "pickup" ? "Set Pickup Location" : "Set Destination"}
          initialCoords={RANAGHAT_COORDS}
          onConfirm={({ address, lat, lng }) => {
            if (pickerTarget === "pickup") setPickup({ address, lat, lng });
            else setDrop({ address, lat, lng });
            setRouteInfo(null);
            setPickerTarget(null);
          }}
          onClose={() => setPickerTarget(null)}
        />
      )}

      <BottomNav role="user" />
    </div>
  );
}
