import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { User, Car, Clock, Route as RouteIcon, IndianRupee, Smartphone, Banknote } from "lucide-react";
import { hasGoogleMapsKey, loadGoogleMaps } from "@/lib/googleMaps";
import { fetchGoogleRoute } from "@/lib/googleDirections";
import MapUnavailable from "@/components/MapUnavailable";
import AdminLayout from "@/components/admin/AdminLayout";
import { useMapTheme } from "@/hooks/useMapTheme";
import { useTheme } from "@/contexts/ThemeContext";
import { DARK_MAP_STYLES } from "@/lib/mapDarkStyle";
import { trpc } from "@/providers/trpc";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  searching: { label: "Searching", color: "#FF6B00", bg: "#FFF5EB" },
  accepted: { label: "Accepted", color: "#0EA5E9", bg: "#E0F2FE" },
  pickup: { label: "Pickup", color: "#0EA5E9", bg: "#E0F2FE" },
  ongoing: { label: "Ongoing", color: "#0EA5E9", bg: "#E0F2FE" },
  completed: { label: "Completed", color: "#138808", bg: "#E8F5E8" },
  cancelled: { label: "Cancelled", color: "#DC2626", bg: "#FEE2E2" },
  driver_cancelled: { label: "Cancelled", color: "#DC2626", bg: "#FEE2E2" },
};

function formatDate(date: Date): string {
  return new Date(date).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function AdminRideDetail() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const rideId = Number(id);
  const { data: ride, isLoading } = trpc.admin.getRideDetail.useQuery(
    { rideId },
    { enabled: Number.isFinite(rideId) && rideId > 0 }
  );

  const pickup = ride ? { lat: parseFloat(ride.pickupLat), lng: parseFloat(ride.pickupLng) } : null;
  const dropoff = ride ? { lat: parseFloat(ride.dropLat), lng: parseFloat(ride.dropLng) } : null;

  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const [mapLoadError, setMapLoadError] = useState(!hasGoogleMapsKey);
  const { theme } = useTheme();
  useMapTheme(map, false);

  useEffect(() => {
    if (!pickup || !dropoff || !hasGoogleMapsKey || !mapContainer.current) return;

    let disposed = false;

    loadGoogleMaps()
      .then(async () => {
        if (disposed || !mapContainer.current) return;
        const gMap = new google.maps.Map(mapContainer.current, {
          center: pickup,
          zoom: 12,
          disableDefaultUI: true,
          zoomControl: true,
          styles: theme === "dark" ? DARK_MAP_STYLES : [],
        });
        map.current = gMap;
        new google.maps.Marker({ position: pickup, map: gMap, label: "A" });
        new google.maps.Marker({ position: dropoff, map: gMap, label: "B" });

        const fallbackBounds = new google.maps.LatLngBounds();
        fallbackBounds.extend(pickup);
        fallbackBounds.extend(dropoff);
        gMap.fitBounds(fallbackBounds, 50);

        try {
          const route = await fetchGoogleRoute(pickup, dropoff);
          if (disposed) return;
          if (route) {
            new google.maps.Polyline({
              path: route.path,
              strokeColor: "#FF6B00",
              strokeWeight: 5,
              map: gMap,
            });
            gMap.fitBounds(route.bounds, 50);
          }
        } catch (routeError) {
          console.error("Error fetching route for ride map:", routeError);
        }
      })
      .catch((error) => {
        console.error("Error loading Google Maps:", error);
        setMapLoadError(true);
      });

    return () => {
      disposed = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng]);

  if (!isLoading && !ride) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0F172A] flex flex-col items-center justify-center px-6 text-center">
        <p className="text-[#6B7280] dark:text-[#9CA3AF] mb-4">Ride not found</p>
        <button onClick={() => navigate("/admin/rides")} className="btn-saffron px-6 py-2.5">
          Back to Rides
        </button>
      </div>
    );
  }

  if (!ride) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0F172A] flex items-center justify-center">
        <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">Loading ride…</p>
      </div>
    );
  }

  const config = STATUS_CONFIG[ride.status] ?? STATUS_CONFIG.completed;

  return (
    <AdminLayout
      title={`#${ride.id}`}
      subtitle={`${formatDate(ride.createdAt)} · ${ride.rideType === "reserve" ? "Reserve" : "Share"}`}
      backTo="/admin/rides"
      headerActions={
        <span className="text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0" style={{ color: config.color, backgroundColor: config.bg }}>
          {config.label}
        </span>
      }
    >
      <div className="max-w-2xl space-y-4">
        {/* Route Map */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4">
          <div className="relative h-56 rounded-xl overflow-hidden">
            <div ref={mapContainer} className="w-full h-full" />
            {mapLoadError && <MapUnavailable />}
          </div>
          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <div className="w-2 h-2 rounded-full bg-[#138808] flex-shrink-0" />
              <span className="text-[#1A1A2E] dark:text-[#E5E7EB]">{ride.pickupAddress}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <div className="w-2 h-2 rounded-full bg-[#FF6B00] flex-shrink-0" />
              <span className="text-[#1A1A2E] dark:text-[#E5E7EB]">{ride.dropAddress}</span>
            </div>
          </div>
        </div>

        {/* Trip Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl p-4 shadow-sm text-center">
            <RouteIcon className="w-4 h-4 text-[#0EA5E9] mx-auto mb-1" />
            <p className="text-lg font-bold text-[#1A1A2E] dark:text-[#E5E7EB]">{Number(ride.distance).toFixed(1)} km</p>
            <p className="text-[10px] text-[#9CA3AF]">Distance</p>
          </div>
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl p-4 shadow-sm text-center">
            <Clock className="w-4 h-4 text-[#7C3AED] mx-auto mb-1" />
            <p className="text-lg font-bold text-[#1A1A2E] dark:text-[#E5E7EB]">{ride.estimatedTime} min</p>
            <p className="text-[10px] text-[#9CA3AF]">Duration</p>
          </div>
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl p-4 shadow-sm text-center">
            <IndianRupee className="w-4 h-4 text-[#138808] mx-auto mb-1" />
            <p className="text-lg font-bold text-[#1A1A2E] dark:text-[#E5E7EB]">₹{Number(ride.totalFare)}</p>
            <p className="text-[10px] text-[#9CA3AF]">Fare</p>
          </div>
        </div>

        {/* People */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#E8F5E8] flex items-center justify-center flex-shrink-0">
              <User className="w-5 h-5 text-[#138808]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-[#9CA3AF]">Rider</p>
              <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">{ride.riderName}</p>
            </div>
            <span className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">{ride.riderPhone}</span>
          </div>
          <div className="flex items-center gap-3 pt-3 border-t border-gray-50 dark:border-gray-700">
            <div className="w-10 h-10 rounded-full bg-[#FFF5EB] flex items-center justify-center flex-shrink-0">
              <Car className="w-5 h-5 text-[#FF6B00]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-[#9CA3AF]">Driver</p>
              <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">{ride.driverName || "Not yet assigned"}</p>
            </div>
            {ride.driverPhone && <span className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">{ride.driverPhone}</span>}
          </div>
        </div>

        {/* Payment */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${ride.paymentMethod && ride.paymentMethod !== "cash" ? "bg-[#E0F2FE]" : "bg-[#FFF5EB]"}`}>
                {ride.paymentMethod && ride.paymentMethod !== "cash" ? (
                  <Smartphone className="w-5 h-5 text-[#0EA5E9]" />
                ) : (
                  <Banknote className="w-5 h-5 text-[#FF6B00]" />
                )}
              </div>
              <div>
                <p className="text-xs text-[#9CA3AF]">Payment Method</p>
                <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB] capitalize">
                  {ride.paymentMethod ? (ride.paymentMethod === "upi" ? "UPI / Card" : ride.paymentMethod) : "Not paid yet"}
                </p>
              </div>
            </div>
            <p className="text-xl font-bold text-[#1A1A2E] dark:text-[#E5E7EB]">₹{Number(ride.totalFare)}</p>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
