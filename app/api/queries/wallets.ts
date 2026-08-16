import { and, eq, gte, sql } from "drizzle-orm";
import { getDb } from "./connection";
import { wallets, walletTransactions, withdrawalRequests, type Wallet, type WalletTransactionRow, type WithdrawalRequestRow } from "@db/schema";

export type WalletType = "driver" | "company" | "fleet" | "referral" | "franchise" | "customer";

export type WalletTransactionType =
  | "commission_credit" | "bonus" | "incentive" | "penalty" | "adjustment" | "withdrawal"
  | "recharge" | "refund" | "cashback" | "promotional_credit" | "referral_credit" | "coupon_discount" | "debit"
  | "cancellation_fee" | "cancellation_compensation"
  | "subscription_payment"
  | "cash_commission_pending" | "cash_commission_cleared" | "withdrawal_reversal"
  | "festival_bonus" | "challenge_reward" | "peak_bonus";

export interface WalletView {
  walletType: WalletType;
  ownerId: string;
  availableBalance: number;
  pendingBalance: number;
  lifetimeEarnings: number;
  duesOwed: number;
  pendingCommission: number;
  frozen: boolean;
  frozenReason: string | null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function genId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 1000)}`;
}

function toView(row: Wallet): WalletView {
  return {
    walletType: row.walletType,
    ownerId: row.ownerId,
    availableBalance: Number(row.availableBalance),
    pendingBalance: Number(row.pendingBalance),
    lifetimeEarnings: Number(row.lifetimeEarnings),
    duesOwed: Number(row.duesOwed),
    pendingCommission: Number(row.pendingCommission),
    frozen: row.frozen,
    frozenReason: row.frozenReason,
  };
}

function walletWhere(walletType: WalletType, ownerId: string) {
  return and(eq(wallets.walletType, walletType), eq(wallets.ownerId, ownerId));
}

// Ensures a wallet row exists, then returns it — INSERT..ON DUPLICATE KEY is
// atomic (no separate exists-check + insert race like the in-memory Map
// version this replaced), then a follow-up SELECT reads whatever ended up there.
export async function getOrCreateWallet(walletType: WalletType, ownerId: string): Promise<WalletView> {
  const db = getDb();
  await db
    .insert(wallets)
    .values({ walletType, ownerId })
    .onDuplicateKeyUpdate({ set: { walletType: sql`${wallets.walletType}` } });
  const row = await db.query.wallets.findFirst({ where: walletWhere(walletType, ownerId) });
  return toView(row!);
}

async function insertTransaction(tx: {
  walletType: WalletType;
  ownerId: string;
  amount: number;
  type: WalletTransactionType;
  description: string;
  sourceRecordId?: string;
}) {
  await getDb().insert(walletTransactions).values({
    id: genId("txn"),
    walletType: tx.walletType,
    ownerId: tx.ownerId,
    amount: String(round2(tx.amount)),
    type: tx.type,
    description: tx.description,
    sourceRecordId: tx.sourceRecordId,
  });
}

// Called by commission-router.ts right after every completed ride/parcel is
// split — this is what turns a commission split into real wallet balances.
export async function creditWallet(
  walletType: WalletType,
  ownerId: string,
  amount: number,
  type: WalletTransactionType,
  description: string,
  sourceRecordId?: string
): Promise<void> {
  if (amount <= 0) return;
  const db = getDb();
  await getOrCreateWallet(walletType, ownerId);
  await db
    .update(wallets)
    .set({
      availableBalance: sql`${wallets.availableBalance} + ${amount}`,
      lifetimeEarnings: sql`${wallets.lifetimeEarnings} + ${amount}`,
    })
    .where(walletWhere(walletType, ownerId));
  await insertTransaction({ walletType, ownerId, amount, type, description, sourceRecordId });
}

// Server-validated spend — atomic conditional decrement (only succeeds if
// the balance actually covers it), so there's no read-then-write race
// between checking the balance and deducting it.
export async function debitWallet(
  walletType: WalletType,
  ownerId: string,
  amount: number,
  type: "debit" | "coupon_discount",
  description: string
): Promise<{ ok: true; wallet: WalletView } | { ok: false; error: string }> {
  const db = getDb();
  await getOrCreateWallet(walletType, ownerId);
  const [result] = await db
    .update(wallets)
    .set({ availableBalance: sql`${wallets.availableBalance} - ${amount}` })
    .where(and(walletWhere(walletType, ownerId), gte(wallets.availableBalance, String(amount))));
  if (result.affectedRows === 0) {
    return { ok: false, error: "Insufficient wallet balance" };
  }
  await insertTransaction({ walletType, ownerId, amount: -amount, type, description });
  const wallet = await getOrCreateWallet(walletType, ownerId);
  return { ok: true, wallet };
}

export async function adjustWallet(
  walletType: WalletType,
  ownerId: string,
  amount: number,
  type: "bonus" | "incentive" | "penalty" | "adjustment" | "festival_bonus" | "challenge_reward" | "peak_bonus",
  description: string
): Promise<WalletView> {
  const db = getDb();
  await getOrCreateWallet(walletType, ownerId);
  await db
    .update(wallets)
    .set({
      availableBalance: sql`${wallets.availableBalance} + ${amount}`,
      ...(amount > 0 ? { lifetimeEarnings: sql`${wallets.lifetimeEarnings} + ${amount}` } : {}),
    })
    .where(walletWhere(walletType, ownerId));
  await insertTransaction({ walletType, ownerId, amount, type, description });
  return getOrCreateWallet(walletType, ownerId);
}

// Called by referral-router.ts when referral bonuses are earned.
export async function creditReferralBonus(
  role: "rider" | "driver",
  ownerName: string,
  amount: number,
  description: string
): Promise<void> {
  await creditWallet(role === "driver" ? "driver" : "customer", ownerName, amount, "referral_credit", description);
}

// Shared wallet-first/defer-to-dues debit used by both cancellation-fee
// (rider) and cancellation-penalty (driver) collection: debits as much as
// the wallet's available balance covers, and anything left over is recorded
// as `duesOwed` — cleared either at the owner's next recharge (rider) or
// automatically at their next ride (both, see collectDuesFromBalance /
// clearDuesFromIncoming below).
async function debitWithDueDeferral(
  walletType: WalletType,
  ownerId: string,
  amount: number,
  type: WalletTransactionType,
  description: string
): Promise<{ debited: number; deferred: number; wallet: WalletView }> {
  const db = getDb();
  const wallet = await getOrCreateWallet(walletType, ownerId);
  const debited = round2(Math.min(amount, wallet.availableBalance));
  const deferred = round2(amount - debited);

  if (debited > 0) {
    await db
      .update(wallets)
      .set({ availableBalance: sql`${wallets.availableBalance} - ${debited}` })
      .where(walletWhere(walletType, ownerId));
    await insertTransaction({ walletType, ownerId, amount: -debited, type, description });
  }
  if (deferred > 0) {
    await db
      .update(wallets)
      .set({ duesOwed: sql`${wallets.duesOwed} + ${deferred}` })
      .where(walletWhere(walletType, ownerId));
  }
  const updated = await getOrCreateWallet(walletType, ownerId);
  return { debited, deferred, wallet: updated };
}

// Called by cancellation-router.ts to collect a rider's cancellation fee.
export async function chargeCancellationFee(
  ownerId: string,
  fee: number,
  description: string
): Promise<{ debited: number; deferred: number; wallet: WalletView }> {
  return debitWithDueDeferral("customer", ownerId, fee, "cancellation_fee", description);
}

// Called by ride-router.ts's driverCancel mutation to collect a driver's
// cancellation penalty — same wallet-first/defer policy as
// chargeCancellationFee, against the driver's wallet instead.
export async function chargeDriverCancellationPenalty(
  driverName: string,
  penalty: number,
  description: string
): Promise<{ debited: number; deferred: number; wallet: WalletView }> {
  return debitWithDueDeferral("driver", driverName, penalty, "penalty", description);
}

// Best-effort retry of an outstanding due against whatever balance the
// wallet already holds — called at the owner's next ride payment/earnings
// event so a due deferred while the wallet was empty gets collected as soon
// as there's balance to cover it.
export async function collectDuesFromBalance(
  walletType: WalletType,
  ownerId: string,
  description: string
): Promise<{ duesCleared: number }> {
  const db = getDb();
  const wallet = await getOrCreateWallet(walletType, ownerId);
  const duesCleared = round2(Math.min(wallet.duesOwed, wallet.availableBalance));
  if (duesCleared <= 0) return { duesCleared: 0 };
  await db
    .update(wallets)
    .set({
      availableBalance: sql`${wallets.availableBalance} - ${duesCleared}`,
      duesOwed: sql`${wallets.duesOwed} - ${duesCleared}`,
    })
    .where(walletWhere(walletType, ownerId));
  await insertTransaction({ walletType, ownerId, amount: -duesCleared, type: "cancellation_fee", description });
  return { duesCleared };
}

// Clears outstanding duesOwed off the top of an incoming credit (recharge,
// commission payout) before the remainder is applied — the "deducted from
// the next ride" half of the wallet-first/defer-to-next-ride policy;
// collectDuesFromBalance above is the wallet-first half.
async function clearDuesFromIncoming(
  walletType: WalletType,
  ownerId: string,
  incomingAmount: number,
  description: string
): Promise<{ duesCleared: number; remaining: number }> {
  const db = getDb();
  const wallet = await getOrCreateWallet(walletType, ownerId);
  if (wallet.duesOwed <= 0 || incomingAmount <= 0) return { duesCleared: 0, remaining: incomingAmount };
  const duesCleared = round2(Math.min(wallet.duesOwed, incomingAmount));
  await db
    .update(wallets)
    .set({ duesOwed: sql`${wallets.duesOwed} - ${duesCleared}` })
    .where(walletWhere(walletType, ownerId));
  await insertTransaction({ walletType, ownerId, amount: -duesCleared, type: "cancellation_fee", description });
  return { duesCleared, remaining: round2(incomingAmount - duesCleared) };
}

// Cash rides: the driver already physically holds the full fare, so the
// commission portion never becomes wallet balance — it accrues here as a
// liability instead. No availableBalance/lifetimeEarnings change, but a real
// (negative-styled) ledger row still records it so the driver sees exactly
// what they owe and why.
async function recordPendingCommission(driverName: string, amount: number, description: string, sourceRecordId?: string): Promise<void> {
  if (amount <= 0) return;
  const db = getDb();
  await getOrCreateWallet("driver", driverName);
  await db
    .update(wallets)
    .set({ pendingCommission: sql`${wallets.pendingCommission} + ${amount}` })
    .where(walletWhere("driver", driverName));
  await insertTransaction({ walletType: "driver", ownerId: driverName, amount: -amount, type: "cash_commission_pending", description, sourceRecordId });
}

// Clears outstanding pendingCommission off the top of an incoming online-ride
// credit before the remainder becomes spendable balance — same shape as
// clearDuesFromIncoming, kept as a separate running total since the wallet
// dashboard shows "Pending Commission (Cash Rides)" as its own stat.
async function clearPendingCommissionFromIncoming(
  driverName: string,
  incomingAmount: number,
  description: string
): Promise<{ cleared: number; remaining: number }> {
  const db = getDb();
  const wallet = await getOrCreateWallet("driver", driverName);
  if (wallet.pendingCommission <= 0 || incomingAmount <= 0) return { cleared: 0, remaining: incomingAmount };
  const cleared = round2(Math.min(wallet.pendingCommission, incomingAmount));
  await db
    .update(wallets)
    .set({ pendingCommission: sql`${wallets.pendingCommission} - ${cleared}` })
    .where(walletWhere("driver", driverName));
  await insertTransaction({ walletType: "driver", ownerId: driverName, amount: cleared, type: "cash_commission_cleared", description });
  return { cleared, remaining: round2(incomingAmount - cleared) };
}

// Admin controls — Freeze/Unfreeze Wallet (Finance Settings). A frozen wallet
// still accrues earnings normally; only withdrawals are blocked (checked in
// queries/payouts.ts).
export async function freezeWallet(walletType: WalletType, ownerId: string, reason: string): Promise<WalletView> {
  const db = getDb();
  await getOrCreateWallet(walletType, ownerId);
  await db.update(wallets).set({ frozen: true, frozenReason: reason }).where(walletWhere(walletType, ownerId));
  return getOrCreateWallet(walletType, ownerId);
}

export async function unfreezeWallet(walletType: WalletType, ownerId: string): Promise<WalletView> {
  const db = getDb();
  await db.update(wallets).set({ frozen: false, frozenReason: null }).where(walletWhere(walletType, ownerId));
  return getOrCreateWallet(walletType, ownerId);
}

// Reverses a transaction by inserting a real offsetting entry rather than
// editing/deleting the original — the ledger stays immutable and auditable
// (every row that ever existed still exists), while the wallet balance ends
// up exactly as if the original had never happened.
export async function reverseTransaction(
  transactionId: string,
  adminNote: string
): Promise<{ ok: true; wallet: WalletView } | { ok: false; error: string }> {
  const db = getDb();
  const original = await db.query.walletTransactions.findFirst({ where: eq(walletTransactions.id, transactionId) });
  if (!original) return { ok: false, error: "Transaction not found" };
  const existingReversal = await db.query.walletTransactions.findFirst({
    where: eq(walletTransactions.sourceRecordId, `reversal-of-${original.id}`),
  });
  if (existingReversal) return { ok: false, error: "This transaction has already been reversed" };

  const reversalAmount = -Number(original.amount);
  await getOrCreateWallet(original.walletType, original.ownerId);
  await db
    .update(wallets)
    .set({
      availableBalance: sql`${wallets.availableBalance} + ${reversalAmount}`,
      ...(reversalAmount > 0 ? { lifetimeEarnings: sql`${wallets.lifetimeEarnings} + ${reversalAmount}` } : {}),
    })
    .where(walletWhere(original.walletType, original.ownerId));
  await insertTransaction({
    walletType: original.walletType,
    ownerId: original.ownerId,
    amount: reversalAmount,
    type: "withdrawal_reversal",
    description: `Reversal of "${original.description}" — ${adminNote}`,
    sourceRecordId: `reversal-of-${original.id}`,
  });
  const wallet = await getOrCreateWallet(original.walletType, original.ownerId);
  return { ok: true, wallet };
}

// Called by cancellation-router.ts to pay a driver compensation for a
// cancellation that happened after they were already dispatched.
export async function creditCancellationCompensation(driverName: string, amount: number, description: string): Promise<void> {
  await creditWallet("driver", driverName, amount, "cancellation_compensation", description);
}

// Called by school-router.ts when a subscription payment is collected —
// pure platform revenue, credited straight to the company wallet.
export async function creditCompanyRevenue(amount: number, description: string, sourceRecordId?: string): Promise<void> {
  await creditWallet("company", "company", amount, "subscription_payment", description, sourceRecordId);
}

// Called by commission-router.ts right after every completed ride/parcel is
// split into driver/company/fleet/referral/franchise shares.
export async function creditWalletsFromCommission(record: {
  id: string;
  source: "ride" | "parcel";
  sourceId: string;
  driverName: string;
  paymentMethod: string;
  total: number;
  driverShare: number;
  companyNet: number;
  fleetOwnerShare: number;
  referralCommission: number;
  franchiseShare: number;
}): Promise<void> {
  const label = `${record.source === "ride" ? "Ride" : "Parcel"} #${record.sourceId}`;

  if (record.paymentMethod === "cash") {
    // The driver collected the full fare in cash already — crediting
    // driverShare on top would double-pay them. What they actually owe the
    // platform is everything that ISN'T their share (commission + every
    // secondary split), tracked as pendingCommission instead of touching
    // availableBalance at all.
    const commissionOwed = round2(record.total - record.driverShare);
    await recordPendingCommission(record.driverName, commissionOwed, `${label} — cash collected, commission owed`, record.id);
  } else {
    // Outstanding driver-cancellation-penalty dues, then any pending cash
    // commission, are cleared off the top of this ride's earnings before the
    // rest becomes spendable balance.
    const { duesCleared, remaining: afterDues } = await clearDuesFromIncoming(
      "driver",
      record.driverName,
      record.driverShare,
      `${label} — outstanding cancellation penalty cleared from driver share`
    );
    const { cleared: commissionCleared, remaining: driverShareAfterClears } = await clearPendingCommissionFromIncoming(
      record.driverName,
      afterDues,
      `${label} — outstanding cash-ride commission cleared from driver share`
    );
    await creditWallet("driver", record.driverName, driverShareAfterClears, "commission_credit", `${label} — driver share`, record.id);
    if (duesCleared > 0 || commissionCleared > 0) {
      await getDb()
        .update(wallets)
        .set({ lifetimeEarnings: sql`${wallets.lifetimeEarnings} + ${duesCleared + commissionCleared}` })
        .where(walletWhere("driver", record.driverName));
    }
  }

  await creditWallet("company", "company", record.companyNet, "commission_credit", `${label} — company net`, record.id);
  await creditWallet("fleet", "fleet", record.fleetOwnerShare, "commission_credit", `${label} — fleet owner share`, record.id);
  await creditWallet("referral", "referral", record.referralCommission, "commission_credit", `${label} — referral commission`, record.id);
  await creditWallet("franchise", "franchise", record.franchiseShare, "commission_credit", `${label} — franchise share`, record.id);
}

// Customer wallet recharge — Add Money credits a server-side balance.
export async function rechargeWallet(
  ownerId: string,
  amount: number,
  method: "upi" | "card" | "netbanking"
): Promise<WalletView> {
  const db = getDb();

  // Outstanding cancellation-fee dues are cleared off the top of a recharge
  // before any of it becomes spendable balance.
  const { remaining: creditedAmount } = await clearDuesFromIncoming(
    "customer",
    ownerId,
    amount,
    "Outstanding cancellation fee cleared from recharge"
  );

  await db
    .update(wallets)
    .set({
      availableBalance: sql`${wallets.availableBalance} + ${creditedAmount}`,
      lifetimeEarnings: sql`${wallets.lifetimeEarnings} + ${amount}`,
    })
    .where(walletWhere("customer", ownerId));
  await insertTransaction({ walletType: "customer", ownerId, amount, type: "recharge", description: `Added via ${method.toUpperCase()}` });

  return getOrCreateWallet("customer", ownerId);
}

// Refunds/cashback/promotional/referral credits into a customer wallet —
// same shape as adjustWallet but scoped to customer-specific transaction
// types so a driver adjustment can't accidentally be typed as one.
export async function creditCustomerWallet(
  ownerId: string,
  amount: number,
  type: "refund" | "cashback" | "promotional_credit" | "referral_credit",
  description: string
): Promise<WalletView> {
  await creditWallet("customer", ownerId, amount, type, description);
  return getOrCreateWallet("customer", ownerId);
}

export type WithdrawalStatus = "pending" | "approved" | "processing" | "completed" | "rejected" | "failed" | "cancelled";

export interface WithdrawalRequestView {
  id: string;
  walletType: WalletType;
  ownerId: string;
  amount: number;
  status: WithdrawalStatus;
  method: "bank" | "upi";
  payoutMode: "automatic" | "manual";
  failureReason: string | null;
  requestedAt: number;
  resolvedAt?: number;
}

export function toWithdrawalView(row: WithdrawalRequestRow): WithdrawalRequestView {
  return {
    id: row.id,
    walletType: row.walletType,
    ownerId: row.ownerId,
    amount: Number(row.amount),
    status: row.status,
    method: row.method,
    payoutMode: row.payoutMode,
    failureReason: row.failureReason,
    requestedAt: row.requestedAt.getTime(),
    resolvedAt: row.resolvedAt?.getTime(),
  };
}

// Low-level only — moves availableBalance to pendingBalance and inserts the
// request row. No KYC/frozen/limit validation here (that's
// queries/payouts.ts's job, since it needs driverProfiles + financeSettings,
// which this module deliberately doesn't know about). `status`/`processingStartedAt`
// are the caller's call: manual mode starts at "pending" (admin decides),
// automatic mode starts straight at "processing" (already past approval).
export async function requestWithdrawal(
  walletType: WalletType,
  ownerId: string,
  amount: number,
  method: "bank" | "upi",
  payoutMode: "automatic" | "manual"
): Promise<{ ok: true; request: WithdrawalRequestView } | { ok: false; error: string }> {
  const db = getDb();
  const [result] = await db
    .update(wallets)
    .set({
      availableBalance: sql`${wallets.availableBalance} - ${amount}`,
      pendingBalance: sql`${wallets.pendingBalance} + ${amount}`,
    })
    .where(and(walletWhere(walletType, ownerId), gte(wallets.availableBalance, String(amount))));
  if (result.affectedRows === 0) {
    return { ok: false, error: "Insufficient available balance" };
  }
  const id = genId("wd");
  const startsProcessing = payoutMode === "automatic";
  await db.insert(withdrawalRequests).values({
    id,
    walletType,
    ownerId,
    amount: String(amount),
    method,
    payoutMode,
    status: startsProcessing ? "processing" : "pending",
    processingStartedAt: startsProcessing ? new Date() : null,
  });
  const request = await db.query.withdrawalRequests.findFirst({ where: eq(withdrawalRequests.id, id) });
  return { ok: true, request: toWithdrawalView(request!) };
}

// Admin decision on a still-pending (manual-mode) request. Approve moves it
// to "processing" — money stays in pendingBalance, nothing is marked
// completed yet (real payout confirmation is what settleDuePayouts simulates
// arriving later). Reject refunds availableBalance immediately.
export async function resolveWithdrawal(
  id: string,
  approve: boolean
): Promise<{ ok: true; request: WithdrawalRequestView } | { ok: false; error: string }> {
  const db = getDb();
  const request = await db.query.withdrawalRequests.findFirst({ where: eq(withdrawalRequests.id, id) });
  if (!request || request.status !== "pending") {
    return { ok: false, error: "Request not found or already resolved" };
  }
  const amount = Number(request.amount);

  if (!approve) {
    await db
      .update(wallets)
      .set({
        pendingBalance: sql`${wallets.pendingBalance} - ${amount}`,
        availableBalance: sql`${wallets.availableBalance} + ${amount}`,
      })
      .where(walletWhere(request.walletType, request.ownerId));
  }

  await db
    .update(withdrawalRequests)
    .set(
      approve
        ? { status: "processing", processingStartedAt: new Date() }
        : { status: "rejected", resolvedAt: new Date() }
    )
    .where(eq(withdrawalRequests.id, id));

  const updated = await db.query.withdrawalRequests.findFirst({ where: eq(withdrawalRequests.id, id) });
  return { ok: true, request: toWithdrawalView(updated!) };
}

// Driver cancels their own still-pending (not yet approved) request.
export async function cancelWithdrawal(
  id: string,
  ownerId: string
): Promise<{ ok: true; request: WithdrawalRequestView } | { ok: false; error: string }> {
  const db = getDb();
  const request = await db.query.withdrawalRequests.findFirst({ where: eq(withdrawalRequests.id, id) });
  if (!request || request.ownerId !== ownerId) return { ok: false, error: "Request not found" };
  if (request.status !== "pending") return { ok: false, error: "Only a request still awaiting approval can be cancelled" };
  const amount = Number(request.amount);

  await db
    .update(wallets)
    .set({
      pendingBalance: sql`${wallets.pendingBalance} - ${amount}`,
      availableBalance: sql`${wallets.availableBalance} + ${amount}`,
    })
    .where(walletWhere(request.walletType, request.ownerId));
  await db.update(withdrawalRequests).set({ status: "cancelled", resolvedAt: new Date() }).where(eq(withdrawalRequests.id, id));

  const updated = await db.query.withdrawalRequests.findFirst({ where: eq(withdrawalRequests.id, id) });
  return { ok: true, request: toWithdrawalView(updated!) };
}

// Settles one "processing" request — completed removes the money from
// pendingBalance for good and writes the real withdrawal ledger row; failed
// restores it to availableBalance (money never actually left) and records
// why, so the driver can see the failure and retry. Never called directly
// by client-facing code — only from settleDuePayouts' lazy sweep below,
// standing in for "a webhook/API response confirming the payout finally
// arrived" per the spec's "never mark completed until confirmation" rule.
async function settlePayout(id: string, outcome: "completed" | "failed", failureReason?: string): Promise<void> {
  const db = getDb();
  const request = await db.query.withdrawalRequests.findFirst({ where: eq(withdrawalRequests.id, id) });
  if (!request || request.status !== "processing") return;
  const amount = Number(request.amount);

  await db
    .update(wallets)
    .set({
      pendingBalance: sql`${wallets.pendingBalance} - ${amount}`,
      ...(outcome === "failed" ? { availableBalance: sql`${wallets.availableBalance} + ${amount}` } : {}),
    })
    .where(walletWhere(request.walletType, request.ownerId));

  if (outcome === "completed") {
    await insertTransaction({
      walletType: request.walletType,
      ownerId: request.ownerId,
      amount: -amount,
      type: "withdrawal",
      description: `Withdrawal completed (${request.id})`,
    });
  }

  await db
    .update(withdrawalRequests)
    .set({
      status: outcome,
      resolvedAt: new Date(),
      failureReason: outcome === "failed" ? (failureReason ?? "Payout failed") : null,
    })
    .where(eq(withdrawalRequests.id, id));
}

const SIMULATED_FAILURE_REASONS = [
  "Bank server timeout — please retry",
  "Invalid IFSC code on file",
  "Receiving bank rejected the transfer",
  "Daily payout rail limit reached — retry later",
];

// Lazily resolves any "processing" request that's been sitting long enough
// to look like a real payout round-trip completed (4-12s) — called from
// listWithdrawalRequests/getWallet so it fires naturally on the polling this
// app already does everywhere, with no separate job scheduler needed. ~95%
// resolve to completed, matching a realistic real-world payout success rate.
const PROCESSING_SETTLE_DELAY_MS = 4000;
export async function settleDuePayouts(): Promise<void> {
  const db = getDb();
  const due = await db
    .select()
    .from(withdrawalRequests)
    .where(and(eq(withdrawalRequests.status, "processing"), sql`${withdrawalRequests.processingStartedAt} IS NOT NULL`));
  const now = Date.now();
  for (const row of due) {
    const startedAt = row.processingStartedAt!.getTime();
    if (now - startedAt < PROCESSING_SETTLE_DELAY_MS) continue;
    const succeeds = Math.random() < 0.95;
    if (succeeds) {
      await settlePayout(row.id, "completed");
    } else {
      const reason = SIMULATED_FAILURE_REASONS[Math.floor(Math.random() * SIMULATED_FAILURE_REASONS.length)];
      await settlePayout(row.id, "failed", reason);
    }
  }
}

// Admin retries a failed request — re-reserves the balance and puts it back
// into processing, same as a fresh automatic-mode request.
export async function retryPayout(id: string): Promise<{ ok: true; request: WithdrawalRequestView } | { ok: false; error: string }> {
  const db = getDb();
  const request = await db.query.withdrawalRequests.findFirst({ where: eq(withdrawalRequests.id, id) });
  if (!request || request.status !== "failed") return { ok: false, error: "Only a failed request can be retried" };
  const amount = Number(request.amount);

  const [result] = await db
    .update(wallets)
    .set({
      availableBalance: sql`${wallets.availableBalance} - ${amount}`,
      pendingBalance: sql`${wallets.pendingBalance} + ${amount}`,
    })
    .where(and(walletWhere(request.walletType, request.ownerId), gte(wallets.availableBalance, String(amount))));
  if (result.affectedRows === 0) return { ok: false, error: "Insufficient available balance to retry" };

  await db
    .update(withdrawalRequests)
    .set({ status: "processing", processingStartedAt: new Date(), failureReason: null, resolvedAt: null })
    .where(eq(withdrawalRequests.id, id));
  const updated = await db.query.withdrawalRequests.findFirst({ where: eq(withdrawalRequests.id, id) });
  return { ok: true, request: toWithdrawalView(updated!) };
}

export async function listWithdrawalRequests(filter: {
  walletType?: WalletType;
  ownerId?: string;
  status?: WithdrawalStatus;
}): Promise<WithdrawalRequestView[]> {
  await settleDuePayouts();
  const db = getDb();
  const conditions = [];
  if (filter.walletType) conditions.push(eq(withdrawalRequests.walletType, filter.walletType));
  if (filter.ownerId) conditions.push(eq(withdrawalRequests.ownerId, filter.ownerId));
  if (filter.status) conditions.push(eq(withdrawalRequests.status, filter.status));
  const rows = await db
    .select()
    .from(withdrawalRequests)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(sql`${withdrawalRequests.requestedAt} DESC`);
  return rows.map(toWithdrawalView);
}

export async function listTransactions(filter: {
  walletType?: WalletType;
  ownerId?: string;
  limit: number;
}): Promise<WalletTransactionRow[]> {
  const db = getDb();
  const conditions = [];
  if (filter.walletType) conditions.push(eq(walletTransactions.walletType, filter.walletType));
  if (filter.ownerId) conditions.push(eq(walletTransactions.ownerId, filter.ownerId));
  return db
    .select()
    .from(walletTransactions)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(sql`${walletTransactions.createdAt} DESC`)
    .limit(filter.limit);
}

export async function listWallets(filter: { walletType?: WalletType }): Promise<WalletView[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(wallets)
    .where(filter.walletType ? eq(wallets.walletType, filter.walletType) : undefined);
  return rows.map(toView);
}

export async function earningsSummaryFor(walletType: WalletType, ownerId: string) {
  const now = Date.now();
  const DAY = 86_400_000;
  const db = getDb();
  const relevant = await db
    .select()
    .from(walletTransactions)
    .where(and(eq(walletTransactions.walletType, walletType), eq(walletTransactions.ownerId, ownerId), sql`${walletTransactions.amount} > 0`));

  const sum = (sinceMs: number) =>
    round2(relevant.filter((t) => t.createdAt.getTime() >= now - sinceMs).reduce((s, t) => s + Number(t.amount), 0));

  return {
    daily: sum(DAY),
    weekly: sum(DAY * 7),
    monthly: sum(DAY * 30),
    yearly: sum(DAY * 365),
    lifetime: round2(relevant.reduce((s, t) => s + Number(t.amount), 0)),
  };
}
