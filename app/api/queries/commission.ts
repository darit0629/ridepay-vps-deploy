import { eq, sql } from "drizzle-orm";
import { getDb } from "./connection";
import { commissionConfig, commissionRecords, type CommissionRecordRow } from "@db/schema";

// ---------------------------------------------------------------------------
// Commission configuration — every percentage an admin can tune. Modeled as:
// gateway/platform charges come off the top of the ride total first, the
// remainder splits into the driver's cut and everything else; every other
// named share (referral, fleet, franchise, partner, promo, cashback, tax,
// TDS, GST-on-commission, insurance, emergency fund, donation) is deducted
// from what's left AFTER the driver's cut, since those are platform-level
// distributions/costs, not the driver's concern. Whatever remains is the
// company's net retained revenue for that ride.
// ---------------------------------------------------------------------------
export interface CommissionConfig {
  driverSharePercent: number;
  paymentGatewayChargePercent: number;
  platformChargePercent: number;
  referralCommissionPercent: number;
  fleetOwnerSharePercent: number;
  franchiseSharePercent: number;
  partnerSharePercent: number;
  promoDiscountSharePercent: number;
  cashbackSharePercent: number;
  taxDeductionPercent: number;
  tdsPercent: number;
  gstOnCommissionPercent: number;
  insuranceFeePercent: number;
  emergencyFundPercent: number;
  donationEnabled: boolean;
  donationPercent: number;
}

const CONFIG_ROW_ID = 1;

function toConfig(row: typeof commissionConfig.$inferSelect): CommissionConfig {
  return {
    driverSharePercent: Number(row.driverSharePercent),
    paymentGatewayChargePercent: Number(row.paymentGatewayChargePercent),
    platformChargePercent: Number(row.platformChargePercent),
    referralCommissionPercent: Number(row.referralCommissionPercent),
    fleetOwnerSharePercent: Number(row.fleetOwnerSharePercent),
    franchiseSharePercent: Number(row.franchiseSharePercent),
    partnerSharePercent: Number(row.partnerSharePercent),
    promoDiscountSharePercent: Number(row.promoDiscountSharePercent),
    cashbackSharePercent: Number(row.cashbackSharePercent),
    taxDeductionPercent: Number(row.taxDeductionPercent),
    tdsPercent: Number(row.tdsPercent),
    gstOnCommissionPercent: Number(row.gstOnCommissionPercent),
    insuranceFeePercent: Number(row.insuranceFeePercent),
    emergencyFundPercent: Number(row.emergencyFundPercent),
    donationEnabled: row.donationEnabled,
    donationPercent: Number(row.donationPercent),
  };
}

// Ensures the singleton config row exists, then returns it.
export async function getCommissionConfig(): Promise<CommissionConfig> {
  const db = getDb();
  await db
    .insert(commissionConfig)
    .values({ id: CONFIG_ROW_ID })
    .onDuplicateKeyUpdate({ set: { id: sql`${commissionConfig.id}` } });
  const row = await db.query.commissionConfig.findFirst({ where: eq(commissionConfig.id, CONFIG_ROW_ID) });
  return toConfig(row!);
}

export async function updateCommissionConfig(patch: Partial<CommissionConfig>): Promise<CommissionConfig> {
  const db = getDb();
  await getCommissionConfig();
  const values: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    values[key] = typeof value === "boolean" ? value : String(value);
  }
  await db.update(commissionConfig).set(values).where(eq(commissionConfig.id, CONFIG_ROW_ID));
  return getCommissionConfig();
}

export interface CommissionSplit {
  total: number;
  paymentGatewayCharge: number;
  platformCharge: number;
  driverShare: number;
  referralCommission: number;
  fleetOwnerShare: number;
  franchiseShare: number;
  partnerShare: number;
  promoDiscountShare: number;
  cashbackShare: number;
  taxDeduction: number;
  tds: number;
  gstOnCommission: number;
  insuranceFee: number;
  emergencyFund: number;
  donation: number;
  companyNet: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// `vehicleCommission` is the per-vehicle-type platform-commission-vs-driver-
// earnings split computed by computeVehicleCommission() (Commission
// Settings, api/queries/commissionVehicleConfig.ts) — it now determines
// platformCharge/driverShare directly, replacing the old global
// driverSharePercent/platformChargePercent (still present as dead columns
// on `commissionConfig`, unused here — see project_commission_settings_redesign
// memory). paymentGatewayChargePercent stays a platform-side cost (deducted
// from the platform's own commission, not the driver's earnings — matches
// the redesigned page's literal "Driver Earnings = Ride Fare − Platform
// Commission" rule), and every other named share (referral, fleet,
// franchise, partner, promo, cashback, tax, TDS, GST-on-commission,
// insurance, emergency fund, donation) still divides what's left of the
// platform's own commission after that, exactly as before — just measured
// against the vehicle-driven platformCharge instead of the old percent-of-
// total figure.
export function splitCommission(
  total: number,
  c: CommissionConfig,
  vehicleCommission: { platformCommission: number; driverEarnings: number }
): CommissionSplit {
  const paymentGatewayCharge = round2(total * (c.paymentGatewayChargePercent / 100));
  const platformCharge = vehicleCommission.platformCommission;
  const driverShare = vehicleCommission.driverEarnings;

  const remainderForCompany = platformCharge - paymentGatewayCharge;

  const referralCommission = round2(remainderForCompany * (c.referralCommissionPercent / 100));
  const fleetOwnerShare = round2(remainderForCompany * (c.fleetOwnerSharePercent / 100));
  const franchiseShare = round2(remainderForCompany * (c.franchiseSharePercent / 100));
  const partnerShare = round2(remainderForCompany * (c.partnerSharePercent / 100));
  const promoDiscountShare = round2(remainderForCompany * (c.promoDiscountSharePercent / 100));
  const cashbackShare = round2(remainderForCompany * (c.cashbackSharePercent / 100));
  const taxDeduction = round2(remainderForCompany * (c.taxDeductionPercent / 100));
  const tds = round2(remainderForCompany * (c.tdsPercent / 100));
  const gstOnCommission = round2(remainderForCompany * (c.gstOnCommissionPercent / 100));
  const insuranceFee = round2(remainderForCompany * (c.insuranceFeePercent / 100));
  const emergencyFund = round2(remainderForCompany * (c.emergencyFundPercent / 100));
  const donation = c.donationEnabled ? round2(remainderForCompany * (c.donationPercent / 100)) : 0;

  const secondaryDeductions =
    referralCommission + fleetOwnerShare + franchiseShare + partnerShare + promoDiscountShare +
    cashbackShare + taxDeduction + tds + gstOnCommission + insuranceFee + emergencyFund + donation;
  const companyNet = round2(remainderForCompany - secondaryDeductions);

  return {
    total,
    paymentGatewayCharge,
    platformCharge,
    driverShare,
    referralCommission,
    fleetOwnerShare,
    franchiseShare,
    partnerShare,
    promoDiscountShare,
    cashbackShare,
    taxDeduction,
    tds,
    gstOnCommission,
    insuranceFee,
    emergencyFund,
    donation,
    companyNet,
  };
}

export interface CommissionRecord extends CommissionSplit {
  id: string;
  source: "ride" | "parcel";
  sourceId: string;
  driverName: string;
  paymentMethod: string;
  createdAt: number;
}

function toRecord(row: CommissionRecordRow): CommissionRecord {
  return {
    id: row.id,
    source: row.source,
    sourceId: row.sourceId,
    driverName: row.driverName,
    paymentMethod: row.paymentMethod,
    createdAt: row.createdAt.getTime(),
    total: Number(row.total),
    paymentGatewayCharge: Number(row.paymentGatewayCharge),
    platformCharge: Number(row.platformCharge),
    driverShare: Number(row.driverShare),
    referralCommission: Number(row.referralCommission),
    fleetOwnerShare: Number(row.fleetOwnerShare),
    franchiseShare: Number(row.franchiseShare),
    partnerShare: Number(row.partnerShare),
    promoDiscountShare: Number(row.promoDiscountShare),
    cashbackShare: Number(row.cashbackShare),
    taxDeduction: Number(row.taxDeduction),
    tds: Number(row.tds),
    gstOnCommission: Number(row.gstOnCommission),
    insuranceFee: Number(row.insuranceFee),
    emergencyFund: Number(row.emergencyFund),
    donation: Number(row.donation),
    companyNet: Number(row.companyNet),
  };
}

export async function insertCommissionRecord(input: {
  source: "ride" | "parcel";
  sourceId: string;
  driverName: string;
  paymentMethod: string;
  split: CommissionSplit;
}): Promise<CommissionRecord> {
  const db = getDb();
  const id = `comm-${Date.now()}-${Math.round(Math.random() * 1000)}`;
  await db.insert(commissionRecords).values({
    id,
    source: input.source,
    sourceId: input.sourceId,
    driverName: input.driverName,
    paymentMethod: input.paymentMethod,
    total: String(input.split.total),
    paymentGatewayCharge: String(input.split.paymentGatewayCharge),
    platformCharge: String(input.split.platformCharge),
    driverShare: String(input.split.driverShare),
    referralCommission: String(input.split.referralCommission),
    fleetOwnerShare: String(input.split.fleetOwnerShare),
    franchiseShare: String(input.split.franchiseShare),
    partnerShare: String(input.split.partnerShare),
    promoDiscountShare: String(input.split.promoDiscountShare),
    cashbackShare: String(input.split.cashbackShare),
    taxDeduction: String(input.split.taxDeduction),
    tds: String(input.split.tds),
    gstOnCommission: String(input.split.gstOnCommission),
    insuranceFee: String(input.split.insuranceFee),
    emergencyFund: String(input.split.emergencyFund),
    donation: String(input.split.donation),
    companyNet: String(input.split.companyNet),
  });
  const row = await db.query.commissionRecords.findFirst({ where: eq(commissionRecords.id, id) });
  return toRecord(row!);
}

export async function listCommissionRecords(limit: number): Promise<CommissionRecord[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(commissionRecords)
    .orderBy(sql`${commissionRecords.createdAt} DESC`)
    .limit(limit);
  return rows.map(toRecord);
}
