import { useCallback, useState } from "react";

// Google Maps' built-in map types make toggling a one-line call - no separate
// tile layers to swap, unlike the old Leaflet setup.
export function useGoogleMapViewToggle() {
  const [mapView, setMapView] = useState<"normal" | "satellite">("normal");

  const toggleMapView = useCallback((map: google.maps.Map | null) => {
    if (!map) return;
    setMapView((prev) => {
      const next = prev === "normal" ? "satellite" : "normal";
      map.setMapTypeId(next === "normal" ? google.maps.MapTypeId.ROADMAP : google.maps.MapTypeId.SATELLITE);
      return next;
    });
  }, []);

  return { mapView, toggleMapView };
}
