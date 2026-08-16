import { useEffect } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { applyMapTheme } from "@/lib/mapDarkStyle";

/**
 * Keeps a Google Map's dark/light styling in sync with the app's theme
 * toggle, for as long as the screen is mounted. Reads `mapRef.current`
 * fresh each time the theme changes, so it works with the plain `useRef`
 * pattern most map screens already use — no need to lift the map instance
 * into state just for this.
 */
export function useMapTheme(mapRef: React.RefObject<google.maps.Map | null>, isVectorMap: boolean) {
  const { theme } = useTheme();

  useEffect(() => {
    if (!mapRef.current) return;
    applyMapTheme(mapRef.current, theme === "dark", isVectorMap);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, isVectorMap]);
}
