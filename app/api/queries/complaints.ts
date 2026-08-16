import { eq, sql } from "drizzle-orm";
import { getDb } from "./connection";
import { appComplaints, complaintMessages, type AppComplaintRow, type ComplaintMessageRow } from "@db/schema";

export type ComplaintStatus = "Open" | "In Progress" | "Resolved" | "Closed";
export type ReporterType = "Customer" | "Driver";

export interface ComplaintMessage {
  sender: "admin" | "reporter";
  text: string;
  createdAt: number;
}

export interface Complaint {
  id: string;
  subject: string;
  description: string;
  reporterName: string;
  reporterPhone: string;
  reporterType: ReporterType;
  relatedRideId?: string;
  status: ComplaintStatus;
  createdAt: number;
}

function toView(row: AppComplaintRow): Complaint {
  return {
    id: row.id,
    subject: row.subject,
    description: row.description,
    reporterName: row.reporterName,
    reporterPhone: row.reporterPhone,
    reporterType: row.reporterType,
    relatedRideId: row.relatedRideId ?? undefined,
    status: row.status,
    createdAt: row.createdAt.getTime(),
  };
}

function toMessageView(row: ComplaintMessageRow): ComplaintMessage {
  return { sender: row.sender, text: row.text, createdAt: row.createdAt.getTime() };
}

export async function listComplaints(status?: ComplaintStatus): Promise<Complaint[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(appComplaints)
    .where(status ? eq(appComplaints.status, status) : undefined)
    .orderBy(sql`${appComplaints.createdAt} DESC`);
  return rows.map(toView);
}

export async function getComplaint(id: string): Promise<{ complaint: Complaint; messages: ComplaintMessage[] } | null> {
  const db = getDb();
  const row = await db.query.appComplaints.findFirst({ where: eq(appComplaints.id, id) });
  if (!row) return null;
  const messageRows = await db
    .select()
    .from(complaintMessages)
    .where(eq(complaintMessages.complaintId, id))
    .orderBy(complaintMessages.createdAt);
  return { complaint: toView(row), messages: messageRows.map(toMessageView) };
}

function genTicketId(): string {
  return `CMT${Math.floor(1000 + Math.random() * 9000)}`;
}

export async function createComplaint(input: {
  subject: string;
  description: string;
  reporterName: string;
  reporterPhone: string;
  reporterType: ReporterType;
  relatedRideId?: string;
}): Promise<Complaint> {
  const db = getDb();
  const id = genTicketId();
  await db.insert(appComplaints).values({ id, ...input });
  const row = await db.query.appComplaints.findFirst({ where: eq(appComplaints.id, id) });
  return toView(row!);
}

export async function updateComplaintStatus(id: string, status: ComplaintStatus): Promise<Complaint | null> {
  const db = getDb();
  await db.update(appComplaints).set({ status }).where(eq(appComplaints.id, id));
  const row = await db.query.appComplaints.findFirst({ where: eq(appComplaints.id, id) });
  return row ? toView(row) : null;
}

// Sending an admin message auto-advances a fresh ticket out of "Open" —
// same behavior the original mock-data UI had (first reply = acknowledged).
export async function addComplaintMessage(
  id: string,
  sender: "admin" | "reporter",
  text: string
): Promise<{ complaint: Complaint; messages: ComplaintMessage[] } | null> {
  const db = getDb();
  const existing = await db.query.appComplaints.findFirst({ where: eq(appComplaints.id, id) });
  if (!existing) return null;
  await db.insert(complaintMessages).values({ complaintId: id, sender, text });
  if (sender === "admin" && existing.status === "Open") {
    await db.update(appComplaints).set({ status: "In Progress" }).where(eq(appComplaints.id, id));
  }
  return getComplaint(id);
}
