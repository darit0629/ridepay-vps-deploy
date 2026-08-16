import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { MapPin, Clock, Sparkles, IndianRupee, ChevronsRight } from "lucide-react";
import MapUnavailable from "@/components/MapUnavailable";
import { hasGoogleMapsKey, loadGoogleMaps } from "@/lib/googleMaps";
import { createPickupIcon, createDestinationIcon } from "@/lib/googleMarkerIcons";
import { fetchGoogleRoute } from "@/lib/googleDirections";
import { useMapTheme } from "@/hooks/useMapTheme";
import { useTheme } from "@/contexts/ThemeContext";
import { DARK_MAP_STYLES } from "@/lib/mapDarkStyle";
import { playNewRideAlarm } from "@/lib/alarmSound";
import { trpc } from "@/providers/trpc";

const aiTags = ["Recommended Accept", "Low Traffic"];
const COMMISSION_FLAT = 2;

export default function DriverRideRequest() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const rideId = Number(searchParams.get("rideId"));
  const [countdown, setCountdown] = useState(12);
  const [isAccepting, setIsAccepting] = useState(false);
  const isAcceptingRef = useRef(false);
  const [rejectedMessage, setRejectedMessage] = useState("");

  const { data: ride } = trpc.ride.getById.useQuery(
    { id: rideId },
    { enabled: Number.isFinite(rideId) && rideId > 0, refetchInterval: 2000, refetchIntervalInBackground: true }
  );
  const acceptMutation = trpc.ride.accept.useMutation();
  const rejectMutation = trpc.ride.reject.useMutation();

  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const [mapLoadError, setMapLoadError] = useState(!hasGoogleMapsKey);
  const { theme } = useTheme();
  useMapTheme(map, false);

  // Swipe-to-reject
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragStartRef = useRef(0);
  const trackWidthRef = useRef(240);

  const fare = ride ? Number(ride.totalFare) : 0;
  const earnings = Math.max(0, Math.round(fare - COMMISSION_FLAT));
  const pickupCoords = ride ? { lat: parseFloat(ride.pickupLat), lng: parseFloat(ride.pickupLng) } : null;
  const dropoffCoords = ride ? { lat: parseFloat(ride.dropLat), lng: parseFloat(ride.dropLng) } : null;

  // Someone else may have already grabbed this ride, or the rider cancelled
  // it, while it was sitting on this driver's screen. Adjusted directly
  // during render (self-terminating: setting rejectedMessage makes the
  // guard false on the next render) — the actual side effect (navigating
  // away) lives in the single timer effect below, which fires for this
  // and every other way rejectedMessage gets set (accept-race, mutation error).
  if (ride && ride.status !== "searching" && !rejectedMessage) {
    setRejectedMessage("This ride is no longer available.");
  }

  useEffect(() => {
    if (!rejectedMessage) return;
    const timer = setTimeout(() => navigate("/driver/dashboard"), 1500);
    return () => clearTimeout(timer);
  }, [rejectedMessage, navigate]);

  // Rings for the whole time the request is on screen — accepting,
  // declining, or the countdown expiring all unmount this page, which
  // stops the alarm via the cleanup below.
  useEffect(() => {
    const stopAlarm = playNewRideAlarm();
    return stopAlarm;
  }, []);

  useEffect(() => {
    if (isAccepting || rejectedMessage) return; // pause countdown during accept animation / already resolved
    if (countdown <= 0) {
      navigate("/driver/dashboard");
      return;
    }
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown, navigate, isAccepting, rejectedMessage]);

  useEffect(() => {
    if (!hasGoogleMapsKey || !mapContainer.current || !pickupCoords || !dropoffCoords) return;
    let disposed = false;

    loadGoogleMaps()
      .then(async () => {
        if (disposed || !mapContainer.current) return;
        const gMap = new google.maps.Map(mapContainer.current, {
          center: pickupCoords,
          zoom: 12,
          disableDefaultUI: true,
          gestureHandling: "none",
          zoomControl: false,
          styles: theme === "dark" ? DARK_MAP_STYLES : [],
        });
        map.current = gMap;

        new google.maps.Marker({ position: pickupCoords, map: gMap, icon: createPickupIcon() });
        new google.maps.Marker({ position: dropoffCoords, map: gMap, icon: createDestinationIcon() });

        const fallbackBounds = new google.maps.LatLngBounds();
        fallbackBounds.extend(pickupCoords);
        fallbackBounds.extend(dropoffCoords);
        gMap.fitBounds(fallbackBounds, 30);

        try {
          const route = await fetchGoogleRoute(pickupCoords, dropoffCoords);
          if (disposed || !route) return;
          new google.maps.Polyline({ path: route.path, strokeColor: "#138808", strokeWeight: 4, strokeOpacity: 0.85, map: gMap });
          gMap.fitBounds(route.bounds, 30);
        } catch (routeError) {
          console.error("Error fetching mini route:", routeError);
        }
      })
      .catch((error) => {
        console.error("Error loading Google Maps:", error);
        setMapLoadError(true);
      });

    return () => { disposed = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickupCoords?.lat, pickupCoords?.lng, dropoffCoords?.lat, dropoffCoords?.lng]);

  const handleAccept = () => {
    // A plain isAccepting state check isn't enough on its own — React state
    // updates aren't guaranteed to commit before a rapid double-tap fires a
    // second click, which sent two real accept.mutate() calls: the first
    // genuinely won (flipping the ride to "accepted" under this driver), but
    // the second's own WHERE status='searching' no longer matched, so it
    // came back "already taken by another driver" and bounced the driver to
    // the dashboard — even though they'd actually just gotten the ride. The
    // ref is checked/set synchronously, so it blocks the second call outright.
    if (isAcceptingRef.current || !ride) return;
    isAcceptingRef.current = true;
    setIsAccepting(true);
    acceptMutation.mutate(
      { rideId: ride.id },
      {
        onSuccess: (result) => {
          if (!result.success) {
            isAcceptingRef.current = false;
            setIsAccepting(false);
            setRejectedMessage(result.error);
            return;
          }
          navigate(`/driver/ride-pickup?rideId=${ride.id}`);
        },
        onError: () => {
          isAcceptingRef.current = false;
          setIsAccepting(false);
          setRejectedMessage("Couldn't accept this ride — please try again.");
        },
      }
    );
  };

  const handleReject = () => {
    if (ride) rejectMutation.mutate({ rideId: ride.id });
    navigate("/driver/dashboard");
  };

  const progress = (countdown / 12) * 100;

  // Swipe-to-reject handlers
  const handleTrackPointerDown = (e: React.PointerEvent) => {
    if (!trackRef.current) return;
    trackWidthRef.current = trackRef.current.clientWidth - 48; // handle width
    dragStartRef.current = e.clientX;
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const handleTrackPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const delta = e.clientX - dragStartRef.current;
    setDragX(Math.max(0, Math.min(trackWidthRef.current, delta)));
  };
  const handleTrackPointerUp = () => {
    if (!dragging) return;
    setDragging(false);
    if (dragX / trackWidthRef.current > 0.65) {
      handleReject();
    } else {
      setDragX(0);
    }
  };
  const swipeProgress = trackWidthRef.current > 0 ? dragX / trackWidthRef.current : 0;

  if (!ride) {
    return (
      <div className="min-h-screen bg-black/50 flex flex-col justify-end">
        <div className="bg-white dark:bg-[#1E293B] rounded-t-3xl p-6">
          <p className="text-center text-sm text-[#6B7280] dark:text-[#9CA3AF]">Loading ride request…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black/50 flex flex-col justify-end">
      {/* Request Card */}
      <div className="bg-white dark:bg-[#1E293B] rounded-t-3xl p-6 animate-in slide-in-from-bottom duration-300 relative overflow-hidden">
        {/* Accept ripple overlay */}
        {isAccepting && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#138808] animate-in fade-in duration-200">
            <div className="relative flex items-center justify-center">
              <span className="absolute w-16 h-16 rounded-full bg-white/30 animate-ping" />
              <span className="absolute w-24 h-24 rounded-full bg-white/20 animate-ping" style={{ animationDelay: "150ms" }} />
              <div className="relative w-14 h-14 rounded-full bg-white flex items-center justify-center">
                <ChevronsRight className="w-7 h-7 text-[#138808]" />
              </div>
            </div>
          </div>
        )}
        {rejectedMessage && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/95 dark:bg-[#1E293B]/95">
            <p className="text-sm font-medium text-[#DC2626] px-6 text-center">{rejectedMessage}</p>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg text-[#1A1A2E] dark:text-[#E5E7EB]">New Ride Request</h2>
          <div className="relative w-12 h-12">
            <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
              <circle cx="24" cy="24" r="20" fill="none" stroke="#E5E7EB" strokeWidth="3" />
              <circle
                cx="24" cy="24" r="20" fill="none" stroke={countdown > 6 ? "#138808" : countdown > 3 ? "#FF6B00" : "#DC2626"}
                strokeWidth="3"
                strokeDasharray={`${progress * 1.26} 126`}
                className="transition-all duration-1000"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-[#1A1A2E] dark:text-[#E5E7EB]">
              {countdown}s
            </span>
          </div>
        </div>

        {/* Passenger row */}
        <div className="flex items-center gap-3 mb-3">
          <div className="w-11 h-11 rounded-full bg-[#FFF5EB] dark:bg-[#3A2A1A] flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-bold text-[#FF6B00]">{(ride.riderName || "R").charAt(0)}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] truncate">{ride.riderName || "Rider"}</p>
          </div>
        </div>

        {/* Mini Route Map */}
        <div className="relative h-32 rounded-xl overflow-hidden mb-3 bg-[#F1F1F1] dark:bg-[#0F172A]">
          <div ref={mapContainer} className="w-full h-full" />
          {mapLoadError && <MapUnavailable />}
        </div>

        {/* Route */}
        <div className="bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl p-4 mb-3">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-[#138808] flex-shrink-0" />
              <p className="text-sm text-[#1A1A2E] dark:text-[#E5E7EB]">{ride.pickupAddress}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-[#FF6B00] flex-shrink-0" />
              <p className="text-sm text-[#1A1A2E] dark:text-[#E5E7EB]">{ride.dropAddress}</p>
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="flex items-center gap-4 mb-3">
          <div className="flex items-center gap-1 text-sm text-[#6B7280] dark:text-[#9CA3AF]">
            <MapPin className="w-4 h-4" />
            {Number(ride.distance).toFixed(1)} KM
          </div>
          <div className="flex items-center gap-1 text-sm text-[#6B7280] dark:text-[#9CA3AF]">
            <Clock className="w-4 h-4" />
            {ride.estimatedTime} min
          </div>
        </div>

        {/* AI Suggestion */}
        <div className="bg-[#F3E8FF] dark:bg-[#2D1B4E] rounded-xl p-3 mb-4">
          <div className="flex items-center gap-1.5 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-[#7C3AED]" />
            <span className="text-xs font-semibold text-[#7C3AED]">AI Suggestion</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {aiTags.map((tag) => (
              <span key={tag} className="text-[10px] font-medium text-[#7C3AED] bg-white dark:bg-[#1E293B] px-2 py-1 rounded-full">
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between mb-6">
          <div>
            <span className="text-sm text-[#6B7280] dark:text-[#9CA3AF] block">Estimated Fare</span>
            <span className="text-xl font-bold text-[#1A1A2E] dark:text-[#E5E7EB]">₹{fare}</span>
          </div>
          <div className="text-right">
            <span className="text-sm text-[#6B7280] dark:text-[#9CA3AF] flex items-center justify-end gap-1">
              <IndianRupee className="w-3.5 h-3.5" /> Your Earnings
            </span>
            <span className="text-xl font-bold text-[#138808]">₹{earnings}</span>
          </div>
        </div>

        {/* Buttons */}
        <div className="space-y-3">
          <button onClick={handleAccept} disabled={isAccepting} className="w-full btn-green py-4 text-lg disabled:opacity-60">
            {isAccepting ? "Accepting…" : "Accept"}
          </button>

          {/* Swipe to reject */}
          <div
            ref={trackRef}
            className="relative w-full h-14 rounded-xl overflow-hidden border-2 border-[#DC2626] select-none touch-none"
            style={{ backgroundColor: `rgba(220,38,38,${0.08 + swipeProgress * 0.15})` }}
          >
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="text-sm font-semibold text-[#DC2626]">
                {swipeProgress > 0.65 ? "Release to Reject" : "Swipe to Reject →"}
              </span>
            </div>
            <div
              onPointerDown={handleTrackPointerDown}
              onPointerMove={handleTrackPointerMove}
              onPointerUp={handleTrackPointerUp}
              className="absolute top-1 left-1 w-11 h-11 rounded-lg bg-[#DC2626] flex items-center justify-center cursor-grab active:cursor-grabbing"
              style={{ transform: `translateX(${dragX}px)`, transition: dragging ? "none" : "transform 0.25s ease-out" }}
            >
              <ChevronsRight className="w-5 h-5 text-white" />
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-[#9CA3AF] dark:text-[#64748B] mt-3">
          Auto reject in {countdown} seconds
        </p>
      </div>
    </div>
  );
}
