import { useEffect, useRef, useState } from "react";
import { X, MapPin, Search, LocateFixed, Loader2 } from "lucide-react";
import MapUnavailable from "@/components/MapUnavailable";
import { hasGoogleMapsKey, loadGoogleMaps, GOOGLE_MAP_VECTOR_ID } from "@/lib/googleMaps";
import { attachAutocomplete } from "@/lib/googlePlaces";
import { useTheme } from "@/contexts/ThemeContext";

interface LocationPickerModalProps {
  open: boolean;
  title: string;
  initialCoords: { lat: number; lng: number };
  onConfirm: (result: { address: string; lat: number; lng: number }) => void;
  onClose: () => void;
}

// A "drag the map, pin stays centered" location picker — the same
// convention every ride-hailing/maps app uses, and simpler than
// click-to-drop-a-marker since there's no marker lifecycle to manage.
// Search box (Google Places autocomplete) recenters the map; dragging the
// map re-centers the pin and reverse-geocodes the new center on release.
export default function LocationPickerModal({ open, title, initialCoords, onConfirm, onClose }: LocationPickerModalProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { theme } = useTheme();

  const [mapLoadError, setMapLoadError] = useState(!hasGoogleMapsKey);
  const [address, setAddress] = useState("Locating...");
  const [coords, setCoords] = useState(initialCoords);
  const [resolving, setResolving] = useState(false);

  const reverseGeocode = (position: google.maps.LatLngLiteral) => {
    setResolving(true);
    geocoderRef.current?.geocode({ location: position }, (results, status) => {
      setResolving(false);
      if (status === "OK" && results?.[0]) {
        setAddress(results[0].formatted_address);
      } else {
        setAddress(`${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}`);
      }
    });
  };

  useEffect(() => {
    if (!open || !hasGoogleMapsKey || !mapContainer.current) return;
    let disposed = false;
    setCoords(initialCoords);

    loadGoogleMaps()
      .then(() => {
        if (disposed || !mapContainer.current) return;
        geocoderRef.current = new google.maps.Geocoder();

        const gMap = new google.maps.Map(mapContainer.current, {
          center: initialCoords,
          zoom: 15,
          disableDefaultUI: true,
          zoomControl: true,
          mapId: GOOGLE_MAP_VECTOR_ID,
          colorScheme: theme === "dark" ? google.maps.ColorScheme.DARK : google.maps.ColorScheme.LIGHT,
        });
        map.current = gMap;

        gMap.addListener("dragend", () => {
          const center = gMap.getCenter();
          if (!center) return;
          const next = { lat: center.lat(), lng: center.lng() };
          setCoords(next);
          reverseGeocode(next);
        });

        if (searchInputRef.current) {
          attachAutocomplete(
            searchInputRef.current,
            (place) => {
              const next = { lat: place.lat, lng: place.lng };
              setCoords(next);
              setAddress(place.name);
              gMap.panTo(next);
              gMap.setZoom(16);
            },
            initialCoords
          );
        }

        reverseGeocode(initialCoords);
      })
      .catch((error) => {
        console.error("Error loading Google Maps:", error);
        setMapLoadError(true);
      });

    return () => {
      disposed = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-[#F8F9FA] dark:bg-[#0F172A] flex flex-col">
      <div className="bg-white dark:bg-[#1E293B] px-4 py-3 flex items-center gap-3 shadow-sm flex-shrink-0">
        <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full">
          <X className="w-5 h-5 text-[#1A1A2E] dark:text-[#E5E7EB]" />
        </button>
        <h1 className="font-bold text-lg text-[#1A1A2E] dark:text-[#E5E7EB]">{title}</h1>
      </div>

      <div className="px-4 py-3 bg-white dark:bg-[#1E293B] flex-shrink-0">
        <div className="flex items-center gap-2 bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-3 py-2.5 border border-gray-100 dark:border-gray-700">
          <Search className="w-4 h-4 text-[#9CA3AF] flex-shrink-0" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search for a location"
            className="flex-1 bg-transparent text-sm outline-none text-[#1A1A2E] dark:text-[#E5E7EB] placeholder:text-[#9CA3AF]"
          />
        </div>
      </div>

      <div className="relative flex-1">
        <div ref={mapContainer} className="w-full h-full" />
        {mapLoadError && <MapUnavailable />}

        {/* Fixed center pin — the map moves under it, not the other way around */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full pointer-events-none">
          <MapPin className="w-9 h-9 text-[#FF6B00] drop-shadow-lg" fill="#FF6B00" strokeWidth={1.5} />
        </div>

        <button
          onClick={() => {
            if (!navigator.geolocation || !map.current) return;
            navigator.geolocation.getCurrentPosition((pos) => {
              const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
              map.current?.panTo(next);
              setCoords(next);
              reverseGeocode(next);
            });
          }}
          className="absolute bottom-4 right-4 w-11 h-11 rounded-full bg-white dark:bg-[#1E293B] shadow-md flex items-center justify-center"
        >
          <LocateFixed className="w-5 h-5 text-[#1A1A2E] dark:text-[#E5E7EB]" />
        </button>
      </div>

      <div className="bg-white dark:bg-[#1E293B] px-4 py-4 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] flex-shrink-0 space-y-3">
        <div className="flex items-start gap-2">
          <MapPin className="w-4 h-4 text-[#FF6B00] flex-shrink-0 mt-0.5" />
          <p className="text-sm text-[#1A1A2E] dark:text-[#E5E7EB] flex-1">
            {resolving ? <span className="flex items-center gap-1.5 text-[#9CA3AF]"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Locating...</span> : address}
          </p>
        </div>
        <button
          onClick={() => onConfirm({ address, lat: coords.lat, lng: coords.lng })}
          disabled={resolving}
          className="w-full bg-[#FF6B00] disabled:bg-[#9CA3AF] text-white font-semibold py-3.5 rounded-xl"
        >
          Confirm Location
        </button>
      </div>
    </div>
  );
}
