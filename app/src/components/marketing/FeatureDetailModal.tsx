import { useEffect, type ComponentType } from "react";
import { X } from "lucide-react";
import PhoneMockup from "./PhoneMockup";

interface FeatureDetailModalProps {
  title: string;
  detail: string;
  color: string;
  Screen: ComponentType;
  dark?: boolean;
  onClose: () => void;
}

// A small floating popup (not a bottom sheet) — centered on every screen
// size, dismissed by clicking the backdrop, pressing Escape, or scrolling
// the page behind it, so it never traps the user the way a full sheet would.
export default function FeatureDetailModal({ title, detail, color, Screen, dark, onClose }: FeatureDetailModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    window.addEventListener("wheel", onClose, { passive: true });
    window.addEventListener("touchmove", onClose, { passive: true });
    window.addEventListener("scroll", onClose, { passive: true });
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("wheel", onClose);
      window.removeEventListener("touchmove", onClose);
      window.removeEventListener("scroll", onClose);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative bg-white dark:bg-[#1E293B] w-full max-w-[240px] rounded-2xl shadow-2xl max-h-[85vh] overflow-y-auto animate-fade-slide"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 transition-colors"
          aria-label="Close"
        >
          <X className="w-3 h-3 text-[#1A1A2E] dark:text-[#E5E7EB]" />
        </button>
        <div className="flex flex-col items-center text-center gap-2 p-4 pt-6">
          <PhoneMockup dark={dark} size="compact">
            <Screen />
          </PhoneMockup>
          <span className="text-[9px] font-bold uppercase tracking-wide" style={{ color }}>
            Feature Preview
          </span>
          <h3 className="text-sm font-bold text-[#1A1A2E] dark:text-[#E5E7EB]">{title}</h3>
          <p className="text-[11px] text-[#6B7280] dark:text-[#9CA3AF] leading-relaxed">{detail}</p>
        </div>
      </div>
    </div>
  );
}
