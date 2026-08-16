// Restriction-aware replacement for src/lib/googleDirections.ts's
// fetchGoogleRoute — every live-navigation call site swaps to this, not a
// new polling mechanism. The backend (api/route-restriction-router.ts's
// getSafeRoute) is the sole authority on avoidance; this hook never runs
// its own point-in-polygon/segment-intersection math client-side, since
// that would risk exactly the "different devices see different restriction
// state" problem the backend-authoritative design exists to prevent — see
// the Route Restriction plan's Step 7 note.
import { fetchGoogleRoute, type GoogleRouteResult } from "@/lib/googleDirections";
import { trpc } from "@/providers/trpc";

type TrpcUtils = ReturnType<typeof trpc.useUtils>;

export interface NoAlternativeRoute {
  noAlternative: true;
}

export async function fetchSafeRoute(
  utils: TrpcUtils,
  origin: google.maps.LatLngLiteral,
  destination: google.maps.LatLngLiteral
): Promise<GoogleRouteResult | NoAlternativeRoute | null> {
  const safe = await utils.routeRestriction.getSafeRoute.fetch({
    originLat: origin.lat,
    originLng: origin.lng,
    destLat: destination.lat,
    destLng: destination.lng,
  });

  if (!safe.hasActiveRestrictions) {
    // Overwhelmingly common case — zero restrictions anywhere near this
    // path, already confirmed server-side via a cheap bbox check with no
    // Google call spent. Falls through unchanged to the exact same
    // client-side Directions call every other screen in this app still uses.
    return fetchGoogleRoute(origin, destination);
  }

  if (safe.status === "no_alternative" || !safe.path) {
    return { noAlternative: true };
  }

  const path = safe.path.map((p) => new google.maps.LatLng(p.lat, p.lng));
  const bounds = new google.maps.LatLngBounds();
  for (const point of path) bounds.extend(point);

  return {
    path,
    distanceKm: safe.distanceKm ?? 0,
    durationMin: safe.durationMin ?? 0,
    bounds,
    steps: safe.steps ?? [],
  };
}
