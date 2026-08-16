import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, MapPin, Clock, IndianRupee, Car, Bike, CircleDot, Zap, CheckCircle2, CalendarClock } from "lucide-react";
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

function todayDateStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function UserRoundTrip() {
  const navigate = useNavigate();
  const [pickup, setPickup] = useState<Point | null>(null);
  const [drop, setDrop] = useState<Point | null>(null);
  const [pickerTarget, setPickerTarget] = useState<"pickup" | "drop" | null>(null);
  const [vehicleType, setVehicleType] = useState<VehicleType>("e-riksha");
  const [returnDate, setReturnDate] = useState(todayDateStr());
  const [returnTime, setReturnTime] = useState("18:00");
  const [routeInfo, setRouteInfo] = useState<{ distanceKm: number; durationMin: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{ rideId: number; scheduleId: number } | null>(null);
  const [scheduleWarning, setScheduleWarning] = useState<string | null>(null);

  // Real driving distance/time (not haversine) — same source UserHome's own
  // fare sheet uses, so this quote matches what booking will actually charge.
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
      vehicleType,
      segment: "reserve",
      distanceKm: routeInfo?.distanceKm ?? 0,
      durationMin: routeInfo?.durationMin ?? 0,
      isRoundTrip: true,
      aiMultiplier: 1,
    },
    { enabled: !!routeInfo }
  );

  const bookMutation = trpc.ride.book.useMutation();
  const scheduleMutation = trpc.schedule.create.useMutation();

  const canSubmit = !!pickup && !!drop && !!routeInfo;

  const handleBookRoundTrip = async () => {
    if (!pickup || !drop || !routeInfo) return;
    setError(null);
    setScheduleWarning(null);

    const returnAt = new Date(`${returnDate}T${returnTime}:00`);
    if (returnAt.getTime() <= Date.now()) {
      setError("Pick a return time in the future.");
      return;
    }

    const groupId = crypto.randomUUID();
    try {
      const ride = await bookMutation.mutateAsync({
        pickupLat: String(pickup.lat), pickupLng: String(pickup.lng), pickupAddress: pickup.address,
        dropLat: String(drop.lat), dropLng: String(drop.lng), dropAddress: drop.address,
        vehicleType, segment: "reserve", aiMultiplier: 1,
        isRoundTrip: true, roundTripGroupId: groupId,
      });

      try {
        const returnSchedule = await scheduleMutation.mutateAsync({
          label: "Round trip return",
          pickupLat: String(drop.lat), pickupLng: String(drop.lng), pickupAddress: drop.address,
          dropLat: String(pickup.lat), dropLng: String(pickup.lng), dropAddress: pickup.address,
          vehicleType, segment: "reserve",
          scheduledTime: returnTime, frequency: "once", scheduledDate: returnDate,
          roundTripGroupId: groupId,
        });
        setConfirmation({ rideId: ride.id, scheduleId: returnSchedule.id });
      } catch {
        // The outbound leg is real and already booked — don't hide that
        // behind a generic failure. Let the rider add the return manually.
        setScheduleWarning("Your outbound ride is booked, but we couldn't schedule the return automatically. Add it from Scheduled Rides.");
        setConfirmation({ rideId: ride.id, scheduleId: -1 });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't book the round trip. Please try again.");
    }
  };

  if (confirmation) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0F172A] pb-24 flex flex-col items-center justify-center px-6 text-center">
        <div className="w-16 h-16 rounded-full bg-[#E8F5E8] dark:bg-[#1A2D1A] flex items-center justify-center mb-4">
          <CheckCircle2 className="w-8 h-8 text-[#138808]" />
        </div>
        <h1 className="font-bold text-xl text-[#1A1A2E] dark:text-[#E5E7EB] mb-2">Round Trip Booked!</h1>
        <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] mb-1">Your outbound ride is now searching for a driver.</p>
        {scheduleWarning ? (
          <p className="text-sm text-[#FF6B00] mt-2 mb-6">{scheduleWarning}</p>
        ) : (
          <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] mb-6">
            Your return trip is scheduled for {returnTime} on {returnDate} — we'll remind you when it's time.
          </p>
        )}
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button onClick={() => navigate("/user/home")} className="w-full btn-saffron py-3.5">
            Track Outbound Ride
          </button>
          <button
            onClick={() => navigate("/user/schedule")}
            className="w-full flex items-center justify-center gap-2 bg-white dark:bg-[#1E293B] text-[#1A1A2E] dark:text-[#E5E7EB] font-semibold py-3.5 rounded-xl shadow-sm"
          >
            <CalendarClock className="w-4 h-4" /> View Scheduled Rides
          </button>
        </div>
        <BottomNav role="user" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0F172A] pb-24">
      <div className="bg-white dark:bg-[#1E293B] px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate("/user/services")} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full">
          <ArrowLeft className="w-5 h-5 text-[#1A1A2E] dark:text-[#E5E7EB]" />
        </button>
        <h1 className="font-bold text-lg text-[#1A1A2E] dark:text-[#E5E7EB]">Round Trip</h1>
      </div>

      <div className="px-4 py-4 space-y-4">
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
                {drop?.address || "Destination"}
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

        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4">
          <h2 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] mb-3">When do you want to return?</h2>
          <p className="text-xs text-[#9CA3AF] dark:text-[#64748B] mb-3">
            We'll book your outbound ride right away, then remind you to confirm the return trip at this time.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#6B7280] dark:text-[#9CA3AF] flex-shrink-0" />
              <input
                type="date"
                min={todayDateStr()}
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                className="flex-1 text-sm outline-none border-b border-gray-100 dark:border-gray-700 pb-2 bg-transparent text-[#1A1A2E] dark:text-[#E5E7EB] [color-scheme:light] dark:[color-scheme:dark]"
              />
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#6B7280] dark:text-[#9CA3AF] flex-shrink-0" />
              <input
                type="time"
                value={returnTime}
                onChange={(e) => setReturnTime(e.target.value)}
                className="flex-1 text-sm outline-none border-b border-gray-100 dark:border-gray-700 pb-2 bg-transparent text-[#1A1A2E] dark:text-[#E5E7EB] [color-scheme:light] dark:[color-scheme:dark]"
              />
            </div>
          </div>
        </div>

        {routeInfo && fare && (
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">Estimated outbound fare</span>
              <span className="flex items-center font-bold text-lg text-[#1A1A2E] dark:text-[#E5E7EB]">
                <IndianRupee className="w-4 h-4" />{fare.total}
              </span>
            </div>
            <p className="text-[11px] text-[#9CA3AF] dark:text-[#64748B]">
              {routeInfo.distanceKm.toFixed(1)} km · includes round-trip pricing · return fare quoted when you confirm it
            </p>
          </div>
        )}

        {error && <p className="text-sm text-[#DC2626] text-center">{error}</p>}

        <button
          onClick={handleBookRoundTrip}
          disabled={!canSubmit || bookMutation.isPending || scheduleMutation.isPending}
          className="w-full btn-saffron py-3.5 disabled:opacity-50"
        >
          {bookMutation.isPending || scheduleMutation.isPending ? "Booking..." : "Book Round Trip"}
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
