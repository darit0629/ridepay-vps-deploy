import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { trpc } from "@/providers/trpc";
import {
  Navigation, MapPin, Phone, MessageCircle, ShieldAlert, X, Send, Sparkles,
  Gauge, Clock, BatteryCharging, Volume2, VolumeX,
  AlertTriangle, Construction, CloudRain, Shield, TrainFront,
} from "lucide-react";
import MapViewToggle from "@/components/MapViewToggle";
import MapUnavailable from "@/components/MapUnavailable";
import { useGoogleMapViewToggle } from "@/hooks/useGoogleMapViewToggle";
import { hasGoogleMapsKey, loadGoogleMaps, GOOGLE_MAP_VECTOR_ID } from "@/lib/googleMaps";
import { createDestinationIcon, createNavigationVehicleIcon } from "@/lib/googleMarkerIcons";
import { fetchSafeRoute } from "@/hooks/useSafeRoute";
import { useRickshawOverlay } from "@/hooks/useRickshawOverlay";
import { resolveHeading } from "@/lib/heading";
import { useTheme } from "@/contexts/ThemeContext";
import { useNotifications } from "@/contexts/NotificationsContext";
import RouteRestrictionBanner from "@/components/RouteRestrictionBanner";

const AI_ALERTS = [
  { label: "Heavy Traffic Ahead", icon: AlertTriangle, color: "#FF6B00", bg: "#FFF5EB" },
  { label: "Road Closed - Station Rd", icon: Construction, color: "#DC2626", bg: "#FEE2E2" },
  { label: "Flood Alert Nearby", icon: CloudRain, color: "#0EA5E9", bg: "#E0F2FE" },
  { label: "Police Check Ahead", icon: Shield, color: "#7C3AED", bg: "#F3E8FF" },
  { label: "Railway Gate Closed", icon: TrainFront, color: "#CA8A04", bg: "#FEF9C3" },
];

interface ChatMessage {
  from: "driver" | "customer";
  text: string;
}

export default function DriverDropoff() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const rideId = Number(searchParams.get("rideId"));
  const { data: ride } = trpc.ride.getById.useQuery(
    { id: rideId },
    { enabled: Number.isFinite(rideId) && rideId > 0, refetchInterval: 5000 }
  );

  // Ride was ended/cancelled from elsewhere while this driver was en route.
  useEffect(() => {
    if (ride && ride.status !== "ongoing") navigate("/driver/dashboard");
  }, [ride, navigate]);

  const trpcUtils = trpc.useUtils();
  const { pushSystemNotification } = useNotifications();
  const startWaitingMutation = trpc.ride.startWaiting.useMutation();

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
  const advanceStopMutation = trpc.ride.advanceStop.useMutation();

  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const driverMarkerRef = useRef<google.maps.Marker | null>(null);
  const dropoffMarkerRef = useRef<google.maps.Marker | null>(null);
  const routePolylineRef = useRef<google.maps.Polyline | null>(null);
  const trafficLayerRef = useRef<google.maps.TrafficLayer | null>(null);
  const { mapView, toggleMapView: toggleTileView } = useGoogleMapViewToggle();
  const [mapLoadError, setMapLoadError] = useState(!hasGoogleMapsKey);
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);
  const rickshaw = useRickshawOverlay(mapInstance, "e-riksha");
  const { theme } = useTheme();

  // Continuous real GPS (not a one-time snapshot) — this is the driver's own
  // device, so unlike the rider-facing screens (which poll another person's
  // position from the server), it can track live movement directly. Also
  // pushes to the server (driver.updateLocation) — DriverDashboard.tsx only
  // does this while it's mounted, so without pushing here too, the rider's
  // map would keep showing wherever the driver was when they left the
  // dashboard, frozen for the rest of the ride.
  const [driverGeo, setDriverGeo] = useState<google.maps.LatLngLiteral | null>(null);
  const updateLocationMutation = trpc.driver.updateLocation.useMutation();
  const lastLocationPushRef = useRef(0);
  const geoWatchIdRef = useRef<number | null>(null);
  useEffect(() => {
    if (!navigator.geolocation) return;
    geoWatchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, heading } = position.coords;
        deviceHeadingRef.current = heading;
        setDriverGeo({ lat: latitude, lng: longitude });
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
  const lastDriverPosRef = useRef<google.maps.LatLngLiteral | null>(null);
  const lastRouteFetchPosRef = useRef<google.maps.LatLngLiteral | null>(null);
  const lastHeadingRef = useRef(0);
  const deviceHeadingRef = useRef<number | null>(null);
  // On a Wait & Return's return leg, the driver never left — the same
  // "reach the destination" logic below just needs to target the original
  // pickup point instead of the drop point for this second half of the trip.
  const isReturnLeg = !!ride?.isWaitAndReturn && !!ride?.returnStartedAt;
  // Multi Stop: while stops remain, "the destination" is whichever waypoint
  // is next, not the real final drop — same generalization as isReturnLeg
  // above, just a different source for the coordinates.
  const stops = ride?.stops ?? [];
  const currentStopIndex = ride?.currentStopIndex ?? 0;
  const hasRemainingStops = currentStopIndex < stops.length;
  const currentStop = hasRemainingStops ? stops[currentStopIndex] : null;
  const dropoffCoords: google.maps.LatLngLiteral | null = ride
    ? isReturnLeg
      ? { lat: parseFloat(ride.pickupLat), lng: parseFloat(ride.pickupLng) }
      : currentStop
      ? { lat: parseFloat(currentStop.lat), lng: parseFloat(currentStop.lng) }
      : { lat: parseFloat(ride.dropLat), lng: parseFloat(ride.dropLng) }
    : null;
  const driverCoords: google.maps.LatLngLiteral = driverGeo ?? dropoffCoords ?? { lat: 22.69, lng: 88.37 };

  // distance/eta are genuinely async (come from the route-fetch effect
  // below) so they stay as state; the address is a direct mirror of the
  // real ride and is read straight from `ride` at the display site instead.
  const [dropoff, setDropoff] = useState({
    distance: "",
    eta: "",
  });
  // Straight-line GPS distance to the real drop-off point — gates the
  // end-ride action independently of the Directions API (which can fail or
  // lag), so "has the driver actually arrived" never depends on a 3rd-party
  // call succeeding. 120m covers normal GPS drift without letting the driver
  // end the trip from streets away. Derived directly from driverGeo/
  // dropoffCoords during render (both already available there) rather than
  // stashed in state via an effect — it's a pure calculation, not something
  // that needs to synchronize with an external system.
  const ARRIVAL_RADIUS_KM = 0.12;
  const hasArrivedAtDropoff =
    !!driverGeo && !!dropoffCoords && typeof google !== "undefined" && !!google.maps?.geometry?.spherical
      ? google.maps.geometry.spherical.computeDistanceBetween(
          new google.maps.LatLng(driverGeo),
          new google.maps.LatLng(dropoffCoords)
        ) /
          1000 <=
        ARRIVAL_RADIUS_KM
      : false;

  const passenger = { name: ride?.riderName || "Rider", phone: ride?.riderPhone || "" };

  const [speedKmh, setSpeedKmh] = useState(24);
  const [batteryPercent] = useState(78);
  const [voiceOn, setVoiceOn] = useState(false);
  const [alertIndex, setAlertIndex] = useState(0);
  const [showChat, setShowChat] = useState(false);
  const [showEmergencyConfirm, setShowEmergencyConfirm] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([{ from: "customer", text: "Please hurry, I have a train to catch!" }]);
  const [chatInput, setChatInput] = useState("");

  // Real next-turn instruction from the Directions API's route steps
  // (steps[0] is always the upcoming maneuver from wherever the route was
  // just fetched from — the driver's current position) — replaces a
  // previously hardcoded, always-identical placeholder string.
  const [turnInstruction, setTurnInstruction] = useState("Head towards the drop-off point");

  // Simulated live speed readout
  useEffect(() => {
    const timer = setInterval(() => {
      setSpeedKmh((prev) => {
        const delta = Math.round((Math.random() - 0.5) * 10);
        return Math.max(0, Math.min(38, prev + delta));
      });
    }, 2200);
    return () => clearInterval(timer);
  }, []);

  // Cycle through AI alerts
  useEffect(() => {
    const timer = setInterval(() => setAlertIndex((i) => (i + 1) % AI_ALERTS.length), 5000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!hasGoogleMapsKey || !mapContainer.current || !dropoffCoords) return;
    const dropoffPoint = dropoffCoords;

    let disposed = false;

    loadGoogleMaps()
      .then(() => {
        if (disposed || !mapContainer.current) return;

        const center: google.maps.LatLngLiteral = {
          lat: (driverCoords.lat + dropoffPoint.lat) / 2,
          lng: (driverCoords.lng + dropoffPoint.lng) / 2,
        };

        const gMap = new google.maps.Map(mapContainer.current, {
          center,
          zoom: 13,
          disableDefaultUI: true,
          zoomControl: true,
          zoomControlOptions: { position: google.maps.ControlPosition.RIGHT_BOTTOM },
          // WebGLOverlayView (used for the 3D rickshaw marker) only works on
          // vector maps, which requires a Map ID configured for Vector
          // rendering in Cloud Console.
          mapId: GOOGLE_MAP_VECTOR_ID,
          colorScheme: theme === "dark" ? google.maps.ColorScheme.DARK : google.maps.ColorScheme.LIGHT,
        });
        map.current = gMap;
        setMapInstance(gMap);
        rickshaw.setPosition(driverCoords.lat, driverCoords.lng, 0);

        // Vector maps (mapId-based) compute their viewport lazily on the
        // next tick — without this, the map renders into only a fraction of
        // its actual container until something else forces a relayout.
        setTimeout(() => {
          google.maps.event.trigger(gMap, "resize");
          gMap.setCenter(center);
        }, 100);

        trafficLayerRef.current = new google.maps.TrafficLayer();
        trafficLayerRef.current.setMap(gMap);

        // 2D fallback marker — stays hidden once the 3D overlay confirms it
        // can render (needs a Map ID configured for Vector rendering), but
        // keeps the screen functional immediately on maps that can't do WebGL.
        driverMarkerRef.current = new google.maps.Marker({ position: driverCoords, map: gMap, icon: createNavigationVehicleIcon(0), zIndex: 10 });
        dropoffMarkerRef.current = new google.maps.Marker({ position: dropoffPoint, map: gMap, icon: createDestinationIcon() });

        const loadRoute = async () => {
          try {
            const route = await fetchSafeRoute(trpcUtils, driverCoords, dropoffPoint);
            if (!route || "noAlternative" in route) throw new Error("No route found");

            setDropoff((prev) => ({
              ...prev,
              distance: `${(Math.round(route.distanceKm * 10) / 10).toFixed(1)} KM`,
              eta: `${Math.round(route.durationMin)} min`,
            }));
            if (route.steps[0]) setTurnInstruction(route.steps[0].instruction);

            routePolylineRef.current = new google.maps.Polyline({
              path: route.path,
              strokeColor: "#138808",
              strokeWeight: 5,
              strokeOpacity: 0.85,
              icons: [{
                icon: { path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW, scale: 3, fillColor: "#FF6B00", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 1 },
                offset: "0%",
                repeat: "90px",
              }],
            });
            routePolylineRef.current.setMap(gMap);
            gMap.fitBounds(route.bounds, 60);

            // The vehicle's actual position/heading comes from the live
            // geolocation-tracking effect below (real GPS, not a scripted
            // animation along this route) — this just draws the initial
            // route line and shows the 3D overlay in place immediately.
            if (rickshaw.isAvailableRef.current) {
              driverMarkerRef.current?.setMap(null);
            }
          } catch (error) {
            console.error("Error fetching route:", error);
            routePolylineRef.current = new google.maps.Polyline({
              path: [driverCoords, dropoffPoint],
              strokeColor: "#138808",
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
      dropoffMarkerRef.current?.setMap(null);
      routePolylineRef.current?.setMap(null);
      trafficLayerRef.current?.setMap(null);
    };
    // `colorScheme` can only be set when a vector map is initialized (Google
    // Maps API constraint — it can't be live-patched via setOptions like the
    // classic `styles` array), so this effect intentionally re-runs and
    // recreates the map whenever the app's theme changes. Also re-runs once
    // dropoffCoords actually arrives from the real ride query (initially null).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, dropoffCoords?.lat, dropoffCoords?.lng]);

  // Real live tracking — moves the vehicle to this driver's actual current
  // GPS position every time watchPosition reports one, instead of a scripted
  // animation along the route on a fixed timer. The road route/distance/ETA
  // only re-fetch once the driver has moved a meaningful distance.
  useEffect(() => {
    if (!driverGeo || !dropoffCoords || !map.current) return;
    const gMap = map.current;
    const { lat, lng } = driverGeo;
    const heading = resolveHeading({
      previous: lastDriverPosRef.current,
      current: driverGeo,
      previousHeading: lastHeadingRef.current,
      deviceHeadingDeg: deviceHeadingRef.current,
    });
    lastDriverPosRef.current = driverGeo;
    lastHeadingRef.current = heading;

    if (rickshaw.isAvailableRef.current) {
      rickshaw.setPosition(lat, lng, heading);
    } else if (driverMarkerRef.current) {
      driverMarkerRef.current.setPosition(driverGeo);
      driverMarkerRef.current.setIcon(createNavigationVehicleIcon(heading));
    }

    const lastFetchPos = lastRouteFetchPosRef.current;
    const movedKm = lastFetchPos
      ? Math.sqrt((lastFetchPos.lat - lat) ** 2 + (lastFetchPos.lng - lng) ** 2) * 111
      : Infinity;
    if (movedKm < 0.05) return;
    lastRouteFetchPosRef.current = driverGeo;

    let cancelled = false;
    fetchSafeRoute(trpcUtils, driverGeo, dropoffCoords)
      .then((route) => {
        if (cancelled || !route || "noAlternative" in route) return;
        setDropoff((prev) => ({
          ...prev,
          distance: `${(Math.round(route.distanceKm * 10) / 10).toFixed(1)} KM`,
          eta: `${Math.round(route.durationMin)} min`,
        }));
        if (route.steps[0]) setTurnInstruction(route.steps[0].instruction);
        routePolylineRef.current?.setMap(null);
        routePolylineRef.current = new google.maps.Polyline({
          path: route.path,
          strokeColor: "#138808",
          strokeWeight: 5,
          strokeOpacity: 0.85,
          icons: [{
            icon: { path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW, scale: 3, fillColor: "#FF6B00", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 1 },
            offset: "0%",
            repeat: "90px",
          }],
        });
        routePolylineRef.current.setMap(gMap);
        gMap.fitBounds(route.bounds, 60);
      })
      .catch((error) => console.error("Error refreshing dropoff route:", error));

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverGeo, dropoffCoords?.lat, dropoffCoords?.lng, rickshaw]);

  const toggleMapView = () => toggleTileView(map.current);

  const toggleVoiceNav = () => {
    setVoiceOn((prev) => {
      const next = !prev;
      if (next && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(turnInstruction));
      }
      return next;
    });
  };

  const handleSendMessage = () => {
    const text = chatInput.trim();
    if (!text) return;
    setMessages((prev) => [...prev, { from: "driver", text }]);
    setChatInput("");
  };

  const activeAlert = AI_ALERTS[alertIndex];

  return (
    <div className="h-screen flex flex-col bg-[#F8F9FA] dark:bg-[#0F172A]">
      {/* Green Header */}
      <div className="bg-[#138808] px-4 pt-4 pb-6">
        <div className="flex items-center justify-between mb-1">
          <button onClick={() => navigate(-1)}>
            <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <span className="flex items-center gap-1 text-[10px] font-semibold text-white bg-white/15 px-2.5 py-1 rounded-full">
            <Sparkles className="w-3 h-3" /> AI Route
          </span>
        </div>
        <h1 className="text-white font-bold text-lg">Ride in Progress</h1>
        <p className="text-white/80 text-sm">{isReturnLeg ? "Return Trip — Towards Pickup" : "Towards Drop-off"}</p>
      </div>

      {(ride?.routeRestrictionNotice === "no_alternative" || transientRestrictionNotice) && (
        <div className="px-4 pt-3 bg-[#F8F9FA] dark:bg-[#0F172A]">
          <RouteRestrictionBanner
            notice={ride?.routeRestrictionNotice === "no_alternative" ? "no_alternative" : transientRestrictionNotice}
            role="driver"
          />
        </div>
      )}

      {/* Map */}
      <div className="flex-1 relative">
        <div ref={mapContainer} className="w-full h-full" />
        {mapLoadError && <MapUnavailable />}

        <MapViewToggle mapView={mapView} onToggle={toggleMapView} />

        {/* Upcoming Turn — large card */}
        <div className="absolute top-4 left-4 right-16 bg-[#1E3A5F] rounded-2xl p-4 shadow-lg">
          <div className="flex items-center gap-3">
            <Navigation className="w-7 h-7 text-white flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-sm truncate">{turnInstruction}</p>
              <p className="text-white/70 text-xs">Lane guidance: keep right</p>
            </div>
            <button
              onClick={toggleVoiceNav}
              aria-label="Toggle voice navigation"
              className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0"
            >
              {voiceOn ? <Volume2 className="w-4 h-4 text-white" /> : <VolumeX className="w-4 h-4 text-white/70" />}
            </button>
          </div>
        </div>

        {/* AI Alert banner */}
        <div
          className="absolute left-4 right-4 rounded-xl p-2.5 shadow-md flex items-center gap-2 transition-colors duration-500"
          style={{ top: "108px", backgroundColor: activeAlert.bg }}
        >
          <activeAlert.icon className="w-4 h-4 flex-shrink-0" style={{ color: activeAlert.color }} />
          <span className="text-xs font-medium truncate" style={{ color: activeAlert.color }}>{activeAlert.label}</span>
        </div>

      </div>

      {/* Live stats row */}
      <div className="bg-white dark:bg-[#1E293B] grid grid-cols-4 gap-px px-0 border-t border-gray-100 dark:border-gray-700">
        <div className="text-center py-2.5">
          <Gauge className="w-4 h-4 text-[#0EA5E9] mx-auto mb-0.5" />
          <p className="text-sm font-bold text-[#1A1A2E] dark:text-[#E5E7EB]">{speedKmh}</p>
          <p className="text-[9px] text-[#9CA3AF] dark:text-[#64748B]">km/h</p>
        </div>
        <div className="text-center py-2.5">
          <Clock className="w-4 h-4 text-[#7C3AED] mx-auto mb-0.5" />
          <p className="text-sm font-bold text-[#1A1A2E] dark:text-[#E5E7EB]">{dropoff.eta}</p>
          <p className="text-[9px] text-[#9CA3AF] dark:text-[#64748B]">ETA</p>
        </div>
        <div className="text-center py-2.5">
          <MapPin className="w-4 h-4 text-[#FF6B00] mx-auto mb-0.5" />
          <p className="text-sm font-bold text-[#1A1A2E] dark:text-[#E5E7EB]">{dropoff.distance}</p>
          <p className="text-[9px] text-[#9CA3AF] dark:text-[#64748B]">Left</p>
        </div>
        <div className="text-center py-2.5">
          <BatteryCharging className="w-4 h-4 text-[#138808] mx-auto mb-0.5" />
          <p className="text-sm font-bold text-[#1A1A2E] dark:text-[#E5E7EB]">{batteryPercent}%</p>
          <p className="text-[9px] text-[#9CA3AF] dark:text-[#64748B]">Battery</p>
        </div>
      </div>

      {/* Bottom Sheet */}
      <div className="bg-white dark:bg-[#1E293B] rounded-t-3xl shadow-lg relative z-10">
        <div className="w-12 h-1 bg-gray-200 dark:bg-gray-600 rounded-full mx-auto mt-3 mb-4" />

        <div className="px-4 pb-6 space-y-3">
          <div className="flex items-center gap-3">
            <MapPin className="w-5 h-5 text-[#FF6B00]" />
            <div>
              <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">
                {isReturnLeg ? "Return to" : currentStop ? `Stop ${currentStopIndex + 1} of ${stops.length}` : "Drop-off"}
              </p>
              <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">
                {isReturnLeg ? ride?.pickupAddress : currentStop ? currentStop.address : ride?.dropAddress}
              </p>
            </div>
          </div>

          {/* Passenger Card */}
          <div className="flex items-center gap-3 bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl p-3">
            <img src="/assets/user-avatar.png" alt={passenger.name} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB] truncate">{passenger.name}</p>
            </div>
            <button
              onClick={() => setShowChat(true)}
              className="w-9 h-9 rounded-full bg-[#E0F2FE] dark:bg-[#0C2536] flex items-center justify-center flex-shrink-0"
              aria-label="Chat"
            >
              <MessageCircle className="w-4 h-4 text-[#0EA5E9]" />
            </button>
            <a href={`tel:${passenger.phone.replace(/\s/g, "")}`} className="w-9 h-9 rounded-full bg-[#E8F5E8] dark:bg-[#1A3A22] flex items-center justify-center flex-shrink-0" aria-label="Call">
              <Phone className="w-4 h-4 text-[#138808]" />
            </a>
            <button
              onClick={() => setShowEmergencyConfirm(true)}
              className="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0"
              aria-label="Emergency"
            >
              <ShieldAlert className="w-4 h-4 text-[#DC2626]" />
            </button>
          </div>

          <button
            onClick={() => {
              if (!hasArrivedAtDropoff) return;
              if (currentStop) {
                // Multi Stop: stay on this same screen — advancing
                // currentStopIndex flips dropoffCoords to the next waypoint
                // (or the real final drop) reactively via the poll above.
                advanceStopMutation.mutate({ rideId });
              } else if (ride?.isWaitAndReturn && !isReturnLeg) {
                startWaitingMutation.mutate({ rideId }, { onSuccess: () => navigate(`/driver/waiting?rideId=${rideId}`) });
              } else {
                navigate(`/driver/end-ride?rideId=${rideId}`);
              }
            }}
            disabled={!hasArrivedAtDropoff || startWaitingMutation.isPending || advanceStopMutation.isPending}
            title={hasArrivedAtDropoff ? undefined : "Keep driving — you need to reach the drop-off point first"}
            className="w-full bg-[#1E3A5F] text-white font-semibold py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-[#2C5282] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Navigation className="w-5 h-5" />
            {!hasArrivedAtDropoff
              ? "Continue Navigation"
              : currentStop
              ? `Reached Stop ${currentStopIndex + 1} — Next`
              : ride?.isWaitAndReturn && !isReturnLeg
              ? "Reached Destination — Wait for Rider"
              : "Reached Drop-off"}
          </button>
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
              <img src="/assets/user-avatar.png" alt={passenger.name} className="w-9 h-9 rounded-full object-cover" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-[#1A1A2E] dark:text-[#E5E7EB] truncate">{passenger.name}</p>
              </div>
              <button onClick={() => setShowChat(false)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full">
                <X className="w-4 h-4 text-[#6B7280] dark:text-[#9CA3AF]" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5 bg-[#F8F9FA] dark:bg-[#0F172A]">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.from === "driver" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                      msg.from === "driver" ? "bg-[#138808] text-white rounded-br-sm" : "bg-white dark:bg-[#1E293B] text-[#1A1A2E] dark:text-[#E5E7EB] shadow-sm rounded-bl-sm"
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
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

      {/* Emergency Confirm */}
      {showEmergencyConfirm && (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-end sm:items-center sm:justify-center" onClick={() => setShowEmergencyConfirm(false)}>
          <div className="bg-white dark:bg-[#1E293B] rounded-t-3xl sm:rounded-3xl sm:my-8 w-full sm:max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-[#3A1A1A] flex items-center justify-center mb-3">
              <ShieldAlert className="w-6 h-6 text-[#DC2626]" />
            </div>
            <h2 className="font-bold text-lg text-[#1A1A2E] dark:text-[#E5E7EB] mb-1">Emergency SOS</h2>
            <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF] mb-5">This will call emergency services (100) and share your live location.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowEmergencyConfirm(false)} className="flex-1 py-3 rounded-xl text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB] bg-gray-100 dark:bg-gray-800">
                Cancel
              </button>
              <a href="tel:100" className="flex-1 py-3 rounded-xl text-sm font-semibold text-white bg-[#DC2626] text-center hover:bg-[#B91C1C] transition-colors">
                Call 100
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
