export interface ParcelCategory {
  id: string;
  label: string;
  emoji: string;
  fragileDefault: boolean;
}

export const PARCEL_CATEGORIES: ParcelCategory[] = [
  { id: "documents", label: "Documents", emoji: "📄", fragileDefault: false },
  { id: "food", label: "Food", emoji: "🍔", fragileDefault: false },
  { id: "medicine", label: "Medicine", emoji: "💊", fragileDefault: false },
  { id: "small-package", label: "Small Package", emoji: "📦", fragileDefault: false },
  { id: "gift", label: "Gift", emoji: "🎁", fragileDefault: true },
  { id: "shopping", label: "Shopping", emoji: "🛍", fragileDefault: false },
  { id: "electronics", label: "Electronics", emoji: "📱", fragileDefault: true },
  { id: "clothing", label: "Clothing", emoji: "👕", fragileDefault: false },
];

export interface ParcelEstimate {
  deliveryTimeMin: number;
  cost: number;
  availableRickshaws: number;
  distanceKm: number;
}

// Deterministic pseudo-availability so the UI doesn't flicker on every render
// (Math.random() must never run during render — see project lint rule).
function pseudoCount(seed: string, min: number, max: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return min + (hash % (max - min + 1));
}

export function estimateParcelDelivery(
  categoryId: string,
  weightKg: number,
  distanceKm: number,
  fragile: boolean,
  instant: boolean
): ParcelEstimate {
  const baseFare = 25;
  const perKg = 8;
  const perKm = 6;
  const fragileSurcharge = fragile ? 15 : 0;
  const cost = Math.round(baseFare + weightKg * perKg + distanceKm * perKm + fragileSurcharge);

  const baseMinutes = 12 + distanceKm * 2.2 + (fragile ? 8 : 0);
  const deliveryTimeMin = Math.round(instant ? baseMinutes : baseMinutes + 45);

  return {
    deliveryTimeMin,
    cost,
    availableRickshaws: pseudoCount(categoryId + distanceKm.toFixed(1), 3, 9),
    distanceKm: Math.round(distanceKm * 10) / 10,
  };
}

export type ParcelDeliveryStatus = "picked_up" | "on_route" | "nearby" | "delivered";

export const PARCEL_STATUS_FLOW: { id: ParcelDeliveryStatus; label: string }[] = [
  { id: "picked_up", label: "Parcel Picked Up" },
  { id: "on_route", label: "Driver On Route" },
  { id: "nearby", label: "Nearby" },
  { id: "delivered", label: "Delivered" },
];

export interface IncomingParcel {
  id: string;
  sender: string;
  category: string;
  driverName: string;
  driverPhone: string;
  vehicle: string;
  otp: string;
  status: ParcelDeliveryStatus;
  etaMin: number;
}

export const mockIncomingParcel: IncomingParcel = {
  id: "PCL-48213",
  sender: "Kalyani Multiplex Store",
  category: "Shopping",
  driverName: "Sohail Khan",
  driverPhone: "+91 87654 32109",
  vehicle: "Bajaj RE · WB 14 KL 9988",
  otp: "4821",
  status: "on_route",
  etaMin: 9,
};
