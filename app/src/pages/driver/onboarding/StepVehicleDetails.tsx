import { useRef, useState } from "react";
import { Hash, Car, Palette, CalendarDays, Camera, X } from "lucide-react";
import { resizeImageToDataUrl } from "@/lib/imageCompression";
import { trpc } from "@/providers/trpc";
import type { OnboardingData } from "./onboardingTypes";

interface Props {
  data: OnboardingData;
  update: <K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) => void;
}

const YEARS = Array.from({ length: 30 }, (_, i) => String(new Date().getFullYear() - i));

function FieldCard({
  icon: Icon, label, children,
}: { icon: typeof Hash; label: string; children: React.ReactNode }) {
  return (
    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[24px] p-4">
      <label className="text-xs text-white/50 mb-2 flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5" /> {label}
      </label>
      {children}
    </div>
  );
}

export default function StepVehicleDetails({ data, update }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const uploadDocumentMutation = trpc.driver.uploadDocument.useMutation();

  const vehiclePhoto = data.documents.vehiclePhoto;

  const handlePickPhoto = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setUploadError("");
    try {
      const dataUrl = await resizeImageToDataUrl(file, 1024);
      await uploadDocumentMutation.mutateAsync({ type: "vehiclePhoto", url: dataUrl });
      update("documents", { ...data.documents, vehiclePhoto: dataUrl });
    } catch {
      setUploadError("Couldn't upload that photo — please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-bold mb-1">Vehicle Details</h2>
      <p className="text-white/50 text-sm mb-4">Tell us about your {data.vehicleType || "vehicle"}</p>

      <FieldCard icon={Hash} label="Vehicle Number">
        <input
          value={data.vehicleNumber}
          onChange={(e) => update("vehicleNumber", e.target.value.toUpperCase())}
          placeholder="e.g. WB 12 AB 1234"
          className="w-full bg-transparent text-base font-medium outline-none placeholder:text-white/30"
        />
      </FieldCard>

      <div className="grid grid-cols-2 gap-3">
        <FieldCard icon={Car} label="Brand">
          <input
            value={data.vehicleBrand}
            onChange={(e) => update("vehicleBrand", e.target.value)}
            placeholder="e.g. Bajaj"
            className="w-full bg-transparent text-base font-medium outline-none placeholder:text-white/30"
          />
        </FieldCard>
        <FieldCard icon={Car} label="Model">
          <input
            value={data.vehicleModel}
            onChange={(e) => update("vehicleModel", e.target.value)}
            placeholder="e.g. Maxima"
            className="w-full bg-transparent text-base font-medium outline-none placeholder:text-white/30"
          />
        </FieldCard>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FieldCard icon={CalendarDays} label="Manufacturing Year">
          <select
            value={data.manufacturingYear}
            onChange={(e) => update("manufacturingYear", e.target.value)}
            className="w-full bg-transparent text-base font-medium outline-none [color-scheme:dark]"
          >
            <option value="" className="bg-[#12172A]">Select</option>
            {YEARS.map((y) => (
              <option key={y} value={y} className="bg-[#12172A]">{y}</option>
            ))}
          </select>
        </FieldCard>
        <FieldCard icon={Palette} label="Color">
          <input
            value={data.vehicleColor}
            onChange={(e) => update("vehicleColor", e.target.value)}
            placeholder="e.g. White"
            className="w-full bg-transparent text-base font-medium outline-none placeholder:text-white/30"
          />
        </FieldCard>
      </div>

      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[24px] p-4">
        <label className="text-xs text-white/50 mb-3 flex items-center gap-1.5">
          <Camera className="w-3.5 h-3.5" /> Vehicle Photo (optional)
        </label>
        {vehiclePhoto ? (
          <div className="relative">
            <img src={vehiclePhoto} alt="Vehicle" className="w-full h-36 object-cover rounded-2xl" />
            <button
              onClick={() => update("documents", { ...data.documents, vehiclePhoto: undefined })}
              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center"
              aria-label="Remove photo"
            >
              <X className="w-4 h-4 text-white" />
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-2 right-2 px-3 py-1.5 rounded-full bg-black/60 text-white text-xs font-medium"
            >
              Replace
            </button>
          </div>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full flex flex-col items-center justify-center gap-1.5 h-28 rounded-2xl border-2 border-dashed border-white/15 text-white/50 disabled:opacity-50"
          >
            <Camera className="w-5 h-5" />
            <span className="text-xs">{uploading ? "Uploading…" : "Tap to add a photo"}</span>
          </button>
        )}
        {uploadError && <p className="text-xs text-[#FF6B6B] mt-2">{uploadError}</p>}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => handlePickPhoto(e.target.files?.[0])}
        />
      </div>
    </div>
  );
}
