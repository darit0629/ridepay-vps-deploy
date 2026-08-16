export default function MapUnavailable() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[#F1F1F1] p-6 text-center z-0">
      <div>
        <p className="font-semibold text-[#1A1A2E] mb-1">Map unavailable</p>
        <p className="text-sm text-[#6B7280]">
          Add <code className="px-1 py-0.5 bg-gray-200 rounded text-xs">VITE_GOOGLE_MAPS_API_KEY</code> to your .env
          file to enable the map.
        </p>
      </div>
    </div>
  );
}
