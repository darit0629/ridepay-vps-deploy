import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, IndianRupee, Car, Bike, CircleDot, Zap, Plus, X, GripVertical, Route } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import LocationPickerModal from "@/components/LocationPickerModal";
import { trpc } from "@/providers/trpc";
import { hasGoogleMapsKey, loadGoogleMaps } from "@/lib/googleMaps";
import { fetchGoogleRoute } from "@/lib/googleDirections";

const RANAGHAT_COORDS = { lat: 22.69, lng: 88.37 };
const MAX_STOPS = 3;

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

export default function UserMultiStop() {
  const navigate = useNavigate();
  const [pickup, setPickup] = useState<Point | null>(null);
  const [stops, setStops] = useState<Point[]>([]);
  const [drop, setDrop] = useState<Point | null>(null);
  const [pickerTarget, setPickerTarget] = useState<"pickup" | "drop" | number | null>(null);
  const [vehicleType, setVehicleType] = useState<VehicleType>("e-riksha");
  const [routeInfo, setRouteInfo] = useState<{ distanceKm: number; durationMin: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const allPoints = pickup && drop ? [pickup, ...stops, drop] : null;

  // Real driving distance summed across every leg (pickup→stop1→...→drop),
  // matching how ride-router.ts's book mutation prices a multi-stop ride
  // server-side.
  useEffect(() => {
    if (!allPoints || !hasGoogleMapsKey) return;
    let cancelled = false;
    (async () => {
      await loadGoogleMaps();
      let totalKm = 0;
      let totalMin = 0;
      for (let i = 0; i < allPoints.length - 1; i++) {
        const leg = await fetchGoogleRoute(allPoints[i], allPoints[i + 1]);
        if (!leg) { totalKm = 0; totalMin = 0; break; }
        totalKm += leg.distanceKm;
        totalMin += leg.durationMin;
      }
      if (!cancelled && totalKm > 0) setRouteInfo({ distanceKm: totalKm, durationMin: totalMin });
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickup, drop, stops.length]);

  const { data: fare } = trpc.fare.calculateFare.useQuery(
    {
      vehicleType, segment: "reserve",
      distanceKm: routeInfo?.distanceKm ?? 0, durationMin: routeInfo?.durationMin ?? 0,
      aiMultiplier: 1,
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
        stops: stops.map((s) => ({ lat: String(s.lat), lng: String(s.lng), address: s.address })),
      });
      navigate("/user/home");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't book the ride. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0F172A] pb-24">
      <div className="bg-white dark:bg-[#1E293B] px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate("/user/services")} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full">
          <ArrowLeft className="w-5 h-5 text-[#1A1A2E] dark:text-[#E5E7EB]" />
        </button>
        <h1 className="font-bold text-lg text-[#1A1A2E] dark:text-[#E5E7EB]">Multi Stop</h1>
      </div>

      <div className="px-4 py-4 space-y-4">
        <div className="flex items-start gap-3 bg-[#FEE2E2] dark:bg-[#3D1414] rounded-2xl p-4">
          <Route className="w-5 h-5 text-[#DC2626] flex-shrink-0 mt-0.5" />
          <p className="text-xs text-[#991B1B] dark:text-[#FCA5A5]">
            Visit up to {MAX_STOPS} places in one ride — the driver waits at each stop and takes you to the next.
          </p>
        </div>

        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4">
          <h2 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] mb-3">Your Route</h2>
          <div className="space-y-3">
            <button onClick={() => setPickerTarget("pickup")} className="w-full flex items-center gap-3 text-left">
              <div className="w-3 h-3 rounded-full bg-[#138808] flex-shrink-0" />
              <span className={`flex-1 text-sm border-b border-gray-100 dark:border-gray-700 pb-2 truncate ${pickup ? "text-[#1A1A2E] dark:text-[#E5E7EB]" : "text-[#9CA3AF]"}`}>
                {pickup?.address || "Pickup location"}
              </span>
            </button>

            {stops.map((stop, i) => (
              <div key={i} className="flex items-center gap-3">
                <GripVertical className="w-3 h-3 text-[#9CA3AF] flex-shrink-0" />
                <button onClick={() => setPickerTarget(i)} className="flex-1 flex items-center gap-3 text-left min-w-0">
                  <div className="w-3 h-3 rounded-full bg-[#0EA5E9] flex-shrink-0" />
                  <span className="flex-1 text-sm border-b border-gray-100 dark:border-gray-700 pb-2 truncate text-[#1A1A2E] dark:text-[#E5E7EB]">
                    {stop.address}
                  </span>
                </button>
                <button onClick={() => setStops((prev) => prev.filter((_, idx) => idx !== i))} className="flex-shrink-0 pb-2" aria-label="Remove stop">
                  <X className="w-4 h-4 text-[#9CA3AF]" />
                </button>
              </div>
            ))}

            <button onClick={() => setPickerTarget("drop")} className="w-full flex items-center gap-3 text-left">
              <div className="w-3 h-3 rounded-full bg-[#FF6B00] flex-shrink-0" />
              <span className={`flex-1 text-sm border-b border-gray-100 dark:border-gray-700 pb-2 truncate ${drop ? "text-[#1A1A2E] dark:text-[#E5E7EB]" : "text-[#9CA3AF]"}`}>
                {drop?.address || "Final destination"}
              </span>
            </button>

            {stops.length < MAX_STOPS && (
              <button
                onClick={() => setPickerTarget(stops.length)}
                className="w-full flex items-center justify-center gap-1.5 text-xs font-medium text-[#0EA5E9] py-2"
              >
                <Plus className="w-3.5 h-3.5" /> Add a stop
              </button>
            )}
          </div>

          <div className="mt-4">
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-2">Vehicle</p>
            <div className="grid grid-cols-4 gap-2">
              {VEHICLE_OPTIONS.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setVehicleType(v.id)}
                  className={`flex flex-col items-center gap-1 py-2 rounded-lg text-[11px] font-medium transition-colors ${
                    vehicleType === v.id ? "bg-[#DC2626] text-white" : "bg-gray-100 dark:bg-gray-800 text-[#6B7280] dark:text-[#9CA3AF]"
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
              <span className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">Estimated fare</span>
              <span className="flex items-center font-bold text-lg text-[#1A1A2E] dark:text-[#E5E7EB]">
                <IndianRupee className="w-4 h-4" />{fare.total}
              </span>
            </div>
            <p className="text-[11px] text-[#9CA3AF] dark:text-[#64748B]">
              {routeInfo.distanceKm.toFixed(1)} km total across {stops.length + 1} leg{stops.length > 0 ? "s" : ""}
            </p>
          </div>
        )}

        {error && <p className="text-sm text-[#DC2626] text-center">{error}</p>}

        <button
          onClick={handleBook}
          disabled={!canSubmit || bookMutation.isPending}
          className="w-full bg-[#DC2626] disabled:opacity-50 text-white font-semibold py-3.5 rounded-xl"
        >
          {bookMutation.isPending ? "Booking..." : "Book Multi Stop Ride"}
        </button>
      </div>

      {pickerTarget !== null && (
        <LocationPickerModal
          open
          title={pickerTarget === "pickup" ? "Set Pickup Location" : pickerTarget === "drop" ? "Set Final Destination" : "Set Stop Location"}
          initialCoords={RANAGHAT_COORDS}
          onConfirm={({ address, lat, lng }) => {
            const point = { address, lat, lng };
            if (pickerTarget === "pickup") setPickup(point);
            else if (pickerTarget === "drop") setDrop(point);
            else {
              setStops((prev) => {
                const next = [...prev];
                next[pickerTarget] = point;
                return next;
              });
            }
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
