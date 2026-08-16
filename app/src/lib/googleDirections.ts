export interface GoogleRouteStep {
  /** Plain text — Google returns html_instructions with <b>/<div> tags stripped out. */
  instruction: string;
  maneuver?: string;
  distanceMeters: number;
}

export interface GoogleRouteResult {
  path: google.maps.LatLng[];
  distanceKm: number;
  durationMin: number;
  bounds: google.maps.LatLngBounds;
  steps: GoogleRouteStep[];
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

let directionsService: google.maps.DirectionsService | null = null;

export async function fetchGoogleRoute(
  origin: google.maps.LatLngLiteral,
  destination: google.maps.LatLngLiteral,
  travelMode: google.maps.TravelMode = google.maps.TravelMode.DRIVING
): Promise<GoogleRouteResult | null> {
  if (!directionsService) {
    directionsService = new google.maps.DirectionsService();
  }

  const result = await directionsService.route({ origin, destination, travelMode, provideRouteAlternatives: true });
  if (!result.routes.length) return null;

  // Google's routes[0] is its "recommended" (usually fastest) route, not
  // necessarily the shortest by distance — pick the alternative with the
  // smallest total distance instead, since that's what riders actually asked for.
  const route = result.routes.reduce((shortest, candidate) => {
    const shortestDistance = shortest.legs[0]?.distance?.value ?? Infinity;
    const candidateDistance = candidate.legs[0]?.distance?.value ?? Infinity;
    return candidateDistance < shortestDistance ? candidate : shortest;
  }, result.routes[0]);

  const leg = route.legs[0];
  return {
    path: route.overview_path,
    distanceKm: (leg?.distance?.value ?? 0) / 1000,
    durationMin: (leg?.duration?.value ?? 0) / 60,
    bounds: route.bounds,
    steps: (leg?.steps ?? []).map((step) => ({
      instruction: stripHtml(step.instructions),
      maneuver: step.maneuver,
      distanceMeters: step.distance?.value ?? 0,
    })),
  };
}
