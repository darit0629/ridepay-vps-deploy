import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router";
import { ShieldAlert, Phone, MapPin, Clock, Car } from "lucide-react";
import { hasGoogleMapsKey, loadGoogleMaps } from "@/lib/googleMaps";
import { createDriverIcon, createPickupIcon, createDestinationIcon } from "@/lib/googleMarkerIcons";
import { fetchGoogleRoute } from "@/lib/googleDirections";
import MapUnavailable from "@/components/MapUnavailable";
import { useMapTheme } from "@/hooks/useMapTheme";
import { useTheme } from "@/contexts/ThemeContext";
import { DARK_MAP_STYLES } from "@/lib/mapDarkStyle";
import { trpc } from "@/providers/trpc";

const STATUS_LABEL: Record<string, string> = {
  searching: "Finding a captain",
  accepted: "Captain en route to pickup",
  pickup: "Captain en route to pickup",
  ongoing: "Trip in progress",
  completed: "Trip completed",
  cancelled: "Trip cancelled",
  driver_cancelled: "Trip cancelled",
};

// Public, read-only page a rider's shared trip link opens to. No login and
// no app chrome - this is what a friend/family member sees when tracking
// someone else's ride, so it deliberately doesn't reuse BottomNav etc.
export default function TripShare() {
  const { id } = useParams<{ id: string }>();
  const rideId = Number(id);
  const { data: trip } = trpc.ride.getShareInfo.useQuery(
    { id: rideId },
    { enabled: Number.isFinite(rideId) && rideId > 0, refetchInterval: 5000 }
  );

  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const [mapLoadError, setMapLoadError] = useState(!hasGoogleMapsKey);
  const [eta, setEta] = useState<string | null>(null);
  const { theme } = useTheme();
  useMapTheme(map, false);

  const driverCoords =
    trip?.driverLat && trip?.driverLng ? { lat: parseFloat(trip.driverLat), lng: parseFloat(trip.driverLng) } : null;
  const pickupCoords = trip ? { lat: parseFloat(trip.pickupLat), lng: parseFloat(trip.pickupLng) } : null;
  const dropCoords = trip ? { lat: parseFloat(trip.dropLat), lng: parseFloat(trip.dropLng) } : null;
  const trackingTarget = trip?.status === "ongoing" ? dropCoords : pickupCoords;

  useEffect(() => {
    if (!hasGoogleMapsKey || !mapContainer.current || !pickupCoords || !dropCoords) return;

    let disposed = false;

    loadGoogleMaps()
      .then(async () => {
        if (disposed || !mapContainer.current) return;

        const gMap = new google.maps.Map(mapContainer.current, {
          center: driverCoords ?? pickupCoords,
          zoom: 14,
          disableDefaultUI: true,
          zoomControl: true,
          styles: theme === "dark" ? DARK_MAP_STYLES : [],
        });
        map.current = gMap;

        if (driverCoords) new google.maps.Marker({ position: driverCoords, map: gMap, icon: createDriverIcon() });
        new google.maps.Marker({ position: pickupCoords, map: gMap, icon: createPickupIcon() });
        new google.maps.Marker({ position: dropCoords, map: gMap, icon: createDestinationIcon() });

        const bounds = new google.maps.LatLngBounds();
        if (driverCoords) bounds.extend(driverCoords);
        bounds.extend(pickupCoords);
        bounds.extend(dropCoords);
        gMap.fitBounds(bounds, 60);

        if (driverCoords && trackingTarget) {
          try {
            const route = await fetchGoogleRoute(driverCoords, trackingTarget);
            if (!disposed && route) setEta(`${Math.round(route.durationMin)} min`);
          } catch (error) {
            console.error("Error fetching ETA route:", error);
          }
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
  }, [pickupCoords?.lat, pickupCoords?.lng, dropCoords?.lat, dropCoords?.lng, driverCoords?.lat, driverCoords?.lng]);

  if (!trip) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#F8F9FA] dark:bg-[#0F172A] px-6 text-center">
        <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">This trip link is invalid or has expired.</p>
      </div>
    );
  }

  const statusLabel = STATUS_LABEL[trip.status] ?? trip.status;

  return (
    <div className="h-screen flex flex-col bg-[#F8F9FA] dark:bg-[#0F172A]">
      {/* Map */}
      <div className="flex-1 relative">
        <div ref={mapContainer} className="w-full h-full" />
        {mapLoadError && <MapUnavailable />}

        <div className="absolute top-4 left-4 right-4 bg-white dark:bg-[#1E293B] rounded-xl shadow-md p-3 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#138808] animate-pulse flex-shrink-0" />
          <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">Live trip · {trip.riderName}</p>
        </div>
      </div>

      {/* Trip Info */}
      <div className="bg-white dark:bg-[#1E293B] rounded-t-3xl shadow-lg -mt-6 relative z-10">
        <div className="w-12 h-1 bg-gray-200 dark:bg-gray-600 rounded-full mx-auto mt-3 mb-4" />

        <div className="px-4 pb-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-bold text-[#1A1A2E] dark:text-[#E5E7EB]">{statusLabel}</h1>
              {eta && <p className="text-sm text-[#138808]">ETA {eta}</p>}
            </div>
            <span className="text-xs font-medium text-[#138808] bg-[#E8F5E8] dark:bg-[#1A3A22] px-3 py-1.5 rounded-full">
              Tracking Live
            </span>
          </div>

          {trip.driverName && (
            <div className="flex items-center gap-3 bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl p-3">
              <img
                src={trip.driverAvatar || "/assets/driver-avatar.png"}
                alt={trip.driverName}
                className="w-12 h-12 rounded-full object-cover border-2 border-[#FF6B00]"
              />
              <div className="flex-1">
                <h3 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB]">{trip.driverName}</h3>
                {trip.vehicleModel && (
                  <div className="flex items-center gap-1">
                    <Car className="w-3.5 h-3.5 text-[#6B7280] dark:text-[#9CA3AF]" />
                    <span className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">{trip.vehicleModel} · {trip.vehicleNumber}</span>
                  </div>
                )}
              </div>
              {trip.driverPhone && (
                <a href={`tel:${trip.driverPhone}`} className="w-10 h-10 rounded-full bg-[#138808] flex items-center justify-center">
                  <Phone className="w-5 h-5 text-white" />
                </a>
              )}
            </div>
          )}

          <div className="flex items-center gap-3">
            <MapPin className="w-5 h-5 text-[#FF6B00]" />
            <div>
              <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">Destination</p>
              <p className="text-sm font-medium text-[#1A1A2E] dark:text-[#E5E7EB]">{trip.dropAddress}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-[#6B7280] dark:text-[#9CA3AF]" />
            <p className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">This link updates automatically until the trip ends.</p>
          </div>

          <a
            href="/legal/safety-policy"
            className="w-full flex items-center justify-center gap-2 bg-red-50 dark:bg-[#3A1A1A] text-[#DC2626] dark:text-[#F87171] font-semibold py-3.5 rounded-xl"
          >
            <ShieldAlert className="w-5 h-5" />
            Something feels wrong? Alert Ridepay Support
          </a>
        </div>
      </div>
    </div>
  );
}
