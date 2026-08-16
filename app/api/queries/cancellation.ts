import { eq, and, gte, sql } from "drizzle-orm";
import { getDb } from "./connection";
import { cancellationConfig, cancellationRecords, type CancellationRecordRow } from "@db/schema";
import type { FareVehicleTypeId } from "./fareVehicleConfig";

export type VehicleTypeId =
  | "e-riksha" | "auto-rickshaw" | "car" | "bike"
  | "e-riksha-woman" | "e-riksha-parcel" | "bike-parcel" | "e-riksha-school";

// The old 8-value vehicleType enum column on cancellationRecords can't
// represent the new 10-type taxonomy (no "courier", no split share/reserve)
// — kept only for backward-compat display, populated via this best-effort
// reverse mapping. fareVehicleType (see insertCancellationRecord) is the
// real, authoritative field going forward.
export function toLegacyVehicleType(id: FareVehicleTypeId): VehicleTypeId {
  if (id === "e-riksha-reserve" || id === "e-riksha-share") return "e-riksha";
  if (id === "bike-taxi") return "bike";
  if (id === "e-riksha-women") return "e-riksha-woman";
  if (id === "courier") return "e-riksha-parcel";
  if (id === "auto-rickshaw" || id === "car" || id === "e-riksha-parcel" || id === "bike-parcel" || id === "e-riksha-school") return id;
  return "e-riksha";
}

// Only driverCompensationPercent remains in active use (compensates a
// driver when a rider's cancellation fee is collected) — freeCancellationWindowSec
// is superseded by the new per-vehicle-type passengerFreeCancellationMin
// (Cancellation Rules, api/queries/cancellationVehicleConfig.ts) and is no
// longer read anywhere, left as an orphaned field rather than risking a
// schema migration to remove it.
export interface CancellationConfig {
  freeCancellationWindowSec: number;
  driverCompensationPercent: number;
}

const CONFIG_ROW_ID = 1;

export async function getCancellationConfig(): Promise<CancellationConfig> {
  const db = getDb();
  await db
    .insert(cancellationConfig)
    .values({ id: CONFIG_ROW_ID })
    .onDuplicateKeyUpdate({ set: { id: sql`${cancellationConfig.id}` } });
  const row = await db.query.cancellationConfig.findFirst({ where: eq(cancellationConfig.id, CONFIG_ROW_ID) });
  return { freeCancellationWindowSec: row!.freeCancellationWindowSec, driverCompensationPercent: Number(row!.driverCompensationPercent) };
}

export async function updateCancellationConfig(config: CancellationConfig): Promise<CancellationConfig> {
  const db = getDb();
  await getCancellationConfig();
  await db
    .update(cancellationConfig)
    .set({ freeCancellationWindowSec: config.freeCancellationWindowSec, driverCompensationPercent: String(config.driverCompensationPercent) })
    .where(eq(cancellationConfig.id, CONFIG_ROW_ID));
  return getCancellationConfig();
}

export interface CancellationRecord {
  id: string;
  vehicleType: VehicleTypeId;
  fareVehicleType?: FareVehicleTypeId;
  stage: "searching" | "matched";
  initiator: "rider" | "driver";
  reason: string;
  riderName: string;
  driverName?: string;
  fareAmount: number;
  feeCharged: number;
  feeWaived: boolean;
  waiveReason?: string;
  driverCompensation: number;
  /** Money owed FROM the driver — only set on initiator="driver" records. */
  driverPenalty: number;
  createdAt: number;
}

function toRecord(row: CancellationRecordRow): CancellationRecord {
  return {
    id: row.id,
    vehicleType: row.vehicleType,
    fareVehicleType: (row.fareVehicleType as FareVehicleTypeId | null) ?? undefined,
    stage: row.stage,
    initiator: row.initiator,
    reason: row.reason,
    riderName: row.riderName,
    driverName: row.driverName ?? undefined,
    fareAmount: Number(row.fareAmount),
    feeCharged: Number(row.feeCharged),
    feeWaived: row.feeWaived,
    waiveReason: row.waiveReason ?? undefined,
    driverCompensation: Number(row.driverCompensation),
    driverPenalty: Number(row.driverPenalty),
    createdAt: row.createdAt.getTime(),
  };
}

export async function insertCancellationRecord(input: Omit<CancellationRecord, "id" | "createdAt" | "vehicleType"> & { fareVehicleType: FareVehicleTypeId }): Promise<CancellationRecord> {
  const db = getDb();
  const id = `cancel-${Date.now()}-${Math.round(Math.random() * 1000)}`;
  await db.insert(cancellationRecords).values({
    id,
    vehicleType: toLegacyVehicleType(input.fareVehicleType),
    fareVehicleType: input.fareVehicleType,
    stage: input.stage,
    initiator: input.initiator,
    reason: input.reason,
    riderName: input.riderName,
    driverName: input.driverName,
    fareAmount: String(input.fareAmount),
    feeCharged: String(input.feeCharged),
    feeWaived: input.feeWaived,
    waiveReason: input.waiveReason,
    driverCompensation: String(input.driverCompensation),
    driverPenalty: String(input.driverPenalty ?? 0),
  });
  const row = await db.query.cancellationRecords.findFirst({ where: eq(cancellationRecords.id, id) });
  return toRecord(row!);
}

export async function listCancellationRecords(filter: { riderName?: string; limit: number }): Promise<CancellationRecord[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(cancellationRecords)
    .where(filter.riderName ? eq(cancellationRecords.riderName, filter.riderName) : undefined)
    .orderBy(sql`${cancellationRecords.createdAt} DESC`)
    .limit(filter.limit);
  return rows.map(toRecord);
}

// Powers the Repeated Cancellation Policy (Section F) — how many 'matched'-
// stage cancellations this rider/driver has made within the last N hours,
// used both for the daily free-cancellation allowance and the temporary-
// restriction check at booking/accept time.
export async function countCancellationsSince(
  who: { riderName: string } | { driverName: string },
  sinceMs: number
): Promise<number> {
  const db = getDb();
  const nameCondition = "riderName" in who ? eq(cancellationRecords.riderName, who.riderName) : eq(cancellationRecords.driverName, who.driverName);
  const initiatorCondition = "riderName" in who ? eq(cancellationRecords.initiator, "rider") : eq(cancellationRecords.initiator, "driver");
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(cancellationRecords)
    .where(and(nameCondition, initiatorCondition, eq(cancellationRecords.stage, "matched"), gte(cancellationRecords.createdAt, new Date(sinceMs))));
  return Number(count);
}

function startOfTodayMs(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export async function countCancellationsToday(who: { riderName: string } | { driverName: string }): Promise<number> {
  return countCancellationsSince(who, startOfTodayMs());
}
