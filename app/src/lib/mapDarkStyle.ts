// Dark-mode styling for Google Maps, covering both rendering paths used
// across the app:
//  - Raster maps (no Map ID): styled via a classic JSON `styles` array.
//  - Vector maps (Map ID set, e.g. for the 3D rickshaw overlay screens):
//    styled via the newer `colorScheme` option instead — vector maps ignore
//    local `styles` arrays entirely, so the JSON array below has no effect
//    on them.
export const DARK_MAP_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#1a1a2e" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1a1a2e" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#9ca3af" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#d1d5db" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#8a8fa3" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#14351f" }] },
  { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#5a9e6f" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#2d2d4a" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#1a1a2e" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#8a8fa3" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#3d3d5c" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#1a1a2e" }] },
  { featureType: "road.highway", elementType: "labels.text.fill", stylers: [{ color: "#e5e7eb" }] },
  { featureType: "transit", elementType: "geometry", stylers: [{ color: "#2d2d4a" }] },
  { featureType: "transit.station", elementType: "labels.text.fill", stylers: [{ color: "#8a8fa3" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0c2536" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#4a6a8f" }] },
];

/**
 * Applies (or clears) dark styling on a map instance, using whichever
 * mechanism matches how the map was created. Safe to call any time the
 * app's theme changes while the map is already mounted.
 */
export function applyMapTheme(map: google.maps.Map, isDark: boolean, isVectorMap: boolean) {
  if (isVectorMap) {
    map.setOptions({
      colorScheme: isDark ? google.maps.ColorScheme.DARK : google.maps.ColorScheme.LIGHT,
    });
  } else {
    map.setOptions({ styles: isDark ? DARK_MAP_STYLES : [] });
  }
}
