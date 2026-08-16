import { Car, Package, Layers, Sun, Moon, MapPin, Check } from "lucide-react";
import { OPERATING_AREAS, type OnboardingData } from "./onboardingTypes";

const SERVICE_OPTIONS: { id: OnboardingData["serviceType"]; label: string; icon: typeof Car }[] = [
  { id: "ride", label: "Ride Only", icon: Car },
  { id: "parcel", label: "Parcel Only", icon: Package },
  { id: "both", label: "Ride + Parcel", icon: Layers },
];

const AVAILABILITY_OPTIONS: { id: OnboardingData["availability"]; label: string; icon: typeof Sun }[] = [
  { id: "fulltime", label: "Full Time", icon: Sun },
  { id: "parttime", label: "Part Time", icon: Moon },
];

interface Props {
  data: OnboardingData;
  update: <K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) => void;
}

export default function StepPreferences({ data, update }: Props) {
  const toggleArea = (area: string) => {
    update(
      "operatingAreas",
      data.operatingAreas.includes(area) ? data.operatingAreas.filter((a) => a !== area) : [...data.operatingAreas, area]
    );
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold mb-1">Ride Preferences</h2>
      <p className="text-white/50 text-sm">What kind of work suits you?</p>

      <div>
        <p className="text-xs text-white/50 mb-2">Service Type</p>
        <div className="space-y-2">
          {SERVICE_OPTIONS.map(({ id, label, icon: Icon }) => {
            const selected = data.serviceType === id;
            return (
              <button
                key={id}
                onClick={() => update("serviceType", id)}
                className={`w-full flex items-center gap-3 p-4 rounded-2xl border transition-colors ${
                  selected ? "bg-[#FF6B00]/15 border-[#FF6B00]" : "bg-white/5 border-white/10"
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${selected ? "bg-[#FF6B00]" : "bg-white/10"}`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <span className="font-semibold text-sm flex-1 text-left">{label}</span>
                {selected && <Check className="w-4 h-4 text-[#FF6B00] flex-shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="text-xs text-white/50 mb-2">Availability</p>
        <div className="grid grid-cols-2 gap-3">
          {AVAILABILITY_OPTIONS.map(({ id, label, icon: Icon }) => {
            const selected = data.availability === id;
            return (
              <button
                key={id}
                onClick={() => update("availability", id)}
                className={`flex flex-col items-center gap-2 py-4 rounded-2xl border transition-colors ${
                  selected ? "bg-[#FF6B00]/15 border-[#FF6B00]" : "bg-white/5 border-white/10"
                }`}
              >
                <Icon className={`w-5 h-5 ${selected ? "text-[#FF6B00]" : "text-white/50"}`} />
                <span className="font-semibold text-sm">{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="text-xs text-white/50 mb-2 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> Operating Areas</p>
        <div className="flex flex-wrap gap-2">
          {OPERATING_AREAS.map((area) => {
            const selected = data.operatingAreas.includes(area);
            return (
              <button
                key={area}
                onClick={() => toggleArea(area)}
                className={`px-3.5 py-2 rounded-full text-sm font-medium transition-colors ${
                  selected ? "bg-[#FF6B00] text-white" : "bg-white/5 text-white/60 border border-white/10"
                }`}
              >
                {area}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
