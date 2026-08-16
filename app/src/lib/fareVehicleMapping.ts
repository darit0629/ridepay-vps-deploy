import type { FareVehicleTypeId } from "../../api/fare-router";

// Legacy (vehicleType, segment) → new fare-config vehicle type mapping —
// duplicated from api/queries/fareVehicleConfig.ts's deriveFareVehicleId
// rather than imported, since that file sits behind api/'s server-only
// module chain (same reasoning as FareConfigContext.tsx's fallback data).
// Keep this in sync with that function if the mapping ever changes.
export type LegacyVehicleType =
  | "e-riksha" | "auto-rickshaw" | "car" | "bike"
  | "e-riksha-woman" | "e-riksha-parcel" | "bike-parcel" | "e-riksha-school";
export type LegacyRideSegment = "share" | "reserve" | "auto" | "parcel" | "school" | "women";

export function deriveFareVehicleId(vehicleType: LegacyVehicleType, segment: LegacyRideSegment): FareVehicleTypeId {
  if (vehicleType === "e-riksha") return segment === "reserve" ? "e-riksha-reserve" : "e-riksha-share";
  if (vehicleType === "auto-rickshaw") return "auto-rickshaw";
  if (vehicleType === "bike") return "bike-taxi";
  if (vehicleType === "car") return "car";
  if (vehicleType === "e-riksha-woman") return "e-riksha-women";
  if (vehicleType === "e-riksha-parcel") return "e-riksha-parcel";
  if (vehicleType === "bike-parcel") return "bike-parcel";
  return "e-riksha-school";
}
