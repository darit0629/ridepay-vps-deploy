import { and, eq } from "drizzle-orm";
import { getDb } from "./connection";
import { users, driverProfiles, withdrawalRequests } from "@db/schema";
import { getFinanceSettings } from "./financeSettings";
import { getOrCreateWallet, requestWithdrawal, type WithdrawalRequestView } from "./wallets";

// The validation-gated wrapper around wallets.ts's low-level requestWithdrawal
// — this is where the spec's "System validates: KYC Approved / Bank Verified
// / UPI Verified / Wallet Balance Available / No Frozen Account / No Pending
// Compliance Issues" checks actually live. Kept out of wallets.ts because it
// needs driverProfiles + financeSettings, which that module deliberately
// doesn't know about (wallets.ts stays a generic ledger for every wallet
// type, not just drivers).
export async function requestDriverWithdrawal(
  driverName: string,
  amount: number,
  method: "bank" | "upi"
): Promise<{ ok: true; request: WithdrawalRequestView } | { ok: false; error: string }> {
  const settings = await getFinanceSettings();

  if (amount < settings.minWithdrawal) return { ok: false, error: `Minimum withdrawal is ₹${settings.minWithdrawal}` };
  if (amount > settings.maxWithdrawal) return { ok: false, error: `Maximum withdrawal is ₹${settings.maxWithdrawal}` };

  const wallet = await getOrCreateWallet("driver", driverName);
  if (wallet.frozen) {
    return { ok: false, error: wallet.frozenReason ? `Wallet frozen: ${wallet.frozenReason}` : "Your wallet is frozen — contact support." };
  }
  if (wallet.availableBalance < amount) return { ok: false, error: "Insufficient available balance" };

  const db = getDb();
  const user = await db.query.users.findFirst({ where: eq(users.name, driverName) });
  const profile = user ? await db.query.driverProfiles.findFirst({ where: eq(driverProfiles.userId, user.id) }) : null;
  if (!profile || profile.status !== "approved") {
    return { ok: false, error: "Your driver account isn't approved yet — withdrawals open once onboarding is verified." };
  }
  if (method === "bank" && !profile.bankVerified) {
    return { ok: false, error: "Add and verify a bank account (Wallet → Bank Account) before withdrawing." };
  }
  if (method === "upi" && !profile.upiId) {
    return { ok: false, error: "Add a UPI ID (Wallet → UPI) before withdrawing." };
  }

  const allOpen = await db
    .select()
    .from(withdrawalRequests)
    .where(and(eq(withdrawalRequests.walletType, "driver"), eq(withdrawalRequests.ownerId, driverName)));
  const inFlight = allOpen.some((r) => r.status === "pending" || r.status === "processing");
  if (inFlight) {
    return { ok: false, error: "You already have a withdrawal in progress — wait for it to finish before requesting another." };
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todaysRequests = allOpen.filter((r) => r.requestedAt >= todayStart && r.status !== "cancelled" && r.status !== "rejected");
  if (todaysRequests.length >= settings.maxRequestsPerDay) {
    return { ok: false, error: `You've reached today's limit of ${settings.maxRequestsPerDay} withdrawal requests.` };
  }
  const todaysTotal = todaysRequests.reduce((sum, r) => sum + Number(r.amount), 0);
  if (todaysTotal + amount > settings.dailyWithdrawalLimit) {
    return { ok: false, error: `This would exceed today's ₹${settings.dailyWithdrawalLimit} withdrawal limit (₹${todaysTotal} already requested today).` };
  }

  const payoutMode = settings.automaticPayout && !settings.manualApprovalRequired ? "automatic" : "manual";
  return requestWithdrawal("driver", driverName, amount, method, payoutMode);
}
