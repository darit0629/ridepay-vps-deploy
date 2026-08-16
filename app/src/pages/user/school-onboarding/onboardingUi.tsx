import { useState } from "react";
import { Camera, Loader2, type LucideIcon } from "lucide-react";

export const inputCls =
  "w-full bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl px-4 py-3 text-sm outline-none border border-gray-100 dark:border-gray-700 focus:border-[#FF6B00] text-[#1A1A2E] dark:text-[#E5E7EB]";

export const cardCls = "bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4 space-y-3";

// Downscales and re-encodes a picked image file as a JPEG data URI — same
// pattern SchoolSubscribe.tsx's original single-page form used.
function readImageAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      const maxEdge = 800;
      const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
      URL.revokeObjectURL(objectUrl);
    };
    img.onerror = reject;
    img.src = objectUrl;
  });
}

export function PhotoPicker({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [loading, setLoading] = useState(false);
  return (
    <div>
      <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-2 flex items-center gap-1.5">
        <Camera className="w-3.5 h-3.5" /> {label}
      </label>
      <label className="flex items-center gap-3 bg-[#F8F9FA] dark:bg-[#0F172A] rounded-xl p-3 cursor-pointer border border-dashed border-gray-300 dark:border-gray-600">
        {value ? (
          <img src={value} alt={label} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
        ) : (
          <div className="w-12 h-12 rounded-lg bg-white dark:bg-[#1E293B] flex items-center justify-center flex-shrink-0">
            {loading ? <Loader2 className="w-5 h-5 text-[#FF6B00] animate-spin" /> : <Camera className="w-5 h-5 text-[#9CA3AF]" />}
          </div>
        )}
        <span className="text-sm text-[#6B7280] dark:text-[#9CA3AF]">{value ? "Change photo" : "Tap to upload"}</span>
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setLoading(true);
            try {
              onChange(await readImageAsDataUrl(file));
            } finally {
              setLoading(false);
            }
          }}
        />
      </label>
    </div>
  );
}

export function Field({ label, icon: Icon, children }: { label: string; icon?: LucideIcon; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-[#6B7280] dark:text-[#9CA3AF] mb-2 flex items-center gap-1.5">
        {Icon && <Icon className="w-3.5 h-3.5" />} {label}
      </label>
      {children}
    </div>
  );
}
