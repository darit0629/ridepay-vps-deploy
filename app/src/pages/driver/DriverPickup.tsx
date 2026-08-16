import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { MapPin, Phone, MessageCircle, Send, X, Navigation, Sparkles, QrCode, Timer } from "lucide-react";
import QrScanner from "qr-scanner";
import QrScannerWorkerPath from "qr-scanner/qr-scanner-worker.min.js?url";
import MapViewToggle from "@/components/MapViewToggle";
import MapUnavailable from "@/components/MapUnavailable";
import { useGoogleMapViewToggle } from "@/hooks/useGoogleMapViewToggle";
import { hasGoogleMapsKey, loadGoogleMaps, GOOGLE_MAP_VECTOR_ID } from "@/lib/googleMaps";
import { createPickupIcon, createNavigationVehicleIcon } from "@/lib/googleMarkerIcons";
import { fetchSafeRoute } from "@/hooks/useSafeRoute";
import { useRickshawOverlay } from "@/hooks/useRickshawOverlay";
import { resolveHeading } from "@/lib/heading";
import { useTheme } from "@/contexts/ThemeContext";
import { useNotifications } from "@/contexts/NotificationsContext";
import RouteRestrictionBanner from "@/components/RouteRestrictionBanner";
import { trpc } from "@/providers/trpc";

QrScanner.WORKER_PATH = QrScannerWorkerPath;

// Rider's "Show QR Code" encodes ridepay:pickup-otp:<4 digits> — pull the
// last 4 digits out of whatever gets scanned rather than requiring an exact
// string match, so it still works if the payload format changes slightly.
function extractOtpFromScan(text: string): string[] | null {
  const digits = text.replace(/\D/g, "").slice(-4);
  return digits.length === 4 ? digits.split("") : null;
}

interface ChatMessage {
  from: "driver" | "customer";
  text: string;
}

export default function DriverPickup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const rideId = Number(searchParams.get("rideId"));
  const { data: ride } = trpc.ride.getById.useQuery(
    { id: rideId },
    { enabled: Number.isFinite(rideId) && rideId > 0, refetchInterval: 4000 }
  );
  const trpcUtils = trpc.useUtils();
  const { pushSystemNotification } = useNotifications();
  const verifyOtpMutation = trpc.ride.verifyOtp.useMutation();
  const updateStatusMutation = trpc.ride.updateStatus.useMutation();
  const driverCancelMutation = trpc.ride.driverCancel.useMutation();

  // Route Restriction system — see UserHome.tsx's identical pattern for why
  // this is keyed on the notice *timestamp*, not a boolean.
  const lastSeenRestrictionNoticeAtRef = useRef<number | null>(null);
  const [transientRestrictionNotice, setTransientRestrictionNotice] = useState<"rerouted" | null>(null);
  useEffect(() => {
    const noticeAt = ride?.routeRestrictionNoticeAt ? new Date(ride.routeRestrictionNoticeAt).getTime() : null;
    if (!noticeAt || noticeAt === lastSeenRestrictionNoticeAtRef.current) return;
    lastSeenRestrictionNoticeAtRef.current = noticeAt;

    const notice = ride?.routeRestrictionNotice;
    pushSystemNotification({
      audience: "driver",
      title: notice === "no_alternative" ? "No Alternative Route" : "Route Updated",
      message:
        notice === "no_alternative"
          ? "The road ahead is blocked and we couldn't find another way. Please contact support."
          : "Road ahead is currently blocked — we've found an alternative route.",
    });
    if (notice === "rerouted") {
      setTransientRestrictionNotice("rerouted");
      const timer = setTimeout(() => setTransientRestrictionNotice(null), 15000);
      return () => clearTimeout(timer);
    }
  }, [ride?.routeRestrictionNoticeAt, ride?.routeRestrictionNotice, pushSystemNotification]);

  const [otp, setOtp] = useState(["", "", "", ""]);
  const [otpError, setOtpError] = useState("");
  const [showOtp, setShowOtp] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scanError, setScanError] = useState("");
  const [etaSeconds, setEtaSeconds] = useState(240);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [driverCoords, setDriverCoords] = useState<google.maps.LatLngLiteral | null>(null);

  const scanVideoRef = useRef<HTMLVideoElement>(null);
  const qrScannerRef = useRef<QrScanner | null>(null);

  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);
  const driverMarkerRef = useRef<google.maps.Marker | null>(null);
  const pickupMarkerRef = useRef<google.maps.Marker | null>(null);
  const routePolylineRef = useRef<google.maps.Polyline | null>(null);
  const routeBoundsRef = useRef<google.maps.LatLngBounds | null>(null);
  const { mapView, toggleMapView: toggleTileView } = useGoogleMapViewToggle();
  const [mapLoadError, setMapLoadError] = useState(!hasGoogleMapsKey);
  const { theme } = useTheme();
  const rickshaw = useRickshawOverlay(mapInstance, "e-riksha");
  const lastDriverPosRef = useRef<google.maps.LatLngLiteral | null>(null);
  const lastRouteFetchPosRef = useRef<google.maps.LatLngLiteral | null>(null);
  const lastHeadingRef = useRef(0);
  const deviceHeadingRef = useRef<number | null>(null);

  const pickupCoords: google.maps.LatLngLiteral | null = ride
    ? { lat: parseFloat(ride.pickupLat), lng: parseFloat(ride.pickupLng) }
    : null;

  // Continuous real GPS (not a one-time snapshot) — this is the driver's own
  // device, so it can track live movement directly instead of polling
  // another person's position from the server. Also pushes to the server
  // (driver.updateLocation) — DriverDashboard.tsx only does this while it's
  // mounted, so without pushing here too, the rider's map would keep showing
  // wherever the driver was when they left the dashboard, frozen for the
  // rest of the ride.
  const updateLocationMutation = trpc.driver.updateLocation.useMutation();
  const lastLocationPushRef = useRef(0);
  const geoWatchIdRef = useRef<number | null>(null);
  useEffect(() => {
    if (!navigator.geolocation) return;
    geoWatchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, heading } = position.coords;
        deviceHeadingRef.current = heading;
        setDriverCoords({ lat: latitude, lng: longitude });
        const now = Date.now();
        if (now - lastLocationPushRef.current < 5000) return;
        lastLocationPushRef.current = now;
        updateLocationMutation.mutate({ lat: latitude.toString(), lng: longitude.toString() });
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
    return () => {
      if (geoWatchIdRef.current !== null) navigator.geolocation.clearWatch(geoWatchIdRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ride was cancelled by the rider (or otherwise left the pickup flow)
  // while this driver was en route.
  useEffect(() => {
    if (ride && ride.status !== "accepted" && ride.status !== "pickup" && ride.status !== "ongoing") {
      navigate("/driver/dashboard");
    }
    // Already-ongoing (OTP already verified, e.g. after a refresh) skips
    // straight to the dropoff/rental screen instead of asking for the OTP
    // again — an Hourly Rental has no fixed destination, so it gets its own
    // simpler "in progress" screen instead of DriverDropoff.tsx.
    if (ride?.status === "ongoing") {
      navigate(ride.isHourlyRental ? `/driver/rental-active?rideId=${ride.id}` : `/driver/ride-dropoff?rideId=${ride.id}`);
    }
  }, [ride, navigate]);

  // Arrival countdown while en route (pauses once OTP screen is shown)
  useEffect(() => {
    if (showOtp || etaSeconds <= 0) return;
    const timer = setTimeout(() => setEtaSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [etaSeconds, showOtp]);

  const etaLabel = `${Math.floor(etaSeconds / 60)}:${String(etaSeconds % 60).padStart(2, "0")}`;

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    setOtpError("");
    const newOtp = [...otp];
    newOtp[index] = value.slice(0, 1);
    setOtp(newOtp);
    if (value && index < 3) {
      document.getElementById(`driver-otp-${index + 1}`)?.focus();
    }
  };

  const handleScanQr = () => {
    setScanError("");
    setShowScanner(true);
  };

  // Real camera-based QR scan — opens while `showScanner` is true and tears
  // itself down on close/unmount so the camera stream doesn't stay live in
  // the background.
  useEffect(() => {
    if (!showScanner || !scanVideoRef.current) return;
    let disposed = false;
    setIsScanning(true);

    const scanner = new QrScanner(
      scanVideoRef.current,
      (result) => {
        const scannedOtp = extractOtpFromScan(result.data);
        if (!scannedOtp) return;
        setOtp(scannedOtp);
        setIsScanning(false);
        setShowScanner(false);
      },
      { highlightScanRegion: true, highlightCodeOutline: true, maxScansPerSecond: 5 }
    );
    qrScannerRef.current = scanner;

    scanner.start().catch((error) => {
      if (disposed) return;
      console.error("Error starting QR scanner:", error);
      setScanError("Couldn't access the camera. Check camera permissions, or enter the OTP manually.");
      setIsScanning(false);
    });

    return () => {
      disposed = true;
      scanner.stop();
      scanner.destroy();
      qrScannerRef.current = null;
      setIsScanning(false);
    };
  }, [showScanner]);

  const handleStartRide = () => {
    if (!ride || otp.some((d) => !d)) return;
    setOtpError("");
    verifyOtpMutation.mutate(
      { rideId: ride.id, otp: otp.join("") },
      {
        onSuccess: (result) => {
          if (!result.success) {
            setOtpError(result.message || "That OTP doesn't match — please check with the rider.");
            return;
          }
          navigate(ride.isHourlyRental ? `/driver/rental-active?rideId=${ride.id}` : `/driver/ride-dropoff?rideId=${ride.id}`);
        },
        onError: () => setOtpError("Couldn't verify the OTP — please try again."),
      }
    );
  };

  const handleSendMessage = () => {
    const text = chatInput.trim();
    if (!text) return;
    setMessages((prev) => [...prev, { from: "driver", text }]);
    setChatInput("");
  };

  useEffect(() => {
    if (!hasGoogleMapsKey || !mapContainer.current || !pickupCoords) return;

    let disposed = false;
    const startCoords = driverCoords ?? { lat: pickupCoords.lat + 0.01, lng: pickupCoords.lng + 0.01 };

    loadGoogleMaps()
      .then(() => {
        if (disposed || !mapContainer.current) return;

        const center: google.maps.LatLngLiteral = {
          lat: (startCoords.lat + pickupCoords.lat) / 2,
          lng: (startCoords.lng + pickupCoords.lng) / 2,
        };

        const gMap = new google.maps.Map(mapContainer.current, {
          center,
          zoom: 14,
          disableDefaultUI: true,
          zoomControl: true,
          zoomControlOptions: { position: google.maps.ControlPosition.RIGHT_BOTTOM },
          // WebGLOverlayView (the 3D vehicle) only works on vector maps.
          mapId: GOOGLE_MAP_VECTOR_ID,
          colorScheme: theme === "dark" ? google.maps.ColorScheme.DARK : google.maps.ColorScheme.LIGHT,
        });
        map.current = gMap;
        setMapInstance(gMap);

        // Vector maps compute their viewport lazily on the next tick —
        // without this they render into only a fraction of their actual
        // container until something else forces a relayout.
        setTimeout(() => {
          google.maps.event.trigger(gMap, "resize");
          gMap.setCenter(center);
        }, 100);

        // 2D fallback marker — stays hidden once the 3D overlay confirms it
        // can render, but keeps the screen functional immediately on maps
        // that can't do WebGL.
        driverMarkerRef.current = new google.maps.Marker({ position: startCoords, map: gMap, icon: createNavigationVehicleIcon(0), zIndex: 10 });
        pickupMarkerRef.current = new google.maps.Marker({ position: pickupCoords, map: gMap, icon: createPickupIcon() });
        // Position the 3D overlay immediately too — without this, if real
        // GPS is slow to arrive the 2D marker below gets hidden (once 3D is
        // detected as available) while the 3D model never got a position
        // set, leaving nothing visible on the map at all.
        rickshaw.setPosition(startCoords.lat, startCoords.lng, 0);

        const fallback = new google.maps.LatLngBounds();
        fallback.extend(startCoords);
        fallback.extend(pickupCoords);
        routeBoundsRef.current = fallback;

        const loadRoute = async () => {
          try {
            const route = await fetchSafeRoute(trpcUtils, startCoords, pickupCoords);
            if (!route || "noAlternative" in route) throw new Error("No route found");

            routePolylineRef.current = new google.maps.Polyline({
              path: route.path,
              strokeColor: "#FF6B00",
              strokeWeight: 4,
              strokeOpacity: 0.8,
            });
            routePolylineRef.current.setMap(gMap);
            gMap.fitBounds(route.bounds, 50);
            const routeBounds = new google.maps.LatLngBounds();
            route.path.forEach((p) => routeBounds.extend(p));
            routeBoundsRef.current = routeBounds;

            // The vehicle's actual position/heading comes from the live
            // geolocation-tracking effect below (real GPS) — this just
            // draws the initial route line.
            if (rickshaw.isAvailableRef.current) {
              driverMarkerRef.current?.setMap(null);
            }
          } catch (error) {
            console.error("Error fetching route:", error);
            routePolylineRef.current = new google.maps.Polyline({
              path: [startCoords, pickupCoords],
              strokeColor: "#FF6B00",
              strokeWeight: 4,
              strokeOpacity: 0.8,
            });
            routePolylineRef.current.setMap(gMap);
          }
        };

        loadRoute();
      })
      .catch((error) => {
        console.error("Error loading Google Maps:", error);
        setMapLoadError(true);
      });

    return () => {
      disposed = true;
      driverMarkerRef.current?.setMap(null);
      pickupMarkerRef.current?.setMap(null);
      routePolylineRef.current?.setMap(null);
    };
    // `colorScheme` can only be changed by recreating the vector map, so
    // this effect intentionally re-runs on theme change too.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, pickupCoords?.lat, pickupCoords?.lng]);

  // Real live tracking — moves the vehicle to this driver's actual current
  // GPS position every time watchPosition reports one, instead of leaving it
  // frozen at the initial snapshot. The road route/ETA countdown only
  // re-fetch once the driver has moved a meaningful distance.
  useEffect(() => {
    if (!driverCoords || !pickupCoords || !map.current) return;
    const gMap = map.current;
    const { lat, lng } = driverCoords;
    const heading = resolveHeading({
      previous: lastDriverPosRef.current,
      current: driverCoords,
      previousHeading: lastHeadingRef.current,
      deviceHeadingDeg: deviceHeadingRef.current,
    });
    lastDriverPosRef.current = driverCoords;
    lastHeadingRef.current = heading;

    if (rickshaw.isAvailableRef.current) {
      rickshaw.setPosition(lat, lng, heading);
    } else if (driverMarkerRef.current) {
      driverMarkerRef.current.setPosition(driverCoords);
      driverMarkerRef.current.setIcon(createNavigationVehicleIcon(heading));
    }

    const lastFetchPos = lastRouteFetchPosRef.current;
    const movedKm = lastFetchPos
      ? Math.sqrt((lastFetchPos.lat - lat) ** 2 + (lastFetchPos.lng - lng) ** 2) * 111
      : Infinity;
    if (movedKm < 0.05) return;
    lastRouteFetchPosRef.current = driverCoords;

    let cancelled = false;
    fetchSafeRoute(trpcUtils, driverCoords, pickupCoords)
      .then((route) => {
        if (cancelled || !route || "noAlternative" in route) return;
        routePolylineRef.current?.setMap(null);
        routePolylineRef.current = new google.maps.Polyline({
          path: route.path,
          strokeColor: "#FF6B00",
          strokeWeight: 4,
          strokeOpacity: 0.8,
        });
        routePolylineRef.current.setMap(gMap);
        gMap.fitBounds(route.bounds, 50);
        const routeBounds = new google.maps.LatLngBounds();
        route.path.forEach((p) => routeBounds.extend(p));
        routeBoundsRef.current = routeBounds;
        setEtaSeconds(Math.max(0, Math.round(route.durationMin * 60)));
        setDistanceKm(Math.max(0.1, Math.round(route.distanceKm * 10) / 10));
      })
      .catch((error) => console.error("Error refreshing pickup route:", error));

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverCoords, pickupCoords?.lat, pickupCoords?.lng, rickshaw]);

  const toggleMapView = () => toggleTileView(map.current);

  const handleRecenter = () => {
    if (!map.current || !routeBoundsRef.current) return;
    map.current.fitBounds(routeBoundsRef.current, 50);
  };

  if (!ride) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#F8F9FA] dark:bg-[#0F172A]">
        <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">Loading ride…</p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#F8F9FA] dark:bg-[#0F172A]">
      {/* Green Header */}
      <div className="bg-[#138808] px-4 pt-4 pb-6">
        <button
          onClick={() => navigate("/driver/dashboard")}
          className="mb-3"
        >
          <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-white font-bold text-lg">
              {showOtp ? "At Pickup" : "On the way to pickup"}
            </h1>
            <p className="text-white/80 text-sm">
              {showOtp ? "Get OTP from customer" : "Please reach the pickup location"}
            </p>
          </div>
          {!showOtp && (
            <div className="flex items-center gap-2">
              {distanceKm !== null && (
                <div className="bg-white/15 px-3 py-1.5 rounded-full">
                  <span className="text-white font-semibold text-sm">{distanceKm} km</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 bg-white/15 px-3 py-1.5 rounded-full">
                <Timer className="w-4 h-4 text-white" />
                <span className="text-white font-semibold text-sm">{etaLabel}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 pt-3">
        <RouteRestrictionBanner
          notice={ride?.routeRestrictionNotice === "no_alternative" ? "no_alternative" : transientRestrictionNotice}
          role="driver"
        />
      </div>

      {/* Map */}
      {!showOtp && (
        <div className="flex-1 relative">
          <div ref={mapContainer} className="w-full h-full" />
          {mapLoadError && <MapUnavailable />}

          {/* Map View Toggle Button */}
          <MapViewToggle mapView={mapView} onToggle={toggleMapView} />

          {/* Large floating navigation button */}
          <button
            onClick={handleRecenter}
            aria-label="Recenter navigation"
            className="absolute bottom-4 right-4 w-16 h-16 rounded-full bg-[#1E3A5F] shadow-[0_6px_20px_rgba(30,58,95,0.5)] flex items-center justify-center active:scale-90 transition-transform"
          >
            <Navigation className="w-7 h-7 text-white" />
          </button>
        </div>
      )}

      {/* Bottom Sheet */}
      <div className="bg-white dark:bg-[#1E293B] rounded-t-3xl shadow-lg -mt-4 relative z-10 max-h-[60vh] overflow-y-auto">
        <div className="w-12 h-1 bg-gray-200 dark:bg-gray-600 rounded-full mx-auto mt-3 mb-4" />

        <div className="px-4 pb-6 space-y-4">
          {!showOtp ? (
            <>
              {/* Pickup Info */}
              <div className="flex items-center gap-3">
                <MapPin className="w-5 h-5 text-[#138808]" />
                <div>
                  <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Pickup Location</p>
                  <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">{ride.pickupAddress}</p>
                </div>
              </div>

              {/* AI Pickup Tip */}
              <div className="flex items-start gap-2.5 bg-[#F3E8FF] dark:bg-[#2D1B4E] rounded-xl p-3">
                <Sparkles className="w-4 h-4 text-[#7C3AED] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-[#7C3AED] mb-0.5">AI Pickup Tip</p>
                  <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Look out for the rider near the pickup point</p>
                </div>
              </div>

              {/* Customer Info */}
              <div className="flex items-center gap-3 bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl p-3">
                <img
                  src="/assets/user-avatar.png"
                  alt={ride.riderName || "Rider"}
                  className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-[#1A1A2E] dark:text-[#E5E7EB] truncate">{ride.riderName || "Rider"}</p>
                </div>
                <button
                  onClick={() => setShowChat(true)}
                  className="w-10 h-10 rounded-full bg-[#E0F2FE] dark:bg-[#0C2536] flex items-center justify-center flex-shrink-0"
                  aria-label="Chat with customer"
                >
                  <MessageCircle className="w-5 h-5 text-[#0EA5E9]" />
                </button>
                <a
                  href={`tel:${ride.riderPhone || ""}`}
                  className="w-10 h-10 rounded-full bg-[#138808] flex items-center justify-center flex-shrink-0"
                  aria-label="Call customer"
                >
                  <Phone className="w-5 h-5 text-white" />
                </a>
              </div>

              <button
                onClick={() => {
                  setShowOtp(true);
                  if (ride) updateStatusMutation.mutate({ rideId: ride.id, status: "pickup" });
                }}
                className="w-full btn-green py-4 text-lg"
              >
                Reached Pickup
              </button>
              <button
                onClick={() => setShowCancelConfirm(true)}
                className="w-full text-center text-sm font-medium text-[#DC2626] py-2"
              >
                Cancel Ride
              </button>
            </>
          ) : (
            <>
              {/* OTP Section */}
              <div className="text-center">
                <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] mb-4">Ask the customer to read out their pickup OTP</p>

                <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] mb-4">Enter OTP to Start Ride</p>
                <div className="flex justify-center gap-3 mb-3">
                  {otp.map((digit, i) => (
                    <input
                      key={i}
                      id={`driver-otp-${i}`}
                      type="text"
                      value={digit}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      className="w-14 h-16 bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl text-center text-2xl font-bold text-[#1A1A2E] dark:text-[#E5E7EB] border-2 border-[#E5E7EB] dark:border-gray-700 focus:border-[#FF6B00] outline-none"
                      maxLength={1}
                    />
                  ))}
                </div>
                {otpError && <p className="text-xs text-[#DC2626] mb-3">{otpError}</p>}

                <button
                  onClick={handleScanQr}
                  disabled={isScanning}
                  className="flex items-center justify-center gap-2 mx-auto text-sm font-medium text-[#0EA5E9] bg-[#E0F2FE] dark:bg-[#0C2536] px-4 py-2 rounded-full mb-4 disabled:opacity-60"
                >
                  <QrCode className="w-4 h-4" /> {isScanning ? "Scanning..." : "Scan QR Instead"}
                </button>

                <p className="text-xs text-[#9CA3AF] dark:text-[#64748B] mb-4">OTP is mandatory to start the ride</p>

                <button
                  onClick={handleStartRide}
                  disabled={otp.some((d) => !d) || verifyOtpMutation.isPending}
                  className="w-full btn-green py-4 text-lg disabled:opacity-50"
                >
                  {verifyOtpMutation.isPending ? "Verifying…" : "Start Ride"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Chat Sheet */}
      {showChat && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center sm:justify-center" onClick={() => setShowChat(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative bg-white dark:bg-[#1E293B] w-full sm:max-w-sm sm:mx-4 sm:my-8 rounded-t-3xl sm:rounded-3xl flex flex-col overflow-hidden"
            style={{ height: "min(70vh, 520px)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
              <img src="/assets/user-avatar.png" alt={ride.riderName || "Rider"} className="w-9 h-9 rounded-full object-cover" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-[#1A1A2E] dark:text-[#E5E7EB] truncate">{ride.riderName || "Rider"}</p>
              </div>
              <button onClick={() => setShowChat(false)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full">
                <X className="w-4 h-4 text-[#6B7280] dark:text-[#9CA3AF]" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5 bg-[#F8F9FA] dark:bg-[#0F172A]">
              {messages.length === 0 ? (
                <p className="text-xs text-center text-[#9CA3AF] mt-4">No messages yet</p>
              ) : (
                messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.from === "driver" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                        msg.from === "driver" ? "bg-[#138808] text-white rounded-br-sm" : "bg-white dark:bg-[#1E293B] text-[#1A1A2E] dark:text-[#E5E7EB] shadow-sm rounded-bl-sm"
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="border-t border-gray-100 dark:border-gray-700 p-3 flex items-center gap-2 flex-shrink-0">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                placeholder="Type a message..."
                className="flex-1 bg-[#F8F9FA] dark:bg-[#0F172A] text-[#1A1A2E] dark:text-[#E5E7EB] rounded-full px-4 py-2.5 text-sm outline-none border border-transparent focus:border-[#138808]"
              />
              <button
                onClick={handleSendMessage}
                disabled={!chatInput.trim()}
                className="w-10 h-10 rounded-full bg-[#138808] flex items-center justify-center flex-shrink-0 disabled:opacity-50"
              >
                <Send className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Ride Sheet */}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center sm:justify-center" onClick={() => setShowCancelConfirm(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative bg-white dark:bg-[#1E293B] w-full sm:max-w-sm sm:mx-4 rounded-t-3xl sm:rounded-3xl p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <p className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">Cancel this ride?</p>
              <button onClick={() => setShowCancelConfirm(false)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full">
                <X className="w-4 h-4 text-[#6B7280] dark:text-[#9CA3AF]" />
              </button>
            </div>
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">
              Cancelling after accepting may carry a penalty per your account's cancellation policy.
            </p>
            <div>
              <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-1.5 block">Reason</label>
              <select
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-4 py-3 text-sm outline-none border border-gray-100 dark:border-gray-700 focus:border-[#FF6B00] text-[#1A1A2E] dark:text-[#E5E7EB]"
              >
                <option value="">Select a reason…</option>
                <option value="Passenger not reachable">Passenger not reachable</option>
                <option value="Vehicle issue">Vehicle issue</option>
                <option value="Wrong pickup location">Wrong pickup location</option>
                <option value="Emergency">Emergency</option>
                <option value="Safety concern">Safety concern</option>
              </select>
            </div>
            {driverCancelMutation.error && (
              <p className="text-xs text-[#DC2626]">{driverCancelMutation.error.message}</p>
            )}
            <button
              onClick={() => {
                if (!ride || !cancelReason) return;
                driverCancelMutation.mutate(
                  { rideId: ride.id, reason: cancelReason },
                  {
                    onSuccess: () => {
                      setShowCancelConfirm(false);
                      navigate("/driver/dashboard");
                    },
                  }
                );
              }}
              disabled={!cancelReason || driverCancelMutation.isPending}
              className="w-full bg-[#DC2626] text-white font-semibold py-3.5 rounded-xl disabled:opacity-50"
            >
              {driverCancelMutation.isPending ? "Cancelling…" : "Confirm Cancellation"}
            </button>
          </div>
        </div>
      )}

      {/* QR Scanner Sheet */}
      {showScanner && (
        <div className="fixed inset-0 z-[70] bg-black flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 flex-shrink-0">
            <p className="text-white font-semibold text-sm">Scan customer's QR code</p>
            <button
              onClick={() => setShowScanner(false)}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              aria-label="Close scanner"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
          <div className="flex-1 relative overflow-hidden">
            <video ref={scanVideoRef} className="absolute inset-0 w-full h-full object-cover" muted playsInline />
          </div>
          <div className="px-6 py-5 flex-shrink-0 text-center">
            {scanError ? (
              <p className="text-sm text-red-400">{scanError}</p>
            ) : (
              <p className="text-sm text-white/70">Point the camera at the OTP QR code shown on the customer's phone</p>
            )}
            <button
              onClick={() => setShowScanner(false)}
              className="mt-3 text-sm font-medium text-[#FF6B00]"
            >
              Enter OTP manually instead
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
