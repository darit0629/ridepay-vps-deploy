import { Check } from "lucide-react";
import Vehicle3DPreview from "@/components/Vehicle3DPreview";
import type { VehicleModelType } from "@/lib/vehicleModels3D";
import { VEHICLE_TYPES, requiredDocumentsFor, type OnboardingData, type VehicleTypeId } from "./onboardingTypes";

const MODEL_FOR: Record<VehicleTypeId, VehicleModelType> = {
  Toto: "e-riksha",
  "Auto Rickshaw": "auto-rickshaw",
  Bike: "bike",
  Car: "car",
};

const SUBTITLE_FOR: Record<VehicleTypeId, string> = {
  Toto: "Eco-friendly e-rickshaw",
  "Auto Rickshaw": "Fuel-powered auto",
  Bike: "Quick two-wheeler",
  Car: "AC & spacious rides",
};

interface Props {
  data: OnboardingData;
  update: <K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) => void;
}

export default function StepVehicleType({ data, update }: Props) {
  return (
    <div>
      <h2 className="text-xl font-bold mb-1">Choose Your Vehicle</h2>
      <p className="text-white/50 text-sm mb-4">This decides which documents you'll need next</p>

      <div className="grid grid-cols-2 gap-3">
        {VEHICLE_TYPES.map((type) => {
          const selected = data.vehicleType === type;
          return (
            <button
              key={type}
              onClick={() => update("vehicleType", type)}
              className={`flex flex-col items-center gap-2 rounded-[24px] p-5 border transition-all relative ${
                selected
                  ? "bg-[#FF6B00]/15 border-[#FF6B00] shadow-[0_8px_24px_rgba(255,107,0,0.25)]"
                  : "bg-white/5 border-white/10"
              }`}
            >
              {selected && (
                <div className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-[#FF6B00] flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{
                  background: selected ? "linear-gradient(145deg, #FF8A3D, #E65A00)" : "linear-gradient(145deg, #1E293B, #0F172A)",
                }}
              >
                <Vehicle3DPreview vehicleType={MODEL_FOR[type]} spin={false} className="w-11 h-11" />
              </div>
              <p className="font-bold text-sm mt-1">{type}</p>
              <p className="text-[11px] text-white/50 text-center leading-tight">{SUBTITLE_FOR[type]}</p>
            </button>
          );
        })}
      </div>

      {data.vehicleType && (
        <div className="mt-4 bg-white/5 border border-white/10 rounded-2xl p-4">
          <p className="text-xs text-white/50 mb-1">Documents you'll need for a {data.vehicleType}</p>
          <p className="text-xs text-white/80">{requiredDocumentsFor(data.vehicleType).length} documents, including your license and vehicle RC.</p>
        </div>
      )}
    </div>
  );
}
