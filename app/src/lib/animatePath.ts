export interface PathAnimationHandle {
  cancel: () => void;
}

// Drives a vehicle continuously along a Directions path at constant speed,
// firing every animation frame — replaces the old "jump 2-3 points every
// ~1s" interval pattern, which looked like the vehicle (and the polyline
// retracting behind it) was teleporting in bursts rather than moving
// smoothly. Position is linearly interpolated *between* path points (not
// snapped to the nearest one), and pacing is by cumulative distance so
// dense/sparse point clusters along the route don't speed up or slow down
// the apparent motion.
export function animateAlongPath(
  path: google.maps.LatLngLiteral[],
  durationMs: number,
  onTick: (point: google.maps.LatLngLiteral, headingDeg: number, remainingPath: google.maps.LatLngLiteral[]) => void,
  onDone: () => void
): PathAnimationHandle {
  if (path.length < 2) {
    onDone();
    return { cancel: () => {} };
  }

  let rafId = 0;
  let cancelled = false;
  const start = performance.now();

  const cumulative: number[] = [0];
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    cumulative.push(cumulative[i - 1] + Math.hypot(b.lat - a.lat, b.lng - a.lng));
  }
  const total = cumulative[cumulative.length - 1] || 1;

  const frame = (now: number) => {
    if (cancelled) return;
    const t = Math.min(1, (now - start) / durationMs);
    const targetDist = t * total;

    let i = 1;
    while (i < cumulative.length - 1 && cumulative[i] < targetDist) i++;
    const segStart = cumulative[i - 1];
    const segEnd = cumulative[i];
    const segT = segEnd > segStart ? (targetDist - segStart) / (segEnd - segStart) : 0;
    const a = path[i - 1];
    const b = path[i];
    const point = { lat: a.lat + (b.lat - a.lat) * segT, lng: a.lng + (b.lng - a.lng) * segT };
    const heading = google.maps.geometry?.spherical ? google.maps.geometry.spherical.computeHeading(a, b) : 0;
    const remainingPath = [point, ...path.slice(i)];

    onTick(point, heading, remainingPath);

    if (t >= 1) {
      onDone();
      return;
    }
    rafId = requestAnimationFrame(frame);
  };
  rafId = requestAnimationFrame(frame);

  return {
    cancel: () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    },
  };
}
