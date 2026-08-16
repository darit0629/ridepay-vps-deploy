import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Flame, TrendingUp } from "lucide-react";
import MapUnavailable from "@/components/MapUnavailable";
import { hasGoogleMapsKey, loadGoogleMaps } from "@/lib/googleMaps";
import { useMapTheme } from "@/hooks/useMapTheme";
import { useTheme } from "@/contexts/ThemeContext";
import { DARK_MAP_STYLES } from "@/lib/mapDarkStyle";

type DemandLevel = "normal" | "busy" | "high" | "veryHigh";

interface Hotspot {
  name: string;
  reason: string;
  lat: number;
  lng: number;
  level: DemandLevel;
}

const LEVEL_STYLE: Record<DemandLevel, { color: string; label: string; textColor: string; bg: string }> = {
  normal: { color: "#138808", label: "Normal", textColor: "#138808", bg: "#E8F5E8" },
  busy: { color: "#EAB308", label: "Busy", textColor: "#A16207", bg: "#FEF9C3" },
  high: { color: "#FF6B00", label: "High Demand", textColor: "#FF6B00", bg: "#FFF5EB" },
  veryHigh: { color: "#DC2626", label: "Very High Demand", textColor: "#DC2626", bg: "#FEE2E2" },
};

const hotspots: Hotspot[] = [
  { name: "Ranaghat Railway Station", reason: "Evening commuter rush", lat: 23.1815, lng: 88.5617, level: "veryHigh" },
  { name: "Ranaghat College", reason: "Classes letting out", lat: 23.1745, lng: 88.5605, level: "high" },
  { name: "Ranaghat Market", reason: "Weekend shopping crowd", lat: 23.178, lng: 88.5585, level: "high" },
  { name: "Sub-Divisional Hospital", reason: "Visiting hours", lat: 23.1795, lng: 88.5635, level: "busy" },
  { name: "Anulia", reason: "Residential area", lat: 23.185, lng: 88.555, level: "normal" },
];

export default function DriverDemandMap() {
  const navigate = useNavigate();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const [mapLoadError, setMapLoadError] = useState(!hasGoogleMapsKey);
  const { theme } = useTheme();
  useMapTheme(map, false);

  useEffect(() => {
    if (!hasGoogleMapsKey || !mapContainer.current) return;

    let disposed = false;
    const circles: google.maps.Circle[] = [];

    loadGoogleMaps()
      .then(() => {
        if (disposed || !mapContainer.current) return;

        const gMap = new google.maps.Map(mapContainer.current, {
          center: { lat: 23.179, lng: 88.559 },
          zoom: 14,
          disableDefaultUI: true,
          zoomControl: true,
          styles: theme === "dark" ? DARK_MAP_STYLES : [],
        });
        map.current = gMap;

        hotspots.forEach((spot) => {
          const style = LEVEL_STYLE[spot.level];
          const circle = new google.maps.Circle({
            center: { lat: spot.lat, lng: spot.lng },
            radius: spot.level === "veryHigh" ? 500 : spot.level === "high" ? 400 : spot.level === "busy" ? 300 : 200,
            map: gMap,
            fillColor: style.color,
            fillOpacity: 0.25,
            strokeColor: style.color,
            strokeOpacity: 0.6,
            strokeWeight: 2,
          });
          circles.push(circle);
        });
      })
      .catch((error) => {
        console.error("Error loading Google Maps:", error);
        setMapLoadError(true);
      });

    return () => {
      disposed = true;
      circles.forEach((c) => c.setMap(null));
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#F8F9FA] dark:bg-[#0F172A] pb-6">
      {/* Header */}
      <div className="bg-white dark:bg-[#1E293B] px-4 py-3 flex items-center gap-3 shadow-sm z-10 relative">
        <button onClick={() => navigate("/driver/dashboard")} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full">
          <ArrowLeft className="w-5 h-5 text-[#1A1A2E] dark:text-[#E5E7EB]" />
        </button>
        <h1 className="font-bold text-lg text-[#1A1A2E] dark:text-[#E5E7EB]">Demand Heatmap</h1>
      </div>

      {/* Push-style alert */}
      <div className="px-4 pt-3">
        <div className="bg-[#DC2626] text-white rounded-2xl p-3 flex items-start gap-3">
          <Flame className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p className="text-sm">
            High demand expected near <strong>Ranaghat Railway Station</strong> in 20 minutes. Go online now to earn more.
          </p>
        </div>
      </div>

      {/* Map */}
      <div className="px-4 pt-3">
        <div className="relative h-64 rounded-2xl overflow-hidden shadow-sm">
          <div ref={mapContainer} className="w-full h-full" />
          {mapLoadError && <MapUnavailable />}

          {/* Legend */}
          <div className="absolute bottom-3 left-3 bg-white dark:bg-[#1E293B] rounded-xl shadow-md p-2.5 space-y-1">
            {(Object.keys(LEVEL_STYLE) as DemandLevel[]).map((level) => (
              <div key={level} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: LEVEL_STYLE[level].color }} />
                <span className="text-[10px] text-[#6B7280] dark:text-[#9CA3AF]">{LEVEL_STYLE[level].label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Hotspot List */}
      <div className="px-4 pt-4 space-y-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-[#FF6B00]" />
          <h2 className="font-semibold text-[#1A1A2E] dark:text-[#E5E7EB] text-sm">Nearby Demand Zones</h2>
        </div>
        {hotspots.map((spot) => {
          const style = LEVEL_STYLE[spot.level];
          return (
            <div key={spot.name} className="bg-white dark:bg-[#1E293B] rounded-2xl shadow-sm p-4 flex items-center justify-between">
              <div>
                <p className="font-medium text-sm text-[#1A1A2E] dark:text-[#E5E7EB]">{spot.name}</p>
                <p className="text-xs text-[#6B7280] dark:text-[#9CA3AF]">{spot.reason}</p>
              </div>
              <span
                className="text-xs font-semibold px-3 py-1.5 rounded-full flex-shrink-0"
                style={{ color: style.textColor, backgroundColor: style.bg }}
              >
                {style.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
