import { eq, desc } from "drizzle-orm";
import { getDb } from "./connection";
import { sosAlerts } from "@db/schema";

function genId(): string {
  return `sos-${Date.now()}-${Math.round(Math.random() * 1000)}`;
}

export async function raiseSOS(input: {
  userId: number;
  role: "user" | "driver";
  subscriptionId?: string;
  lat?: number;
  lng?: number;
  note?: string;
}) {
  const id = genId();
  await getDb()
    .insert(sosAlerts)
    .values({
      id,
      userId: input.userId,
      role: input.role,
      subscriptionId: input.subscriptionId,
      lat: input.lat !== undefined ? String(input.lat) : undefined,
      lng: input.lng !== undefined ? String(input.lng) : undefined,
      note: input.note ?? "",
    });
  return (await getDb().query.sosAlerts.findFirst({ where: eq(sosAlerts.id, id) }))!;
}

export async function listOpenSOS() {
  return getDb().select().from(sosAlerts).where(eq(sosAlerts.status, "open")).orderBy(desc(sosAlerts.createdAt));
}

export async function resolveSOS(id: string) {
  await getDb().update(sosAlerts).set({ status: "resolved", resolvedAt: new Date() }).where(eq(sosAlerts.id, id));
  return getDb().query.sosAlerts.findFirst({ where: eq(sosAlerts.id, id) });
}

export async function listMySOS(userId: number) {
  return getDb().select().from(sosAlerts).where(eq(sosAlerts.userId, userId)).orderBy(desc(sosAlerts.createdAt));
}
