import { eq, sql } from "drizzle-orm";
import { getDb } from "./connection";
import { subscriptionPlans, users, type SubscriptionPlanRow } from "@db/schema";

export type PlanCategory = "Individual" | "Corporate";

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number | null;
  period: string;
  perks: string[];
  category: PlanCategory;
  active: boolean;
}

const DEFAULT_PLANS: (Omit<SubscriptionPlanRow, "price"> & { price: string | null })[] = [
  { id: "free", name: "Free", price: "0", period: "", perks: ["Standard ride matching", "Standard support"], category: "Individual", active: true },
  { id: "silver", name: "Silver", price: "99", period: "/month", perks: ["5% discount on every ride", "Priority booking", "No cancellation fee (limited)"], category: "Individual", active: true },
  { id: "gold", name: "Gold", price: "199", period: "/month", perks: ["10% discount on every ride", "Premium 24/7 support", "Priority driver matching", "Free ride insurance"], category: "Individual", active: true },
  { id: "corporate", name: "Corporate", price: null, period: "pricing", perks: ["Monthly consolidated invoices", "Employee travel management", "Usage reports & analytics", "Dedicated account manager"], category: "Corporate", active: true },
];

export async function seedSubscriptionPlansIfEmpty(): Promise<void> {
  const db = getDb();
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(subscriptionPlans);
  if (Number(count) > 0) return;
  await db.insert(subscriptionPlans).values(DEFAULT_PLANS);
}

function toView(row: SubscriptionPlanRow): SubscriptionPlan {
  return {
    id: row.id,
    name: row.name,
    price: row.price === null ? null : Number(row.price),
    period: row.period,
    perks: row.perks,
    category: row.category,
    active: row.active,
  };
}

export async function listPlans(): Promise<SubscriptionPlan[]> {
  const rows = await getDb().select().from(subscriptionPlans);
  return rows.map(toView);
}

export interface UpdatePlanInput {
  price?: number | null;
  period?: string;
  perks?: string[];
  category?: PlanCategory;
  active?: boolean;
}

export async function updatePlan(id: string, updates: UpdatePlanInput): Promise<SubscriptionPlan[]> {
  const db = getDb();
  const values: Partial<typeof subscriptionPlans.$inferInsert> = {};
  if (updates.price !== undefined) values.price = updates.price === null ? null : String(updates.price);
  if (updates.period !== undefined) values.period = updates.period;
  if (updates.perks !== undefined) values.perks = updates.perks;
  if (updates.category !== undefined) values.category = updates.category;
  if (updates.active !== undefined) values.active = updates.active;
  if (Object.keys(values).length > 0) {
    await db.update(subscriptionPlans).set(values).where(eq(subscriptionPlans.id, id));
  }
  return listPlans();
}

export async function getMyPlanId(userId: number): Promise<string> {
  const user = await getDb().query.users.findFirst({ where: eq(users.id, userId) });
  return user?.subscriptionPlanId ?? "free";
}

export async function setMyPlanId(userId: number, planId: string): Promise<void> {
  await getDb().update(users).set({ subscriptionPlanId: planId }).where(eq(users.id, userId));
}
