// Bearing between two consecutive GPS/polled fixes is only meaningful once
// they're far enough apart — real-world GPS jitter (a few meters, even with
// enableHighAccuracy) dominates the true direction of travel when two fixes
// land within a few meters of each other, so computeHeading on noisy
// near-identical points returns essentially a random angle. Feeding that
// straight into the map's heading rotation is what produced the reported
// "jumping in place / spinning in a circle instead of navigating forward"
// symptom — every poll snapped to a new, unrelated bearing. Real navigation
// apps avoid this by trusting the device's own reported course over ground
// when available, and otherwise holding the last known heading until enough
// distance has accumulated to compute a trustworthy new one.
const MIN_HEADING_DISTANCE_METERS = 5;

export function resolveHeading(params: {
  previous: google.maps.LatLngLiteral | null;
  current: google.maps.LatLngLiteral;
  previousHeading: number;
  /** navigator.geolocation's own coords.heading, when the caller has it (null/undefined if unavailable or not moving). */
  deviceHeadingDeg?: number | null;
}): number {
  const { previous, current, previousHeading, deviceHeadingDeg } = params;

  if (deviceHeadingDeg != null && Number.isFinite(deviceHeadingDeg)) {
    return deviceHeadingDeg;
  }

  if (previous && google.maps.geometry?.spherical) {
    const movedMeters = google.maps.geometry.spherical.computeDistanceBetween(
      new google.maps.LatLng(previous),
      new google.maps.LatLng(current)
    );
    if (movedMeters >= MIN_HEADING_DISTANCE_METERS) {
      return google.maps.geometry.spherical.computeHeading(previous, current);
    }
  }

  return previousHeading;
}
