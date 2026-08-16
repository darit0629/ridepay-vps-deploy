import { useState } from "react";
import { MapPin, Navigation, Building2, Landmark, Hash, Loader2 } from "lucide-react";
import { hasGoogleMapsKey, loadGoogleMaps } from "@/lib/googleMaps";
import type { OnboardingData } from "./onboardingTypes";

interface Props {
  data: OnboardingData;
  update: <K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) => void;
}

function componentFor(components: google.maps.GeocoderAddressComponent[], type: string): string {
  return components.find((c) => c.types.includes(type))?.long_name ?? "";
}

export default function StepAddress({ data, update }: Props) {
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState("");

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocateError("Geolocation isn't supported on this device");
      return;
    }
    if (!hasGoogleMapsKey) {
      setLocateError("Map service unavailable — please enter your address manually");
      return;
    }
    setLocating(true);
    setLocateError("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = { lat: position.coords.latitude, lng: position.coords.longitude };
        loadGoogleMaps()
          .then(() => {
            const geocoder = new google.maps.Geocoder();
            geocoder.geocode({ location: coords }, (results, status) => {
              setLocating(false);
              if (status !== "OK" || !results?.[0]) {
                setLocateError("Couldn't find your address — please enter it manually");
                return;
              }
              const r = results[0];
              const components = r.address_components;
              update("address", r.formatted_address);
              update("landmark", componentFor(components, "sublocality") || componentFor(components, "neighborhood"));
              update("city", componentFor(components, "locality") || componentFor(components, "administrative_area_level_2"));
              update("state", componentFor(components, "administrative_area_level_1"));
              update("pincode", componentFor(components, "postal_code"));
            });
          })
          .catch(() => {
            setLocating(false);
            setLocateError("Couldn't load the map service — please enter your address manually");
          });
      },
      () => {
        setLocating(false);
        setLocateError("Location access denied — please enter your address manually");
      }
    );
  };

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-bold mb-1">Your Address</h2>
      <p className="text-white/50 text-sm mb-4">Where should we reach you?</p>

      <button
        onClick={handleUseCurrentLocation}
        disabled={locating}
        className="w-full flex items-center justify-center gap-2 bg-[#FF6B00]/15 border border-[#FF6B00]/30 text-[#FF6B00] font-semibold py-3.5 rounded-2xl mb-1 disabled:opacity-60"
      >
        {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
        {locating ? "Finding your location…" : "Use Current Location"}
      </button>
      {locateError && <p className="text-xs text-[#FF6B6B] text-center px-1">{locateError}</p>}

      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[24px] p-4">
        <label className="text-xs text-white/50 mb-2 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> Current Address</label>
        <textarea
          value={data.address}
          onChange={(e) => update("address", e.target.value)}
          placeholder="House/flat no., street, area"
          rows={2}
          className="w-full bg-transparent text-base font-medium outline-none placeholder:text-white/30 resize-none"
        />
      </div>

      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[24px] p-4">
        <label className="text-xs text-white/50 mb-2 flex items-center gap-1.5"><Landmark className="w-3.5 h-3.5" /> Landmark (optional)</label>
        <input
          value={data.landmark}
          onChange={(e) => update("landmark", e.target.value)}
          placeholder="Nearby landmark"
          className="w-full bg-transparent text-base font-medium outline-none placeholder:text-white/30"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[24px] p-4">
          <label className="text-xs text-white/50 mb-2 flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" /> City</label>
          <input
            value={data.city}
            onChange={(e) => update("city", e.target.value)}
            placeholder="City"
            className="w-full bg-transparent text-base font-medium outline-none placeholder:text-white/30"
          />
        </div>
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[24px] p-4">
          <label className="text-xs text-white/50 mb-2 block">State</label>
          <input
            value={data.state}
            onChange={(e) => update("state", e.target.value)}
            placeholder="State"
            className="w-full bg-transparent text-base font-medium outline-none placeholder:text-white/30"
          />
        </div>
      </div>

      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[24px] p-4">
        <label className="text-xs text-white/50 mb-2 flex items-center gap-1.5"><Hash className="w-3.5 h-3.5" /> PIN Code</label>
        <input
          value={data.pincode}
          onChange={(e) => update("pincode", e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="6-digit PIN code"
          className="w-full bg-transparent text-base font-medium outline-none placeholder:text-white/30"
        />
      </div>
    </div>
  );
}
