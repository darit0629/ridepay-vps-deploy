import { and, eq, sql } from "drizzle-orm";
import { getDb } from "./connection";
import { referralConfig, referralMembers, referralRecords, type ReferralRecordRow } from "@db/schema";
import { creditReferralBonus } from "./wallets";

export type ReferralRole = "rider" | "driver";

/** Bonus pair for one referrer-role → referee-role combination. */
export interface ReferralBonusPair {
  referrerBonus: number;
  refereeBonus: number;
}

export interface ReferralConfig {
  enabled: boolean;
  payoutTrigger: "signup" | "first_ride";
  riderToRider: ReferralBonusPair;
  riderToDriver: ReferralBonusPair;
  driverToDriver: ReferralBonusPair;
  driverToRider: ReferralBonusPair;
}

const CONFIG_ROW_ID = 1;

function toConfig(row: typeof referralConfig.$inferSelect): ReferralConfig {
  return {
    enabled: row.enabled,
    payoutTrigger: row.payoutTrigger,
    riderToRider: { referrerBonus: Number(row.riderToRiderReferrer), refereeBonus: Number(row.riderToRiderReferee) },
    riderToDriver: { referrerBonus: Number(row.riderToDriverReferrer), refereeBonus: Number(row.riderToDriverReferee) },
    driverToDriver: { referrerBonus: Number(row.driverToDriverReferrer), refereeBonus: Number(row.driverToDriverReferee) },
    driverToRider: { referrerBonus: Number(row.driverToRiderReferrer), refereeBonus: Number(row.driverToRiderReferee) },
  };
}

export async function getReferralConfig(): Promise<ReferralConfig> {
  const db = getDb();
  await db
    .insert(referralConfig)
    .values({ id: CONFIG_ROW_ID })
    .onDuplicateKeyUpdate({ set: { id: sql`${referralConfig.id}` } });
  const row = await db.query.referralConfig.findFirst({ where: eq(referralConfig.id, CONFIG_ROW_ID) });
  return toConfig(row!);
}

export async function updateReferralConfig(config: ReferralConfig): Promise<ReferralConfig> {
  const db = getDb();
  await getReferralConfig();
  await db
    .update(referralConfig)
    .set({
      enabled: config.enabled,
      payoutTrigger: config.payoutTrigger,
      riderToRiderReferrer: String(config.riderToRider.referrerBonus),
      riderToRiderReferee: String(config.riderToRider.refereeBonus),
      riderToDriverReferrer: String(config.riderToDriver.referrerBonus),
      riderToDriverReferee: String(config.riderToDriver.refereeBonus),
      driverToDriverReferrer: String(config.driverToDriver.referrerBonus),
      driverToDriverReferee: String(config.driverToDriver.refereeBonus),
      driverToRiderReferrer: String(config.driverToRider.referrerBonus),
      driverToRiderReferee: String(config.driverToRider.refereeBonus),
    })
    .where(eq(referralConfig.id, CONFIG_ROW_ID));
  return getReferralConfig();
}

function bonusPairFor(config: ReferralConfig, referrerRole: ReferralRole, refereeRole: ReferralRole): ReferralBonusPair {
  if (referrerRole === "rider") return refereeRole === "rider" ? config.riderToRider : config.riderToDriver;
  return refereeRole === "driver" ? config.driverToDriver : config.driverToRider;
}

function generateCode(name: string, taken: Set<string>): string {
  const base = name.trim().split(/\s+/)[0].toUpperCase().replace(/[^A-Z]/g, "").slice(0, 8) || "RIDEPAY";
  let code = "";
  do {
    code = `${base}${Math.floor(100 + Math.random() * 900)}`;
  } while (taken.has(code));
  return code;
}

export interface ReferralMember {
  code: string;
  ownerUserId: number | null;
  ownerName: string;
  ownerRole: ReferralRole;
  shareCount: number;
}

export async function getOrCreateMember(userId: number, name: string, role: ReferralRole): Promise<ReferralMember> {
  const db = getDb();
  const existing = await db.query.referralMembers.findFirst({
    where: eq(referralMembers.ownerUserId, userId),
  });
  if (existing) return existing;

  const allCodes = await db.select({ code: referralMembers.code }).from(referralMembers);
  const code = generateCode(name, new Set(allCodes.map((c) => c.code)));
  await db.insert(referralMembers).values({ code, ownerUserId: userId, ownerName: name, ownerRole: role });
  return { code, ownerUserId: userId, ownerName: name, ownerRole: role, shareCount: 0 };
}

/** Fire-and-forget counter bumped whenever the rider taps a share button —
 *  makes the "Friends Invited" stat distinct from actual signups. */
export async function recordShare(userId: number, name: string, role: ReferralRole): Promise<void> {
  const db = getDb();
  await getOrCreateMember(userId, name, role);
  await db
    .update(referralMembers)
    .set({ shareCount: sql`${referralMembers.shareCount} + 1` })
    .where(eq(referralMembers.ownerUserId, userId));
}

export type ReferralStatus = "pending" | "completed";

export interface ReferralRecord {
  id: string;
  code: string;
  referrerName: string;
  referrerRole: ReferralRole;
  refereeName: string;
  refereeRole: ReferralRole;
  status: ReferralStatus;
  referrerBonus: number;
  refereeBonus: number;
  createdAt: number;
  completedAt?: number;
}

function toRecord(row: ReferralRecordRow): ReferralRecord {
  return {
    id: row.id,
    code: row.code,
    referrerName: row.referrerName,
    referrerRole: row.referrerRole,
    refereeName: row.refereeName,
    refereeRole: row.refereeRole,
    status: row.status,
    referrerBonus: Number(row.referrerBonus),
    refereeBonus: Number(row.refereeBonus),
    createdAt: row.createdAt.getTime(),
    completedAt: row.completedAt?.getTime(),
  };
}

/** Completes any pending referrals where `userId` is the referee — called by
 *  ride-router.ts when a ride payment actually settles, which is this
 *  prototype's "referee completed their first ride" moment. Pays the
 *  referrer their bonus. */
export async function completeReferralsFor(userId: number): Promise<void> {
  const db = getDb();
  const pending = await db.query.referralRecords.findMany({
    where: and(eq(referralRecords.status, "pending"), eq(referralRecords.refereeUserId, userId)),
  });
  for (const record of pending) {
    await db.update(referralRecords).set({ status: "completed", completedAt: new Date() }).where(eq(referralRecords.id, record.id));
    await creditReferralBonus(
      record.referrerRole,
      record.referrerName,
      Number(record.referrerBonus),
      `Referral bonus — ${record.refereeName} completed their first ride`
    );
  }
}

export async function myReferralCode(userId: number, name: string, role: ReferralRole) {
  const db = getDb();
  const member = await getOrCreateMember(userId, name, role);
  const mineRows = await db.query.referralRecords.findMany({
    where: eq(referralRecords.referrerUserId, userId),
  });
  const mine = mineRows.map(toRecord);
  const hasUsedReferral = !!(await db.query.referralRecords.findFirst({ where: eq(referralRecords.refereeUserId, userId) }));

  return {
    code: member.code,
    shareCount: member.shareCount,
    hasUsedReferral,
    stats: {
      driversInvited: mine.filter((r) => r.refereeRole === "driver").length,
      ridersInvited: mine.filter((r) => r.refereeRole === "rider").length,
      totalEarned: mine.filter((r) => r.status === "completed").reduce((s, r) => s + r.referrerBonus, 0),
    },
    history: mine,
  };
}

export async function applyReferralCode(input: {
  code: string;
  refereeUserId: number;
  refereeName: string;
  refereeRole: ReferralRole;
}): Promise<{ ok: true; record: ReferralRecord; message: string } | { ok: false; error: string }> {
  const db = getDb();
  const config = await getReferralConfig();
  if (!config.enabled) return { ok: false, error: "Referral program is currently disabled" };

  const code = input.code.toUpperCase();
  const member = await db.query.referralMembers.findFirst({ where: eq(referralMembers.code, code) });
  if (!member) return { ok: false, error: "Invalid referral code" };
  if (member.ownerUserId === input.refereeUserId) return { ok: false, error: "You can't use your own referral code" };

  const alreadyUsed = await db.query.referralRecords.findFirst({ where: eq(referralRecords.refereeUserId, input.refereeUserId) });
  if (alreadyUsed) return { ok: false, error: "This account has already used a referral code" };

  const pair = bonusPairFor(config, member.ownerRole, input.refereeRole);
  const payNow = config.payoutTrigger === "signup";
  const id = `ref-${Date.now()}-${Math.round(Math.random() * 1000)}`;
  const now = new Date();

  await db.insert(referralRecords).values({
    id,
    code,
    referrerUserId: member.ownerUserId,
    referrerName: member.ownerName,
    referrerRole: member.ownerRole,
    refereeUserId: input.refereeUserId,
    refereeName: input.refereeName,
    refereeRole: input.refereeRole,
    status: payNow ? "completed" : "pending",
    referrerBonus: String(pair.referrerBonus),
    refereeBonus: String(pair.refereeBonus),
    completedAt: payNow ? now : undefined,
  });

  await creditReferralBonus(input.refereeRole, input.refereeName, pair.refereeBonus, `Welcome bonus — joined with referral code ${code}`);
  if (payNow) {
    await creditReferralBonus(member.ownerRole, member.ownerName, pair.referrerBonus, `Referral bonus — ${input.refereeName} joined with your code`);
  }

  const row = await db.query.referralRecords.findFirst({ where: eq(referralRecords.id, id) });
  return {
    ok: true,
    record: toRecord(row!),
    message: payNow
      ? `₹${pair.refereeBonus} credited to your wallet — ${member.ownerName} earned ₹${pair.referrerBonus}!`
      : `₹${pair.refereeBonus} credited to your wallet — ${member.ownerName} earns ₹${pair.referrerBonus} after your first ride!`,
  };
}

export async function listReferralRecords(): Promise<ReferralRecord[]> {
  const rows = await getDb().select().from(referralRecords).orderBy(sql`${referralRecords.createdAt} DESC`);
  return rows.map(toRecord);
}

