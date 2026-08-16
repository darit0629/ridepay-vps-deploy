import { useRef, useEffect } from "react";
import { User, School, MapPin, Map as MapIcon } from "lucide-react";
import { hasGoogleMapsKey, loadGoogleMaps } from "@/lib/googleMaps";
import { attachAutocomplete } from "@/lib/googlePlaces";
import { Field, PhotoPicker, inputCls, cardCls } from "./onboardingUi";
import { DEFAULT_COORDS, type SchoolOnboardingData } from "./onboardingTypes";

interface Props {
  data: SchoolOnboardingData;
  update: <K extends keyof SchoolOnboardingData>(key: K, value: SchoolOnboardingData[K]) => void;
  onPickOnMap: () => void;
}

export default function StepStudent({ data, update, onPickOnMap }: Props) {
  const schoolAddressInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!hasGoogleMapsKey) return;
    let disposed = false;
    loadGoogleMaps().then(() => {
      if (disposed || !schoolAddressInputRef.current) return;
      attachAutocomplete(
        schoolAddressInputRef.current,
        (place) => {
          update("schoolAddress", place.name);
          update("dropCoords", { lat: place.lat, lng: place.lng });
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
          <User className="w-4 h-4 text-[#FF6B00]" /> Student Details
        </h2>
        <Field label="Full Name">
          <input value={data.studentName} onChange={(e) => update("studentName", e.target.value)} className={inputCls} placeholder="Student's full name" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <PhotoPicker label="Student Photo" value={data.studentPhotoUrl} onChange={(v) => update("studentPhotoUrl", v)} />
          <PhotoPicker label="Student ID / Aadhaar" value={data.studentIdPhotoUrl} onChange={(v) => update("studentIdPhotoUrl", v)} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Class"><input value={data.className} onChange={(e) => update("className", e.target.value)} className={inputCls} placeholder="5" /></Field>
          <Field label="Section"><input value={data.section} onChange={(e) => update("section", e.target.value)} className={inputCls} placeholder="A" /></Field>
          <Field label="Roll No."><input value={data.rollNumber} onChange={(e) => update("rollNumber", e.target.value)} className={inputCls} placeholder="12" /></Field>
        </div>
      </div>

      <div className={cardCls}>
        <h2 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] flex items-center gap-2">
          <School className="w-4 h-4 text-[#7C3AED]" /> School
        </h2>
        <Field label="School Name">
          <input value={data.schoolName} onChange={(e) => update("schoolName", e.target.value)} className={inputCls} placeholder="Ranaghat Public School" />
        </Field>
        <Field label="School Address" icon={MapPin}>
          <div className="flex gap-2">
            <input
              ref={schoolAddressInputRef}
              value={data.schoolAddress}
              onChange={(e) => update("schoolAddress", e.target.value)}
              className={inputCls}
              placeholder="Search for the school, or pick on map"
            />
            <button
              type="button"
              onClick={onPickOnMap}
              className="w-12 flex-shrink-0 bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl flex items-center justify-center border border-gray-100 dark:border-gray-700"
              aria-label="Pick school location on map"
            >
              <MapIcon className="w-4 h-4 text-[#FF6B00]" />
            </button>
          </div>
        </Field>
        <Field label="School Phone (office/reception)">
          <input
            type="tel"
            value={data.schoolPhone}
            onChange={(e) => update("schoolPhone", e.target.value)}
            className={inputCls}
            placeholder="Optional — shown as the in-app 'Call School' number"
          />
        </Field>
      </div>
    </div>
  );
}
