export interface RouteResult {
  coords: [number, number][];
  distanceKm: number;
  durationMin: number;
}

// Free OSRM demo routing service - shared by every page that draws a route.
export async function fetchRoute(
  start: [number, number],
  end: [number, number],
  profile: "driving" | "bike" = "driving"
): Promise<RouteResult | null> {
  const response = await fetch(
    `https://router.project-osrm.org/route/v1/${profile}/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson`
  );
  const data = await response.json();

  if (!data.routes || data.routes.length === 0) return null;

  const route = data.routes[0];
  const coords: [number, number][] = route.geometry.coordinates.map(
    (coord: number[]) => [coord[1], coord[0]] as [number, number]
  );

  return {
    coords,
    distanceKm: route.distance / 1000,
    durationMin: route.duration / 60,
  };
}
