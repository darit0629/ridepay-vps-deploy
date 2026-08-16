// Server-side Google Directions REST client for the Route Restriction
// system — the ONLY backend code in this app that calls Google directly
// (everywhere else, routing is client-side via google.maps.DirectionsService
// in the browser). Needed because real road-avoidance must be authoritative
// on the server, not something each client device decides for itself.
//
// Google's Directions API has no "avoid this custom road/area" parameter —
// only avoidHighways/avoidTolls/avoidFerries. Real avoidance here means:
// compute a route, geometrically test it against active restriction
// geometry, and if it crosses a "hard" restriction, inject a detour
// waypoint and retry. This is a heuristic, not a guarantee from Google's
// side — bounded to a few attempts before giving up honestly with
// status:"no_alternative" rather than silently returning a route that
// still crosses the closure.

import {
  type LatLng,
  decodePolyline,
  routeIntersectsRoadRestriction,
  routeIntersectsAreaRestriction,
  bearingBetween,
  offsetByMeters,
  pointToSegmentDistanceMeters,
  segmentsIntersect,
  pointInPolygon,
} from "./routeGeometry";

const DIRECTIONS_URL = "https://maps.googleapis.com/maps/api/directions/json";
const MAX_DETOUR_ATTEMPTS = 3;
const WAYPOINT_OFFSET_METERS = [300, 600, 900];
const ROAD_BUFFER_METERS = 15;

let warnedMissingKey = false;

export type RestrictionSeverity = "advisory" | "restricted" | "fully_blocked" | "emergency_closure";

export interface ServerRestrictionGeometry {
  id: string;
  severity: RestrictionSeverity;
  restrictionType: "road" | "area";
  segments?: LatLng[][]; // road-type: one array of points per named road
  areaGeometry?: LatLng[]; // area-type: a single closed polygon ring
}

export interface RouteStep {
  instruction: string;
  maneuver?: string;
  distanceMeters: number;
}

export interface RestrictionAwareRouteResult {
  status: "ok" | "no_alternative";
  path?: LatLng[];
  distanceKm?: number;
  durationMin?: number;
  steps?: RouteStep[];
  usedRestrictedRoad?: boolean;
  detourAttempts?: number;
}

interface RawDirectionsResult {
  path: LatLng[];
  distanceKm: number;
  durationMin: number;
  steps: RouteStep[];
}

interface GoogleDirectionsApiResponse {
  status: string;
  routes?: {
    overview_polyline: { points: string };
    legs?: {
      distance?: { value: number };
      duration?: { value: number };
      steps?: { html_instructions: string; maneuver?: string; distance?: { value: number } }[];
    }[];
  }[];
}

// Same tag-stripping approach as src/lib/googleDirections.ts's client-side
// stripHtml — Google's step instructions come back with <b>/<div> markup.
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

export async function fetchGoogleDirections(origin: LatLng, destination: LatLng, viaWaypoints: LatLng[]): Promise<RawDirectionsResult | null> {
  const apiKey = process.env.GOOGLE_MAPS_SERVER_KEY ?? "";
  if (!apiKey) {
    if (!warnedMissingKey) {
      console.error("[googleDirectionsServer] GOOGLE_MAPS_SERVER_KEY is not configured — route-restriction avoidance cannot call Google Directions.");
      warnedMissingKey = true;
    }
    return null;
  }

  const params = new URLSearchParams({
    origin: `${origin.lat},${origin.lng}`,
    destination: `${destination.lat},${destination.lng}`,
    mode: "driving",
    key: apiKey,
  });
  if (viaWaypoints.length) {
    params.set("waypoints", viaWaypoints.map((w) => `via:${w.lat},${w.lng}`).join("|"));
  }

  const response = await fetch(`${DIRECTIONS_URL}?${params.toString()}`);
  const data = (await response.json()) as GoogleDirectionsApiResponse;
  if (data.status !== "OK" || !data.routes?.length) return null;

  const route = data.routes[0];
  const leg = route.legs?.[0];
  return {
    path: decodePolyline(route.overview_polyline.points),
    distanceKm: (leg?.distance?.value ?? 0) / 1000,
    durationMin: (leg?.duration?.value ?? 0) / 60,
    steps: (leg?.steps ?? []).map((step) => ({
      instruction: stripHtml(step.html_instructions),
      maneuver: step.maneuver,
      distanceMeters: step.distance?.value ?? 0,
    })),
  };
}

function restrictionIntersectsRoute(routePath: LatLng[], restriction: ServerRestrictionGeometry): boolean {
  if (restriction.restrictionType === "road" && restriction.segments) {
    return routeIntersectsRoadRestriction(routePath, restriction.segments, ROAD_BUFFER_METERS);
  }
  if (restriction.restrictionType === "area" && restriction.areaGeometry) {
    return routeIntersectsAreaRestriction(routePath, restriction.areaGeometry);
  }
  return false;
}

/** Finds the first route point that lands inside/near the given
 *  restriction's geometry — used as the anchor to offset a detour
 *  waypoint from. */
function findCollisionPoint(routePath: LatLng[], restriction: ServerRestrictionGeometry): LatLng | null {
  if (restriction.restrictionType === "road" && restriction.segments) {
    for (const segment of restriction.segments) {
      for (let i = 0; i < segment.length - 1; i++) {
        for (let j = 0; j < routePath.length - 1; j++) {
          if (
            segmentsIntersect(segment[i], segment[i + 1], routePath[j], routePath[j + 1]) ||
            pointToSegmentDistanceMeters(routePath[j], segment[i], segment[i + 1]) <= ROAD_BUFFER_METERS
          ) {
            return routePath[j];
          }
        }
      }
    }
  } else if (restriction.restrictionType === "area" && restriction.areaGeometry) {
    for (const point of routePath) {
      if (pointInPolygon(point, restriction.areaGeometry)) return point;
    }
  }
  return null;
}

/**
 * Computes a route from origin to destination that avoids every "hard"
 * restriction (fully_blocked / emergency_closure) in `restrictions`,
 * retrying with an injected detour waypoint up to MAX_DETOUR_ATTEMPTS times.
 * "restricted" (soft) restrictions are avoided on a best-effort basis but
 * never block the route; "advisory" is excluded entirely — informational
 * only, never affects routing, per spec.
 */
export async function computeRestrictionAwareRoute(
  origin: LatLng,
  destination: LatLng,
  restrictions: ServerRestrictionGeometry[]
): Promise<RestrictionAwareRouteResult> {
  const hard = restrictions.filter((r) => r.severity === "fully_blocked" || r.severity === "emergency_closure");
  const soft = restrictions.filter((r) => r.severity === "restricted");

  const waypoints: LatLng[] = [];
  const overallBearing = bearingBetween(origin, destination);

  for (let attempt = 0; attempt < MAX_DETOUR_ATTEMPTS; attempt++) {
    const result = await fetchGoogleDirections(origin, destination, waypoints);
    if (!result) {
      return { status: "no_alternative", detourAttempts: attempt };
    }

    const collidingHard = hard.find((r) => restrictionIntersectsRoute(result.path, r));
    if (!collidingHard) {
      const usedRestrictedRoad = soft.some((r) => restrictionIntersectsRoute(result.path, r));
      return {
        status: "ok",
        path: result.path,
        distanceKm: result.distanceKm,
        durationMin: result.durationMin,
        steps: result.steps,
        usedRestrictedRoad,
        detourAttempts: attempt,
      };
    }

    const collisionPoint = findCollisionPoint(result.path, collidingHard);
    if (!collisionPoint) break; // collision detected but couldn't be localized — stop retrying rather than loop blind

    // Alternate side per attempt, offsetting further each time.
    const side = attempt % 2 === 0 ? 90 : -90;
    const detour = offsetByMeters(collisionPoint, (overallBearing + side + 360) % 360, WAYPOINT_OFFSET_METERS[attempt] ?? 900);
    waypoints.push(detour);
  }

  return { status: "no_alternative", detourAttempts: MAX_DETOUR_ATTEMPTS };
}
