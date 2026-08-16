export type PlanId = "free" | "silver" | "gold" | "corporate";
export type PlanCategory = "Individual" | "Corporate";

export interface SubscriptionPlan {
  id: PlanId;
  name: string;
  price: number | null; // null = "Custom" pricing (corporate)
  period: string;
  perks: string[];
  category: PlanCategory;
  active: boolean;
}

export const initialPlans: SubscriptionPlan[] = [
  { id: "free", name: "Free", price: 0, period: "", perks: ["Standard ride matching", "Standard support"], category: "Individual", active: true },
  { id: "silver", name: "Silver", price: 99, period: "/month", perks: ["5% discount on every ride", "Priority booking", "No cancellation fee (limited)"], category: "Individual", active: true },
  { id: "gold", name: "Gold", price: 199, period: "/month", perks: ["10% discount on every ride", "Premium 24/7 support", "Priority driver matching", "Free ride insurance"], category: "Individual", active: true },
  { id: "corporate", name: "Corporate", price: null, period: "pricing", perks: ["Monthly consolidated invoices", "Employee travel management", "Usage reports & analytics", "Dedicated account manager"], category: "Corporate", active: true },
];
