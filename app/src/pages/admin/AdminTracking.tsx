import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { X, Navigation2 } from "lucide-react";
import MapViewToggle from "@/components/MapViewToggle";
import MapUnavailable from "@/components/MapUnavailable";
import { useGoogleMapViewToggle } from "@/hooks/useGoogleMapViewToggle";
import { hasGoogleMapsKey, loadGoogleMaps, GOOGLE_MAP_VECTOR_ID } from "@/lib/googleMaps";
import { useRickshawFleetOverlay } from "@/hooks/useRickshawFleetOverlay";
import type { VehicleModelType } from "@/lib/vehicleModels3D";
import { createPickupIcon, createDestinationIcon } from "@/lib/googleMarkerIcons";
import { fetchGoogleRoute } from "@/lib/googleDirections";
import AdminLayout from "@/components/admin/AdminLayout";
import { useMapTheme } from "@/hooks/useMapTheme";
import { useTheme } from "@/contexts/ThemeContext";
import { trpc } from "@/providers/trpc";

interface CurrentRide {
  pickupLabel: string;
  dropoffLabel: string;
  pickup: google.maps.LatLngLiteral;
  dropoff: google.maps.LatLngLiteral;
}

interface TrackedDriver {
  id: number;
  name: string;
  lat: number;
  lng: number;
  modelType: VehicleModelType;
  currentRide?: CurrentRide;
}

function vehicleModelFor(vehicleType: string): VehicleModelType {
  return vehicleType?.toLowerCase().includes("auto") ? "auto-rickshaw" : "e-riksha";
}

export default function AdminTracking() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<"all" | "online" | "ongoing">("all");
  const [activeRoute, setActiveRoute] = useState<{
    driverName: string;
    pickupLabel: string;
    dropoffLabel: string;
    distanceKm: number;
    durationMin: number;
  } | null>(null);

  // Real driver positions + active rides, polled — no simulated drift.
  const { data } = trpc.admin.getLiveTracking.useQuery(undefined, { refetchInterval: 5000, refetchIntervalInBackground: true });
  const trackedDrivers: TrackedDriver[] = (data?.drivers ?? []).map((d) => {
    const activeRide = data?.rides.find((r) => r.driverId === d.userId);
    return {
      id: d.id,
      name: d.name,
      lat: parseFloat(d.lat),
      lng: parseFloat(d.lng),
      modelType: vehicleModelFor(d.vehicleType),
      currentRide: activeRide
        ? {
            pickupLabel: activeRide.pickupAddress,
            dropoffLabel: activeRide.dropAddress,
            pickup: { lat: parseFloat(activeRide.pickupLat), lng: parseFloat(activeRide.pickupLng) },
            dropoff: { lat: parseFloat(activeRide.dropLat), lng: parseFloat(activeRide.dropLng) },
          }
        : undefined,
    };
  });

  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);
  const driverMarkersRef = useRef<google.maps.Marker[]>([]);
  const fleetSwitchedRef = useRef(false);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const routePolylineRef = useRef<google.maps.Polyline | null>(null);
  const routeMarkersRef = useRef<google.maps.Marker[]>([]);
  const { mapView, toggleMapView: toggleTileView } = useGoogleMapViewToggle();
  const [mapReady, setMapReady] = useState(false);
  const [mapLoadError, setMapLoadError] = useState(!hasGoogleMapsKey);
  const { theme } = useTheme();
  useMapTheme(map, true);
  const rickshawFleet = useRickshawFleetOverlay(mapInstance);

  const ongoingDrivers = trackedDrivers.filter((d) => d.currentRide);

  // Draws the pickup→dropoff route for a driver currently carrying a
  // passenger, replacing any previously shown route.
  const clearDriverRoute = () => {
    routePolylineRef.current?.setMap(null);
    routePolylineRef.current = null;
    routeMarkersRef.current.forEach((m) => m.setMap(null));
    routeMarkersRef.current = [];
    setActiveRoute(null);
  };

  const showDriverRoute = async (driver: TrackedDriver) => {
    if (!driver.currentRide || !map.current) return;
    const { pickup, dropoff, pickupLabel, dropoffLabel } = driver.currentRide;
    const gMap = map.current;

    const result = await fetchGoogleRoute(pickup, dropoff);
    if (!result || map.current !== gMap) return;

    clearDriverRoute();

    routePolylineRef.current = new google.maps.Polyline({
      path: result.path,
      map: gMap,
      strokeColor: "#FF6B00",
      strokeWeight: 4,
      strokeOpacity: 0.9,
    });
    routeMarkersRef.current = [
      new google.maps.Marker({ position: pickup, map: gMap, icon: createPickupIcon() }),
      new google.maps.Marker({ position: dropoff, map: gMap, icon: createDestinationIcon() }),
    ];
    gMap.fitBounds(result.bounds, 80);

    setActiveRoute({
      driverName: driver.name,
      pickupLabel,
      dropoffLabel,
      distanceKm: Math.round(result.distanceKm * 10) / 10,
      durationMin: Math.round(result.durationMin),
    });
  };

  // Map is created once on mount.
  useEffect(() => {
    if (!hasGoogleMapsKey || !mapContainer.current) return;

    let disposed = false;

    loadGoogleMaps()
      .then(() => {
        if (disposed || !mapContainer.current) return;

        const gMap = new google.maps.Map(mapContainer.current, {
          center: { lat: 22.69, lng: 88.37 },
          zoom: 13,
          disableDefaultUI: true,
          zoomControl: true,
          zoomControlOptions: { position: google.maps.ControlPosition.RIGHT_BOTTOM },
          // Vector rendering (needs a Map ID) is required for the 3D vehicle
          // fleet overlay showing live driver movement.
          mapId: GOOGLE_MAP_VECTOR_ID,
          colorScheme: theme === "dark" ? google.maps.ColorScheme.DARK : google.maps.ColorScheme.LIGHT,
        });
        map.current = gMap;
        setMapInstance(gMap);

        // Vector maps compute their viewport lazily — without this the map
        // renders into only a fraction of its container until something else
        // forces a relayout.
        setTimeout(() => {
          google.maps.event.trigger(gMap, "resize");
          gMap.setCenter({ lat: 22.69, lng: 88.37 });
        }, 100);

        infoWindowRef.current = new google.maps.InfoWindow();
        setMapReady(true);
      })
      .catch((error) => {
        console.error("Error loading Google Maps:", error);
        setMapLoadError(true);
      });

    return () => {
      disposed = true;
      driverMarkersRef.current.forEach((marker) => marker.setMap(null));
      routePolylineRef.current?.setMap(null);
      routeMarkersRef.current.forEach((marker) => marker.setMap(null));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Driver markers are rebuilt whenever the filter changes or a new poll of
  // real driver positions/active rides arrives — no simulated drift, this
  // just reflects each driver's latest real reported GPS position. Drivers
  // currently carrying a passenger get an orange pin instead of green so
  // they stand out, and their info window offers a "Show Route" button.
  useEffect(() => {
    if (!mapReady || !map.current) return;

    driverMarkersRef.current.forEach((marker) => marker.setMap(null));
    driverMarkersRef.current = [];
    fleetSwitchedRef.current = false;
    trackedDrivers.forEach((d) => rickshawFleet.removeVehicle(String(d.id)));
    clearDriverRoute();

    const filteredDrivers =
      filter === "ongoing" ? trackedDrivers.filter((d) => d.currentRide)
        : filter === "online" ? trackedDrivers.filter((d) => !d.currentRide)
        : trackedDrivers;

    const markerIcon = (driver: TrackedDriver, opacity: number) => ({
      path: google.maps.SymbolPath.CIRCLE,
      scale: opacity < 1 ? 4 : 8,
      fillColor: driver.currentRide ? "#FF6B00" : "#138808",
      fillOpacity: opacity,
      strokeColor: "#ffffff",
      strokeWeight: opacity < 1 ? 1 : 2,
    });

    const markers = filteredDrivers.map((driver) => {
      const marker = new google.maps.Marker({
        position: { lat: driver.lat, lng: driver.lng },
        map: map.current!,
        icon: markerIcon(driver, 1),
      });
      marker.addListener("click", () => {
        if (!infoWindowRef.current || !map.current) return;
        const rideInfo = driver.currentRide
          ? `<div style="margin-top:4px;color:#FF6B00;">🚏 Carrying passenger<br>${driver.currentRide.pickupLabel} → ${driver.currentRide.dropoffLabel}</div>
             <button id="show-route-${driver.id}" style="margin-top:8px;width:100%;background:#1E3A5F;color:#fff;border:none;border-radius:6px;padding:6px 10px;font-size:12px;font-weight:600;cursor:pointer;">Show Route</button>`
          : `<div style="margin-top:4px;color:#138808;">Available</div>`;
        infoWindowRef.current.setContent(
          `<div style="font-family:inherit;min-width:160px;">` +
            `<b>${driver.name}</b>${rideInfo}` +
            `<button id="view-profile-${driver.id}" style="margin-top:8px;width:100%;background:#FF6B00;color:#fff;border:none;border-radius:6px;padding:6px 10px;font-size:12px;font-weight:600;cursor:pointer;">View Full Profile</button>` +
          `</div>`
        );
        infoWindowRef.current.open({ map: map.current, anchor: marker });
        google.maps.event.addListenerOnce(infoWindowRef.current, "domready", () => {
          document.getElementById(`view-profile-${driver.id}`)?.addEventListener("click", () => {
            navigate(`/admin/drivers/${driver.id}`);
          });
          document.getElementById(`show-route-${driver.id}`)?.addEventListener("click", () => {
            infoWindowRef.current?.close();
            showDriverRoute(driver);
          });
        });
      });
      return marker;
    });

    driverMarkersRef.current = markers;

    if (rickshawFleet.isAvailableRef.current) {
      fleetSwitchedRef.current = true;
      markers.forEach((m, mi) => m.setIcon(markerIcon(filteredDrivers[mi], 0.6)));
      filteredDrivers.forEach((driver) => {
        rickshawFleet.setVehicle(String(driver.id), driver.lat, driver.lng, 0, driver.modelType);
      });
    }

    if (filteredDrivers.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      filteredDrivers.forEach((d) => bounds.extend({ lat: d.lat, lng: d.lng }));
      map.current.fitBounds(bounds, 50);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, mapReady, data]);

  const toggleMapView = () => toggleTileView(map.current);

  return (
    <AdminLayout title="Live Tracking" fullBleed>
      {/* Filter Bar */}
      <div className="bg-white dark:bg-[#1E293B] px-4 py-2 flex gap-3 border-b border-gray-100 dark:border-gray-700">
        <button
          onClick={() => setFilter("all")}
          className={`px-4 py-1.5 rounded-full text-xs font-medium ${filter === "all" ? "bg-[#1E3A5F] text-white" : "bg-gray-100 dark:bg-gray-700 text-[#6B7280] dark:text-[#9CA3AF]"}`}
        >
          All
        </button>
        <button
          onClick={() => setFilter("online")}
          className={`px-4 py-1.5 rounded-full text-xs font-medium flex items-center gap-1 ${filter === "online" ? "bg-[#E8F5E8] text-[#138808]" : "bg-gray-100 dark:bg-gray-700 text-[#6B7280] dark:text-[#9CA3AF]"}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#138808]" /> Online Drivers
        </button>
        <button
          onClick={() => setFilter("ongoing")}
          className={`px-4 py-1.5 rounded-full text-xs font-medium flex items-center gap-1 ${filter === "ongoing" ? "bg-[#FFF5EB] text-[#FF6B00]" : "bg-gray-100 dark:bg-gray-700 text-[#6B7280] dark:text-[#9CA3AF]"}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#FF6B00]" /> Ongoing Rides
        </button>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <div ref={mapContainer} className="w-full h-full" />
        {mapLoadError && <MapUnavailable />}
        {mapReady && trackedDrivers.length === 0 && (
          <div className="absolute inset-x-4 top-4 bg-white dark:bg-[#1E293B] rounded-xl shadow-md p-3 text-center text-xs text-[#6B7280] dark:text-[#9CA3AF]">
            No drivers are currently online.
          </div>
        )}

        {/* Map View Toggle Button */}
        <MapViewToggle mapView={mapView} onToggle={toggleMapView} />

        {/* Stats overlay */}
        <div className="absolute top-4 left-4 bg-white dark:bg-[#1E293B] rounded-xl shadow-md p-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#138808]" />
            <span className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">{trackedDrivers.length} Online</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#FF6B00]" />
            <span className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">{ongoingDrivers.length} Ongoing</span>
          </div>
        </div>

        {/* Active route banner — shown after picking "Show Route" on a driver currently carrying a passenger */}
        {activeRoute && (
          <div className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 bg-white dark:bg-[#1E293B] rounded-xl shadow-md p-3.5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#FF6B00]">
                <Navigation2 className="w-3.5 h-3.5" /> {activeRoute.driverName}'s ongoing ride
              </div>
              <button onClick={clearDriverRoute} className="p-0.5 text-[#9CA3AF] hover:text-[#1A1A2E] dark:hover:text-white flex-shrink-0" aria-label="Clear route">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-[#1A1A2E] dark:text-[#E5E7EB] mt-1.5">
              {activeRoute.pickupLabel} → {activeRoute.dropoffLabel}
            </p>
            <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mt-0.5">
              {activeRoute.distanceKm} km · ~{activeRoute.durationMin} min
            </p>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
