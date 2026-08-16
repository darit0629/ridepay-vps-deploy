import { eq } from "drizzle-orm";
import { getDb } from "./connection";
import { financeSettings } from "@db/schema";

export interface FinanceSettings {
  automaticPayout: boolean;
  automaticDailySettlement: boolean;
  automaticWeeklySettlement: boolean;
  minWithdrawal: number;
  maxWithdrawal: number;
  dailyWithdrawalLimit: number;
  maxRequestsPerDay: number;
  manualApprovalRequired: boolean;
  holidaySettlementPause: boolean;
}

const SETTINGS_ROW_ID = 1;

function toSettings(row: typeof financeSettings.$inferSelect): FinanceSettings {
  return {
    automaticPayout: row.automaticPayout,
    automaticDailySettlement: row.automaticDailySettlement,
    automaticWeeklySettlement: row.automaticWeeklySettlement,
    minWithdrawal: Number(row.minWithdrawal),
    maxWithdrawal: Number(row.maxWithdrawal),
    dailyWithdrawalLimit: Number(row.dailyWithdrawalLimit),
    maxRequestsPerDay: row.maxRequestsPerDay,
    manualApprovalRequired: row.manualApprovalRequired,
    holidaySettlementPause: row.holidaySettlementPause,
  };
}

// Ensures the singleton config row exists, then returns it — same pattern as
// commission-router's getCommissionConfig / cancellation's getCancellationConfig.
export async function getFinanceSettings(): Promise<FinanceSettings> {
  const db = getDb();
  await db
    .insert(financeSettings)
    .values({ id: SETTINGS_ROW_ID })
    .onDuplicateKeyUpdate({ set: { id: SETTINGS_ROW_ID } });
  const row = await db.query.financeSettings.findFirst({ where: eq(financeSettings.id, SETTINGS_ROW_ID) });
  return toSettings(row!);
}

export async function updateFinanceSettings(patch: Partial<FinanceSettings>): Promise<FinanceSettings> {
  const db = getDb();
  await getFinanceSettings();
  const values: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    values[key] = typeof value === "boolean" ? value : String(value);
  }
  await db.update(financeSettings).set(values).where(eq(financeSettings.id, SETTINGS_ROW_ID));
  return getFinanceSettings();
}
