import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  ArrowLeft, Banknote, Smartphone, Route as RouteIcon, Clock, IndianRupee,
  Repeat, Download, Play, MapPin, CheckCircle2,
} from "lucide-react";
import MapUnavailable from "@/components/MapUnavailable";
import { hasGoogleMapsKey, loadGoogleMaps } from "@/lib/googleMaps";
import { createPickupIcon, createDestinationIcon, createDriverIcon } from "@/lib/googleMarkerIcons";
import { fetchGoogleRoute } from "@/lib/googleDirections";
import { downloadTextFile, buildInvoiceHtml } from "@/lib/downloadFile";
import BottomNav from "@/components/BottomNav";
import { useMapTheme } from "@/hooks/useMapTheme";
import { useTheme } from "@/contexts/ThemeContext";
import { DARK_MAP_STYLES } from "@/lib/mapDarkStyle";
import { trpc } from "@/providers/trpc";

const STATUS_LABEL: Record<string, string> = {
  completed: "Completed",
  cancelled: "Cancelled",
  driver_cancelled: "Cancelled",
  searching: "Searching",
  accepted: "Accepted",
  pickup: "Pickup",
  ongoing: "Ongoing",
};

function formatDate(date: Date): string {
  return new Date(date).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function DriverTripDetail() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const rideId = Number(id);
  const { data: trip, isLoading } = trpc.ride.getById.useQuery(
    { id: rideId },
    { enabled: Number.isFinite(rideId) && rideId > 0 }
  );

  const pickupCoords = trip ? { lat: parseFloat(trip.pickupLat), lng: parseFloat(trip.pickupLng) } : null;
  const dropoffCoords = trip ? { lat: parseFloat(trip.dropLat), lng: parseFloat(trip.dropLng) } : null;

  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const routePathRef = useRef<google.maps.LatLng[] | google.maps.LatLngLiteral[] | null>(null);
  const replayMarkerRef = useRef<google.maps.Marker | null>(null);
  const replayIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [mapLoadError, setMapLoadError] = useState(!hasGoogleMapsKey);
  const [isReplaying, setIsReplaying] = useState(false);
  const { theme } = useTheme();
  useMapTheme(map, false);

  useEffect(() => {
    if (!pickupCoords || !dropoffCoords || !hasGoogleMapsKey || !mapContainer.current) return;

    let disposed = false;

    loadGoogleMaps()
      .then(async () => {
        if (disposed || !mapContainer.current) return;

        const gMap = new google.maps.Map(mapContainer.current, {
          center: pickupCoords,
          zoom: 12,
          disableDefaultUI: true,
          zoomControl: true,
          styles: theme === "dark" ? DARK_MAP_STYLES : [],
        });
        map.current = gMap;

        new google.maps.Marker({ position: pickupCoords, map: gMap, icon: createPickupIcon() });
        new google.maps.Marker({ position: dropoffCoords, map: gMap, icon: createDestinationIcon() });

        const fallbackBounds = new google.maps.LatLngBounds();
        fallbackBounds.extend(pickupCoords);
        fallbackBounds.extend(dropoffCoords);
        gMap.fitBounds(fallbackBounds, 50);

        try {
          const route = await fetchGoogleRoute(pickupCoords, dropoffCoords);
          if (disposed || !route) return;
          routePathRef.current = route.path;
          new google.maps.Polyline({ path: route.path, strokeColor: "#138808", strokeWeight: 4, strokeOpacity: 0.8, map: gMap });
          gMap.fitBounds(route.bounds, 50);
        } catch (routeError) {
          console.error("Error fetching route for trip replay:", routeError);
        }
      })
      .catch((error) => {
        console.error("Error loading Google Maps:", error);
        setMapLoadError(true);
      });

    return () => {
      disposed = true;
      if (replayIntervalRef.current) clearInterval(replayIntervalRef.current);
      replayMarkerRef.current?.setMap(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickupCoords?.lat, pickupCoords?.lng, dropoffCoords?.lat, dropoffCoords?.lng]);

  if (!isLoading && !trip) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0F172A] flex flex-col items-center justify-center px-6 text-center">
        <p className="text-[#6B7280] dark:text-[#9CA3AF] mb-4">Trip not found</p>
        <button onClick={() => navigate("/driver/trips")} className="btn-saffron px-6 py-2.5">Back to Trips</button>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0F172A] flex items-center justify-center">
        <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">Loading trip…</p>
      </div>
    );
  }

  const fare = Number(trip.totalFare);
  const statusLabel = STATUS_LABEL[trip.status] ?? trip.status;

  const handleReplay = () => {
    const path = routePathRef.current;
    if (!path || !map.current || isReplaying) return;

    setIsReplaying(true);
    replayMarkerRef.current?.setMap(null);
    const marker = new google.maps.Marker({ position: path[0], map: map.current, icon: createDriverIcon() });
    replayMarkerRef.current = marker;

    let step = 0;
    const totalSteps = path.length;
    replayIntervalRef.current = setInterval(() => {
      step += 1;
      if (step >= totalSteps) {
        if (replayIntervalRef.current) clearInterval(replayIntervalRef.current);
        setIsReplaying(false);
        return;
      }
      marker.setPosition(path[step]);
    }, Math.max(15, Math.floor(2000 / totalSteps)));
  };

  const handleDownloadInvoice = () => {
    const html = buildInvoiceHtml({
      invoiceNo: `INV-TRIP-${trip.id}`,
      date: formatDate(trip.createdAt),
      billedTo: trip.riderName || "Rider",
      billedToDetail: `${trip.pickupAddress} → ${trip.dropAddress}`,
      lineItems: [{ label: `${trip.rideType === "reserve" ? "Reserve" : "Share"} Ride Fare`, amount: fare }],
      total: fare,
    });
    downloadTextFile(`invoice-trip-${trip.id}.html`, html, "text/html");
  };

  const handleRepeatRide = () => {
    navigate("/driver/dashboard");
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0F172A] pb-28">
      {/* Header */}
      <div className="bg-white dark:bg-[#1E293B] px-4 py-3 flex items-center gap-3 shadow-sm">
        <button onClick={() => navigate("/driver/trips")} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full">
          <ArrowLeft className="w-5 h-5 text-[#1A1A2E] dark:text-[#E5E7EB]" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-lg text-[#1A1A2E] dark:text-[#E5E7EB]">{trip.pickupAddress} → {trip.dropAddress}</h1>
          <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">{formatDate(trip.createdAt)}</p>
        </div>
      </div>

      <div className="p-4 max-w-2xl mx-auto space-y-4">
        {/* Map Thumbnail */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-3">
          <div className="relative h-48 rounded-xl overflow-hidden">
            <div ref={mapContainer} className="w-full h-full" />
            {mapLoadError && <MapUnavailable />}
          </div>
          <button
            onClick={handleReplay}
            disabled={isReplaying || !hasGoogleMapsKey}
            className="w-full flex items-center justify-center gap-2 mt-3 bg-[#1E3A5F] text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-[#2C5282] transition-colors disabled:opacity-50"
          >
            <Play className="w-4 h-4" /> {isReplaying ? "Replaying..." : "Replay Navigation"}
          </button>
        </div>

        {/* Ride Timeline — reflects the ride's real status, not an assumed
            "picked up then completed" sequence. A ride can be sitting here at
            any status (accepted, ongoing, cancelled) if the driver or rider
            never carried it through to a real finish. */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4">
          <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] mb-3">Ride Timeline</h3>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center flex-shrink-0">
                <div className="w-3 h-3 rounded-full bg-[#138808]" />
                <div className="w-0.5 flex-1 bg-gray-200 dark:bg-gray-700 my-1" style={{ minHeight: "24px" }} />
              </div>
              <div>
                <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">Accepted {trip.riderName || "rider"}'s ride</p>
                <p className="text-xs text-[#9CA3AF]">{trip.pickupAddress}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div
                className={`w-3 h-3 rounded-full flex-shrink-0 mt-0.5 ${
                  trip.status === "completed" ? "bg-[#138808]" : trip.status === "cancelled" || trip.status === "driver_cancelled" ? "bg-[#DC2626]" : "bg-[#FF6B00]"
                }`}
              />
              <div>
                <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">
                  {trip.status === "completed"
                    ? "Trip completed"
                    : trip.status === "cancelled" || trip.status === "driver_cancelled"
                    ? "Trip cancelled"
                    : `Trip ${STATUS_LABEL[trip.status]?.toLowerCase() ?? trip.status} — not yet completed`}
                </p>
                <p className="text-xs text-[#9CA3AF]">
                  {trip.status === "completed" ? `${trip.dropAddress} · ${trip.estimatedTime} min after pickup` : trip.dropAddress}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Passenger + Payment */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#FFF5EB] dark:bg-[#3D2914] flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-[#FF6B00]">{(trip.riderName || "R").charAt(0)}</span>
              </div>
              <div>
                <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">{trip.riderName || "Rider"}</p>
              </div>
            </div>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
              trip.status === "completed"
                ? "bg-[#E8F5E8] dark:bg-[#1A2D1A] text-[#138808]"
                : trip.status === "cancelled" || trip.status === "driver_cancelled"
                ? "bg-red-50 dark:bg-[#3D1414] text-[#DC2626]"
                : "bg-[#FFF5EB] dark:bg-[#3D2914] text-[#FF6B00]"
            }`}>
              <CheckCircle2 className="w-3 h-3 inline mr-1" />{statusLabel}
            </span>
          </div>
          {trip.paymentMethod && (
            <div className="flex items-center gap-2 pt-3 border-t border-gray-50 dark:border-gray-700">
              {trip.paymentMethod === "cash" ? <Banknote className="w-4 h-4 text-[#138808]" /> : <Smartphone className="w-4 h-4 text-[#0EA5E9]" />}
              <span className="text-sm text-[#1A1A2E] dark:text-[#E5E7EB] capitalize">Paid via {trip.paymentMethod}</span>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl p-4 shadow-sm text-center">
            <RouteIcon className="w-4 h-4 text-[#0EA5E9] mx-auto mb-1" />
            <p className="text-lg font-bold text-[#1A1A2E] dark:text-[#E5E7EB]">{Number(trip.distance).toFixed(1)} km</p>
            <p className="text-[10px] text-[#9CA3AF]">Distance</p>
          </div>
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl p-4 shadow-sm text-center">
            <Clock className="w-4 h-4 text-[#7C3AED] mx-auto mb-1" />
            <p className="text-lg font-bold text-[#1A1A2E] dark:text-[#E5E7EB]">{trip.estimatedTime} min</p>
            <p className="text-[10px] text-[#9CA3AF]">Duration</p>
          </div>
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl p-4 shadow-sm text-center">
            <IndianRupee className="w-4 h-4 text-[#138808] mx-auto mb-1" />
            <p className="text-lg font-bold text-[#1A1A2E] dark:text-[#E5E7EB]">₹{fare}</p>
            <p className="text-[10px] text-[#9CA3AF]">Fare</p>
          </div>
        </div>

        {/* Route summary */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4 space-y-3">
          <div className="flex items-center gap-3">
            <MapPin className="w-4 h-4 text-[#138808] flex-shrink-0" />
            <p className="text-sm text-[#1A1A2E] dark:text-[#E5E7EB]">{trip.pickupAddress}</p>
          </div>
          <div className="flex items-center gap-3">
            <MapPin className="w-4 h-4 text-[#FF6B00] flex-shrink-0" />
            <p className="text-sm text-[#1A1A2E] dark:text-[#E5E7EB]">{trip.dropAddress}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleRepeatRide}
            className="flex items-center justify-center gap-2 bg-[#138808] text-white font-semibold py-3.5 rounded-xl hover:bg-[#1AA814] transition-colors"
          >
            <Repeat className="w-4 h-4" /> Repeat Ride
          </button>
          <button
            onClick={handleDownloadInvoice}
            className="flex items-center justify-center gap-2 bg-white dark:bg-[#1E293B] border border-gray-200 dark:border-gray-700 text-[#1A1A2E] dark:text-[#E5E7EB] font-semibold py-3.5 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
          >
            <Download className="w-4 h-4" /> Invoice
          </button>
        </div>
      </div>

      <BottomNav role="driver" />
    </div>
  );
}
