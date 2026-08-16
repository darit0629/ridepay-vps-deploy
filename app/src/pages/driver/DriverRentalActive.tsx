import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Clock, Phone, MessageCircle, ShieldAlert, IndianRupee, Timer } from "lucide-react";
import { trpc } from "@/providers/trpc";
import MapUnavailable from "@/components/MapUnavailable";
import { hasGoogleMapsKey, loadGoogleMaps, GOOGLE_MAP_VECTOR_ID } from "@/lib/googleMaps";
import { useTheme } from "@/contexts/ThemeContext";

function formatDuration(ms: number) {
  const totalSec = Math.floor(Math.abs(ms) / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function DriverRentalActive() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const rideId = Number(searchParams.get("rideId"));
  const { theme } = useTheme();

  const { data: ride } = trpc.ride.getById.useQuery(
    { id: rideId },
    { enabled: Number.isFinite(rideId) && rideId > 0, refetchInterval: 4000, refetchIntervalInBackground: true }
  );

  useEffect(() => {
    if (!ride) return;
    if (ride.status === "completed") navigate(`/driver/end-ride?rideId=${rideId}`);
    else if (ride.status !== "ongoing" || !ride.isHourlyRental) navigate("/driver/dashboard");
  }, [ride, rideId, navigate]);

  // Self-tracking only — no destination, no route/geofence, unlike
  // DriverDropoff.tsx which every bit of its map logic is built around one.
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const [mapLoadError, setMapLoadError] = useState(!hasGoogleMapsKey);
  const updateLocationMutation = trpc.driver.updateLocation.useMutation();
  const lastPushRef = useRef(0);

  useEffect(() => {
    if (!hasGoogleMapsKey || !navigator.geolocation) return;
    let disposed = false;
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const coords = { lat: position.coords.latitude, lng: position.coords.longitude };
        const now = Date.now();
        if (now - lastPushRef.current > 5000) {
          lastPushRef.current = now;
          updateLocationMutation.mutate({ lat: coords.lat.toString(), lng: coords.lng.toString() });
        }
        if (!map.current && mapContainer.current) {
          loadGoogleMaps().then(() => {
            if (disposed || !mapContainer.current || map.current) return;
            const gMap = new google.maps.Map(mapContainer.current, {
              center: coords,
              zoom: 15,
              disableDefaultUI: true,
              zoomControl: true,
              mapId: GOOGLE_MAP_VECTOR_ID,
              colorScheme: theme === "dark" ? google.maps.ColorScheme.DARK : google.maps.ColorScheme.LIGHT,
            });
            map.current = gMap;
            markerRef.current = new google.maps.Marker({ position: coords, map: gMap });
          }).catch(() => setMapLoadError(true));
        } else if (map.current) {
          map.current.panTo(coords);
          markerRef.current?.setPosition(coords);
        }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
    return () => { disposed = true; navigator.geolocation.clearWatch(watchId); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const completeMutation = trpc.ride.completeHourlyRental.useMutation({
    onSuccess: () => navigate(`/driver/end-ride?rideId=${rideId}`),
  });

  const startedAt = ride?.rentalStartedAt ? new Date(ride.rentalStartedAt).getTime() : null;
  const packageMs = (ride?.rentalHours ?? 0) * 60 * 60 * 1000;
  const elapsedMs = startedAt ? now - startedAt : 0;
  const remainingMs = packageMs - elapsedMs;
  const isOvertime = remainingMs < 0;
  const overtimeHours = isOvertime ? Math.ceil(Math.abs(remainingMs) / (60 * 60 * 1000)) : 0;
  const overtimeCharge = overtimeHours * Number(ride?.rentalExtraHourRate ?? 0);

  const passenger = { name: ride?.riderName || "Rider", phone: ride?.riderPhone || "" };

  return (
    <div className="h-screen flex flex-col bg-[#F8F9FA] dark:bg-[#0F172A]">
      <div className="bg-[#7C3AED] px-4 pt-4 pb-4 flex-shrink-0">
        <h1 className="text-white font-bold text-lg">Hourly Rental — In Progress</h1>
        <p className="text-white/80 text-sm">{ride?.rentalHours}h package · {passenger.name}</p>
      </div>

      <div className="flex-1 relative min-h-[200px]">
        <div ref={mapContainer} className="w-full h-full" />
        {mapLoadError && <MapUnavailable />}
      </div>

      <div className="bg-white dark:bg-[#1E293B] rounded-t-3xl shadow-lg flex-shrink-0">
        <div className="w-12 h-1 bg-gray-200 dark:bg-gray-600 rounded-full mx-auto mt-3 mb-4" />
        <div className="px-4 pb-6 space-y-3">
          <div className={`rounded-2xl p-4 text-center ${isOvertime ? "bg-[#FEE2E2] dark:bg-[#3D1414]" : "bg-[#F3E8FF] dark:bg-[#2D1B4E]"}`}>
            <p className={`text-xs mb-1 flex items-center justify-center gap-1 ${isOvertime ? "text-[#DC2626]" : "text-[#7C3AED]"}`}>
              {isOvertime ? <Timer className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
              {isOvertime ? "Overtime" : "Time Remaining"}
            </p>
            <p className={`text-3xl font-bold tabular-nums ${isOvertime ? "text-[#DC2626]" : "text-[#1A1A2E] dark:text-[#E5E7EB]"}`}>
              {formatDuration(remainingMs)}
            </p>
            {isOvertime && (
              <p className="text-xs text-[#DC2626] mt-1">+₹{overtimeCharge} overage so far ({overtimeHours}h × ₹{ride?.rentalExtraHourRate})</p>
            )}
          </div>

          <div className="flex items-center justify-between bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl p-3">
            <span className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Package price</span>
            <span className="flex items-center font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">
              <IndianRupee className="w-3.5 h-3.5" />{ride?.rentalPackagePrice}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <a href={`tel:${passenger.phone.replace(/\s/g, "")}`} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#138808] text-white text-xs font-medium">
              <Phone className="w-3.5 h-3.5" /> Call
            </a>
            <a href={`sms:${passenger.phone.replace(/\s/g, "")}`} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#E0F2FE] dark:bg-[#0C2536] text-[#0EA5E9] text-xs font-medium">
              <MessageCircle className="w-3.5 h-3.5" /> Message
            </a>
            <a href="tel:100" className="w-10 flex items-center justify-center py-2.5 rounded-xl bg-red-50 dark:bg-[#3A1A1A]" aria-label="Emergency">
              <ShieldAlert className="w-4 h-4 text-[#DC2626]" />
            </a>
          </div>

          <button
            onClick={() => completeMutation.mutate({ rideId })}
            disabled={completeMutation.isPending}
            className="w-full bg-[#7C3AED] text-white font-semibold py-4 rounded-xl disabled:opacity-50"
          >
            {completeMutation.isPending ? "Ending..." : "End Rental"}
          </button>
        </div>
      </div>
    </div>
  );
}
