import { Map, Satellite } from "lucide-react";

interface MapViewToggleProps {
  mapView: "normal" | "satellite";
  onToggle: () => void;
  className?: string;
}

export default function MapViewToggle({ mapView, onToggle, className }: MapViewToggleProps) {
  return (
    <button
      onClick={onToggle}
      className={
        className ??
        "absolute top-4 right-4 z-20 bg-white rounded-xl shadow-lg p-3 hover:bg-gray-50 transition-colors"
      }
    >
      {mapView === "normal" ? (
        <Satellite className="w-5 h-5 text-[#1A1A2E] dark:text-[#E5E7EB]" />
      ) : (
        <Map className="w-5 h-5 text-[#1A1A2E] dark:text-[#E5E7EB]" />
      )}
    </button>
  );
}
