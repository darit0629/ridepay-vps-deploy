import { useRef, useEffect } from "react";
import { MapPin, Map as MapIcon, Clock } from "lucide-react";
import { hasGoogleMapsKey, loadGoogleMaps } from "@/lib/googleMaps";
import { attachAutocomplete } from "@/lib/googlePlaces";
import { Field, inputCls, cardCls } from "./onboardingUi";
import { DEFAULT_COORDS, type SchoolOnboardingData } from "./onboardingTypes";

interface Props {
  data: SchoolOnboardingData;
  update: <K extends keyof SchoolOnboardingData>(key: K, value: SchoolOnboardingData[K]) => void;
  onPickOnMap: () => void;
}

export default function StepLogistics({ data, update, onPickOnMap }: Props) {
  const homeAddressInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!hasGoogleMapsKey) return;
    let disposed = false;
    loadGoogleMaps().then(() => {
      if (disposed || !homeAddressInputRef.current) return;
      attachAutocomplete(
        homeAddressInputRef.current,
        (place) => {
          update("homeAddress", place.name);
          update("pickupCoords", { lat: place.lat, lng: place.lng });
        },
        DEFAULT_COORDS
      );
    });
    return () => {
      disposed = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      <div className={cardCls}>
        <h2 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] flex items-center gap-2">
          <MapPin className="w-4 h-4 text-[#FF6B00]" /> Pickup Location
        </h2>
        <Field label="Home Address" icon={MapPin}>
          <div className="flex gap-2">
            <input
              ref={homeAddressInputRef}
              value={data.homeAddress}
              onChange={(e) => update("homeAddress", e.target.value)}
              className={inputCls}
              placeholder="Search for home, or pick on map"
            />
            <button
              type="button"
              onClick={onPickOnMap}
              className="w-12 flex-shrink-0 bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl flex items-center justify-center border border-gray-100 dark:border-gray-700"
              aria-label="Pick home location on map"
            >
              <MapIcon className="w-4 h-4 text-[#FF6B00]" />
            </button>
          </div>
        </Field>
      </div>

      <div className={cardCls}>
        <h2 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] flex items-center gap-2">
          <Clock className="w-4 h-4 text-[#FF6B00]" /> Schedule
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Morning Pickup"><input type="time" value={data.morningPickupTime} onChange={(e) => update("morningPickupTime", e.target.value)} className={inputCls} /></Field>
          <Field label="School Reporting"><input type="time" value={data.schoolReportingTime} onChange={(e) => update("schoolReportingTime", e.target.value)} className={inputCls} /></Field>
          <Field label="School End"><input type="time" value={data.schoolEndTime} onChange={(e) => update("schoolEndTime", e.target.value)} className={inputCls} /></Field>
          <Field label="Return Pickup"><input type="time" value={data.returnPickupTime} onChange={(e) => update("returnPickupTime", e.target.value)} className={inputCls} /></Field>
        </div>
        <p className="text-xs text-[#9CA3AF]">Service runs Monday – Friday, excluding school holidays published by admin.</p>
      </div>
    </div>
  );
}
