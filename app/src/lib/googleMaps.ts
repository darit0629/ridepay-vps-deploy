import { setOptions, importLibrary } from "@googlemaps/js-api-loader";

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

export const hasGoogleMapsKey = Boolean(GOOGLE_MAPS_API_KEY);

// A Map ID configured for Vector rendering in Cloud Console — required for
// WebGLOverlayView (the 3D rickshaw marker). Any screen creating a map that
// needs 3D should pass `mapId: GOOGLE_MAP_VECTOR_ID` to `new google.maps.Map()`.
export const GOOGLE_MAP_VECTOR_ID = "504b9af1e705f5341babd748";

let loadPromise: Promise<void> | null = null;

async function loadLibraries(): Promise<void> {
  setOptions({ key: GOOGLE_MAPS_API_KEY!, v: "weekly" });
  await Promise.all([
    importLibrary("maps"),
    importLibrary("places"),
    importLibrary("marker"),
    importLibrary("geometry"),
    importLibrary("routes"),
    importLibrary("geocoding"),
  ]);
}

// Loads the Maps JS API once; every map on every screen shares this same
// promise so re-navigating between pages never injects the script twice.
// After this resolves, the global `google.maps` namespace is populated and
// callers can use it directly (e.g. `new google.maps.Map(...)`).
export function loadGoogleMaps(): Promise<void> {
  if (!GOOGLE_MAPS_API_KEY) {
    return Promise.reject(new Error("VITE_GOOGLE_MAPS_API_KEY is not configured"));
  }
  if (!loadPromise) {
    loadPromise = loadLibraries();
  }
  return loadPromise;
}
