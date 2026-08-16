// Pure computational-geometry helpers for the Route Restriction system —
// zero DB/network dependency, so both googleDirectionsServer.ts (route
// avoidance) and routeRestrictions.ts's bbox prefilters can reuse the same
// math without either one drifting from the other.

export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_M = 6371000;

/** Decodes a Google encoded-polyline string (the format `overview_polyline.
 *  points` comes back in) into a plain lat/lng path. */
export function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}

/** Local equirectangular projection around a given latitude — good enough
 *  at road-network scale (a few km) for meter-accurate distance math
 *  without pulling in a full geodesy library. */
function toLocalMeters(p: LatLng, originLat: number): { x: number; y: number } {
  const latRad = (originLat * Math.PI) / 180;
  return {
    x: p.lng * (Math.PI / 180) * EARTH_RADIUS_M * Math.cos(latRad),
    y: p.lat * (Math.PI / 180) * EARTH_RADIUS_M,
  };
}

export function pointToSegmentDistanceMeters(p: LatLng, a: LatLng, b: LatLng): number {
  const originLat = (p.lat + a.lat + b.lat) / 3;
  const P = toLocalMeters(p, originLat);
  const A = toLocalMeters(a, originLat);
  const B = toLocalMeters(b, originLat);
  const dx = B.x - A.x;
  const dy = B.y - A.y;
  const lengthSq = dx * dx + dy * dy;
  let t = lengthSq === 0 ? 0 : ((P.x - A.x) * dx + (P.y - A.y) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));
  const closestX = A.x + t * dx;
  const closestY = A.y + t * dy;
  return Math.hypot(P.x - closestX, P.y - closestY);
}

function orientation(p: LatLng, q: LatLng, r: LatLng): 0 | 1 | 2 {
  const val = (q.lng - p.lng) * (r.lat - q.lat) - (q.lat - p.lat) * (r.lng - q.lng);
  if (Math.abs(val) < 1e-12) return 0;
  return val > 0 ? 1 : 2;
}

function onSegment(p: LatLng, q: LatLng, r: LatLng): boolean {
  return (
    q.lng <= Math.max(p.lng, r.lng) &&
    q.lng >= Math.min(p.lng, r.lng) &&
    q.lat <= Math.max(p.lat, r.lat) &&
    q.lat >= Math.min(p.lat, r.lat)
  );
}

/** Standard orientation-based 2D segment-crossing test — treats lat/lng as
 *  planar coordinates, which is fine for a boolean crossing check at
 *  road-network scale. */
export function segmentsIntersect(a1: LatLng, a2: LatLng, b1: LatLng, b2: LatLng): boolean {
  const o1 = orientation(a1, a2, b1);
  const o2 = orientation(a1, a2, b2);
  const o3 = orientation(b1, b2, a1);
  const o4 = orientation(b1, b2, a2);
  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(a1, b1, a2)) return true;
  if (o2 === 0 && onSegment(a1, b2, a2)) return true;
  if (o3 === 0 && onSegment(b1, a1, b2)) return true;
  if (o4 === 0 && onSegment(b1, a2, b2)) return true;
  return false;
}

/** Ray-casting point-in-polygon test. `ring` need not repeat its first
 *  point at the end — the wraparound edge is handled internally. */
export function pointInPolygon(point: LatLng, ring: LatLng[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i].lng;
    const yi = ring[i].lat;
    const xj = ring[j].lng;
    const yj = ring[j].lat;
    const crosses = yi > point.lat !== yj > point.lat && point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

/** True if any edge of `routePath` crosses, or passes within
 *  `bufferMeters` of, any edge of any road segment in `segments`. The
 *  buffer catches near-parallel routes that graze a blocked road without a
 *  true geometric crossing. */
export function routeIntersectsRoadRestriction(routePath: LatLng[], segments: LatLng[][], bufferMeters = 15): boolean {
  for (const segment of segments) {
    for (let i = 0; i < segment.length - 1; i++) {
      const a = segment[i];
      const b = segment[i + 1];
      for (let j = 0; j < routePath.length - 1; j++) {
        const r1 = routePath[j];
        const r2 = routePath[j + 1];
        if (segmentsIntersect(a, b, r1, r2)) return true;
        if (pointToSegmentDistanceMeters(r1, a, b) <= bufferMeters) return true;
      }
    }
  }
  return false;
}

/** True if the route ever enters the polygon, or passes through it without
 *  a vertex landing inside (route edge crosses a polygon edge). */
export function routeIntersectsAreaRestriction(routePath: LatLng[], polygonRing: LatLng[]): boolean {
  for (const point of routePath) {
    if (pointInPolygon(point, polygonRing)) return true;
  }
  for (let i = 0; i < routePath.length - 1; i++) {
    const r1 = routePath[i];
    const r2 = routePath[i + 1];
    for (let j = 0; j < polygonRing.length; j++) {
      const p1 = polygonRing[j];
      const p2 = polygonRing[(j + 1) % polygonRing.length];
      if (segmentsIntersect(r1, r2, p1, p2)) return true;
    }
  }
  return false;
}

export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export function boundingBox(points: LatLng[]): BoundingBox {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  }
  return { minLat, maxLat, minLng, maxLng };
}

/** Expands a bounding box by roughly `paddingKm` on every side — a coarse
 *  degrees-per-km approximation (1° lat ≈ 111km everywhere; 1° lng scaled
 *  by cos(latitude)), good enough for a cheap DB-level prefilter, not for
 *  the actual avoidance geometry. */
export function padBoundingBox(box: BoundingBox, paddingKm: number): BoundingBox {
  const latPad = paddingKm / 111;
  const midLat = (box.minLat + box.maxLat) / 2;
  const lngPad = paddingKm / (111 * Math.max(0.1, Math.cos((midLat * Math.PI) / 180)));
  return {
    minLat: box.minLat - latPad,
    maxLat: box.maxLat + latPad,
    minLng: box.minLng - lngPad,
    maxLng: box.maxLng + lngPad,
  };
}

export function boxesOverlap(a: BoundingBox, b: BoundingBox): boolean {
  return a.minLat <= b.maxLat && a.maxLat >= b.minLat && a.minLng <= b.maxLng && a.maxLng >= b.minLng;
}

/** Initial compass bearing (degrees, 0-360) from `a` to `b`. */
export function bearingBetween(a: LatLng, b: LatLng): number {
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Offsets `origin` by `meters` along compass `bearingDeg` — used to place
 *  a detour waypoint a fixed distance to one side of a blocked point. */
export function offsetByMeters(origin: LatLng, bearingDeg: number, meters: number): LatLng {
  const bearing = (bearingDeg * Math.PI) / 180;
  const latRad = (origin.lat * Math.PI) / 180;
  const lngRad = (origin.lng * Math.PI) / 180;
  const angularDistance = meters / EARTH_RADIUS_M;
  const newLatRad = Math.asin(
    Math.sin(latRad) * Math.cos(angularDistance) + Math.cos(latRad) * Math.sin(angularDistance) * Math.cos(bearing)
  );
  const newLngRad =
    lngRad +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latRad),
      Math.cos(angularDistance) - Math.sin(latRad) * Math.sin(newLatRad)
    );
  return { lat: (newLatRad * 180) / Math.PI, lng: (newLngRad * 180) / Math.PI };
}
