import { eq } from "drizzle-orm";
import { getDb } from "./connection";
import { parcelBookings, type ParcelBookingRow } from "@db/schema";

export type ParcelStage = "assigned" | "picked_up" | "arrived" | "delivered";
export type ParcelPaymentStatus = "unpaid" | "confirmed";
export type ParcelPayer = "sender" | "receiver";
export type ParcelPaymentMethod = "cash" | "upi" | "wallet";

export interface ParcelBooking {
  trackingId: string;
  deliveryPin: string;
  pickup: string;
  destination: string;
  pickupCoords: { lat: number; lng: number };
  destinationCoords: { lat: number; lng: number };
  category: string;
  weightKg: number;
  fragile: boolean;
  notes: string;
  cost: number;
  paidBy: ParcelPayer;
  stage: ParcelStage;
  paymentStatus: ParcelPaymentStatus;
  paymentMethod?: ParcelPaymentMethod;
  driverName: string;
  driverPhone: string;
  vehicle: string;
  createdAt: number;
  deliveredAt?: number;
}

function toView(row: ParcelBookingRow): ParcelBooking {
  return {
    trackingId: row.trackingId,
    deliveryPin: row.deliveryPin,
    pickup: row.pickup,
    destination: row.destination,
    pickupCoords: { lat: Number(row.pickupLat), lng: Number(row.pickupLng) },
    destinationCoords: { lat: Number(row.destinationLat), lng: Number(row.destinationLng) },
    category: row.category,
    weightKg: Number(row.weightKg),
    fragile: row.fragile,
    notes: row.notes,
    cost: Number(row.cost),
    paidBy: row.paidBy,
    stage: row.stage,
    paymentStatus: row.paymentStatus,
    paymentMethod: row.paymentMethod ?? undefined,
    driverName: row.driverName,
    driverPhone: row.driverPhone,
    vehicle: row.vehicle,
    createdAt: row.createdAt.getTime(),
    deliveredAt: row.deliveredAt?.getTime(),
  };
}

const TRACKING_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars (0/O, 1/I)
function generateTrackingId(): string {
  let code = "";
  for (let i = 0; i < 6; i++) code += TRACKING_CHARS[Math.floor(Math.random() * TRACKING_CHARS.length)];
  return `RPX-${code}`;
}
function generatePin(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export interface ParcelBookInput {
  pickup: string;
  destination: string;
  pickupCoords: { lat: number; lng: number };
  destinationCoords: { lat: number; lng: number };
  category: string;
  weightKg: number;
  fragile: boolean;
  notes: string;
  cost: number;
  paidBy: ParcelPayer;
}

export async function createParcelBooking(input: ParcelBookInput): Promise<ParcelBooking> {
  const db = getDb();
  const trackingId = generateTrackingId();
  await db.insert(parcelBookings).values({
    trackingId,
    deliveryPin: generatePin(),
    pickup: input.pickup,
    destination: input.destination,
    pickupLat: String(input.pickupCoords.lat),
    pickupLng: String(input.pickupCoords.lng),
    destinationLat: String(input.destinationCoords.lat),
    destinationLng: String(input.destinationCoords.lng),
    category: input.category,
    weightKg: String(input.weightKg),
    fragile: input.fragile,
    notes: input.notes,
    cost: String(input.cost),
    paidBy: input.paidBy,
    stage: "assigned",
    paymentStatus: "unpaid",
    driverName: "Sohail Khan",
    driverPhone: "+91 87654 32109",
    vehicle: "Bajaj RE · WB 14 KL 9988",
  });
  const row = await db.query.parcelBookings.findFirst({ where: eq(parcelBookings.trackingId, trackingId) });
  return toView(row!);
}

export async function getParcelByTrackingId(trackingId: string): Promise<ParcelBooking | null> {
  const row = await getDb().query.parcelBookings.findFirst({ where: eq(parcelBookings.trackingId, trackingId.trim().toUpperCase()) });
  return row ? toView(row) : null;
}

export async function advanceParcelStage(trackingId: string, stage: ParcelStage): Promise<ParcelBooking | null> {
  const db = getDb();
  const existing = await db.query.parcelBookings.findFirst({ where: eq(parcelBookings.trackingId, trackingId) });
  if (!existing) return null;
  await db.update(parcelBookings).set({ stage }).where(eq(parcelBookings.trackingId, trackingId));
  const row = await db.query.parcelBookings.findFirst({ where: eq(parcelBookings.trackingId, trackingId) });
  return toView(row!);
}

export async function confirmParcelDelivery(
  trackingId: string,
  pin: string
): Promise<{ ok: true; booking: ParcelBooking } | { ok: false; error: string }> {
  const db = getDb();
  const existing = await db.query.parcelBookings.findFirst({ where: eq(parcelBookings.trackingId, trackingId) });
  if (!existing) return { ok: false, error: "Tracking ID not found" };
  if (existing.stage !== "arrived") return { ok: false, error: "The courier hasn't arrived yet" };
  if (existing.deliveryPin !== pin) return { ok: false, error: "Incorrect delivery PIN" };
  await db.update(parcelBookings).set({ stage: "delivered", deliveredAt: new Date() }).where(eq(parcelBookings.trackingId, trackingId));
  const row = await db.query.parcelBookings.findFirst({ where: eq(parcelBookings.trackingId, trackingId) });
  return { ok: true, booking: toView(row!) };
}

export async function submitParcelPayment(trackingId: string, method: ParcelPaymentMethod): Promise<ParcelBooking | null> {
  const db = getDb();
  const existing = await db.query.parcelBookings.findFirst({ where: eq(parcelBookings.trackingId, trackingId) });
  if (!existing) return null;
  await db.update(parcelBookings).set({ paymentMethod: method, paymentStatus: "confirmed" }).where(eq(parcelBookings.trackingId, trackingId));
  const row = await db.query.parcelBookings.findFirst({ where: eq(parcelBookings.trackingId, trackingId) });
  return toView(row!);
}
