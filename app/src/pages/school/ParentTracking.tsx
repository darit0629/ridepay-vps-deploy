import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, MapPin, Clock, Phone, Bell, ShieldCheck } from "lucide-react";
import MapUnavailable from "@/components/MapUnavailable";
import { hasGoogleMapsKey, loadGoogleMaps, GOOGLE_MAP_VECTOR_ID } from "@/lib/googleMaps";
import { createDriverIcon } from "@/lib/googleMarkerIcons";
import { useMapTheme } from "@/hooks/useMapTheme";
import { useTheme } from "@/contexts/ThemeContext";
import { useRickshawOverlay } from "@/hooks/useRickshawOverlay";
import { trpc } from "@/providers/trpc";
import { MORNING_STAGES, EVENING_STAGES, STAGE_LABELS } from "@/lib/schoolStages";

const vehicleCoords: google.maps.LatLngLiteral = { lat: 23.178, lng: 88.5605 };
const schoolCoords: google.maps.LatLngLiteral = { lat: 23.1745, lng: 88.5605 };

// Parent-facing phrasing for each real trip stage, shown as a notification
// feed — same stage keys SchoolDashboard.tsx uses for its own timeline.
const NOTIFICATION_TEXT: Record<string, string> = {
  driver_assigned: "A driver has been assigned for today's trip.",
  driver_started: "The school vehicle has started its route.",
  near_pickup: "The vehicle is near the pickup point.",
  arrived_pickup: "The vehicle has arrived at the pickup point.",
  student_boarded: "Your child has boarded the vehicle.",
  pickup_confirmed: "Pickup confirmed.",
  left_pickup: "The vehicle has left the pickup point.",
  reached_school: "The vehicle has reached school.",
  left_school: "The vehicle has left school.",
  near_home: "The vehicle is near home.",
  reached_home: "The vehicle has reached home.",
  student_dropped: "Your child was dropped off safely.",
  trip_completed: "Trip completed.",
};

export default function ParentTracking() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const vehicleMarkerRef = useRef<google.maps.Marker | null>(null);
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);
  const [mapLoadError, setMapLoadError] = useState(!hasGoogleMapsKey);
  const { theme } = useTheme();
  useMapTheme(map, true);
  const schoolVehicle = useRickshawOverlay(mapInstance, "e-riksha-school");

  const direction = new Date().getHours() < 13 ? "morning" : "evening";
  const stages = direction === "morning" ? MORNING_STAGES : EVENING_STAGES;

  const { data: sub } = trpc.school.getSubscription.useQuery({ id: id ?? "" }, { enabled: !!id, refetchInterval: 8000, refetchIntervalInBackground: true });
  const { data: trip } = trpc.school.getTodayTrip.useQuery({ subscriptionId: id ?? "", direction }, { enabled: !!id, refetchInterval: 5000, refetchIntervalInBackground: true });
  const { data: attendance } = trpc.school.listAttendance.useQuery({ subscriptionId: id ?? "", limit: 5 }, { enabled: !!id });

  useEffect(() => {
    if (!hasGoogleMapsKey || !mapContainer.current) return;

    let disposed = false;

    loadGoogleMaps()
      .then(() => {
        if (disposed || !mapContainer.current) return;

        const gMap = new google.maps.Map(mapContainer.current, {
          center: vehicleCoords,
          zoom: 14,
          disableDefaultUI: true,
          zoomControl: true,
          mapId: GOOGLE_MAP_VECTOR_ID,
          colorScheme: theme === "dark" ? google.maps.ColorScheme.DARK : google.maps.ColorScheme.LIGHT,
        });
        map.current = gMap;
        setMapInstance(gMap);

        // 2D fallback for maps without WebGLOverlayView support — hidden
        // shortly after mount if the 3D school-vehicle overlay comes up instead.
        vehicleMarkerRef.current = new google.maps.Marker({ position: vehicleCoords, map: gMap, icon: createDriverIcon() });
        new google.maps.Marker({
          position: schoolCoords,
          map: gMap,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: "#1E3A5F",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2,
          },
        });

        schoolVehicle.setPosition(vehicleCoords.lat, vehicleCoords.lng, 0);
        // Capability check resolves synchronously once the overlay hook's own
        // effect runs on the next render — give it a beat, then defer to
        // whichever turned out to actually be available.
        setTimeout(() => {
          if (schoolVehicle.isAvailableRef.current) vehicleMarkerRef.current?.setMap(null);
        }, 300);
      })
      .catch((error) => {
        console.error("Error loading Google Maps:", error);
        setMapLoadError(true);
      });

    return () => {
      disposed = true;
    };
    // Mount-once map init, matching every other map screen in this app —
    // theme is read once here and kept in sync afterward by useMapTheme();
    // schoolVehicle's setPosition/isAvailableRef are stable across renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!sub) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0F172A] flex items-center justify-center">
        <p className="text-sm text-[#9CA3AF]">Loading...</p>
      </div>
    );
  }

  const currentStageIdx = trip?.stageIndex ?? -1;
  const currentStageLabel = currentStageIdx >= 0 ? STAGE_LABELS[stages[currentStageIdx]] ?? stages[currentStageIdx] : "Not started yet";
  const tripComplete = currentStageIdx >= stages.length - 1;
  const boardedIdx = (stages as readonly string[]).indexOf("student_boarded");
  const activePin = currentStageIdx < boardedIdx ? sub.pickupPin : sub.dropPin;

  const notifications = [
    ...(trip?.stageHistory ?? [])
      .slice()
      .reverse()
      .map((event) => ({
        time: new Date(event.timestamp).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }),
        text: NOTIFICATION_TEXT[event.stage] ?? STAGE_LABELS[event.stage] ?? event.stage,
      })),
    ...(attendance ?? [])
      .filter((a) => a.date !== trip?.date && a.completed)
      .slice(0, 1)
      .map((a) => ({ time: a.date, text: "Your child was dropped home safely." })),
  ];

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0F172A] pb-6">
      {/* Header */}
      <div className="bg-white dark:bg-[#1E293B] px-4 py-3 flex items-center gap-3 shadow-sm">
        <button onClick={() => navigate("/admin/school-transport")} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full">
          <ArrowLeft className="w-5 h-5 text-[#1A1A2E] dark:text-[#E5E7EB]" />
        </button>
        <div>
          <h1 className="font-bold text-lg text-[#1A1A2E] dark:text-[#E5E7EB]">{sub.studentName}</h1>
          <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Class {sub.className}{sub.section}</p>
        </div>
      </div>

      {/* Map */}
      <div className="px-4 pt-3">
        <div className="relative h-56 rounded-2xl overflow-hidden shadow-sm">
          <div ref={mapContainer} className="w-full h-full" />
          {mapLoadError && <MapUnavailable />}
          <div className="absolute top-3 left-3 right-3 bg-white dark:bg-[#1E293B] rounded-xl shadow-md p-2.5 flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${tripComplete ? "bg-[#138808]" : "bg-[#FF6B00] animate-pulse"}`} />
            <p className="text-xs font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">{currentStageLabel}</p>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Trip Status */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-bold text-[#1A1A2E] dark:text-[#E5E7EB]">{currentStageLabel}</h2>
              <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">at {sub.schoolName}</p>
            </div>
            {sub.assignedDriverPhone && (
              <a href={`tel:${sub.assignedDriverPhone}`} className="w-10 h-10 rounded-full bg-[#138808] flex items-center justify-center">
                <Phone className="w-5 h-5 text-white" />
              </a>
            )}
          </div>
          {sub.assignedDriverName ? (
            <div className="flex items-center gap-3 bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl p-3">
              <img src="/assets/driver-avatar.png" alt={sub.assignedDriverName} className="w-10 h-10 rounded-full object-cover" />
              <div>
                <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">{sub.assignedDriverName}</p>
                <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">{sub.assignedVehicle}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-[#9CA3AF] text-center py-3">No driver assigned yet.</p>
          )}
        </div>

        {/* Guardian OTP */}
        {sub.assignedDriverName && !tripComplete && (
          <div className="bg-[#E8F5E8] dark:bg-[#1A3A22] rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck className="w-4 h-4 text-[#138808]" />
              <p className="text-sm font-medium text-[#138808] dark:text-[#86EFAC]">{currentStageIdx < boardedIdx ? "Pickup" : "Drop-off"} PIN</p>
            </div>
            <div className="flex justify-center gap-3 mb-1">
              {activePin.split("").map((digit, i) => (
                <div key={i} className="w-12 h-14 bg-white dark:bg-[#1E293B] rounded-xl flex items-center justify-center text-xl font-bold text-[#1A1A2E] dark:text-[#E5E7EB] shadow-sm">
                  {digit}
                </div>
              ))}
            </div>
            <p className="text-xs text-[#138808]/80 dark:text-[#86EFAC]/80 text-center">Share this with the driver only at pickup/drop-off</p>
          </div>
        )}

        {/* Notifications */}
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <Bell className="w-4 h-4 text-[#FF6B00]" />
            <h2 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] text-sm">Notifications</h2>
          </div>
          {notifications.length === 0 ? (
            <p className="text-sm text-[#9CA3AF] text-center py-3">No updates yet today.</p>
          ) : (
            <div className="space-y-3">
              {notifications.map((entry, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#FFF5EB] dark:bg-[#3A2A1A] flex items-center justify-center flex-shrink-0">
                    <Clock className="w-3.5 h-3.5 text-[#FF6B00]" />
                  </div>
                  <div>
                    <p className="text-sm text-[#1A1A2E] dark:text-[#E5E7EB]">{entry.text}</p>
                    <p className="text-xs text-[#9CA3AF] dark:text-[#64748B]">{entry.time}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-[#6B7280] dark:text-[#9CA3AF] px-1">
          <MapPin className="w-3.5 h-3.5" />
          Route: {sub.homeAddress} → {sub.schoolName}
        </div>
      </div>
    </div>
  );
}
