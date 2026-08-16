import { useEffect, useState } from "react";

interface WeatherState {
  tempC: number | null;
  emoji: string;
  description: string;
}

// Open-Meteo needs no API key and is CORS-enabled for browser calls, so no
// server proxy is required here.
const WEATHER_CODE_MAP: Record<number, { emoji: string; description: string }> = {
  0: { emoji: "☀️", description: "Clear sky" },
  1: { emoji: "🌤️", description: "Mostly clear" },
  2: { emoji: "⛅", description: "Partly cloudy" },
  3: { emoji: "☁️", description: "Overcast" },
  45: { emoji: "🌫️", description: "Foggy" },
  48: { emoji: "🌫️", description: "Foggy" },
  51: { emoji: "🌦️", description: "Light drizzle" },
  53: { emoji: "🌦️", description: "Drizzle" },
  55: { emoji: "🌦️", description: "Dense drizzle" },
  61: { emoji: "🌧️", description: "Light rain" },
  63: { emoji: "🌧️", description: "Rain" },
  65: { emoji: "🌧️", description: "Heavy rain" },
  71: { emoji: "🌨️", description: "Snow" },
  73: { emoji: "🌨️", description: "Snow" },
  75: { emoji: "🌨️", description: "Heavy snow" },
  80: { emoji: "🌧️", description: "Rain showers" },
  81: { emoji: "🌧️", description: "Rain showers" },
  82: { emoji: "⛈️", description: "Violent showers" },
  95: { emoji: "⛈️", description: "Thunderstorm" },
  96: { emoji: "⛈️", description: "Thunderstorm" },
  99: { emoji: "⛈️", description: "Thunderstorm" },
};

const REFRESH_MS = 5 * 60 * 1000;

export function useWeather(coords: { lat: number; lng: number } | null | undefined) {
  const [weather, setWeather] = useState<WeatherState>({ tempC: null, emoji: "🌤️", description: "" });

  // Rounded to ~1km so dragging the pickup pin while editing doesn't spam
  // the API — the weather chip only needs a rough area, not exact coords.
  const lat = coords ? Math.round(coords.lat * 100) / 100 : null;
  const lng = coords ? Math.round(coords.lng * 100) / 100 : null;

  useEffect(() => {
    if (lat === null || lng === null) return;
    let cancelled = false;

    const fetchWeather = async () => {
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code`;
        const res = await fetch(url);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const code = data?.current?.weather_code as number | undefined;
        const temp = data?.current?.temperature_2m as number | undefined;
        const mapped = WEATHER_CODE_MAP[code ?? 0] ?? WEATHER_CODE_MAP[0];
        setWeather({ tempC: temp ?? null, emoji: mapped.emoji, description: mapped.description });
      } catch (error) {
        console.warn("Error fetching weather:", error);
      }
    };

    fetchWeather();
    const interval = setInterval(fetchWeather, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [lat, lng]);

  return weather;
}
